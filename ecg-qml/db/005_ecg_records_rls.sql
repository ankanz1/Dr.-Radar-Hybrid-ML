-- Dr. Radar RLS Policy Migration: ECG persistence tables
-- Adds Row Level Security for public.ecg_records, public.predictions and
-- public.explanations so patients can store and read only their own ECG
-- analyses through the anon key.
-- Ownership chain: ecg_records.patient_id -> public.patients.user_id -> auth.uid()
--                  predictions.ecg_record_id -> public.ecg_records (same chain)
--                  explanations.prediction_id -> public.predictions (same chain)
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- Enable RLS (idempotent; uses pg_class.relrowsecurity, the actual RLS flag)
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'ecg_records'::regclass AND relrowsecurity = TRUE
    ) THEN
        ALTER TABLE public.ecg_records ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'predictions'::regclass AND relrowsecurity = TRUE
    ) THEN
        ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'explanations'::regclass AND relrowsecurity = TRUE
    ) THEN
        ALTER TABLE public.explanations ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- =============================================================================
-- public.ecg_records policies
-- =============================================================================

DROP POLICY IF EXISTS "ecg_records_insert_own" ON public.ecg_records;
CREATE POLICY "ecg_records_insert_own" ON public.ecg_records
    FOR INSERT TO authenticated
    WITH CHECK (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ecg_records_select_own" ON public.ecg_records;
CREATE POLICY "ecg_records_select_own" ON public.ecg_records
    FOR SELECT TO authenticated
    USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ecg_records_delete_own" ON public.ecg_records;
CREATE POLICY "ecg_records_delete_own" ON public.ecg_records
    FOR DELETE TO authenticated
    USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

-- =============================================================================
-- public.predictions policies (ownership inherited through ecg_records)
-- =============================================================================

DROP POLICY IF EXISTS "predictions_insert_own" ON public.predictions;
CREATE POLICY "predictions_insert_own" ON public.predictions
    FOR INSERT TO authenticated
    WITH CHECK (
        ecg_record_id IN (
            SELECT r.id FROM public.ecg_records r
            WHERE r.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "predictions_select_own" ON public.predictions;
CREATE POLICY "predictions_select_own" ON public.predictions
    FOR SELECT TO authenticated
    USING (
        ecg_record_id IN (
            SELECT r.id FROM public.ecg_records r
            WHERE r.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
        )
    );

-- =============================================================================
-- public.explanations policies (ownership inherited through predictions)
-- FK chain: explanations.prediction_id -> predictions.ecg_record_id
--           -> ecg_records.patient_id -> patients.user_id = auth.uid()
-- =============================================================================

DROP POLICY IF EXISTS "explanations_insert_own" ON public.explanations;
CREATE POLICY "explanations_insert_own" ON public.explanations
    FOR INSERT TO authenticated
    WITH CHECK (
        prediction_id IN (
            SELECT p.id FROM public.predictions p
            WHERE p.ecg_record_id IN (
                SELECT r.id FROM public.ecg_records r
                WHERE r.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "explanations_select_own" ON public.explanations;
CREATE POLICY "explanations_select_own" ON public.explanations
    FOR SELECT TO authenticated
    USING (
        prediction_id IN (
            SELECT p.id FROM public.predictions p
            WHERE p.ecg_record_id IN (
                SELECT r.id FROM public.ecg_records r
                WHERE r.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
            )
        )
    );

-- =============================================================================
-- Policy summary
-- =============================================================================
-- - Authenticated patients may insert/read (and for ecg_records, delete) only
--   rows whose FK chain resolves to their own public.patients row
--   (patients.user_id = auth.uid()).
-- - No policy grants update on any of the three tables (clinical records are
--   append-only); no anonymous access; no service-role usage.
-- - Doctors intentionally have no access here (appointment-based
--   authorization is deferred, consistent with 003_add_rls_policies.sql).
