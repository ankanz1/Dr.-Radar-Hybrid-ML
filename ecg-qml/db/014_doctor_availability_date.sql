-- =============================================================================
-- Dr. Radar Migration 014: dated availability + hard slot exclusivity
-- =============================================================================
-- Sequential follow-up to 013 (013 is left untouched: it may already be applied
-- in some environments, so this file is written to be correct whether or not
-- 013 has run).
--
-- Problem being fixed (doctor availability + patient booking flow):
--   1. doctors.slots is a bare list of "HH:MM" labels with no date, while the
--      patient booking flow always books TOMORROW (ConnectDoctorScreen uses
--      tomorrowDate()). A doctor who publishes for any other day would
--      silently expose slots that patients would book for the wrong date.
--      -> doctors.availability_date (nullable DATE column, NOT a new table)
--         records which calendar day the published slot list applies to.
--
--   2. Booked slots were not reliably hidden from the directory, and
--      request_appointment()'s exclusivity check in 013 was wrapped in a
--      BEGIN/EXCEPTION WHEN OTHERS block, so its own RAISE EXCEPTION was
--      swallowed by its own handler (v_slot_taken := false) — double booking
--      was never actually rejected. -> request_appointment is re-created with
--      a plain, non-swallowed check plus pg_advisory_xact_lock() so two
--      concurrent bookings of the same doctor/date/slot serialize instead of
--      both passing the EXISTS check (race window).
--
--   3. Slot timestamps are now anchored EXPLICITLY at UTC wall clock
--      (…::timestamp AT TIME ZONE 'UTC') instead of relying on the session
--      TimeZone, matching the extraction already used for booked_slots
--      (start_time AT TIME ZONE 'UTC'). The label format stays exactly the
--      existing one: 24-hour "HH:MM".
--
-- Security model — NOTHING weakened:
--   - RLS stays ENABLED on every table; no policy is created, altered or
--     dropped anywhere in this file.
--   - publish_doctor_slots still writes ONLY the caller's own doctors row
--     (doctors.user_id = auth.uid()); it additionally validates the date
--     (never in the past) and stores availability_date alongside slots.
--   - list_doctor_directory still exposes ONLY public directory columns;
--     availability_date and booked_slots contain no patient identity.
--   - request_appointment still validates: caller's own patient row, doctor
--     exists, slot is one of the doctor's stored slots, valid consultation
--     type, non-past date, AND (new) the requested date equals the doctor's
--     published availability_date (skipped for legacy rows where it is NULL),
--     AND the slot is not already taken by a 'scheduled' appointment.
--   - No service role, no secrets, search_path pinned. Idempotent.
-- Run in the Supabase SQL editor as postgres/owner (AFTER 011; 013 optional).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. doctors.availability_date — which day the published slot list applies to
-- -----------------------------------------------------------------------------
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS availability_date date;

COMMENT ON COLUMN public.doctors.availability_date IS
    'Calendar day (YYYY-MM-DD) the published doctors.slots labels apply to. NULL = legacy/undated slot list (valid for any day). Set only through publish_doctor_slots().';

-- -----------------------------------------------------------------------------
-- 2. publish_doctor_slots(): validated write to the caller's own doctors row
--    Signature changed (adds p_on_date) -> DROP the 013 overload first so the
--    function name resolves to exactly one version.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.publish_doctor_slots(jsonb, boolean);

CREATE FUNCTION public.publish_doctor_slots(
    p_slots jsonb,
    p_on_date date DEFAULT NULL,
    p_is_available_today boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_doctor_id uuid;
    v_clean jsonb := '[]'::jsonb;
    v_label text;
    v_next timestamptz;
    v_earliest text;
    v_target date;
BEGIN
    -- Default to tomorrow when no date is supplied (the patient flow books
    -- tomorrow), and never accept a date in the past.
    v_target := COALESCE(p_on_date, (CURRENT_DATE + 1));
    IF v_target < CURRENT_DATE THEN
        RAISE EXCEPTION 'The availability date cannot be in the past.';
    END IF;

    -- The caller's OWN doctor row (never a client-supplied id)
    SELECT id INTO v_doctor_id
    FROM public.doctors
    WHERE user_id = auth.uid()
    LIMIT 1;
    IF v_doctor_id IS NULL THEN
        RAISE EXCEPTION 'No doctor profile is linked to this account.';
    END IF;

    -- p_slots must be a JSON array of "HH:MM" 24-hour labels (00:00-23:59).
    IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
        RAISE EXCEPTION 'slots must be a JSON array of HH:MM strings.';
    END IF;

    FOR v_label IN SELECT jsonb_array_elements_text(p_slots) LOOP
        v_label := btrim(v_label);
        -- Strict HH:MM 24-hour validation
        IF v_label !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'Invalid slot label "%": use 24-hour HH:MM (e.g. 09:30).', v_label;
        END IF;
        IF NOT (v_clean @> to_jsonb(v_label)) THEN
            v_clean := v_clean || to_jsonb(v_label);
        END IF;
    END LOOP;

    SELECT min(labels.label) INTO v_earliest
    FROM jsonb_array_elements_text(v_clean) AS labels(label);

    -- next_available = the earliest published slot on the chosen day, anchored
    -- at UTC wall clock (the same convention request_appointment uses when it
    -- stores start_time). NULL when every slot on that day has already passed.
    IF v_earliest IS NOT NULL THEN
        v_next := (v_target::text || ' ' || v_earliest)::timestamp AT TIME ZONE 'UTC';
        IF v_next <= now() THEN
            v_next := NULL;
        END IF;
    END IF;

    UPDATE public.doctors
    SET slots = v_clean,
        availability_date = CASE WHEN jsonb_array_length(v_clean) = 0 THEN NULL ELSE v_target END,
        is_available_today = COALESCE(
            p_is_available_today,
            jsonb_array_length(v_clean) > 0 AND v_target = CURRENT_DATE
        ),
        next_available = v_next,
        updated_at = now()
    WHERE id = v_doctor_id;

    RETURN v_clean;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_doctor_slots(jsonb, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_doctor_slots(jsonb, date, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. list_doctor_directory(): public columns + availability_date + booked_slots
--    (booked_slots now scoped to the doctor's published day when it is known).
--    Return type changed -> must DROP, then re-CREATE.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_doctor_directory();

CREATE FUNCTION public.list_doctor_directory()
RETURNS TABLE (
    doctor_id uuid,
    user_id uuid,
    display_name text,
    title text,
    specialty text,
    hospital text,
    about text,
    rating double precision,
    experience_years integer,
    is_available_today boolean,
    next_available timestamptz,
    slots jsonb,
    availability_date date,
    booked_slots jsonb,
    avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 50
ROWS 500
AS $$
    SELECT
        d.id,
        d.user_id,
        u.display_name,
        d.title,
        d.specialty,
        d.hospital,
        d.about,
        d.rating,
        d.experience_years,
        d.is_available_today,
        d.next_available,
        d.slots,
        d.availability_date,
        -- Taken HH:MM labels for this doctor, as UTC wall clock (the same
        -- convention request_appointment uses when it anchors a slot label on
        -- a date). Scoped to the published day when it is known, otherwise to
        -- every future scheduled booking (legacy undated rows). No patient
        -- identity is exposed.
        COALESCE((
            SELECT jsonb_agg(
                DISTINCT to_char(a.start_time AT TIME ZONE 'UTC', 'HH24:MI')
                ORDER BY to_char(a.start_time AT TIME ZONE 'UTC', 'HH24:MI')
            )
            FROM public.appointments a
            WHERE a.doctor_id = d.id
              AND a.status = 'scheduled'
              AND a.start_time >= now()
              AND (
                    d.availability_date IS NULL
                    OR (a.start_time AT TIME ZONE 'UTC')::date = d.availability_date
              )
        ), '[]'::jsonb) AS booked_slots,
        d.avatar_url
    FROM public.doctors d
    JOIN public.users u ON u.id = d.user_id
    ORDER BY d.is_available_today DESC, d.rating DESC
$$;

REVOKE ALL ON FUNCTION public.list_doctor_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_doctor_directory() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. request_appointment(): same signature, hardened exclusivity + date match
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_appointment(
    p_doctor_id uuid,
    p_slot text,
    p_consultation_type text,
    p_reason text,
    p_on_date date
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id uuid;
    v_doctor_exists boolean;
    v_slot_valid boolean;
    v_start timestamptz;
    v_end timestamptz;
    v_appointment_id uuid;
    v_slot_taken boolean;
    v_availability_date date;
    v_slot_label text;
    v_is_hhmm boolean;
BEGIN
    -- Basic argument sanity
    IF p_doctor_id IS NULL OR p_slot IS NULL OR p_on_date IS NULL THEN
        RAISE EXCEPTION 'Missing doctor, slot, or date.';
    END IF;
    IF p_consultation_type IS NULL
       OR p_consultation_type NOT IN ('in_person', 'telehealth', 'follow_up') THEN
        RAISE EXCEPTION 'Consultation type must be in_person, telehealth, or follow_up.';
    END IF;
    IF p_reason IS NOT NULL AND length(btrim(p_reason)) > 500 THEN
        RAISE EXCEPTION 'Reason must be 500 characters or fewer.';
    END IF;
    IF p_on_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'The appointment date cannot be in the past.';
    END IF;

    v_slot_label := btrim(p_slot);
    v_is_hhmm := v_slot_label ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

    -- Serialize concurrent bookings of the same doctor/date/slot. The
    -- transaction-level advisory lock is released automatically at commit or
    -- rollback, so two patients racing for "10:00" take turns: the second one
    -- re-reads appointments AFTER the first commits and is rejected by the
    -- exclusivity check below. (Key is derived only from public booking
    -- coordinates — doctor id, date, label — no patient data.)
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'request_appointment:' || p_doctor_id::text || ':' || p_on_date::text || ':' || v_slot_label,
            0
        )
    );

    -- The caller's OWN patient row (RLS-equivalent check; never a client-supplied id)
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE user_id = auth.uid()
    LIMIT 1;
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'No patient profile is linked to this account.';
    END IF;

    -- The doctor must exist
    SELECT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = p_doctor_id)
    INTO v_doctor_exists;
    IF NOT v_doctor_exists THEN
        RAISE EXCEPTION 'This doctor is not available.';
    END IF;

    -- The requested day must be the doctor's published availability day.
    -- Legacy rows (availability_date IS NULL) stay valid for any day.
    SELECT d.availability_date INTO v_availability_date
    FROM public.doctors d
    WHERE d.id = p_doctor_id;
    IF v_availability_date IS NOT NULL AND v_availability_date <> p_on_date THEN
        RAISE EXCEPTION 'This doctor has not published availability for that date (published: %). Please pick another day.', v_availability_date;
    END IF;

    -- The slot must be one of the doctor's stored slots (no invented availability)
    SELECT EXISTS (
        SELECT 1
        FROM public.doctors d
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.slots, '[]'::jsonb)) AS s(slot)
        WHERE d.id = p_doctor_id
          AND btrim(s.slot) = v_slot_label
    )
    INTO v_slot_valid;
    IF NOT v_slot_valid THEN
        RAISE EXCEPTION 'The selected time slot is not offered by this doctor.';
    END IF;

    -- Slot exclusivity: reject when a 'scheduled' appointment already occupies
    -- this doctor's day+time. The check is deliberately NOT wrapped in an
    -- EXCEPTION block so the rejection cannot swallow itself (013 bug). Only
    -- labels that parse as HH:MM can be compared; anything else keeps the
    -- legacy behavior.
    IF v_is_hhmm THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.appointments a
            WHERE a.doctor_id = p_doctor_id
              AND a.status = 'scheduled'
              AND (a.start_time AT TIME ZONE 'UTC')::date = p_on_date
              AND (a.start_time AT TIME ZONE 'UTC')::time = v_slot_label::time
        )
        INTO v_slot_taken;
        IF v_slot_taken THEN
            RAISE EXCEPTION 'That time slot has already been booked. Please choose another.';
        END IF;
    END IF;

    -- Build start/end timestamps. The label is anchored as UTC wall clock on
    -- the requested date (independent of the session TimeZone) so the stored
    -- start_time round-trips to the same HH:MM label the doctor published.
    IF v_is_hhmm THEN
        v_start := (p_on_date::text || ' ' || v_slot_label)::timestamp AT TIME ZONE 'UTC';
    ELSE
        v_start := p_on_date::timestamp AT TIME ZONE 'UTC';
    END IF;
    v_end := v_start + interval '30 minutes';

    INSERT INTO public.appointments (
        patient_id,
        doctor_id,
        start_time,
        end_time,
        status,
        consultation_type,
        reason
    ) VALUES (
        v_patient_id,
        p_doctor_id,
        v_start,
        v_end,
        'scheduled',
        p_consultation_type,
        CASE
            WHEN p_reason IS NOT NULL AND length(btrim(p_reason)) > 0
            THEN btrim(p_reason)
            ELSE NULL
        END
    )
    RETURNING id INTO v_appointment_id;

    RETURN v_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_appointment(uuid, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_appointment(uuid, text, text, text, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Verification inventory (run in SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'availability_date';
--
-- SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('list_doctor_directory', 'request_appointment', 'publish_doctor_slots');
--
-- -- As the demo doctor (authenticated): publish tomorrow's 10:00 slot
-- SELECT public.publish_doctor_slots('["10:00"]'::jsonb, (CURRENT_DATE + 1));
--
-- -- As the demo patient: directory shows the slot, then it books it
-- SELECT display_name, slots, availability_date, booked_slots FROM public.list_doctor_directory();
-- SELECT public.request_appointment('<doctor-id>', '10:00', 'telehealth', NULL, (CURRENT_DATE + 1));
-- -- Second attempt must fail: 'That time slot has already been booked.'
--
-- =============================================================================
-- Summary
-- =============================================================================
-- - doctors.availability_date records WHICH day the published HH:MM slots are
--   for; publishing defaults to tomorrow and never accepts a past date.
-- - Directory exposes availability_date + date-scoped booked_slots so patients
--   only ever see open slots for the day they are booking.
-- - request_appointment rejects wrong-day, already-booked and concurrent
--   bookings of the same doctor/date/slot; timestamps anchored explicitly UTC.
-- - RLS untouched; no new table; no policy changes; idempotent.
-- =============================================================================
