-- =============================================================================
-- Dr. Radar RLS Migration 008: ensure core account-provisioning policies
-- =============================================================================
-- Problem being fixed:
--   public.users upsert failed [42501]: new row violates row-level security
--   policy for table "users" — for the row's OWN authenticated user.
--
-- Root cause (verified by inspection + sandbox reproduction):
--   003_add_rls_policies.sql wraps its "ENABLE ROW LEVEL SECURITY" statements
--   in DO-blocks that query pg_policy.polytype — a column that exists in NO
--   PostgreSQL version. Run as a script, 003 aborts at its first DO-block,
--   BEFORE creating any policy. RLS was later enabled on the tables (dashboard
--   toggle / later migrations), leaving users/patients/doctors with RLS ON and
--   ZERO of the 003 policies. Every authenticated INSERT is therefore
--   default-denied (42501). (The 006 policies and 007 fix are unrelated to
--   INSERT and do not remedy this.)
--
-- This migration ensures the intended policy set EXISTS, idempotently:
--   - users:    authenticated INSERT/SELECT/UPDATE own row (id = auth.uid())
--   - patients: authenticated INSERT/SELECT/UPDATE own row (user_id = auth.uid())
--   - doctors:  authenticated INSERT/SELECT/UPDATE own row (user_id = auth.uid())
--   - no anonymous policies (default deny remains for anon)
--   - no broad authenticated INSERT (strict equality predicates only)
--   - RLS (re-)enabled with a correct pg_class-based guard
--   - appointments/health_profiles/ecg_records/predictions/explanations and
--     migration 007 are NOT touched (no recursion is possible: these policies
--     contain plain equality predicates, no subqueries)
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ensure RLS is enabled (pg_class.relrowsecurity — the correct catalog check)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relrowsecurity
    ) THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'patients' AND c.relrowsecurity
    ) THEN
        ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'doctors' AND c.relrowsecurity
    ) THEN
        ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. public.users — own-row policies (names match 003 for clean replacement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. public.patients — own-row policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "patients_insert_own" ON public.patients;
CREATE POLICY "patients_insert_own" ON public.patients
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "patients_read_own" ON public.patients;
CREATE POLICY "patients_read_own" ON public.patients
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "patients_update_own" ON public.patients;
CREATE POLICY "patients_update_own" ON public.patients
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. public.doctors — own-row policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "doctors_insert_own" ON public.doctors;
CREATE POLICY "doctors_insert_own" ON public.doctors
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "doctors_read_own" ON public.doctors;
CREATE POLICY "doctors_read_own" ON public.doctors
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "doctors_update_own" ON public.doctors;
CREATE POLICY "doctors_update_own" ON public.doctors
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Summary
-- -----------------------------------------------------------------------------
-- - Repairs the never-applied 003 policy set with correct catalog guards.
-- - Strict own-row equality only: user A can never INSERT/UPDATE user B's
--   users/patients/doctors rows; anon stays fully blocked (no anon policies).
-- - No subqueries → cannot re-introduce the 42P17 recursion fixed by 007.
-- - 007 helper functions and appointment/ECG policies remain untouched.
