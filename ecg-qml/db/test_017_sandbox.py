"""TEMPORARY sandbox proof for migration 017 (account-identity reconciliation).

Replicates the test_016_sandbox harness: scratch local Postgres DB with
Supabase semantics (anon/authenticated roles, auth.uid() from JWT claims),
built from the real supabase_schema.sql plus migrations 006/007/008 (RLS),
011/013/014/015 (booking), 012 (patient self-heal) and 017 (reconciliation).

auth.users is emulated with a minimal (id, email) table — exactly the surface
migration 017 reads — so reconciliation scenarios map 1:1 to production.

Covers the required reconciliation cases:
  1. brand-new auth identity -> 'created' (users row created)
  2. brand-new patient       -> patients row creatable afterwards (012 RPC + RLS)
  3. brand-new doctor        -> doctors row creatable afterwards
  4. existing auth ID        -> 'existing', NO writes (profile data untouched)
  5. legacy users row, same email, different UUID -> 'reconciled' to auth.uid()
  6. legacy patients row (with health_profiles + ecg_records + appointments
     attached) -> patients.id preserved, user_id moved, dependents intact
  7. legacy doctors row -> doctors.id preserved, user_id moved
  8. concurrent provisioning -> idempotent (two parallel sessions of the same
     new auth identity race to reconcile one legacy row; exactly one moves it,
     the loser reports 'existing'; single row + single patients row after)
  9. genuine two-identity conflict -> 'conflict', nothing deleted/merged
 10. no RLS bypass: anon cannot EXECUTE; authenticated sees only own rows;
     cross-user reconciliation impossible (email comes from auth.uid())
 11. helper properties: SECURITY DEFINER, VOLATILE, search_path pinned,
     authenticated-only EXECUTE, RLS still enabled
 12. idempotent re-apply of migration 017

Run: DATABASE_URL=... python3 test_017_sandbox.py   (needs a reachable PG)
"""

import json
import os
import re
import sys
import threading

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

DB_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(DB_DIR, "..", ".env"))

BASE_URL = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
SCRATCH_DB = "dr_radar_reconcile_test_017"
SCRATCH_URL = f"{BASE_URL}/{SCRATCH_DB}"

admin_engine = create_engine(f"{BASE_URL}/postgres", isolation_level="AUTOCOMMIT")

with admin_engine.connect() as c:
    if c.execute(text("SELECT 1 FROM pg_database WHERE datname = :d"), {"d": SCRATCH_DB}).scalar():
        c.execute(text(f"DROP DATABASE {SCRATCH_DB} WITH (FORCE)"))
    c.execute(text(f"CREATE DATABASE {SCRATCH_DB}"))
    for role in ("anon", "authenticated"):
        if not c.execute(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": role}).scalar():
            c.execute(text(f"CREATE ROLE {role} NOLOGIN"))
print("[sandbox] scratch database created:", SCRATCH_DB)

engine = create_engine(SCRATCH_URL, isolation_level="AUTOCOMMIT")

# Fixed sandbox-only UUIDs (no real accounts).
U_NEW = "a1700000-0000-0000-0000-000000000001"        # fresh auth identity
U_LEGACY = "a1700000-0000-0000-0000-000000000002"     # legacy public.users id
U_OTHER = "a1700000-0000-0000-0000-000000000003"      # NEW auth id with the LEGACY email
U_BOTH_AUTH = "a1700000-0000-0000-0000-000000000004"  # conflict case: auth id with own app data
U_BOTH_LEGACY = "a1700000-0000-0000-0000-000000000005"  # conflict case: legacy id
U_RACE_NEW = "a1700000-0000-0000-0000-000000000006"   # concurrency: new auth id
U_RACE_LEGACY = "a1700000-0000-0000-0000-000000000007"  # concurrency: legacy id
U_DOC_AUTH = "a1700000-0000-0000-0000-000000000008"   # doctor case: new auth id
U_DOC_LEGACY = "a1700000-0000-0000-0000-000000000009"  # doctor case: legacy id
EMAIL_LEGACY = "legacy.reconcile@test.local"
EMAIL_BOTH = "conflict.case@test.local"
EMAIL_RACE = "race.case@test.local"
EMAIL_DOC = "doc.reconcile@test.local"

RESULTS = []


def check(name, fn):
    try:
        fn()
        RESULTS.append((name, "PASS"))
        print(f"  PASS  {name}")
    except AssertionError as e:
        RESULTS.append((name, f"FAIL :: {e}"))
        print(f"  FAIL  {name} :: {e}")
    except Exception as e:  # noqa: BLE001
        RESULTS.append((name, f"ERROR :: {type(e).__name__}: {str(e)[:140]}"))
        print(f"  ERROR {name} :: {type(e).__name__}: {str(e)[:140]}")


def as_user(conn, uid, role="authenticated"):
    conn.exec_driver_sql("RESET ROLE")
    if uid is None:
        conn.exec_driver_sql("SET ROLE anon")
        conn.exec_driver_sql("SET request.jwt.claims = '{}'")
    else:
        assert re.match(r"^[0-9a-fA-F-]{36}$", uid)
        claims = json.dumps({"sub": uid, "role": role}).replace("'", "")
        conn.exec_driver_sql(f"SET request.jwt.claims = '{claims}'")
        conn.exec_driver_sql(f"SET ROLE {role}")


def sqlstate_of(exc):
    orig = getattr(exc, "orig", None)
    return getattr(orig, "sqlstate", None) or getattr(exc, "sqlstate", None) or ""


def expect_error(conn, sql, params, contains=None, code=None):
    try:
        conn.execute(text(sql), params or {})
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if contains and contains.lower() not in msg.lower():
            raise AssertionError(f"expected message containing {contains!r}, got: {msg[:160]}") from e
        if code and code not in sqlstate_of(e) and code not in msg:
            raise AssertionError(f"expected {code}, got: {msg[:160]}") from e
        return msg
    raise AssertionError(f"expected error, but statement succeeded: {sql[:90]}")


def run_file(conn, path):
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    # sandbox-only: strip any invalid pg_policy.polytype DO-guards (003/004 pattern)
    sql = re.sub(r"DO \$\$.*?pg_policy.*?END\s*\$\$;", "", sql, flags=re.DOTALL)
    # Migration files contain literal '%' (RAISE EXCEPTION formats), which the
    # SQLAlchemy/psycopg3 parameter parser rejects — run them on a raw cursor.
    raw = conn.connection.driver_connection
    with raw.cursor() as cur:
        cur.execute(sql)


def reconcile(conn):
    return conn.execute(
        text("SELECT * FROM public.reconcile_account_identity()")
    ).mappings().one()


def insert_user(conn, uid, email, role="patient", first="Old", last="Identity"):
    conn.execute(
        text(
            "INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash, onboarding_completed, profile_completed) "
            "VALUES (CAST(:i AS uuid), :e, :r, :f, :l, :d, 'x', TRUE, TRUE)"
        ),
        {"i": uid, "e": email, "r": role, "f": first, "l": last, "d": f"{first} {last}"},
    )


def seed_auth_user(conn, uid, email):
    """Emulate auth.users (minimal surface read by migration 017)."""
    conn.execute(
        text("INSERT INTO auth.users (id, email) VALUES (CAST(:i AS uuid), :e) "
             "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email"),
        {"i": uid, "e": email},
    )


print("[sandbox] creating schema (mirrors live Supabase schema)...")

SETUP = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
"""

MIGRATIONS = (
    "006_doctor_ecg_access_rls.sql",
    "007_fix_appointments_rls_recursion.sql",
    "008_ensure_core_rls_policies.sql",
    "011_doctor_directory_and_booking.sql",
    "013_doctor_availability_and_slot_exclusivity.sql",
    "014_doctor_availability_date.sql",
    "015_request_appointment_volatile.sql",
)

with engine.connect() as conn:
    conn.exec_driver_sql(SETUP)
    with open(os.path.join(DB_DIR, "supabase_schema.sql"), encoding="utf-8") as f:
        conn.exec_driver_sql(f.read())

    for t in (
        "users", "patients", "doctors", "appointments", "health_profiles",
        "ecg_records", "predictions", "explanations", "consultations", "reports",
    ):
        conn.exec_driver_sql(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY")

    conn.exec_driver_sql("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;")
    conn.exec_driver_sql("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;")

    for mig in MIGRATIONS:
        run_file(conn, os.path.join(DB_DIR, mig))
        print(f"[sandbox] applied migration {mig}")

    run_file(conn, os.path.join(DB_DIR, "012_ensure_patient_profile.sql"))
    print("[sandbox] applied migration 012_ensure_patient_profile.sql")

    # ---- Seed BEFORE 017 (mirrors production: legacy rows exist already) ----
    # Conflict case: auth identity already has its OWN users+patients rows under
    # a different email; a legacy row with the SAME auth email also exists.
    seed_auth_user(conn, U_BOTH_AUTH, EMAIL_BOTH)
    insert_user(conn, U_BOTH_AUTH, "both.new@test.local", role="patient", first="Both", last="Auth")
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (CAST(:u AS uuid))"), {"u": U_BOTH_AUTH})
    insert_user(conn, U_BOTH_LEGACY, EMAIL_BOTH, role="patient", first="Both", last="Legacy")
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (CAST(:u AS uuid))"), {"u": U_BOTH_LEGACY})

    # Concurrency race: TWO parallel sessions of the SAME new auth identity
    # (production: React StrictMode double-fire / double login) reconciling the
    # same legacy row. The legacy id is deliberately NOT in auth.users (an
    # orphaned application row — the production legacy shape).
    seed_auth_user(conn, U_RACE_NEW, EMAIL_RACE)
    insert_user(conn, U_RACE_LEGACY, EMAIL_RACE, role="patient", first="Race", last="Case")
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (CAST(:u AS uuid))"), {"u": U_RACE_LEGACY})

    # Doctor reconciliation case: legacy doctor + new auth id, same email.
    seed_auth_user(conn, U_DOC_AUTH, EMAIL_DOC)
    insert_user(conn, U_DOC_LEGACY, EMAIL_DOC, role="doctor", first="Doc", last="Legacy")
    conn.execute(
        text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (CAST(:u AS uuid), 'Dr', 'Neurology')"),
        {"u": U_DOC_LEGACY},
    )

    # Brand-new patient case.
    seed_auth_user(conn, U_NEW, "brand.new@test.local")
    print("[sandbox] seeded auth.users emulation + legacy identities")

    run_file(conn, os.path.join(DB_DIR, "017_reconcile_account_identity.sql"))
    print("[sandbox] applied migration 017_reconcile_account_identity.sql\n")

    # =========================================================
    print("=== A. brand-new identity -> 'created' ===")

    def a1():
        as_user(conn, U_NEW)
        row = reconcile(conn)
        assert row["status"] == "created", f"expected created, got {row['status']}"
        assert str(row["user_id"]) == U_NEW
        n = conn.execute(
            text("SELECT count(*) FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_NEW}
        ).scalar()
        assert n == 1, f"exactly one users row expected, saw {n}"
    check("1. brand-new auth identity -> 'created' (users row created)", a1)

    def a2():
        as_user(conn, U_NEW)
        # Brand-new PATIENT: the 012 self-heal RPC must work after reconcile.
        pid = conn.execute(text("SELECT public.ensure_patient_profile()")).scalar()
        assert pid, "patients row must be creatable for the new identity"
        # ...and the client-side patients upsert path (RLS INSERT) succeeds.
        conn.execute(
            text("INSERT INTO public.patients (user_id, dob) VALUES (CAST(:u AS uuid), NULL) "
                 "ON CONFLICT (user_id) DO NOTHING"),
            {"u": U_NEW},
        )
        n = conn.execute(
            text("SELECT count(*) FROM public.patients WHERE user_id = CAST(:u AS uuid)"), {"u": U_NEW}
        ).scalar()
        assert n == 1, f"exactly one patients row expected, saw {n}"
    check("2. brand-new patient -> patients row creatable (012 RPC + RLS)", a2)

    def a3():
        # Brand-new DOCTOR: users row exists; doctors INSERT under RLS succeeds.
        u_doc_new = "a1700000-0000-0000-0000-00000000000a"
        seed_auth_user(conn, u_doc_new, "brand.doc@test.local")
        as_user(conn, u_doc_new)
        row = reconcile(conn)
        assert row["status"] == "created"
        conn.execute(
            text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (CAST(:u AS uuid), 'Dr', 'Cardiology')"),
            {"u": u_doc_new},
        )
        n = conn.execute(
            text("SELECT count(*) FROM public.doctors WHERE user_id = CAST(:u AS uuid)"), {"u": u_doc_new}
        ).scalar()
        assert n == 1
    check("3. brand-new doctor -> doctors row creatable", a3)

    # =========================================================
    print("\n=== B. existing identity -> 'existing', zero writes ===")

    def b1():
        as_user(conn, U_NEW)
        conn.execute(
            text("UPDATE public.users SET first_name = 'Customized', display_name = 'Customized Name' "
                 "WHERE id = CAST(:u AS uuid)"),
            {"u": U_NEW},
        )
        row = reconcile(conn)
        assert row["status"] == "existing", f"expected existing, got {row['status']}"
        name = conn.execute(
            text("SELECT first_name FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_NEW}
        ).scalar()
        assert name == "Customized", f"profile overwritten during login sync: {name!r}"
    check("4. existing auth ID -> 'existing', profile data NOT overwritten", b1)

    # =========================================================
    print("\n=== C. legacy identity reconciliation (the core bug) ===")

    def c1():
        # Legacy state: U_LEGACY owns the email + a patients row with data.
        insert_user(conn, U_LEGACY, EMAIL_LEGACY, role="patient", first="Legacy", last="Patient")
        legacy_patient = conn.execute(
            text("INSERT INTO public.patients (user_id) VALUES (CAST(:u AS uuid)) RETURNING id"),
            {"u": U_LEGACY},
        ).scalar()
        hp = conn.execute(
            text("INSERT INTO public.health_profiles (patient_id, primary_goal) VALUES (CAST(:p AS uuid), 'monitor') RETURNING id"),
            {"p": legacy_patient},
        ).scalar()
        ecg = conn.execute(
            text("INSERT INTO public.ecg_records (patient_id, ecg_values, recorded_at) "
                 "VALUES (CAST(:p AS uuid), '{\"a\":1}', now()) RETURNING id"),
            {"p": legacy_patient},
        ).scalar()
        appt = conn.execute(
            text("INSERT INTO public.appointments (patient_id, doctor_id, start_time, status) "
                 "SELECT CAST(:p AS uuid), d.id, now() + interval '1 day', 'scheduled' "
                 "FROM public.doctors d LIMIT 1 RETURNING id"),
            {"p": legacy_patient},
        ).scalar()
        conn.commit()

        # The NEW auth id claims the SAME email (production: auth.users).
        seed_auth_user(conn, U_OTHER, EMAIL_LEGACY)

        # RLS: the new identity cannot see the legacy row.
        as_user(conn, U_OTHER)
        hidden = conn.execute(
            text("SELECT count(*) FROM public.users WHERE email = :e"), {"e": EMAIL_LEGACY}
        ).scalar()
        assert hidden == 0, "RLS must hide the legacy row from the new auth identity"

        # The RPC (SECURITY DEFINER) sees it and reconciles.
        row = reconcile(conn)
        assert row["status"] == "reconciled", f"expected reconciled, got {row['status']}"
        assert str(row["user_id"]) == U_OTHER
        assert str(row["patient_id"]) == str(legacy_patient), "RPC must return the preserved patients.id"

        # Identity moved; profile data preserved; no duplicate.
        u = conn.execute(
            text("SELECT email, first_name FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_OTHER}
        ).one()
        assert str(u.email) == EMAIL_LEGACY
        assert str(u.first_name) == "Legacy", "legacy profile data must be preserved"
        pid = conn.execute(
            text("SELECT id FROM public.patients WHERE user_id = CAST(:u AS uuid)"), {"u": U_OTHER}
        ).scalar()
        assert str(pid) == str(legacy_patient), "patients.id must be unchanged"
        assert conn.execute(
            text("SELECT count(*) FROM public.health_profiles WHERE id = CAST(:h AS uuid)"), {"h": hp}
        ).scalar() == 1, "health_profiles row must survive"
        assert conn.execute(
            text("SELECT count(*) FROM public.ecg_records WHERE id = CAST(:e AS uuid)"), {"e": ecg}
        ).scalar() == 1, "ecg_records row must survive"
        assert conn.execute(
            text("SELECT count(*) FROM public.appointments WHERE id = CAST(:a AS uuid)"), {"a": appt}
        ).scalar() == 1, "appointments row must survive"
        assert conn.execute(
            text("SELECT count(*) FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_LEGACY}
        ).scalar() == 0, "old users.id must no longer exist (moved, not duplicated)"
        assert conn.execute(
            text("SELECT count(*) FROM public.users WHERE email = :e"), {"e": EMAIL_LEGACY}
        ).scalar() == 1, "exactly one users row for the email after reconcile"
    check("5. legacy users row same email -> reconciled to auth.uid(); data preserved", c1)

    def c2():
        # Scenario 6 follow-up: exactly one patients row, original id (covered
        # in check 5); repeat-call stability (StrictMode double-fire).
        as_user(conn, U_OTHER)
        r1 = reconcile(conn)
        r2 = reconcile(conn)
        assert r1["status"] == "existing" and r2["status"] == "existing"
        assert str(r1["patient_id"]) == str(r2["patient_id"]) != "None"
    check("6. legacy patient data preserved; repeated calls stable", c2)

    def c3():
        # Scenario 7: legacy DOCTOR row moves to the new auth identity.
        as_user(conn, U_DOC_AUTH)
        row = reconcile(conn)
        assert row["status"] == "reconciled", f"expected reconciled, got {row['status']}"
        assert str(row["doctor_id"]), "RPC must return the moved doctors.id"
        d = conn.execute(
            text("SELECT id, title, specialty FROM public.doctors WHERE user_id = CAST(:u AS uuid)"),
            {"u": U_DOC_AUTH},
        ).one()
        assert str(d.specialty) == "Neurology", "doctor row data must be preserved"
        assert conn.execute(
            text("SELECT count(*) FROM public.doctors WHERE user_id = CAST(:u AS uuid)"), {"u": U_DOC_LEGACY}
        ).scalar() == 0, "old doctors.user_id reference must be gone"
        assert conn.execute(
            text("SELECT count(*) FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_DOC_LEGACY}
        ).scalar() == 0, "legacy users row must be gone (moved)"
    check("7. legacy doctor row -> moved to auth.uid(), data preserved", c3)

    # =========================================================
    print("\n=== D. concurrency: idempotent under racing sessions ===")

    def d1():
        # Two PARALLEL sessions of the SAME new auth identity (U_RACE_NEW)
        # reconcile the same legacy row. The FOR UPDATE lock on the legacy row
        # serializes them: the winner re-keys it, the loser's locked re-read
        # observes the re-keyed row and reports 'existing'. Every session must
        # observe a consistent outcome and the data must stay single.
        barrier = threading.Barrier(2)
        outcomes = []

        def worker():
            eng = create_engine(SCRATCH_URL, isolation_level="AUTOCOMMIT")
            try:
                with eng.connect() as c2:
                    as_user(c2, U_RACE_NEW)
                    barrier.wait()  # maximize interleaving
                    outcomes.append(reconcile(c2)["status"])
            finally:
                eng.dispose()

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start(); t2.start(); t1.join(); t2.join()

        assert set(outcomes) <= {"created", "reconciled", "existing"}, f"unexpected statuses: {outcomes}"
        assert "reconciled" in outcomes, f"one session must perform the reconciliation: {outcomes}"
        n = conn.execute(
            text("SELECT count(*) FROM public.users WHERE email = :e"), {"e": EMAIL_RACE}
        ).scalar()
        assert n == 1, f"exactly one users row for the raced email, saw {n}"
        n = conn.execute(
            text("SELECT count(*) FROM public.users WHERE id = CAST(:u AS uuid)"), {"u": U_RACE_NEW}
        ).scalar()
        assert n == 1, "the identity's users row must exist exactly once"
        n = conn.execute(
            text("SELECT count(*) FROM public.patients WHERE user_id = CAST(:u AS uuid)"), {"u": U_RACE_NEW}
        ).scalar()
        assert n == 1, f"the legacy patients row must follow the identity exactly once, saw {n}"
        # Post-race stability: further calls are all 'existing'.
        r = reconcile(conn)
        assert r["status"] == "existing"
    check("8. concurrent provisioning -> idempotent, single identity", d1)

    # =========================================================
    print("\n=== E. genuine two-identity conflict -> 'conflict', data kept ===")

    def e1():
        as_user(conn, U_BOTH_AUTH)
        row = reconcile(conn)
        assert row["status"] == "conflict", f"expected conflict, got {row['status']}"
        assert row["message"], "conflict must carry an explanatory message"
        # Nothing deleted, nothing merged:
        assert conn.execute(
            text("SELECT count(*) FROM public.patients WHERE user_id = CAST(:u AS uuid)"), {"u": U_BOTH_AUTH}
        ).scalar() == 1, "auth identity's patients row must be preserved"
        assert conn.execute(
            text("SELECT count(*) FROM public.patients WHERE user_id = CAST(:u AS uuid)"), {"u": U_BOTH_LEGACY}
        ).scalar() == 1, "legacy identity's patients row must be preserved"
        assert conn.execute(
            text("SELECT count(*) FROM public.users WHERE email IN (:a, :b)"),
            {"a": "both.new@test.local", "b": EMAIL_BOTH},
        ).scalar() == 2, "conflict must not delete or merge users rows"
    check("9. two-identity conflict -> 'conflict', BOTH identities' data preserved", e1)

    # =========================================================
    print("\n=== F. security: RLS intact, cross-user impossible, grants ===")

    def f1():
        as_user(conn, None)
        expect_error(conn, "SELECT * FROM public.reconcile_account_identity()", {}, code="42501")
        expect_error(conn, "SELECT count(*) FROM public.users", {}, code="42501")
    check("10a. anon cannot execute the reconciliation RPC (RLS intact)", f1)

    def f2():
        # Authenticated user sees ONLY their own row (RLS unchanged).
        as_user(conn, U_OTHER)
        n = conn.execute(text("SELECT count(*) FROM public.users"), {}).scalar()
        assert n == 1, f"authenticated must see exactly their own row, saw {n}"
        # ...and cannot update someone else's.
        expect_error(
            conn,
            "UPDATE public.users SET email = 'hijacked@test.local' WHERE email = :e",
            {"e": EMAIL_RACE},
            code="42501",
        )
    check("10b. no RLS bypass: authenticated sees only own rows", f2)

    def f3():
        # The RPC takes NO parameters: the email always comes from auth.uid(),
        # so a caller can never reconcile someone else's email. Also verify a
        # direct cross-user patients UPDATE is blocked by RLS.
        nparams = conn.execute(
            text("SELECT pronargs FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                 "WHERE n.nspname='public' AND p.proname='reconcile_account_identity'")
        ).scalar()
        assert nparams == 0, "RPC must take no client-supplied arguments"
        as_user(conn, U_OTHER)
        expect_error(
            conn,
            "UPDATE public.patients SET user_id = CAST(:me AS uuid) WHERE user_id = CAST(:them AS uuid)",
            {"me": U_OTHER, "them": U_BOTH_LEGACY},
            code="42501",
        )
    check("10c. cross-user reconciliation impossible (email from auth.uid(), no args)", f3)

    def f4():
        row = conn.execute(
            text(
                "SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig, "
                "       has_function_privilege('anon', 'public.reconcile_account_identity()', 'EXECUTE') AS grant_anon, "
                "       has_function_privilege('authenticated', 'public.reconcile_account_identity()', 'EXECUTE') AS grant_auth "
                "FROM pg_proc p WHERE p.oid = to_regprocedure('public.reconcile_account_identity()')"
            )
        ).one()
        assert row.prosecdef is True, "must be SECURITY DEFINER"
        assert row.provolatile == "v", f"must be VOLATILE, got {row.provolatile!r}"
        assert row.proconfig is not None and any(
            c.startswith("search_path=") and c[len("search_path="):].strip('"') == ""
            for c in row.proconfig
        ), f"search_path must be pinned to empty, got {row.proconfig}"
        assert row.grant_anon is False, "anon must not hold EXECUTE"
        assert row.grant_auth is True, "authenticated must hold EXECUTE"
        for t in ("users", "patients", "doctors"):
            rls = conn.execute(
                text("SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass(:r)"), {"r": f"public.{t}"}
            ).scalar()
            assert rls is True, f"RLS must remain enabled on {t}"
    check("11. SECURITY DEFINER + search_path pinned + authenticated-only + RLS on", f4)

    # =========================================================
    print("\n=== G. migration 017 is idempotent ===")

    def g1():
        conn.exec_driver_sql("RESET ROLE")  # DDL needs the DB owner role
        run_file(conn, os.path.join(DB_DIR, "017_reconcile_account_identity.sql"))
        print("[sandbox] re-applied migration 017_reconcile_account_identity.sql")
        as_user(conn, U_OTHER)
        row = reconcile(conn)
        assert row["status"] == "existing", f"data must survive re-apply, got {row['status']}"
    check("12. re-applying 017 is a no-op (data + security intact)", g1)

    conn.exec_driver_sql("RESET ROLE")

# =========================================================
print("\n[sandbox] results")
failed = 0
for name, status in RESULTS:
    if not status.startswith("PASS"):
        failed += 1
        print(f"  {status:10} {name}")
if failed == 0:
    print(f"  ALL {len(RESULTS)} CHECKS PASSED")
else:
    print(f"  {failed}/{len(RESULTS)} CHECKS FAILED")

engine.dispose()
admin_engine.dispose()
sys_exit = 1 if failed else 0
print("[sandbox] done")
raise SystemExit(sys_exit)
