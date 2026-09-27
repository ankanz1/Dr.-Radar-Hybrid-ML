-- Dr. Radar RLS Policy Migration
-- This script adds Row Level Security policies to the existing schema
-- Idempotent: safe to run multiple times
-- Tables: public.users, public.patients, public.doctors

-- =============================================================================
-- Ensure RLS is enabled on tables (idempotent)
-- =============================================================================

-- Users table RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polytype = 'RLS' AND polrelid = 'users'::regclass) THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Patients table RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polytype = 'RLS' AND polrelid = 'patients'::regclass) THEN
        ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Doctors table RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polytype = 'RLS' AND polrelid = 'doctors'::regclass) THEN
        ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- =============================================================================
-- public.users policies
-- =============================================================================

-- Drop existing policies if any (idempotent)
DO $$
BEGIN
    DROP POLICY IF EXISTS "users_insert_own" ON public.users;
    DROP POLICY IF EXISTS "users_read_own" ON public.users;
    DROP POLICY IF EXISTS "users_update_own" ON public.users;
END
$$;

-- Create policies for public.users
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_read_own" ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- =============================================================================
-- public.patients policies
-- =============================================================================

-- Drop existing policies if any (idempotent)
DO $$
BEGIN
    DROP POLICY IF EXISTS "patients_insert_own" ON public.patients;
    DROP POLICY IF EXISTS "patients_read_own" ON public.patients;
    DROP POLICY IF EXISTS "patients_update_own" ON public.patients;
END
$$;

-- Create policies for public.patients
CREATE POLICY "patients_insert_own" ON public.patients
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "patients_read_own" ON public.patients
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "patients_update_own" ON public.patients
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- =============================================================================
-- public.doctors policies
-- =============================================================================

-- Drop existing policies if any (idempotent)
DO $$
BEGIN
    DROP POLICY IF EXISTS "doctors_insert_own" ON public.doctors;
    DROP POLICY IF EXISTS "doctors_read_own" ON public.doctors;
    DROP POLICY IF EXISTS "doctors_update_own" ON public.doctors;
END
$$;

-- Create policies for public.doctors
CREATE POLICY "doctors_insert_own" ON public.doctors
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "doctors_read_own" ON public.doctors
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "doctors_update_own" ON public.doctors
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- =============================================================================
-- Policy summary
-- =============================================================================
-- RLS ensures authenticated users can only manage their own profile data:
-- - users: insert/read/update own row (id = auth.uid())
-- - patients: insert/read/update own record (user_id = auth.uid())
-- - doctors: insert/read/update own record (user_id = auth.uid())
-- - Doctors do NOT have access to patient medical records (handled later)
-- - Appointment-based authorization will be implemented separately