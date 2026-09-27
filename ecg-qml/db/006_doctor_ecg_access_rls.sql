-- Dr. Radar RLS Policy Migration: Doctor ECG access via appointments
-- Minimum secure authorization for the doctor dashboard demo.
--
-- Authorization model (existing appointments table — no new relationship tables):
--   doctors.user_id = auth.uid()
--   -> appointments.doctor_id = doctors.id
--   -> appointments.patient_id = patients.id
--   -> patient's ecg_records / predictions / explanations
-- An appointment authorizes access ONLY when status IN ('scheduled','completed')
-- (actual schema values; there is no 'confirmed' status in this schema).
-- Doctors get SELECT-only on patient ECG data; INSERT/UPDATE/DELETE stay patient-only.
--
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- 0. Enable RLS on public.appointments (currently has NO RLS and no policies)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'appointments'::regclass AND relrowsecurity = TRUE
    ) THEN
        ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Doctor/patient visibility of their OWN appointment rows (needed so the
-- authorization chain below can resolve, and so a future booking UI can list
-- the signed-in user's appointments). No INSERT/UPDATE/DELETE policies are
-- added: appointments remain non-writable (booking system is out of scope).
DROP POLICY IF EXISTS "appointments_select_own" ON public.appointments;
CREATE POLICY "appointments_select_own" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
        OR patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

-- =============================================================================
-- 1. Patient identity for the doctor dashboard (minimum necessary).
--    Supabase RLS is row-level (column-blind), so the frontend restricts the
--    selected columns to name/email only. Patient-own policies from 003
--    remain in force and unchanged.
-- =============================================================================

-- patients: doctors may read identity rows of appointment-authorized patients.
DROP POLICY IF EXISTS "patients_select_doctor_authorized" ON public.patients;
CREATE POLICY "patients_select_doctor_authorized" ON public.patients
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT a.patient_id
            FROM public.appointments a
            JOIN public.doctors d ON d.id = a.doctor_id
            WHERE d.user_id = auth.uid()
              AND a.status IN ('scheduled', 'completed')
        )
    );

-- users: doctors may read name/email of appointment-authorized patients only.
DROP POLICY IF EXISTS "users_select_doctor_authorized" ON public.users;
CREATE POLICY "users_select_doctor_authorized" ON public.users
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT p.user_id
            FROM public.patients p
            WHERE p.id IN (
                SELECT a.patient_id
                FROM public.appointments a
                JOIN public.doctors d ON d.id = a.doctor_id
                WHERE d.user_id = auth.uid()
                  AND a.status IN ('scheduled', 'completed')
            )
        )
    );

-- =============================================================================
-- 2. Doctor SELECT access to stored ECG analyses (read-only, appointment-bound)
--    Each policy expresses the FULL authorization chain directly so policies
--    never depend on each other's evaluation. No INSERT/UPDATE/DELETE for
--    doctors anywhere; patient-own policies from 005 remain unchanged.
-- =============================================================================

-- ecg_records: patient has a scheduled/completed appointment with this doctor.
DROP POLICY IF EXISTS "ecg_records_select_doctor_authorized" ON public.ecg_records;
CREATE POLICY "ecg_records_select_doctor_authorized" ON public.ecg_records
    FOR SELECT TO authenticated
    USING (
        patient_id IN (
            SELECT a.patient_id
            FROM public.appointments a
            JOIN public.doctors d ON d.id = a.doctor_id
            WHERE d.user_id = auth.uid()
              AND a.status IN ('scheduled', 'completed')
        )
    );

-- predictions: parent ecg_record is doctor-authorized.
DROP POLICY IF EXISTS "predictions_select_doctor_authorized" ON public.predictions;
CREATE POLICY "predictions_select_doctor_authorized" ON public.predictions
    FOR SELECT TO authenticated
    USING (
        ecg_record_id IN (
            SELECT r.id
            FROM public.ecg_records r
            WHERE r.patient_id IN (
                SELECT a.patient_id
                FROM public.appointments a
                JOIN public.doctors d ON d.id = a.doctor_id
                WHERE d.user_id = auth.uid()
                  AND a.status IN ('scheduled', 'completed')
            )
        )
    );

-- explanations: parent prediction -> ecg_record is doctor-authorized.
DROP POLICY IF EXISTS "explanations_select_doctor_authorized" ON public.explanations;
CREATE POLICY "explanations_select_doctor_authorized" ON public.explanations
    FOR SELECT TO authenticated
    USING (
        prediction_id IN (
            SELECT p.id
            FROM public.predictions p
            WHERE p.ecg_record_id IN (
                SELECT r.id
                FROM public.ecg_records r
                WHERE r.patient_id IN (
                    SELECT a.patient_id
                    FROM public.appointments a
                    JOIN public.doctors d ON d.id = a.doctor_id
                    WHERE d.user_id = auth.uid()
                      AND a.status IN ('scheduled', 'completed')
                )
            )
        )
    );

-- =============================================================================
-- Policy summary
-- =============================================================================
-- - appointments: RLS enabled; authenticated users see only appointment rows
--   where they are the doctor or the patient. No write policies (booking UI
--   is out of scope; rows are managed via SQL for the demo).
-- - patients/users: doctors read ONLY identity fields of appointment-
--   authorized patients (frontend additionally selects only the minimum
--   columns). Patient-own policies are untouched.
-- - ecg_records/predictions/explanations: doctors get SELECT only, and only
--   through the chain doctor -> appointment('scheduled'|'completed') ->
--   patient -> ecg_record -> prediction -> explanation. All three policies
--   express the chain independently; no cross-policy evaluation dependencies.
-- - Doctors have NO INSERT/UPDATE/DELETE on any patient ECG table.
-- - Patient ownership policies from 003/004/005 are NOT modified.
-- - No 'confirmed' status exists in the schema; authorization uses the real
--   values 'scheduled' and 'completed'. 'cancelled'/'no_show' never authorize.
