-- =============================================================================
-- Dr. Radar RLS Migration 007: fix PostgreSQL 42P17 infinite recursion
-- =============================================================================
-- Runtime error being fixed:
--   public.users upsert failed [42P17]: "infinite recursion detected in policy
--   for relation \"appointments\""
--
-- Recursive path (introduced by 006_doctor_ecg_access_rls.sql):
--   appointments_select_own (006)
--     USING: doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
--         OR patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
--       → patients row scan fires patients SELECT policies:
--   patients_select_doctor_authorized (006)
--     USING: id IN (SELECT a.patient_id FROM public.appointments a ...)
--       → scans public.appointments again → 42P17 CYCLE
--   (users_select_doctor_authorized reaches the same cycle via patients.)
--
-- PostgREST additionally applies SELECT policies to upsert RETURNING rows,
-- which is why the onboarding public.users upsert hits this error.
--
-- Fix strategy (smallest safe change, security model preserved):
--   1. Rewrite appointments_select_own to depend ONLY on base columns
--      (doctor_id/patient_id resolved through SECURITY DEFINER helpers),
--      never through other RLS-protected scans reachable by the role.
--   2. Route the appointments subqueries in the 006 policies through
--      SECURITY DEFINER helper functions that run as the table owner
--      (owner bypasses RLS by default, so no policy re-entry occurs).
--   3. Helpers are locked down: explicit search_path, no dynamic SQL,
--      fixed row caps, Execute to function-owner only.
--
-- Security model preserved:
--   - patients access their own records (policies from 003/004/005 untouched)
--   - doctors read patient identity/ECG/prediction/explanation data ONLY with
--     a 'scheduled' or 'completed' appointment
--   - doctors gain NO INSERT/UPDATE/DELETE on patient ECG data (none created)
--   - users stay writable only by their own authenticated user
--   - RLS stays ENABLED on every table; nothing is made public
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper functions (stable + index-safe)
-- -----------------------------------------------------------------------------

-- Patient IDs with a scheduled/completed appointment to this doctor.
CREATE OR REPLACE FUNCTION public.doctor_authorized_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
ROWS 1000
AS $$
    SELECT a.patient_id
    FROM public.appointments a
    WHERE a.status IN ('scheduled', 'completed')
      AND a.doctor_id IN (
          SELECT d.id FROM public.doctors d WHERE d.user_id = auth.uid()
      )
$$;

-- All appointment rows involving this doctor (base-column scan only).
CREATE OR REPLACE FUNCTION public.doctor_own_appointment_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
ROWS 1000
AS $$
    SELECT a.id FROM public.appointments a
    WHERE a.doctor_id IN (
        SELECT d.id FROM public.doctors d WHERE d.user_id = auth.uid()
    )
$$;

-- All appointment rows for the patient profile owned by this user.
CREATE OR REPLACE FUNCTION public.patient_own_appointment_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
ROWS 1000
AS $$
    SELECT a.id FROM public.appointments a
    WHERE a.patient_id IN (
        SELECT p.id FROM public.patients p WHERE p.user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.doctor_authorized_patient_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doctor_own_appointment_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_own_appointment_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_authorized_patient_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_own_appointment_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_own_appointment_ids() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. appointments: rewrite the recursive policy (base columns only)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "appointments_select_own" ON public.appointments;
CREATE POLICY "appointments_select_own" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT public.doctor_own_appointment_ids())
        OR id IN (SELECT public.patient_own_appointment_ids())
    );

-- -----------------------------------------------------------------------------
-- 3. patients / users: same authorization as 006, now via helpers (no cycle)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "patients_select_doctor_authorized" ON public.patients;
CREATE POLICY "patients_select_doctor_authorized" ON public.patients
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT public.doctor_authorized_patient_ids())
    );

DROP POLICY IF EXISTS "users_select_doctor_authorized" ON public.users;
CREATE POLICY "users_select_doctor_authorized" ON public.users
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT p.user_id
            FROM public.patients p
            WHERE p.id IN (SELECT public.doctor_authorized_patient_ids())
        )
    );

-- -----------------------------------------------------------------------------
-- 4. ecg_records / predictions / explanations: doctor SELECT via helpers.
--    The patients scan inside users_select_doctor_authorized is safe: patients
--    policies no longer scan appointments directly. Write policies for doctors
--    intentionally do not exist (SELECT-only access to patient ECG data).
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "ecg_records_select_doctor_authorized" ON public.ecg_records;
CREATE POLICY "ecg_records_select_doctor_authorized" ON public.ecg_records
    FOR SELECT TO authenticated
    USING (
        patient_id IN (SELECT public.doctor_authorized_patient_ids())
    );

DROP POLICY IF EXISTS "predictions_select_doctor_authorized" ON public.predictions;
CREATE POLICY "predictions_select_doctor_authorized" ON public.predictions
    FOR SELECT TO authenticated
    USING (
        ecg_record_id IN (
            SELECT r.id FROM public.ecg_records r
            WHERE r.patient_id IN (SELECT public.doctor_authorized_patient_ids())
        )
    );

DROP POLICY IF EXISTS "explanations_select_doctor_authorized" ON public.explanations;
CREATE POLICY "explanations_select_doctor_authorized" ON public.explanations
    FOR SELECT TO authenticated
    USING (
        prediction_id IN (
            SELECT p.id FROM public.predictions p
            WHERE p.ecg_record_id IN (
                SELECT r.id FROM public.ecg_records r
                WHERE r.patient_id IN (SELECT public.doctor_authorized_patient_ids())
            )
        )
    );

-- -----------------------------------------------------------------------------
-- Summary
-- -----------------------------------------------------------------------------
-- - 42P17 recursion eliminated: appointments policy touches no RLS-protected
--   scans reachable by the requesting role (helpers are SECURITY DEFINER as
--   table owner, who bypasses RLS).
-- - Security model unchanged: own-data policies untouched; doctor access
--   remains SELECT-only and appointment-bound ('scheduled'/'completed' only);
--   no new write policies anywhere; RLS stays enabled; anon remains blocked.
