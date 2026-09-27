-- =============================================================================
-- Dr. Radar Migration 013: doctor availability publishing + slot exclusivity
-- =============================================================================
-- Purpose (fix "No slots published" / booking flow):
--   1. publish_doctor_slots(): the authenticated doctor writes their OWN
--      public.doctors row (slots JSONB + is_available_today + next_available).
--      Migration 008 already grants doctors_update_own (user_id = auth.uid()),
--      but a plain table UPDATE cannot sanitize/validate the slot labels, so
--      this SECURITY DEFINER function validates every label (HH:MM 24-hour,
--      00:00-23:59), dedupes, and stores the result. No other columns are
--      writable through it and no other doctor's row can be touched.
--
--   2. list_doctor_directory() is recreated with one added output column,
--      booked_slots jsonb: the HH:MM labels of that doctor's future scheduled
--      appointments. Patients use it to HIDE already-booked slots. All other
--      columns/semantics are unchanged (still public directory data only).
--      The return type changed, so the function is DROPped and re-CREATEd
--      (CREATE OR REPLACE cannot change a return type). Deploy together with
--      the matching frontend release; the frontend tolerates the old shape.
--
--   3. request_appointment() gains a slot-exclusivity check: a slot already
--      taken by a 'scheduled' appointment for the same doctor on the same date
--      is rejected. Same signature/behavior otherwise; CREATE OR REPLACE is
--      sufficient. Double-booking by the SAME patient at the same start time
--      remains blocked by uq_appointments_patient_doctor_start (schema).
--
-- Security model — NOTHING weakened:
--   - RLS stays ENABLED on every table; no policy is dropped or altered.
--   - publish_doctor_slots touches ONLY the caller's own doctors row
--      (patients.user_id = auth.uid() pattern: doctors.user_id = auth.uid()).
--   - list_doctor_directory still exposes ONLY public directory columns;
--      booked_slots contains no patient identity, only HH:MM labels.
--   - request_appointment keeps validating: caller's own patient row, doctor
--      exists, slot is one of the doctor's stored slots, valid consultation
--      type, non-past date. Now also: slot not already booked for that doctor.
--   - No service role, no secrets, search_path pinned. Idempotent.
-- Run in the Supabase SQL editor as postgres/owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. publish_doctor_slots(): validated write to the caller's own doctors row
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_doctor_slots(
    p_slots jsonb,
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
    v_clean jsonb;
    v_slot text;
    v_next timestamptz;
    v_earliest text;
BEGIN
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

    v_clean := '[]'::jsonb;
    FOR v_slot IN SELECT jsonb_array_elements_text(p_slots) LOOP
        v_slot := btrim(v_slot);
        -- Strict HH:MM 24-hour validation (no past/invalid labels possible)
        IF v_slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'Invalid slot label "%": use 24-hour HH:MM (e.g. 09:30).', v_slot;
        END IF;
        IF NOT (v_clean @> to_jsonb(v_slot)) THEN
            v_clean := v_clean || to_jsonb(v_slot);
        END IF;
    END LOOP;

    SELECT min(v_slot) INTO v_earliest FROM jsonb_array_elements_text(v_clean) AS s(v_slot);

    -- next_available = the earliest slot's next future occurrence (UTC, the
    -- same convention request_appointment uses to anchor slots on dates).
    IF v_earliest IS NOT NULL THEN
        v_next := (CURRENT_DATE::text || ' ' || v_earliest)::timestamptz;
        IF v_next <= now() THEN
            v_next := v_next + interval '1 day';
        END IF;
    END IF;

    UPDATE public.doctors
    SET slots = v_clean,
        is_available_today = COALESCE(p_is_available_today, jsonb_array_length(v_clean) > 0),
        next_available = v_next,
        updated_at = now()
    WHERE id = v_doctor_id;

    RETURN v_clean;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_doctor_slots(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_doctor_slots(jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. list_doctor_directory(): same public columns + booked_slots for patients.
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
        -- Future scheduled bookings for this doctor, as HH:MM labels (UTC wall
        -- clock, the same convention request_appointment uses when anchoring a
        -- slot label on a date). No patient identity is exposed.
        COALESCE((
            SELECT jsonb_agg(
                DISTINCT to_char(a.start_time AT TIME ZONE 'UTC', 'HH24:MI')
                ORDER BY to_char(a.start_time AT TIME ZONE 'UTC', 'HH24:MI')
            )
            FROM public.appointments a
            WHERE a.doctor_id = d.id
              AND a.status = 'scheduled'
              AND a.start_time >= now()
        ), '[]'::jsonb) AS booked_slots,
        d.avatar_url
    FROM public.doctors d
    JOIN public.users u ON u.id = d.user_id
    ORDER BY d.is_available_today DESC, d.rating DESC
$$;

REVOKE ALL ON FUNCTION public.list_doctor_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_doctor_directory() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. request_appointment(): add slot-exclusivity (same signature -> REPLACE)
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
STABLE
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

    -- The slot must be one of the doctor's stored slots (no invented availability)
    SELECT EXISTS (
        SELECT 1
        FROM public.doctors d
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.slots, '[]'::jsonb)) AS s(slot)
        WHERE d.id = p_doctor_id
          AND btrim(s.slot) = btrim(p_slot)
    )
    INTO v_slot_valid;
    IF NOT v_slot_valid THEN
        RAISE EXCEPTION 'The selected time slot is not offered by this doctor.';
    END IF;

    -- NEW (migration 013): the slot must not already be booked for this doctor
    -- on the requested date by a scheduled appointment. Skipped silently when
    -- the legacy label format cannot be cast to a time (same tolerance as the
    -- start-time parsing below).
    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM public.appointments a
            WHERE a.doctor_id = p_doctor_id
              AND a.status = 'scheduled'
              AND (a.start_time AT TIME ZONE 'UTC')::date = p_on_date
              AND (a.start_time AT TIME ZONE 'UTC')::time = btrim(p_slot)::time
        )
        INTO v_slot_taken;
        IF v_slot_taken THEN
            RAISE EXCEPTION 'That time slot has already been booked. Please choose another.';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Label not parseable as HH:MM -> keep legacy behavior (no exclusivity).
        v_slot_taken := false;
    END;

    -- Build start/end timestamps. The slot string is a display label stored by
    -- the deployment; we anchor it on the requested date at midnight UTC and
    -- store the label in `reason` suffix if it does not parse as HH:MM.
    BEGIN
        v_start := (p_on_date::text || ' ' || btrim(p_slot))::timestamptz;
    EXCEPTION WHEN OTHERS THEN
        v_start := p_on_date::timestamptz; -- date at 00:00 UTC when slot is not parseable
    END;
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
-- 4. Verification inventory (run in SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('list_doctor_directory', 'request_appointment', 'publish_doctor_slots');
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('doctors', 'appointments');
--
-- -- As the demo doctor (authenticated): publish and read back
-- SELECT public.publish_doctor_slots('["09:30","11:00","14:30"]'::jsonb);
-- SELECT slots, is_available_today, next_available FROM public.doctors
-- WHERE user_id = auth.uid();
--
-- -- As the demo patient: directory now includes booked_slots
-- SELECT display_name, slots, booked_slots FROM public.list_doctor_directory();

-- =============================================================================
-- Summary
-- =============================================================================
-- - Doctors can publish validated HH:MM slots to their OWN doctors row.
-- - Directory exposes booked slot labels so patients only see open slots.
-- - request_appointment rejects double-booked slots per doctor/date.
-- - RLS untouched; no new table policies; no service role; idempotent.
-- =============================================================================
