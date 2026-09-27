-- =============================================================================
-- Dr. Radar Migration 010: fix LIVE ECG storage path (storage.objects + ecg_uploads)
-- =============================================================================
-- Symptom fixed: authenticated patient uploads left the "ecg-uploads" bucket
-- EMPTY in the live project while local sandbox tests (test_009_sandbox.py) all
-- passed. The sandbox ran against LOCAL Postgres; the live project's policy
-- state was never proven. Candidate live failure modes, all repaired here:
--
--   F1. 009 was only PARTIALLY applied live (e.g. the SQL editor errored mid-
--       script). The table+grants exist but the storage.objects policies and/or
--       the ecg_storage_* helper functions do not -> every authenticated Storage
--       upload is default-DENIED. (Anon probes confirm table+bucket exist and
--       anon is denied; they cannot prove the AUTH policies exist.)
--   F2. 009 was applied but a later dashboard action REPLACED the storage
--       policies (e.g. the dashboard "New policy" quick-template
--       "Allow authenticated uploads" writes bucket_id = 'ecg-uploads'
--       AND auth.role() = 'authenticated' — the too-broad form this project
--       forbids) — or dropped them.
--   F3. The helper functions exist but their ownership/permissions drifted from
--       007's safe pattern, making the policy expressions fail closed.
--
-- Strategy: RE-ASSERT the full, sandbox-proven 009 policy set IDEMPOTENTLY with
-- CREATE OR REPLACE / DROP-IF-EXISTS + CREATE (drop+create removes any stray
-- dashboard-created policy of the same name and fixes drifted definitions).
-- Then print a policy inventory to verify what actually exists live.
--
-- Unchanged guarantees (identical to 009):
--   - auth.uid() = public.users.id, NEVER public.patients.id. Every storage
--     policy resolves auth.uid() -> public.patients.user_id -> patients.id and
--     compares that UUID against the object's FIRST PATH SEGMENT.
--   - No policy compares auth.uid() to the storage path directly.
--   - Bucket stays PRIVATE; no broad bucket_id+auth.role() policy is created.
--   - Doctors: SELECT-only, appointment-authorized (007 helper). No doctor
--     INSERT/UPDATE/DELETE. Anon: zero policies (default deny).
--   - No service-role usage; RLS is never disabled anywhere.
--
-- Run in the Supabase SQL editor as postgres/owner. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. public.ecg_uploads — ensure the table, grants and RLS flag (F1: partial 009)
--    CREATE TABLE IF NOT EXISTS: if 009 created it fully, this is a no-op.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecg_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    upload_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ecg_uploads_upload_type_check
        CHECK (upload_type IN ('ecg-csv', 'ecg-txt', 'ecg-pdf')),
    CONSTRAINT ecg_uploads_mime_type_check
        CHECK (mime_type IN ('text/csv', 'text/plain', 'application/pdf', 'application/octet-stream')),
    CONSTRAINT ecg_uploads_size_check CHECK (size_bytes > 0),
    CONSTRAINT ecg_uploads_file_name_check CHECK (length(btrim(file_name)) > 0)
);

CREATE INDEX IF NOT EXISTS ix_ecguploads_patient_id ON public.ecg_uploads(patient_id);
CREATE INDEX IF NOT EXISTS ix_ecguploads_created_at ON public.ecg_uploads(created_at);

REVOKE ALL ON public.ecg_uploads FROM anon;
GRANT SELECT, INSERT, DELETE ON public.ecg_uploads TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'ecg_uploads' AND c.relrowsecurity
    ) THEN
        ALTER TABLE public.ecg_uploads ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. ecg_records.upload_id — ensure the link column exists (F1: partial 009)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ecg_records'
          AND column_name = 'upload_id'
    ) THEN
        ALTER TABLE public.ecg_records
            ADD COLUMN upload_id UUID REFERENCES public.ecg_uploads(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_ecgrecords_upload_id ON public.ecg_records(upload_id);

-- -----------------------------------------------------------------------------
-- 3. Private bucket "ecg-uploads" — re-assert config (private, 25 MB, MIME list)
--    ON CONFLICT DO UPDATE is intentionally OVERRIDING here: the live bucket was
--    created by 009, but a dashboard edit may have made it public or dropped the
--    MIME whitelist. Keeping it private is a security requirement.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ecg-uploads',
    'ecg-uploads',
    FALSE,
    26214400, -- 25 MB
    ARRAY['text/csv', 'text/plain', 'application/pdf', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 4. Storage path helpers — re-assert definitions (F1/F3: missing or drifted)
--    Same STRICT pattern as 007: SECURITY DEFINER, SET search_path = '',
--    STABLE, static SQL only, EXECUTE revoked from anon/public.
-- -----------------------------------------------------------------------------

-- Own patient_id of the caller (auth.uid() -> patients.user_id -> patients.id),
-- or NULL when the caller is not a patient.
CREATE OR REPLACE FUNCTION public.ecg_storage_own_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 10
AS $$
    SELECT p.id FROM public.patients p WHERE p.user_id = auth.uid()
$$;

-- TRUE when path is exactly "{own_patient_id}/..." for the caller (patient scope).
CREATE OR REPLACE FUNCTION public.ecg_storage_path_is_own(path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 10
AS $$
    SELECT public.ecg_storage_own_patient_id() IS NOT NULL
       AND path IS NOT NULL
       AND position(public.ecg_storage_own_patient_id()::text || '/' in path) = 1
$$;

-- Patient IDs appointment-authorized to the CALLER-doctor (reuses 007 helper).
CREATE OR REPLACE FUNCTION public.ecg_storage_authorized_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
ROWS 1000
AS $$
    SELECT public.doctor_authorized_patient_ids()
$$;

-- TRUE when path is "{authorized_patient_id}/..." for the caller (doctor scope).
CREATE OR REPLACE FUNCTION public.ecg_storage_path_is_authorized(path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
AS $$
    SELECT path IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.ecg_storage_authorized_patient_ids() ap
        WHERE position(ap::text || '/' in path) = 1
    )
$$;

REVOKE ALL ON FUNCTION public.ecg_storage_own_patient_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ecg_storage_path_is_own(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ecg_storage_path_is_authorized(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecg_storage_own_patient_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ecg_storage_path_is_own(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ecg_storage_path_is_authorized(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. storage.objects policies — DROP + CREATE (F1: missing, F2: drifted/replaced)
--    Drop-then-create replaces any stray dashboard-created policy of the same
--    name; policies with OTHER names (e.g. a dashboard quick-template) are
--    reported by the inventory in section 7 for manual review.
--    Patient INSERT/SELECT/DELETE under the own-patient prefix only; doctor
--    SELECT-only under appointment-authorized prefixes; anon: none (default
--    deny); no UPDATE policy anywhere (objects are immutable once stored).
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "ecg_uploads_patient_insert_own" ON storage.objects;
CREATE POLICY "ecg_uploads_patient_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'ecg-uploads'
        AND public.ecg_storage_path_is_own(name)
    );

DROP POLICY IF EXISTS "ecg_uploads_patient_select_own" ON storage.objects;
CREATE POLICY "ecg_uploads_patient_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'ecg-uploads'
        AND public.ecg_storage_path_is_own(name)
    );

DROP POLICY IF EXISTS "ecg_uploads_patient_delete_own" ON storage.objects;
CREATE POLICY "ecg_uploads_patient_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'ecg-uploads'
        AND public.ecg_storage_path_is_own(name)
    );

DROP POLICY IF EXISTS "ecg_uploads_doctor_select_authorized" ON storage.objects;
CREATE POLICY "ecg_uploads_doctor_select_authorized" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'ecg-uploads'
        AND public.ecg_storage_path_is_authorized(name)
    );

-- -----------------------------------------------------------------------------
-- 6. ecg_uploads table policies — re-assert (F1/F2). Patient INSERT/SELECT/
--    DELETE own rows only (no UPDATE: append-only). Doctor SELECT-only,
--    appointment-authorized. Anon: none.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "ecg_uploads_insert_own" ON public.ecg_uploads;
CREATE POLICY "ecg_uploads_insert_own" ON public.ecg_uploads
    FOR INSERT TO authenticated
    WITH CHECK (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ecg_uploads_select_own" ON public.ecg_uploads;
CREATE POLICY "ecg_uploads_select_own" ON public.ecg_uploads
    FOR SELECT TO authenticated
    USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ecg_uploads_delete_own" ON public.ecg_uploads;
CREATE POLICY "ecg_uploads_delete_own" ON public.ecg_uploads
    FOR DELETE TO authenticated
    USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ecg_uploads_select_doctor_authorized" ON public.ecg_uploads;
CREATE POLICY "ecg_uploads_select_doctor_authorized" ON public.ecg_uploads
    FOR SELECT TO authenticated
    USING (
        patient_id IN (SELECT public.doctor_authorized_patient_ids())
    );

-- -----------------------------------------------------------------------------
-- 7. POLICY INVENTORY — verify what ACTUALLY exists live after this migration.
--    Expected output: exactly the 8 policies above (4 storage + 4 table).
--    Any OTHER policy on storage.objects referencing 'ecg-uploads' (e.g. a
--    dashboard quick-template) is a red flag: drop it manually.
-- -----------------------------------------------------------------------------
SELECT 'storage.objects' AS location, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (policyname LIKE 'ecg_uploads%' OR qual ILIKE '%ecg-uploads%' OR with_check ILIKE '%ecg-uploads%')
UNION ALL
SELECT 'public.ecg_uploads', policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ecg_uploads'
ORDER BY 1, 2;

-- Function inventory (ownership/perms sanity):
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig AS search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('ecg_storage_own_patient_id', 'ecg_storage_path_is_own',
                    'ecg_storage_authorized_patient_ids', 'ecg_storage_path_is_authorized',
                    'doctor_authorized_patient_ids');

-- Bucket config:
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'ecg-uploads';

-- =============================================================================
-- Summary
-- =============================================================================
-- - Repairs all three plausible live failure modes WITHOUT disabling RLS,
--   WITHOUT making the bucket public, WITHOUT service-role in the frontend,
--   and WITHOUT weakening patient/doctor authorization.
-- - Storage policy behavior (unchanged from the sandbox-proven 009 logic):
--     INSERT: authenticated AND bucket_id='ecg-uploads' AND path starts with
--             "{auth.uid()'s own patients.id}/"
--     SELECT: same as INSERT, OR path starts with an appointment-authorized
--             patient's id (doctor)
--     DELETE: patient own-prefix only (no doctor DELETE)
--     UPDATE: no policy at all (default deny) — objects are immutable
--     anon:   no policy (default deny)
-- - The final SELECTs print the live inventory; compare against the expected
--   8-policy set before declaring the fix live.
-- =============================================================================
