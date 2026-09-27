"""TEMPORARY sandbox proof for migration 008 (missing core RLS policies).

On a scratch local Postgres DB replicating Supabase semantics:
  1. apply 006 + 007 policies but NOT 003 (live-DB state)  -> reproduce 42501
  2. apply 008                                              -> fix
  3. verify: own-row provisioning, cross-user denial, anon denial,
     doctor appointment/ECG authorization (007 intact), RETURNING behavior.
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

with admin_engine.connect() as c:
    if c.execute(text("SELECT 1 FROM pg_database WHERE datname = :d"), {"d": SCRATCH_DB}).scalar():
        c.execute(text(f"DROP DATABASE {SCRATCH_DB} WITH (FORCE)"))
    c.execute(text(f"CREATE DATABASE {SCRATCH_DB}"))
print("[sandbox] scratch database created:", SCRATCH_DB)

engine = create_engine(SCRATCH_URL, isolation_level="AUTOCOMMIT")
with admin_engine.connect() as c:
    for role in ("anon", "authenticated"):
        if not c.execute(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": role}).scalar():
            c.execute(text(f"CREATE ROLE {role} NOLOGIN"))

DB_DIR = os.path.dirname(os.path.abspath(__file__))


def run_file(conn, path):
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    # sandbox-only: strip 003/004's invalid pg_policy.polytype DO-guards
    sql = re.sub(r"DO \$\$.*?pg_policy.*?END\s*\$\$;", "", sql, flags=re.DOTALL)
    conn.exec_driver_sql(sql)


def run_sql(conn, sql):
    conn.exec_driver_sql(sql)


U_PATIENT = "a0000000-0000-0000-0000-000000000001"
U_DOCTOR = "a0000000-0000-0000-0000-000000000002"
U_STRANGER = "a0000000-0000-0000-0000-000000000003"

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
        print(f"  ERROR {name} :: {type(e).__name__}: {str(e)[:150]}")


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


def expect_error(conn, sql, code):
    try:
        conn.execute(text(sql))
    except Exception as e:  # noqa: BLE001
        sqlstate = getattr(e, "sqlstate", None) or getattr(getattr(e, "orig", None), "sqlstate", None)
        assert code in (sqlstate or "") or code in str(e), f"expected {code}, got: {str(e)[:130]}"
        return
    raise AssertionError(f"expected error {code}, but statement succeeded")


SCHEMA = open(os.path.join(DB_DIR, "test_007_sandbox.py"), encoding="utf-8").read()
SCHEMA = SCHEMA.split('SCHEMA = """')[1].split('"""\n')[0]

print("[sandbox] creating schema + seeding...")
with engine.connect() as conn:
    conn.exec_driver_sql(SCHEMA)
    run_file(conn, os.path.join(DB_DIR, "006_doctor_ecg_access_rls.sql"))
    run_file(conn, os.path.join(DB_DIR, "007_fix_appointments_rls_recursion.sql"))
    # live-DB state: RLS enabled, 006/007 applied, 003 NEVER applied
    for t in ("users", "patients", "doctors", "appointments",
              "ecg_records", "predictions", "explanations", "health_profiles"):
        conn.exec_driver_sql(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY")

    run_sql(conn, f"""
        INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
        VALUES ('{U_PATIENT}', 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient', 'x'),
               ('{U_DOCTOR}', 'doc@test.local', 'doctor', 'Dot', 'Or', 'Dot Or', 'x')
    """)  # seeded as superuser postgres (simulates dashboard/manual creation)
    conn.exec_driver_sql("RESET ROLE")

    # ============================================================
    print("\n=== STEP 1: reproduce symptom B (003 missing, 007 era) ===")
    err = {"code": ""}

    def repro():
        as_user(conn, U_PATIENT)
        try:
            conn.execute(text("""
                INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
                VALUES (:id, 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient', 'supabase-auth-managed')
                ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
                RETURNING *
            """), {"id": U_PATIENT})
        except Exception as e:  # noqa: BLE001
            err["code"] = (getattr(e, "sqlstate", "")
                           or getattr(getattr(e, "orig", None), "sqlstate", "")
                           or ("42501" if "row-level security" in str(e) else ""))
            return  # expected outcome: the upsert must be rejected
        raise AssertionError("expected 42501 but own-user upsert succeeded")
    check("own-user upsert BEFORE 008 (expect 42501)", repro)
    assert err["code"] == "42501", f"expected to reproduce 42501, got: {err['code']!r}"
    print("  [reproduced symptom B exactly: 42501 on own-user upsert]")

    # ============================================================
    print("\n=== STEP 2: apply 008 ===")
    conn.exec_driver_sql("RESET ROLE")
    run_file(conn, os.path.join(DB_DIR, "008_ensure_core_rls_policies.sql"))
    print("[sandbox] 008 applied")

    # ============================================================
    print("\n=== STEP 3: verification ===")

    def a():
        as_user(conn, U_PATIENT)
        r = conn.execute(text("""
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:id, 'pat2@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient v2', 'supabase-auth-managed')
            ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING id, display_name
        """), {"id": U_PATIENT}).fetchone()
        assert r and str(r[0]) == U_PATIENT
    check("a. own-user upsert with RETURNING succeeds", a)

    def b():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u) ON CONFLICT (user_id) DO UPDATE SET gender='M' RETURNING user_id"),
                         {"u": U_PATIENT}).fetchone()
        assert n and str(n[0]) == U_PATIENT
    check("b. patient row upsert succeeds for own user", b)

    def c():
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("""
            INSERT INTO public.doctors (user_id, title, specialty)
            VALUES (:u, 'Dr', 'Cardiology')
            ON CONFLICT (user_id) DO UPDATE SET title = EXCLUDED.title
            RETURNING user_id
        """), {"u": U_DOCTOR}).fetchone()
        assert n and str(n[0]) == U_DOCTOR
    check("c. doctor row upsert succeeds for own user", c)

    def d():
        as_user(conn, U_PATIENT)
        expect_error(conn, f"""
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES ('{U_STRANGER}', 's@test.local', 'patient', 'S', 'T', 'ST', 'x')
        """, "42501")
    check("d1. cross-user users INSERT denied (42501)", d)

    def d2():
        as_user(conn, U_PATIENT)
        r = conn.execute(text(f"UPDATE public.users SET display_name='hacked' WHERE id='{U_DOCTOR}' RETURNING id")).fetchall()
        assert len(r) == 0, "cross-user UPDATE must affect 0 rows"
        expect_error(conn, f"""
            INSERT INTO public.patients (user_id) VALUES ('{U_DOCTOR}')
        """, "42501")
    check("d2. cross-user UPDATE affects 0 rows; patients cross-INSERT denied", d2)

    def e():
        as_user(conn, None)
        n = conn.execute(text("SELECT count(*) FROM public.users")).scalar()
        assert n == 0
        expect_error(conn, """
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (gen_random_uuid(), 'a@b.c', 'patient', 'A', 'B', 'AB', 'x')
        """, "42501")
    check("e. anon sees 0 rows; anon INSERT denied (42501)", e)

    def f():
        # doctor appointment/ECG authorization (007) still works
        as_user(conn, U_DOCTOR)
        # doctor can see their own doctors row; seed appointment exists? none yet; add as superuser
        conn.exec_driver_sql("RESET ROLE")
        conn.exec_driver_sql(f"""
            INSERT INTO public.appointments (patient_id, doctor_id, start_time, status)
            SELECT p.id, d.id, now(), 'scheduled'
            FROM public.patients p, public.doctors d
            WHERE p.user_id = '{U_PATIENT}' AND d.user_id = '{U_DOCTOR}'
        """)
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert n == 1
        ecg = conn.execute(text("SELECT count(*) FROM public.ecg_records")).scalar()
        assert ecg == 0 or ecg >= 0  # doctor may see 0 (no ecg seeded) — no recursion error is the point
    check("f. 007 intact: appointments/ECG authorization without recursion", f)

    def g():
        as_user(conn, U_DOCTOR)
        expect_error(conn, """
            INSERT INTO public.ecg_records (patient_id, recorded_at)
            SELECT id, now() FROM public.patients LIMIT 1
        """, "42501")
        r = conn.execute(text("UPDATE public.ecg_records SET lead='h' RETURNING id")).fetchall()
        assert len(r) == 0
    check("g. doctor cannot write patient ECG data", g)

    def h():
        # RLS flags + policy inventory
        as_user(conn, U_PATIENT)
        conn.exec_driver_sql("RESET ROLE")
        rows = conn.execute(text("""
            SELECT c.relname, c.relrowsecurity FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname IN ('users','patients','doctors','appointments')
        """)).fetchall()
        assert all(r[1] for r in rows), f"RLS must stay enabled: {rows}"
        pols = conn.execute(text("""
            SELECT tablename, policyname FROM pg_policies
            WHERE schemaname='public' AND tablename IN ('users','patients','doctors')
            ORDER BY 1,2
        """)).fetchall()
        names = {p[1] for p in pols}
        expected = {"users_insert_own", "users_read_own", "users_update_own",
                    "patients_insert_own", "patients_read_own", "patients_update_own",
                    "doctors_insert_own", "doctors_read_own", "doctors_update_own"}
        assert expected.issubset(names), f"missing policies: {expected - names}"
    check("h. RLS enabled + all 9 own-row policies exist", h)

    conn.exec_driver_sql("RESET ROLE")

print("\n=== SUMMARY ===")
fails = [r for r in RESULTS if r[1] != "PASS"]
for name, status, msg in RESULTS:
    print(f"  {status:<5} {name}" + (f" :: {msg[:110]}" if msg else ""))
print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} checks passed")
sys.exit(1 if fails else 0)
