-- =============================================================================
-- Dr. Radar Migration 017: general account-identity reconciliation RPC
-- =============================================================================
-- Bug fixed (GENERAL, not account-specific):
--   A legitimate Supabase Auth user signs in with auth.uid() = NEW_AUTH_ID and
--   auth.users.email = E, but a LEGACY public.users row (OLD_ID, same email E)
--   already exists. The frontend provisioning upsert
--     public.users.upsert({ id: NEW_AUTH_ID, email: E, ... }, { onConflict: 'id' })
--   hits the UNIQUE(email) constraint users_email_key -> Postgres 23505 ->
--   PostgREST 409 -> the generic "We couldn't save your profile..." error.
--   RLS (users_read_own: id = auth.uid()) hides the legacy row from the
--   frontend, so the client cannot even see — let alone resolve — the
--   conflict. This has now happened to multiple accounts and WILL happen for
--   every future legacy-identity signup.
--
-- Root cause:
--   public.users.id (application identity) and auth.users.id (Supabase Auth
--   identity) can drift apart for the same human: e.g. the user was created
--   before the current auth architecture (auth row deleted and re-registered,
--   or the row predates Supabase Auth entirely). auth.uid() is authoritative
--   (safety rule 6); the application identity must be brought to it.
--
-- Fix — reconcile_account_identity():
--   A SECURITY DEFINER RPC that, in ONE atomic statement, either
--     - finds the caller's own users row for auth.uid()        -> 'existing'
--       (syncing ONLY the email handle if it diverged from auth.users and no
--       other row owns it — profile data is never touched),
--     - creates it (normal fresh signup)                       -> 'created',
--     - re-keys the legacy identity to auth.uid()              -> 'reconciled'
--       (patients.user_id / doctors.user_id moved FIRST, then the users row
--       id updated — the FK graph hangs off patients.id / doctors.id, which
--       never change, so health_profiles / ecg_records / predictions /
--       explanations / appointments / consultations / reports / storage
--       paths ({patient_id}/...) are preserved untouched), or
--     - reports 'conflict' when reconciliation is not safe (requires
--       administrative review; the RPC deletes nothing and merges nothing):
--         a) the legacy users.id is itself still a LIVE auth.users identity
--            (two live auth identities claiming one application row — only
--            an admin can decide ownership),
--         b) moving the identity violates a dependent foreign key (e.g. chat
--            messages: 016 sets FORCE ROW LEVEL SECURITY, so hidden rows
--            cannot even be detected beforehand — the FK violation is caught
--            atomically and NOTHING is left half-moved),
--         c) the legacy identity holds BOTH a patient and a doctor profile,
--         d) the auth identity already owns application rows (orphaned
--            patients/doctors row, or two application rows for one human).
--
-- Security model — NOTHING weakened (rules 1-10):
--   - RLS stays ENABLED everywhere; no policy created/dropped/altered. The
--     function is SECURITY DEFINER (the table owner bypasses RLS INSIDE the
--     function for tables WITHOUT FORCE RLS) and reads/writes rows the caller
--     cannot see — that is the point: RLS hid the legacy row from the frontend.
--   - Cross-user safety: every branch keys off auth.uid() / the auth.users
--     email of auth.uid(). The function takes NO arguments, so a caller can
--     only ever reconcile THEIR OWN email.
--   - SET search_path = '' with fully schema-qualified names (no hijack).
--   - authenticated-only EXECUTE; anon and PUBLIC revoked (rule 3: no service
--     role is involved anywhere).
--   - Nothing is ever deleted (rule 4). Conflict branches preserve BOTH
--     identities (rule 5). Profile data of an existing row is never
--     overwritten during login sync (rule 9).
--   - Concurrency-safe (rule 7): FOR UPDATE on the legacy row serializes
--     reconcilers (a loser of the race re-reads the re-keyed row and reports
--     'existing'); the insert path uses ON CONFLICT DO NOTHING + re-read.
--     The FK-violation handler rolls back the ENTIRE move block (plpgsql
--     savepoint semantics), so no interleaving can leave half-moved data.
--     Assumption: auth.users.email is unique per project (Supabase Auth
--     guarantees this), so at most one live auth identity maps to an email.
--   - Errors propagate (rule 8): genuine DB failures RAISE (surfaced by the
--     frontend verbatim in DEV, generic message in prod). FK conflicts are
--     NOT swallowed — they are converted into the documented 'conflict'
--     outcome with all data preserved.
--
-- Reconciliation order (derived from the FK graph — see sandbox test):
--   FKs referencing public.users.id (verified by migration inspection):
--     patients.user_id        (UNIQUE, ON DELETE CASCADE, ON UPDATE NO ACTION)
--     doctors.user_id         (UNIQUE, ON DELETE CASCADE, ON UPDATE NO ACTION)
--     messages.sender_user_id (016, ON DELETE CASCADE, ON UPDATE NO ACTION)
--   Because ON UPDATE is NO ACTION, child user_id references must be moved
--   BEFORE the users.id re-key, all inside the single function statement.
--   messages rows are NOT moved (moving chat authorship is an audit-relevant
--   merge decision AND 016's FORCE RLS makes hidden rows unmovable): a legacy
--   identity with chat history fails the re-key with 23503, which the
--   handler converts to 'conflict' with everything rolled back intact.
--   patients.id / doctors.id NEVER change => every grandchild FK
--   (appointments.patient_id, ecg_records.patient_id, reports.patient_id,
--   health_profiles.patient_id, appointments.doctor_id, ...) keeps pointing
--   at the same rows. Storage paths "{patient_id}/..." likewise.
--   NOTHING is deleted or duplicated (rule 5).
--
-- Run in the Supabase SQL editor as postgres/owner. Idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_account_identity()
RETURNS TABLE (
    status     text,
    user_id    uuid,
    patient_id uuid,
    doctor_id  uuid,
    message    text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_id        uuid := auth.uid();
    v_auth_email     text;
    v_own_row        public.users%ROWTYPE;
    v_legacy         public.users%ROWTYPE;
    v_patient_id     uuid;
    v_doctor_id      uuid;
    v_legacy_patient uuid;
    v_legacy_doctor  uuid;
    v_conflict_msg   text;
BEGIN
    -- 1. Must be an authenticated call (auth.uid() is NULL for anon).
    IF v_auth_id IS NULL THEN
        RAISE EXCEPTION 'reconcile_account_identity requires an authenticated session';
    END IF;

    -- 2. The authoritative email comes from auth.users via auth.uid() — never
    --    from a client argument (rule 6). No auth.users row => not a real
    --    authenticated user.
    SELECT au.email INTO v_auth_email
      FROM auth.users au
     WHERE au.id = v_auth_id;
    IF v_auth_email IS NULL OR btrim(v_auth_email) = '' THEN
        RAISE EXCEPTION 'No auth.users row for the authenticated identity';
    END IF;

    -- 3. Existing application row for auth.uid()?
    SELECT * INTO v_own_row
      FROM public.users u
     WHERE u.id = v_auth_id;
    IF FOUND THEN
        SELECT p.id INTO v_patient_id FROM public.patients p WHERE p.user_id = v_auth_id;
        SELECT d.id INTO v_doctor_id  FROM public.doctors  d WHERE d.user_id = v_auth_id;

        IF lower(btrim(COALESCE(v_own_row.email, ''))) = lower(btrim(v_auth_email)) THEN
            -- 3a. Healthy account: success, no writes. Login sync must never
            --     overwrite profile data (rule 9).
            RETURN QUERY SELECT 'existing'::text, v_auth_id, v_patient_id, v_doctor_id,
                'Application identity already linked to this auth user'::text;
            RETURN;
        END IF;

        -- 3b. The own row's email handle diverged from the auth identity.
        IF EXISTS (
            SELECT 1 FROM public.users u2
             WHERE lower(btrim(u2.email)) = lower(btrim(v_auth_email))
               AND u2.id <> v_auth_id
        ) THEN
            -- Another application row owns the auth email: two application
            -- rows for one human — do NOT merge (rule 5); admin review.
            RETURN QUERY SELECT 'conflict'::text, v_auth_id, v_patient_id, v_doctor_id,
                'This sign-in email is also used by another profile; administrative review required'::text;
            RETURN;
        END IF;

        -- No other row owns the auth email: sync the handle on the caller's
        -- OWN row (identity repair scoped to auth.uid(), not profile data).
        UPDATE public.users SET email = v_auth_email WHERE id = v_auth_id;
        RETURN QUERY SELECT 'existing'::text, v_auth_id, v_patient_id, v_doctor_id,
            'Application identity already linked to this auth user (email synced)'::text;
        RETURN;
    END IF;

    -- 4. Legacy application row with the same email (different id)?
    --    Lock it FOR UPDATE so concurrent reconciles serialize instead of
    --    interleaving (rule 7). If a concurrent transaction re-keyed the row
    --    to OUR id between step 3 and here, the locked re-read below yields
    --    the updated row and branch 4b reports 'existing'.
    SELECT * INTO v_legacy
      FROM public.users u
     WHERE lower(btrim(u.email)) = lower(btrim(v_auth_email))
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        -- 4a. Fresh signup: create the normal users row. ON CONFLICT DO
        --     NOTHING + re-read makes concurrent first-logins idempotent.
        --     role defaults to 'patient'; provisioning sets the real role and
        --     profile afterwards. Names fall back to the email local part.
        INSERT INTO public.users (
            id, email, role, first_name, last_name, display_name,
            password_hash, onboarding_completed, profile_completed
        ) VALUES (
            v_auth_id, v_auth_email, 'patient',
            split_part(v_auth_email, '@', 1), '', split_part(v_auth_email, '@', 1),
            'supabase-auth-managed', FALSE, FALSE
        )
        ON CONFLICT (id) DO NOTHING;

        SELECT * INTO v_own_row FROM public.users u WHERE u.id = v_auth_id;
        IF v_own_row.id IS NULL THEN
            -- Unreachable under READ COMMITTED after ON CONFLICT; guard
            -- anyway rather than return a null id (fail loudly, rule 8).
            RAISE EXCEPTION 'reconcile_account_identity: users row missing after insert (concurrency anomaly)';
        END IF;

        SELECT p.id INTO v_patient_id FROM public.patients p WHERE p.user_id = v_auth_id;
        SELECT d.id INTO v_doctor_id  FROM public.doctors  d WHERE d.user_id = v_auth_id;
        RETURN QUERY SELECT 'created'::text, v_auth_id, v_patient_id, v_doctor_id,
            'Application row created for this auth identity'::text;
        RETURN;
    END IF;

    -- 4b. The locked row turned out to be OURS already (a concurrent
    --     reconcile re-keyed it between our step 3 and this read): success.
    IF v_legacy.id = v_auth_id THEN
        SELECT p.id INTO v_patient_id FROM public.patients p WHERE p.user_id = v_auth_id;
        SELECT d.id INTO v_doctor_id  FROM public.doctors  d WHERE d.user_id = v_auth_id;
        RETURN QUERY SELECT 'existing'::text, v_auth_id, v_patient_id, v_doctor_id,
            'Application identity already linked to this auth user'::text;
        RETURN;
    END IF;

    -- 4c. Guard: is the legacy users.id itself a LIVE auth identity? If yes,
    --     there are two live auth identities claiming one application row and
    --     only an administrator may decide ownership — moving the row would
    --     hijack the other live identity's data (rules 4/5).
    IF EXISTS (SELECT 1 FROM auth.users au WHERE au.id = v_legacy.id) THEN
        RETURN QUERY SELECT 'conflict'::text, v_legacy.id,
            (SELECT p.id FROM public.patients p WHERE p.user_id = v_legacy.id),
            (SELECT d.id FROM public.doctors d WHERE d.user_id = v_legacy.id),
            'The existing profile belongs to another active sign-in identity; administrative review required'::text;
        RETURN;
    END IF;

    -- 5. Dependent-data guards (no writes yet).
    SELECT p.id INTO v_legacy_patient FROM public.patients p WHERE p.user_id = v_legacy.id;
    SELECT d.id INTO v_legacy_doctor  FROM public.doctors  d WHERE d.user_id = v_legacy.id;

    IF v_legacy_patient IS NOT NULL AND v_legacy_doctor IS NOT NULL THEN
        -- Pathological legacy row holding BOTH a patient and a doctor profile
        -- (the schema allows it). Not safely reconcilable here.
        RETURN QUERY SELECT 'conflict'::text, v_legacy.id, v_legacy_patient, v_legacy_doctor,
            'Legacy identity holds both a patient and a doctor profile; administrative review required'::text;
        RETURN;
    END IF;

    -- 5b. Chat history (016) uses FORCE ROW LEVEL SECURITY: hidden rows are
    --     typically INVISIBLE even to the definer, so this check is
    --     best-effort. The authoritative net is the FK-violation handler
    --     around the move block below, which converts any unmovable
    --     reference into 'conflict' with everything rolled back intact.
    IF to_regclass('public.messages') IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.messages m WHERE m.sender_user_id = v_legacy.id) THEN
        RETURN QUERY SELECT 'conflict'::text, v_legacy.id, v_legacy_patient, v_legacy_doctor,
            'The existing profile has chat history; administrative review required'::text;
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.patients p WHERE p.user_id = v_auth_id)
       OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.user_id = v_auth_id) THEN
        -- The auth identity already owns application rows (orphaned profile
        -- data without a users row): DO NOT merge (rule 5); admin review.
        RETURN QUERY SELECT 'conflict'::text, v_legacy.id, v_legacy_patient, v_legacy_doctor,
            'Both identities already have application data; administrative review required'::text;
        RETURN;
    END IF;

    -- 6. Safe reconciliation — children first (ON UPDATE NO ACTION FKs), then
    --    the identity re-key — all in this one block/transaction (atomic).
    --    If ANY dependent reference cannot be moved (e.g. chat messages under
    --    FORCE RLS), the handler rolls the WHOLE block back (plpgsql savepoint
    --    semantics) and reports a structured conflict: nothing half-moved.
    BEGIN
        --    6a. Move the legacy patients row (data attached via patient_id
        --        is preserved untouched — only user_id changes).
        IF v_legacy_patient IS NOT NULL THEN
            UPDATE public.patients
               SET user_id = v_auth_id
             WHERE id = v_legacy_patient;
        END IF;

        --    6b. Move the legacy doctors row the same way.
        IF v_legacy_doctor IS NOT NULL THEN
            UPDATE public.doctors
               SET user_id = v_auth_id
             WHERE id = v_legacy_doctor;
        END IF;

        --    6c. Re-key the identity: the legacy users row becomes the auth
        --        identity. The legacy users.id disappears as a PK — nothing
        --        movable references it anymore (6a/6b moved patients/doctors;
        --        messages rows are deliberately never moved — see 5b).
        UPDATE public.users
           SET id = v_auth_id
         WHERE id = v_legacy.id;

        RETURN QUERY SELECT 'reconciled'::text, v_auth_id, v_legacy_patient, v_legacy_doctor,
            'Legacy identity reconciled to this auth user; all related data preserved'::text;
        RETURN;
    EXCEPTION
        WHEN foreign_key_violation OR unique_violation THEN
            -- Everything this block wrote is rolled back; both identities and
            -- all dependent data are untouched. Surface a structured conflict
            -- (rule 8: honest, never swallowed) for administrative review.
            v_conflict_msg :=
                'The existing profile has records that cannot be moved automatically; administrative review required';
            RETURN QUERY SELECT 'conflict'::text, v_legacy.id, v_legacy_patient, v_legacy_doctor,
                v_conflict_msg;
            RETURN;
    END;
END;
$$;

-- -----------------------------------------------------------------------------
-- Least privilege: authenticated only (rule 3), anon/public denied.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reconcile_account_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_account_identity() TO authenticated;

-- -----------------------------------------------------------------------------
-- Verification inventory (run in the SQL editor to confirm live state)
-- -----------------------------------------------------------------------------
-- SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'reconcile_account_identity';
--
-- SELECT has_function_privilege('anon',          'public.reconcile_account_identity()', 'EXECUTE'), -- false
--        has_function_privilege('authenticated','public.reconcile_account_identity()', 'EXECUTE'); -- true
--
-- -- Policies on users/patients/doctors must be UNCHANGED (exactly the 008 set):
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('users','patients','doctors');
--
-- -- RLS still enabled on every core table:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relnamespace = 'public'::regnamespace
--    AND relname IN ('users','patients','doctors');
--
-- =============================================================================
-- Summary
-- =============================================================================
-- - General fix: any legitimate auth user hitting the users_email_key 23505
--   legacy collision is reconciled automatically; no per-account SQL, no
--   hardcoded ids/emails, no rows deleted, no RLS change.
-- - patients/doctors rows keep their PKs; all dependent data (ECG records,
--   predictions, explanations, appointments, consultations, reports, health
--   profiles, storage paths) survives untouched.
-- - Conflicts that only an administrator may resolve (live duplicate auth
--   identity, unmovable references such as chat history, dual role profiles,
--   two application rows for one human) are surfaced as structured
--   'conflict' results — never merged, half-moved, or destroyed.
-- - Safe under concurrency: FOR UPDATE lock on the legacy row, ON CONFLICT
--   guards on inserts, FK-violation handler with full rollback.
-- =============================================================================
