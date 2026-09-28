-- =============================================================================
-- Dr. Radar Migration 016: appointment-scoped messages (Phase 4 — Step 1)
-- =============================================================================
-- Purpose (Phase 4 "Communication", step 1 — database foundation only):
--   Persistent doctor <-> patient chat, scoped to an EXISTING appointment.
--   A message row can only exist for an appointment whose patient or doctor
--   is the sender, and it can only be read by the two participants.
--
-- Reuses the existing security model untouched:
--   - appointments schema from supabase_schema.sql (patient_id -> patients.id,
--     doctor_id -> doctors.id, status CHECK 'scheduled'/'completed'/
--     'cancelled'/'no_show')
--   - SECURITY DEFINER helpers from 007 (STABLE, search_path='', least
--     privilege): patient_own_appointment_ids(), doctor_own_appointment_ids()
--   - RLS stays ENABLED on every table; nothing is made public.
--   - No change to booking (011/013/014/015), ECG (005/006/009/010), auth,
--     or the appointments RLS policies (003/006/007/008).
--
-- Security model for messages:
--   - SELECT: caller must be the patient (via patients.user_id = auth.uid())
--     or the doctor (via doctors.user_id = auth.uid()) of the appointment.
--     Resolved through the 007 helpers so no RLS-protected scan is reachable
--     from the policy (no 42P17 recursion, same pattern as 007).
--   - INSERT: WITH CHECK requires
--       * sender_user_id = auth.uid() (cannot impersonate anyone), AND
--       * the appointment exists and the caller is its patient or doctor,
--         resolved through one SECURITY DEFINER helper (no recursion).
--   - UPDATE/DELETE: intentionally NO policies — messages are immutable
--     audit-style chat history. authenticated holds no such table privilege.
--   - anon: no grants, no policies -> zero access (Supabase default deny).
--   - Helper is SECURITY DEFINER (owner bypasses RLS), STABLE, search_path
--     pinned to '' and fully schema-qualified inside; EXECUTE revoked from
--     PUBLIC/anon and granted to authenticated only.
--
-- Realtime (requirement 12):
--   Supabase Realtime postgis/wal_rls broadcasts row changes to subscribers;
--   the frontend later subscribes with supabase.channel().on('postgres_changes').
--   On Supabase Postgres 15 the publication is pre-created as empty
--   (supabase_realtime); ALTER PUBLICATION ... ADD TABLE adds messages to it.
--   Guarded with a DO block so the migration also applies cleanly on a plain
--   Postgres 15 sandbox where the publication does not exist (it is created
--   there, matching the Supabase default).
--
-- Run in the Supabase SQL editor as postgres/owner. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    sender_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL CHECK (btrim(body) <> '' AND char_length(body) <= 4000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Indexes (requirement 5)
-- -----------------------------------------------------------------------------
-- Chat timeline per appointment: (appointment_id, created_at) serves the
-- "load messages of this appointment in order" query as a single index scan.
CREATE INDEX IF NOT EXISTS ix_messages_appointment_created
    ON public.messages (appointment_id, created_at);
-- Sender lookup (e.g. "my messages across appointments", moderation).
CREATE INDEX IF NOT EXISTS ix_messages_sender_user_id
    ON public.messages (sender_user_id);
-- created_at alone for global recency ordering/pagination.
CREATE INDEX IF NOT EXISTS ix_messages_created_at
    ON public.messages (created_at);

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger (same pattern as supabase_schema.sql)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_messages_set_updated_at ON public.messages;
CREATE TRIGGER trg_messages_set_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. SECURITY DEFINER helper (requirement 10/11/14)
-- -----------------------------------------------------------------------------
-- Appointment IDs where the CALLER is the patient or the doctor. SECURITY
-- DEFINER as table owner bypasses RLS -> no policy re-entry (the exact
-- recursion 007 fixed). STABLE: same answer within a statement, index-safe.
CREATE OR REPLACE FUNCTION public.user_appointment_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
COST 100
ROWS 1000
AS $$
    SELECT a.id
    FROM public.appointments a
    WHERE a.patient_id IN (
              SELECT p.id FROM public.patients p WHERE p.user_id = auth.uid()
          )
       OR a.doctor_id IN (
              SELECT d.id FROM public.doctors d WHERE d.user_id = auth.uid()
          )
$$;

REVOKE ALL ON FUNCTION public.user_appointment_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_appointment_ids() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. RLS (requirements 6-9, 14)
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

-- No policy for anon is intentional: policies are TO authenticated, so anon
-- (and PUBLIC) fall through to default-deny. No UPDATE/DELETE policies:
-- chat history is immutable for participants (and they hold no such grants).

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
    FOR SELECT TO authenticated
    USING (
        appointment_id IN (SELECT public.user_appointment_ids())
    );

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_user_id = auth.uid()  -- cannot impersonate the other participant
        AND appointment_id IN (SELECT public.user_appointment_ids())
    );

-- -----------------------------------------------------------------------------
-- 6. Least-privilege grants (requirement 11)
-- -----------------------------------------------------------------------------
-- Live-Supabase parity: default privileges grant ALL on new tables, so the
-- immutability guarantee must be enforced at the privilege level too. Only
-- SELECT + INSERT remain for authenticated; anon holds nothing.
GRANT SELECT, INSERT ON public.messages TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.messages FROM authenticated;
REVOKE ALL ON public.messages FROM anon;

-- -----------------------------------------------------------------------------
-- 7. Realtime (requirement 12)
-- -----------------------------------------------------------------------------
-- Supabase Realtime (wal_rls) broadcasts messages row changes to authorized
-- subscribers; the frontend subscribes per appointment later. The publication
-- exists (empty) on Supabase Postgres 15; create-if-missing keeps the
-- migration runnable on a plain Postgres 15 sandbox.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END
$$;

-- Replica identity FULL so Realtime delivers complete old/new row images
-- (needed for UPDATE/DELETE payloads; harmless for INSERT-only chat).
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- -----------------------------------------------------------------------------
-- Verification inventory (run in SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT relrowsecurity, relforcerowsecurity FROM pg_class
--  WHERE oid = 'public.messages'::regclass;
--
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'messages';
--
-- SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'user_appointment_ids';
--
-- SELECT * FROM pg_publication_tables
--  WHERE pubname = 'supabase_realtime' AND tablename = 'messages';

-- =============================================================================
-- Summary
-- =============================================================================
-- - public.messages: appointment-scoped, participant-only chat foundation.
-- - SELECT/INSERT RLS via 007-pattern SECURITY DEFINER helper; no recursion.
-- - sender_user_id = auth.uid() in WITH CHECK: no impersonation possible.
-- - anon default-deny (no grants, no policies); no UPDATE/DELETE path at all.
-- - Realtime: messages added to supabase_realtime publication, REPLICA IDENTITY FULL.
-- - No existing table, policy, or function was modified.
-- =============================================================================
