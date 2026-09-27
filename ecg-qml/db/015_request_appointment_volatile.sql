-- =============================================================================
-- 015: request_appointment() must be VOLATILE
-- =============================================================================
-- Problem
--   Patient booking fails with:
--     "INSERT is not allowed in a non-volatile function"
--   PostgreSQL rejects writes executed from a function declared STABLE or
--   IMMUTABLE (verified: STABLE + INSERT raises exactly that error).
--
-- Root cause
--   public.request_appointment() was originally declared STABLE in
--   011_doctor_directory_and_booking.sql (LANGUAGE plpgsql / STABLE) and
--   again in 013_doctor_availability_and_slot_exclusivity.sql. Migration 014
--   recreates it as VOLATILE, but a live database whose function was last
--   written by 011/013 (e.g. 013 applied after 014, or 014 never applied)
--   still has provolatile = 's', so the final INSERT inside the booking
--   routine is refused.
--
-- Fix
--   Sequential migration 015 re-creates the function with the exact 014
--   definition — identical signature, return type, SECURITY DEFINER,
--   search_path pinning, and body (patient authorization, doctor/slot/date
--   validation, advisory-lock serialization, booked-slot and double-booking
--   protection, UTC-anchored start/end times) — but declared VOLATILE.
--
--   CREATE OR REPLACE is allowed to change volatility attributes
--   (provolatile flips to 'v'), so this is safe and idempotent: run it any
--   number of times, before or after 014, in any order relative to 011/013.
--   It is the LAST migration for this function and supersedes the STABLE
--   declarations in 011 (line ~102) and 013 (line ~188).
--
-- Contract unchanged (frontend/API contract preserved)
--   - signature: request_appointment(uuid, text, text, text, date)
--   - returns: uuid (appointment id)
--   - granted to: authenticated (REVOKE from PUBLIC, anon)
--   - success = appointment id; errors are the same RAISE messages as 014
-- =============================================================================

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
-- Verification (run in the SQL editor / psql to confirm live state)
-- -----------------------------------------------------------------------------
-- Should return 'v' (volatile), prosecdef = true:
-- SELECT p.provolatile, p.prosecdef, p.proconfig
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'request_appointment'
--   AND p.proargtypes::text = 'uuid,text,text,text,date';
--
-- Regression guard: a STABLE copy would fail here with
--   "INSERT is not allowed in a non-volatile function".
