-- Dr. Radar Health Profiles RLS Policy Migration
-- Idempotent: safe to run multiple times
-- Adds Row Level Security to public.health_profiles table
-- Ownership: patient_id → public.patients.user_id → auth.uuid()

-- =============================================================================
-- Ensure RLS is enabled on health_profiles (idempotent)
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.health_profiles'::regclass
          AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- =============================================================================
-- Drop existing policies if any (idempotent)
-- =============================================================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "healthprofiles_insert_own" ON public.health_profiles;
    DROP POLICY IF EXISTS "healthprofiles_read_own" ON public.health_profiles;
    DROP POLICY IF EXISTS "healthprofiles_update_own" ON public.health_profiles;
END
$$;

-- =============================================================================
-- Create policies for public.health_profiles
-- Ownership: patient_id from public.patients → auth.uid()
-- =============================================================================

-- Allow authenticated patients to insert their own health profile
CREATE POLICY "healthprofiles_insert_own" ON public.health_profiles
    FOR INSERT TO authenticated
    WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- Allow authenticated patients to read their own health profile
CREATE POLICY "healthprofiles_read_own" ON public.health_profiles
    FOR SELECT TO authenticated
    USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- Allow authenticated patients to update their own health profile
CREATE POLICY "healthprofiles_update_own" ON public.health_profiles
    FOR UPDATE TO authenticated
    USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- =============================================================================
-- Policy summary
-- =============================================================================
-- RLS ensures authenticated patients can only manage their own health profile:
-- - INSERT: only if patient_id matches their patient row (user_id = auth.uid())
-- - SELECT: only if patient_id matches their patient row (user_id = auth.uid())
-- - UPDATE: only if patient_id matches their patient row (user_id = auth.uid())
-- - Doctors do NOT have access yet (to be implemented via appointments)
-- - If no patient row exists for the auth.user, no rows are accessible