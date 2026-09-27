-- =============================================================================
-- Dr. Radar Migration 012: guarantee a patients row for every patient account
-- =============================================================================
-- Bug fixed:
--   public.users has a row with role='patient' but NO public.patients row
--   (patients.user_id = users.id). HealthAssessmentScreen then reports
--   "No patient profile is linked to this account, so the assessment cannot
--   be saved" (healthProfileService.resolvePatientRow -> 'no-patient-record').
--
-- Root cause (verified by code + migration inspection):
--   Patient provisioning is FRONTEND-orchestrated only (no auth.users trigger
--   exists): provisionAccount() upserts public.users FIRST (setting
--   onboarding_completed = true) and upserts public.patients SECOND. Any
--   failure of that second upsert (network error, or the historical window
--   where patients had RLS ON with zero policies — see migration 008's
--   header) strands the account permanently: syncAccountProvisioning() only
--   inserts-if-missing the users row and never repairs a missing patients
--   row. No database-level guarantee existed.
--
-- Fix — a database-backed, self-healing, IDEMPOTENT RPC:
--   ensure_patient_profile() inserts the CALLER's OWN patients row
--   (user_id = auth.uid()) only when the caller's public.users row exists AND
--   has role = 'patient'. The UNIQUE constraint on patients.user_id makes the
--   INSERT ... ON CONFLICT DO NOTHING duplicate-safe.
--
-- Guarantees (NOTHING weakened):
--   - RLS stays ENABLED on every table; no policy is created, dropped or
--     altered. auth.uid() is resolved inside the function; the caller can
--     only ever affect their OWN row (patients.user_id = auth.uid()).
--   - Doctors are never touched: role <> 'patient' (or no users row) returns
--     the caller's existing doctors row id (or NULL) without any write.
--   - No service role, no anon grant, no secrets, search_path pinned.
--   - No fake data, no hardcoded user ids, no users.patient_id column.
--   - Existing patient rows are never modified — DO NOTHING.
--
-- Run in the Supabase SQL editor as postgres/owner. Idempotent (safe to
-- re-run). Uses IF NOT EXISTS on 009/010-style helper naming for a clean
-- re-apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_patient_profile()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role      text;
    v_patient_id uuid;
BEGIN
    -- The caller's OWN public.users row. With search_path pinned to '' this
    -- resolves public.users; auth.uid() is NULL for anon callers.
    SELECT u.role
      INTO v_role
      FROM public.users u
     WHERE u.id = auth.uid();

    -- No application row (or anonymous caller): nothing to guarantee here.
    -- The frontend only calls this with a live session.
    IF v_role IS NULL THEN
        RETURN NULL;
    END IF;

    -- Doctors: never touch patients. Their own doctors row (if any) is
    -- returned as-is; the function is a strict no-op for them.
    IF v_role <> 'patient' THEN
        SELECT d.id
          INTO v_patient_id
          FROM public.doctors d
         WHERE d.user_id = auth.uid();
        RETURN v_patient_id;
    END IF;

    -- Patient: insert-if-missing the caller's own patients row. The UNIQUE
    -- constraint on patients.user_id + ON CONFLICT DO NOTHING make this
    -- idempotent and duplicate-safe; existing rows are never modified.
    INSERT INTO public.patients (user_id)
    VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_patient_id;

    -- Row already existed (or concurrent insert won): read the existing id.
    IF v_patient_id IS NULL THEN
        SELECT p.id
          INTO v_patient_id
          FROM public.patients p
         WHERE p.user_id = auth.uid();
    END IF;

    RETURN v_patient_id;
END;
$$;

-- Function owner must be able to write patients despite RLS (SECURITY
-- DEFINER). As postgres/owner in the Supabase SQL editor this is already the
-- table owner; no GRANT on the table is needed beyond what the owner has.
-- Execute privilege: authenticated ONLY (no anon, no public).
REVOKE ALL ON FUNCTION public.ensure_patient_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_patient_profile() TO authenticated;

-- -----------------------------------------------------------------------------
-- Verification inventory (run in the SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT p.proname, p.prosecdef, p.proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'ensure_patient_profile';
--
-- -- Policies on patients must be UNCHANGED (exactly the 008 set):
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'patients';
--
-- -- As the affected patient (signed in), in the app:
-- SELECT public.ensure_patient_profile();  -- -> patients.id, stable across calls
--
-- -- Data repair is verified by the two test accounts in the app itself:
-- --   ankan.work01@gmail.com          -> row created on next login / assessment open
-- --   ankanmukherjee011@gmail.com     -> same patient_id returned, no duplicate row
--
-- SELECT count(*) FROM public.patients WHERE user_id = auth.uid();  -- must be 1
-- =============================================================================