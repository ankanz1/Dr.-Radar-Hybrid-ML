"""TEMPORARY sandbox proof for migration 007 (42P17 recursion fix).

Recreates the relevant Supabase semantics on a scratch local Postgres DB:
roles anon/authenticated, auth.uid() from request.jwt.claims, RLS, grants.
Then: seed data -> reproduce 42P17 under 006 -> apply 007 -> verify a-f.
No frontend, no live Supabase access. Prints PASS/FAIL per assertion.
"""
import json
import os
import re
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
SCRATCH_DB = "dr_radar_rls_test"
SCRATCH_URL = f"{BASE_URL}/{SCRATCH_DB}"

admin_engine = create_engine(f"{BASE_URL}/postgres", isolation_level="AUTOCOMMIT")

# ---------------------------------------------------------------- scratch db
with admin_engine.connect() as c:
    exists = c.execute(text("SELECT 1 FROM pg_database WHERE datname = :d"), {"d": SCRATCH_DB}).scalar()
    if exists:
        c.execute(text(f"DROP DATABASE {SCRATCH_DB} WITH (FORCE)"))
    c.execute(text(f"CREATE DATABASE {SCRATCH_DB}"))
print("[sandbox] scratch database created:", SCRATCH_DB)

engine = create_engine(SCRATCH_URL, isolation_level="AUTOCOMMIT")

# Roles are cluster-wide: create if missing, reuse if they already exist.
with admin_engine.connect() as c:
    for role in ("anon", "authenticated"):
        exists = c.execute(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": role}).scalar()
        if not exists:
            c.execute(text(f"CREATE ROLE {role} NOLOGIN"))
            print(f"[sandbox] created cluster role {role}")
        else:
            print(f"[sandbox] reusing existing cluster role {role}")


def run_file(conn, path):
    # exec_driver_sql: raw psycopg2 execution — no SQLAlchemy bind-param parsing,
    # multi-statement scripts and $$-quoted bodies pass through verbatim.
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    # SANDBOX ONLY: 003/004 wrap "ENABLE ROW LEVEL SECURITY" in a DO block that
    # references pg_policy.polytype — a column that exists in no PG version.
    # The sandbox schema enables RLS explicitly already, so strip those blocks
    # here. Live migration files are NOT modified by this.
    sql = re.sub(r"DO \$\$\s*BEGIN\s*IF NOT EXISTS \(SELECT 1 FROM pg_policy.*?END\s*\$\$;", "", sql, flags=re.DOTALL)
    conn.exec_driver_sql(sql)


U_PATIENT = "a0000000-0000-0000-0000-000000000001"  # auth user 1 (patient)
U_DOCTOR = "a0000000-0000-0000-0000-000000000002"  # auth user 2 (doctor)

RESULTS = []


def check(name, fn):
    try:
        fn()
        RESULTS.append((name, "PASS", ""))
        print(f"  PASS  {name}")
    except AssertionError as e:
        RESULTS.append((name, "FAIL", str(e)))
        print(f"  FAIL  {name} :: {e}")
    except Exception as e:  # noqa: BLE001
        RESULTS.append((name, "ERROR", f"{type(e).__name__}: {e}"))
        print(f"  ERROR {name} :: {type(e).__name__}: {str(e)[:160]}")


UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


def as_user(conn, uid, role="authenticated"):
    # SET statements cannot take bind params — values are validated literals
    # we construct ourselves (uids are hardcoded test UUIDs).
    conn.exec_driver_sql("RESET ROLE")
    if uid is None:
        conn.exec_driver_sql("SET ROLE anon")
        conn.exec_driver_sql("SET request.jwt.claims = '{}'")
    else:
        assert UUID_RE.match(uid), f"not a uuid: {uid}"
        claims = json.dumps({"sub": uid, "role": role}).replace("'", "")
        conn.exec_driver_sql(f"SET request.jwt.claims = '{claims}'")
        conn.exec_driver_sql(f"SET ROLE {role}")


def expect_error(conn, sql, params, code):
    try:
        conn.execute(text(sql), params or {})
    except Exception as e:  # noqa: BLE001
        sqlstate = getattr(e, "sqlstate", None) or getattr(
            getattr(e, "orig", None), "sqlstate", None)
        s = str(e)
        assert code in (sqlstate or "") or code in s, (
            f"expected error {code}, got: {s[:140]}")
        return
    raise AssertionError(f"expected error {code}, but statement succeeded")


print("[sandbox] creating schema (mirrors live Supabase schema)...")
SCHEMA = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) UNIQUE NOT NULL,
    role varchar(20) NOT NULL CHECK (role IN ('patient','doctor')),
    first_name varchar(150) NOT NULL,
    last_name varchar(150) NOT NULL,
    display_name varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    avatar_url varchar(500),
    onboarding_completed boolean NOT NULL DEFAULT false,
    profile_completed boolean NOT NULL DEFAULT false
);
CREATE TABLE public.patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    dob timestamptz, gender varchar(50), country varchar(100),
    language varchar(50), avatar_url varchar(500)
);
CREATE TABLE public.doctors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL, specialty varchar(200) NOT NULL,
    hospital varchar(300)
);
CREATE TABLE public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    status varchar(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','completed','cancelled','no_show')),
    CONSTRAINT uq_appt UNIQUE (patient_id, doctor_id, start_time)
);
CREATE TABLE public.ecg_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    ecg_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    lead varchar(50) NOT NULL DEFAULT 'Lead II',
    recorded_at timestamptz NOT NULL
);
CREATE TABLE public.predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ecg_record_id uuid NOT NULL REFERENCES public.ecg_records(id) ON DELETE CASCADE,
    predicted_class integer NOT NULL CHECK (predicted_class BETWEEN 0 AND 4),
    confidence float NOT NULL
);
CREATE TABLE public.explanations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id uuid UNIQUE NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
    method varchar(255) NOT NULL
);
CREATE TABLE public.health_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid UNIQUE NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecg_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
"""
with engine.connect() as conn:
    conn.exec_driver_sql(SCHEMA)
    db_dir = os.path.dirname(os.path.abspath(__file__))
    for mig in ["003_add_rls_policies.sql", "004_health_profiles_rls.sql",
                "005_ecg_records_rls.sql", "006_doctor_ecg_access_rls.sql"]:
        run_file(conn, os.path.join(db_dir, mig))
        print(f"[sandbox] applied migration {mig}")

    # Seed: two auth users, patient profile, doctor profile, scheduled appointment,
    # one ECG record + prediction + explanation owned by the patient.
    conn.execute(text("""
        INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
        VALUES (:p, 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient', 'x'),
               (:d, 'doc@test.local', 'doctor', 'Dot', 'Or', 'Dot Or', 'x')
    """), {"p": U_PATIENT, "d": U_DOCTOR})
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u)"), {"u": U_PATIENT})
    conn.execute(text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (:u, 'Dr', 'Cardiology')"), {"u": U_DOCTOR})
    conn.execute(text("""
        INSERT INTO public.appointments (patient_id, doctor_id, start_time, status)
        SELECT p.id, d.id, now(), 'scheduled' FROM public.patients p, public.doctors d
        WHERE p.user_id = :pu AND d.user_id = :du
    """), {"pu": U_PATIENT, "du": U_DOCTOR})
    conn.execute(text("""
        INSERT INTO public.ecg_records (patient_id, recorded_at)
        SELECT id, now() FROM public.patients WHERE user_id = :u
    """), {"u": U_PATIENT})
    conn.execute(text("""
        INSERT INTO public.predictions (ecg_record_id, predicted_class, confidence)
        SELECT id, 0, 0.99 FROM public.ecg_records LIMIT 1
    """))
    conn.execute(text("""
        INSERT INTO public.explanations (prediction_id, method)
        SELECT id, 'shap' FROM public.predictions LIMIT 1
    """))
    conn.execute(text("INSERT INTO public.health_profiles (patient_id) SELECT id FROM public.patients LIMIT 1"))

    # =========================================================
    # STEP 1 — REPRODUCE the bug under migration 006
    # =========================================================
    print("\n=== STEP 1: reproduce 42P17 with current 006 policies ===")
    reproduced = {"appointments_select": False, "users_upsert_returning": False}

    def try_appointments_select():
        as_user(conn, U_DOCTOR)
        conn.execute(text("SELECT count(*) FROM public.appointments"))
    check("doctor SELECT appointments (expect 42P17 under 006)", try_appointments_select)

    def try_users_upsert():
        as_user(conn, U_PATIENT)
        conn.execute(text("""
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:id, 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient', 'supabase-auth-managed')
            ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING *
        """), {"id": U_PATIENT})
    # The exact frontend operation shape (PostgREST adds RETURNING on upsert)
    try:
        try_users_upsert()
        print("  NOTE  users upsert w/ RETURNING did NOT fail under 006 (plan shape dependent)")
    except Exception as e:  # noqa: BLE001
        if "42P17" in str(e) or "infinite recursion" in str(e):
            reproduced["users_upsert_returning"] = True
            print(f"  REPRODUCED users upsert error: {str(e)[:120]}")
        else:
            print(f"  NOTE  users upsert failed with different error: {str(e)[:120]}")

    # =========================================================
    # STEP 2 — APPLY migration 007
    # =========================================================
    print("\n=== STEP 2: apply 007_fix_appointments_rls_recursion.sql ===")
    conn.execute(text("RESET ROLE"))
    run_file(conn, os.path.join(db_dir, "007_fix_appointments_rls_recursion.sql"))
    print("[sandbox] 007 applied")

    # =========================================================
    # STEP 3 — VERIFY requirements a-f
    # =========================================================
    print("\n=== STEP 3: verification (a-f) ===")

    # (a) authenticated user can upsert public.users (with RETURNING, like PostgREST)
    def verify_a():
        as_user(conn, U_PATIENT)
        r = conn.execute(text("""
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:id, 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient v2', 'supabase-auth-managed')
            ON CONFLICT (id) DO UPDATE
            SET display_name = EXCLUDED.display_name, onboarding_completed = true
            RETURNING id, display_name
        """), {"id": U_PATIENT})
        row = r.fetchone()
        assert row is not None and str(row[0]) == U_PATIENT, f"upsert returned {row}"
    check("a. authenticated user upserts public.users (RETURNING)", verify_a)

    # (b) patient can access own patient/profile data — and NOT others'
    def verify_b():
        as_user(conn, U_PATIENT)
        own = conn.execute(text("SELECT count(*) FROM public.patients")).scalar()
        assert own == 1, f"patient should see exactly own row, saw {own}"
        hp = conn.execute(text("SELECT count(*) FROM public.health_profiles")).scalar()
        assert hp == 1, f"patient should see own health profile, saw {hp}"
        ecg = conn.execute(text("SELECT count(*) FROM public.ecg_records")).scalar()
        assert ecg == 1, f"patient should see own ecg record, saw {ecg}"
        # patient cannot write users row of someone else
        expect_error(conn, """
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:id, 'x@test.local', 'patient', 'X', 'Y', 'XY', 'z')
        """, {"id": U_DOCTOR}, "42501")
    check("b. patient sees own data; cross-user users-write blocked (42501)", verify_b)

    # (c) appointment authorization still works (no recursion)
    def verify_c():
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert n == 1, f"doctor should see own appointment row, saw {n}"
        as_user(conn, U_PATIENT)
        n = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert n == 1, f"patient should see own appointment row, saw {n}"
    check("c. appointment authorization works (doctor + patient)", verify_c)

    # (d) doctor authorization for ECG data works; write access still denied
    def verify_d():
        as_user(conn, U_DOCTOR)
        ecg = conn.execute(text("SELECT count(*) FROM public.ecg_records")).scalar()
        assert ecg == 1, f"doctor should see authorized patient ecg record, saw {ecg}"
        pred = conn.execute(text("SELECT count(*) FROM public.predictions")).scalar()
        assert pred == 1, f"doctor should see authorized prediction, saw {pred}"
        expl = conn.execute(text("SELECT count(*) FROM public.explanations")).scalar()
        assert expl == 1, f"doctor should see authorized explanation, saw {expl}"
        ident = conn.execute(text("SELECT count(*) FROM public.users WHERE id <> auth.uid()")).scalar()
        assert ident == 1, f"doctor should read authorized patient identity row, saw {ident}"
        # doctor must NOT be able to write patient ECG data
        expect_error(conn, """
            INSERT INTO public.ecg_records (patient_id, recorded_at)
            SELECT id, now() FROM public.patients LIMIT 1
        """, None, "42501")
        r = conn.execute(text("UPDATE public.ecg_records SET lead = 'hacked' RETURNING id")).fetchall()
        assert len(r) == 0, "doctor must not be able to UPDATE patient ecg_records"
        r = conn.execute(text("DELETE FROM public.ecg_records RETURNING id")).fetchall()
        assert len(r) == 0, "doctor must not be able to DELETE patient ecg_records"
    check("d. doctor reads authorized ECG data; INSERT/UPDATE/DELETE denied", verify_d)

    # (e) anonymous users remain blocked
    # (SELECT under RLS with no applicable policy returns 0 rows — matching
    #  live Supabase behavior; writes are hard-denied with 42501.)
    def verify_e():
        as_user(conn, None)
        n = conn.execute(text("SELECT count(*) FROM public.users")).scalar()
        assert n == 0, f"anon must see 0 users rows, saw {n}"
        a = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert a == 0, f"anon must see 0 appointments rows, saw {a}"
        e = conn.execute(text("SELECT count(*) FROM public.ecg_records")).scalar()
        assert e == 0, f"anon must see 0 ecg_records rows, saw {e}"
        expect_error(conn, """
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (gen_random_uuid(), 'a@b.c', 'patient', 'A', 'B', 'AB', 'x')
        """, None, "42501")
        # literal UUIDs: a real row must be constructed so the INSERT policy
        # is actually evaluated (SELECT-from-patients sees 0 rows as anon and
        # would insert nothing, trivially succeeding)
        expect_error(conn, """
            INSERT INTO public.appointments (patient_id, doctor_id, start_time)
            VALUES ('33333333-3333-3333-3333-333333333333',
                    '44444444-4444-4444-4444-444444444444', now())
        """, None, "42501")
    check("e. anonymous sees nothing; writes denied (42501)", verify_e)

    # (f) no 42P17 recursion remains across a full query battery
    def verify_f():
        queries = [
            "SELECT count(*) FROM public.users",
            "SELECT count(*) FROM public.patients",
            "SELECT count(*) FROM public.doctors",
            "SELECT count(*) FROM public.appointments",
            "SELECT count(*) FROM public.ecg_records",
            "SELECT count(*) FROM public.predictions",
            "SELECT count(*) FROM public.explanations",
            "SELECT count(*) FROM public.health_profiles",
        ]
        for uid in (U_PATIENT, U_DOCTOR):
            as_user(conn, uid)
            for q in queries:
                try:
                    conn.execute(text(q))
                except Exception as e:  # noqa: BLE001
                    s = str(e)
                    assert "42P17" not in s and "infinite recursion" not in s, f"42P17 on {q}: {s[:120]}"
                    raise
    check("f. no 42P17 recursion in full query battery (patient + doctor)", verify_f)

    # Extra: patient can still INSERT own ecg record (persistence flow intact)
    def verify_extra():
        as_user(conn, U_PATIENT)
        r = conn.execute(text("""
            INSERT INTO public.ecg_records (patient_id, recorded_at)
            SELECT id, now() FROM public.patients WHERE user_id = auth.uid()
            RETURNING id
        """)).fetchall()
        assert len(r) == 1, "patient should be able to insert own ecg record"
    check("extra: patient can still INSERT own ecg_record", verify_extra)

    conn.execute(text("RESET ROLE"))

print("\n=== SUMMARY ===")
fails = [r for r in RESULTS if r[1] != "PASS"]
for name, status, msg in RESULTS:
    print(f"  {status:<5} {name}" + (f" :: {msg[:120]}" if msg else ""))
print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} checks passed")
sys.exit(1 if fails else 0)
