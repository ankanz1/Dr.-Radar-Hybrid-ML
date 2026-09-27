-- =============================================================================
-- Dr. Radar Migration 009: ECG file storage (Supabase Storage + metadata)
-- =============================================================================
-- Phase 2A. Adds persistent storage of ORIGINAL uploaded ECG files:
--   - public.ecg_uploads metadata table (never file contents in Postgres)
--   - private storage bucket "ecg-uploads" (25 MB, restricted MIME types)
--   - patient-scoped storage path convention: {patient_id}/{upload_id}/{safe_filename}
--   - table RLS: patient full own-row access (no UPDATE), doctor SELECT-only
--     when authorized through the SAME appointment model as migration 007
--   - storage RLS mirroring the same rules via storage.objects policies
--
-- Storage RLS note: storage.objects policies live in the storage schema and use
-- bucket_id = 'ecg-uploads'. Path-safety (a patient may only touch objects under
-- their own patient_id prefix) is enforced with STRICT SECURITY DEFINER helper
-- functions following the migration 007 safe pattern:
--   SET search_path = ''   (schema-qualified names only)
--   STABLE                 (index-safe, no volatility)
--   no dynamic SQL         (static statements only)
--   REVOKE from anon/public, GRANT to authenticated only
-- The appointments authorization reuses doctor_authorized_patient_ids() from
-- 007 unchanged — no recursion is introduced because the ecg_uploads policies
-- depend only on that helper (which scans appointments as table owner) and on
-- patients via their own helpers, never the reverse.
--
-- Idempotent: safe to run multiple times. Migrations 003-008 are NOT modified.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. public.ecg_uploads — metadata for each stored ORIGINAL file
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

-- Explicit grants (Supabase default privileges usually cover this; being
-- explicit keeps RLS and the privilege layer aligned). No UPDATE grant:
-- rows are append-only, matching the policy set below. Anon gets nothing.
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

-- Patient policies: INSERT/SELECT/DELETE own rows only. No UPDATE policy —
-- stored-upload metadata is append-only (re-upload creates a new row).
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

-- Doctor policy: SELECT-only, appointment-bound through the 007 helper.
DROP POLICY IF EXISTS "ecg_uploads_select_doctor_authorized" ON public.ecg_uploads;
CREATE POLICY "ecg_uploads_select_doctor_authorized" ON public.ecg_uploads
    FOR SELECT TO authenticated
    USING (
        patient_id IN (SELECT public.doctor_authorized_patient_ids())
    );

-- -----------------------------------------------------------------------------
-- 2. public.ecg_records.upload_id — smallest nullable link to the stored file
--    (source stays for human-readable provenance; no backfill of existing rows)
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
-- 3. Private storage bucket "ecg-uploads"
--    (idempotent insert; never public — file_size_limit 25 MB, restricted MIME)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ecg-uploads',
    'ecg-uploads',
    FALSE,
    26214400, -- 25 MB
    ARRAY[
        'text/csv',
        'text/plain',
        'application/pdf',
        'application/octet-stream'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 4. Storage RLS: strict patient-path helpers (007-safe pattern)
-- -----------------------------------------------------------------------------
-- Own patient_id of the caller, or NULL when the caller is not a patient.
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
-- 5. storage.objects policies for bucket "ecg-uploads"
--    Patients: INSERT/SELECT/DELETE under their own patient_id prefix only.
--    Doctors: SELECT-only under authorized patients' prefixes.
--    Anon: no policies -> default deny. Bucket stays private.
--    No UPDATE policy anywhere: objects are immutable once stored (re-upload
--    targets a fresh upload_id folder).
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
-- Summary
-- -----------------------------------------------------------------------------
-- - ecg_uploads: metadata only; contents live in Storage. CHECK constraints
--   pin upload_type ('ecg-csv'|'ecg-txt'|'ecg-pdf') and MIME whitelist.
-- - ecg_records.upload_id: nullable FK, ON DELETE SET NULL (analysis outlives
--   a deleted file record); existing rows untouched (NULL).
-- - Bucket "ecg-uploads": private, 25 MB cap, MIME whitelist enforced server-
--   side by Supabase Storage (not just the client).
-- - Storage paths: {patient_id}/{upload_id}/{safe_filename} — patient_id comes
--   from the DB (never user input); upload_id is a UUID; filename is sanitized
--   client-side and re-verifiable against the path prefix policies.
-- - Patient: full own-prefix object control; Doctor: SELECT-only via the 007
--   appointment model; Anon: zero policies (default deny).
-- - No recursion: ecg_uploads/storage policies depend on 007's helper (owner
--   privileges, no RLS re-entry) and simple patients scans; appointments
--   policies are untouched.
-- =============================================================================
