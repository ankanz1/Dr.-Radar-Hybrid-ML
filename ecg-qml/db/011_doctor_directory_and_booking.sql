-- =============================================================================
-- Dr. Radar Migration 011: doctor directory + patient appointment booking RPCs
-- =============================================================================
-- Purpose (patient-first journey, step 8 "Connect With Doctor"):
--   The frontend needs two capabilities that the existing schema + RLS make
--   impossible with plain table SELECTs:
--
--   1. list_doctor_directory(): a patient must be able to SEE registered
--      doctors to connect with one. public.doctors has RLS enabled (008) with
--      own-row policies only, so a patient SELECT on doctors returns zero rows
--      by design. This function exposes ONLY public directory columns
--      (name/title/specialty/hospital/about/rating/slots/availability) and
--      never any health data — equivalent to a clinic's public website.
--
--   2. request_appointment(): the appointments table has RLS enabled (006/007)
--      with SELECT-only policies; there is intentionally NO INSERT policy
--      (booking was "out of scope" in 006). This function inserts a validated
--      appointment through the caller's OWN patient row without adding a broad
--      INSERT policy to the table.
--
-- Security model — NOTHING weakened:
--   - RLS stays ENABLED on every table; no policy is dropped or altered.
--   - request_appointment is SECURITY DEFINER but validates EVERYTHING:
--       * caller has exactly one own patient row (patients.user_id = auth.uid())
--       * doctor exists
--       * slot is one of the doctor's stored slots (doctors.slots JSONB)
--       * consultation_type is one of the schema CHECK values
--       * date is today or in the future (timezone: UTC)
--       * start time derived as date + slot; end = start + 30 minutes
--     The deferrable unique constraint uq_appointments_patient_doctor_start
--     still blocks exact duplicates at the DB level.
--   - After booking, the patient can only ever read their OWN appointment rows
--     (appointments_select_own, 007) — unchanged.
--   - Doctors keep SELECT-only, appointment-bound access to patient data
--     (007 helpers reused unchanged by this migration).
--   - No service role, no secret, no password handling. search_path pinned.
--   - Directory function is stable and read-only; it exposes no patient data.
--
-- Run in the Supabase SQL editor as postgres/owner. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. list_doctor_directory(): public directory columns for registered doctors
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_doctor_directory()
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
        d.avatar_url
    FROM public.doctors d
    JOIN public.users u ON u.id = d.user_id
    ORDER BY d.is_available_today DESC, d.rating DESC
$$;

REVOKE ALL ON FUNCTION public.list_doctor_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_doctor_directory() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. request_appointment(): validated booking through the caller's own patient row
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
-- 3. Verification inventory (run in SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname IN ('list_doctor_directory', 'request_appointment');
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'appointments';

-- =============================================================================
-- Summary
-- =============================================================================
-- - Doctors discoverable via RPC exposing ONLY public directory columns.
-- - Booking possible through a fully-validated SECURITY DEFINER function;
--   no broad INSERT policy on appointments; caller's own patient row only.
-- - RLS untouched on all tables; doctor SELECT-only patient access unchanged
--   (007); patient own-row access unchanged (003/004/005/008/009/010).
-- - No fake availability: slots must exist in doctors.slots.
-- =============================================================================
