"""TEMPORARY sandbox proof for migration 009 (ECG file storage RLS).

Replicates the test_008_sandbox harness: scratch local Postgres DB with
Supabase semantics (anon/authenticated roles, auth.uid() from JWT claims).
Additionally simulates the storage.objects RLS by testing the 009 helper
functions directly (the real storage.objects table lives in Supabase's
storage schema; the policy predicates are the helpers, so proving the
helpers + ecg_uploads policies proves the policy logic).

Verifies:
  A-I. ecg_uploads patient/doctor/anon access matrix + cross-patient denial
  1-6. storage path helper semantics (own prefix, authorized prefix, traversal)
  N.   007/008 regressions (appointments, users upsert) still pass
"""
import json
import os
import re
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
SCRATCH_DB = "dr_radar_rls_test_009"
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
    # sandbox-only: strip any invalid pg_policy.polytype DO-guards (003/004 pattern)
    sql = re.sub(r"DO \$\$.*?pg_policy.*?END\s*\$\$;", "", sql, flags=re.DOTALL)
    conn.exec_driver_sql(sql)


def run_sql(conn, sql):
    conn.exec_driver_sql(sql)


U_PATIENT = "b0000000-0000-0000-0000-000000000001"
U_PATIENT2 = "b0000000-0000-0000-0000-000000000004"
U_DOCTOR = "b0000000-0000-0000-0000-000000000002"

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
        RESULTS.append((name, f"ERROR :: {type(e).__name__}: {str(e)[:130]}"))
        print(f"  ERROR {name} :: {type(e).__name__}: {str(e)[:130]}")


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

print("[sandbox] creating schema, 006/007/008 policies, seeding...")
with engine.connect() as conn:
    conn.exec_driver_sql(SCHEMA)
    run_file(conn, os.path.join(DB_DIR, "006_doctor_ecg_access_rls.sql"))
    run_file(conn, os.path.join(DB_DIR, "007_fix_appointments_rls_recursion.sql"))
    run_file(conn, os.path.join(DB_DIR, "008_ensure_core_rls_policies.sql"))
    # Live Supabase has 005 applied (patient ECG persistence relies on it);
    # the sandbox must mirror that for ecg_records INSERT checks to pass.
    run_file(conn, os.path.join(DB_DIR, "005_ecg_records_rls.sql"))

    # Simulate the storage schema + storage.objects as Supabase has it, with the
    # same grants the real service uses. Bucket row is created by 009 itself.
    run_sql(conn, """
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE IF NOT EXISTS storage.buckets (
            id text PRIMARY KEY,
            name text NOT NULL,
            public boolean DEFAULT false,
            file_size_limit bigint,
            allowed_mime_types text[]
        );
        CREATE TABLE IF NOT EXISTS storage.objects (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            bucket_id text,
            name text,
            owner text,
            metadata jsonb,
            created_at timestamptz DEFAULT now()
        );
        GRANT USAGE ON SCHEMA storage TO anon, authenticated;
        GRANT ALL ON storage.buckets TO postgres;
        GRANT SELECT ON storage.buckets TO anon, authenticated;
        GRANT ALL ON storage.objects TO anon, authenticated;
    """)

    for t in ("users", "patients", "doctors", "appointments", "ecg_records",
              "predictions", "explanations", "health_profiles"):
        conn.exec_driver_sql(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY")
    # Real Supabase has RLS permanently enabled on storage.objects; replicate
    # that here so the 009 storage policies are actually exercised.
    conn.exec_driver_sql("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY")
    # 009 creates its own table later, so re-grant after applying it:
    # (grants for storage.objects above cover the pre-existing tables only)

    run_sql(conn, f"""
        INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
        VALUES ('{U_PATIENT}', 'pat@test.local', 'patient', 'Pat', 'Ient', 'Pat Ient', 'x'),
               ('{U_PATIENT2}', 'pat2@test.local', 'patient', 'Pea', 'Two', 'Pea Two', 'x'),
               ('{U_DOCTOR}', 'doc@test.local', 'doctor', 'Dot', 'Or', 'Dot Or', 'x')
    """)
    conn.exec_driver_sql("RESET ROLE")

    # patients rows (own-row policies allow each user to insert their own)
    as_user(conn, U_PATIENT)
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u)"), {"u": U_PATIENT})
    as_user(conn, U_PATIENT2)
    conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u)"), {"u": U_PATIENT2})
    as_user(conn, U_DOCTOR)
    conn.execute(text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (:u, 'Dr', 'Cardiology')"), {"u": U_DOCTOR})
    conn.exec_driver_sql("RESET ROLE")

    # Appointment: patient1 <-> doctor (scheduled) — patient2 has NO appointment
    run_sql(conn, f"""
        INSERT INTO public.appointments (patient_id, doctor_id, start_time, status)
        SELECT p.id, d.id, now(), 'scheduled'
        FROM public.patients p, public.doctors d
        WHERE p.user_id = '{U_PATIENT}' AND d.user_id = '{U_DOCTOR}'
    """)

    print("[sandbox] applying 009...")
    run_file(conn, os.path.join(DB_DIR, "009_ecg_storage.sql"))
    print("[sandbox] 009 applied\n")
    # Simulate Supabase's default privileges for the newly created table
    # (local scratch DB has no ALTER DEFAULT PRIVILEGES setup).
    conn.exec_driver_sql("GRANT SELECT, INSERT, DELETE ON public.ecg_uploads TO authenticated")

    PID1 = conn.execute(
        text("SELECT id FROM public.patients WHERE user_id = :u"), {"u": U_PATIENT}).scalar()
    PID2 = conn.execute(
        text("SELECT id FROM public.patients WHERE user_id = :u"), {"u": U_PATIENT2}).scalar()
    print(f"[sandbox] patient1={PID1} patient2={PID2}")

    # ==================================================================
    print("=== A. ecg_uploads patient access ===")

    def a1():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES (:p, 'ecg.csv', 'text/csv', 1024, :path, 'ecg-csv')
            RETURNING id
        """), {"p": PID1, "path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert n
    check("A1. patient INSERT own ecg_uploads row", a1)

    def a2():
        as_user(conn, U_PATIENT)
        expect_error(conn, f"""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES ('{PID2}', 'evil.csv', 'text/csv', 10, '{PID2}/evil/x.csv', 'ecg-csv')
        """, "42501")
    check("A2. patient INSERT for ANOTHER patient denied (42501)", a2)

    def a3():
        as_user(conn, U_PATIENT2)
        n = conn.execute(text("SELECT count(*) FROM public.ecg_uploads")).scalar()
        assert n == 0, f"patient2 must see 0 rows, saw {n}"
    check("A3. patient B cannot SELECT patient A's rows", a3)

    def a4():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("SELECT count(*) FROM public.ecg_uploads")).scalar()
        assert n == 1, f"patient1 must see own row, saw {n}"
    check("A4. patient SELECTs own row", a4)

    def a5():
        as_user(conn, U_PATIENT)
        expect_error(conn, """
            UPDATE public.ecg_uploads SET file_name = 'hacked.csv'
        """, "42501")
    check("A5. patient UPDATE denied (no UPDATE policy)", a5)

    def a6():
        # anon has NO grants on ecg_uploads (009 REVOKEs anon) -> Postgres denies
        # the SELECT itself. Either denial mode means "no access".
        as_user(conn, None)
        try:
            n = conn.execute(text("SELECT count(*) FROM public.ecg_uploads")).scalar()
            assert n == 0, f"anon must see 0 rows, saw {n}"
        except AssertionError:
            raise
        except Exception as e:  # noqa: BLE001
            assert "permission denied" in str(e) or "42501" in str(e), f"unexpected error: {str(e)[:120]}"
        expect_error(conn, f"""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES ('{PID1}', 'anon.csv', 'text/csv', 5, '{PID1}/anon/x.csv', 'ecg-csv')
        """, "42501")
    check("A6. anon: SELECT denied/0 rows; INSERT denied", a6)

    def a7():
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM public.ecg_uploads")).scalar()
        assert n == 1, f"doctor must see authorized patient's row, saw {n}"
    check("A7. doctor SELECTs authorized patient's row", a7)

    def a8():
        # patient2 uploads + doctor tries to see both
        as_user(conn, U_PATIENT2)
        conn.execute(text("""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES (:p, 'p2.csv', 'text/csv', 7, :path, 'ecg-csv')
        """), {"p": PID2, "path": f"{PID2}/upl-p2/p2.csv"})
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM public.ecg_uploads")).scalar()
        assert n == 1, f"doctor must see ONLY authorized patient rows, saw {n}"
    check("A8. doctor does NOT see unauthorized patient's row", a8)

    def a9():
        as_user(conn, U_DOCTOR)
        expect_error(conn, f"""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES ('{PID1}', 'doc.csv', 'text/csv', 9, '{PID1}/doc/x.csv', 'ecg-csv')
        """, "42501")
        expect_error(conn, "UPDATE public.ecg_uploads SET file_name='x' RETURNING id", "42501")
    check("A9. doctor cannot INSERT/UPDATE ecg_uploads", a9)

    def a10():
        as_user(conn, U_PATIENT)
        expect_error(conn, f"""
            INSERT INTO public.ecg_uploads (patient_id, file_name, mime_type, size_bytes, storage_path, upload_type)
            VALUES ('{PID1}', 'bad.csv', 'text/csv', 5, '{PID1}/bad/x.csv', 'weird-type')
        """, "check")
    check("A10. CHECK constraint rejects bad upload_type", a10)

    # ==================================================================
    print("=== B. storage path helpers (policy predicates) ===")

    def b1():
        as_user(conn, U_PATIENT)
        own = conn.execute(text(
            "SELECT public.ecg_storage_path_is_own(:path)"),
            {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert own is True, f"own path must be TRUE, got {own}"
    check("B1. own-prefix path -> TRUE for owner", b1)

    def b2():
        as_user(conn, U_PATIENT2)
        other = conn.execute(text(
            "SELECT public.ecg_storage_path_is_own(:path)"),
            {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert other is False, f"another patient's path must be FALSE, got {other}"
    check("B2. another patient's path -> FALSE", b2)

    def b3():
        as_user(conn, U_PATIENT)
        # a UUID whose text form STARTS WITH the caller's UUID text (prefix attack)
        forged = str(PID1) + "deadbeef-0000-0000-0000-000000000000/ecg.csv"
        r = conn.execute(text("SELECT public.ecg_storage_path_is_own(:path)"), {"path": forged}).scalar()
        assert r is False, "prefix-extended UUID path must be FALSE"
    check("B3. prefix-extended UUID (path traversal) -> FALSE", b3)

    def b4():
        as_user(conn, U_DOCTOR)
        r = conn.execute(text(
            "SELECT public.ecg_storage_path_is_own(:path)"),
            {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert r is False, "doctor has no own patient prefix"
    check("B4. doctor own-prefix check -> FALSE", b4)

    def b5():
        as_user(conn, U_DOCTOR)
        auth1 = conn.execute(text(
            "SELECT public.ecg_storage_path_is_authorized(:path)"),
            {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        auth2 = conn.execute(text(
            "SELECT public.ecg_storage_path_is_authorized(:path)"),
            {"path": f"{PID2}/upl-p2/p2.csv"}).scalar()
        assert auth1 is True, f"authorized patient path must be TRUE, got {auth1}"
        assert auth2 is False, f"unauthorized patient path must be FALSE, got {auth2}"
    check("B5. doctor: authorized prefix TRUE, unauthorized FALSE", b5)

    def b6():
        as_user(conn, U_PATIENT)
        r = conn.execute(text(
            "SELECT public.ecg_storage_path_is_authorized(:path)"),
            {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert r is False, "patient must not gain doctor-style access"
    check("B6. patient via doctor helper -> FALSE", b6)

    def b7():
        # anon has no EXECUTE on the helpers (REVOKE...GRANT authenticated only)
        as_user(conn, None)
        expect_error(conn, "SELECT public.ecg_storage_path_is_own('{}')", "permission denied")
    check("B7. anon cannot execute storage helpers (default deny)", b7)

    # ==================================================================
    print("=== C. storage.objects RLS (simulated table, real policies) ===")

    def c1():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("""
            SELECT count(*) FROM storage.objects
            WHERE bucket_id = 'ecg-uploads'
        """)).scalar()
        assert n == 0, f"patient1 must see 0 objects initially, saw {n}"
    check("C1. patient sees 0 objects (empty prefix)", c1)

    def c2():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("""
            INSERT INTO storage.objects (bucket_id, name) VALUES ('ecg-uploads', :path) RETURNING id
        """), {"path": f"{PID1}/upl-abc/ecg.csv"}).scalar()
        assert n, "own-prefix insert must succeed"
        # cross-patient insert attempt
        expect_error(conn, f"""
            INSERT INTO storage.objects (bucket_id, name)
            VALUES ('ecg-uploads', '{PID2}/steal/x.csv')
        """, "42501")
    check("C2. patient INSERT own object; cross-patient denied", c2)

    def c3():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ecg-uploads'")).scalar()
        assert n == 1
        # cannot READ another patient's object
        as_user(conn, U_PATIENT2)
        n2 = conn.execute(text("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ecg-uploads'")).scalar()
        assert n2 == 0, f"patient2 must see 0 objects, saw {n2}"
    check("C3. patient SELECT own only; patient B sees 0", c3)

    def c4():
        as_user(conn, U_PATIENT)
        expect_error(conn, f"""
            INSERT INTO storage.objects (bucket_id, name) VALUES ('ecg-uploads', '{PID2}/x/y.csv')
        """, "42501")
        expect_error(conn, f"""
            INSERT INTO storage.objects (bucket_id, name) VALUES ('other-bucket', '{PID1}/x/y.csv')
        """, "42501")
    check("C4. cross-patient + wrong-bucket INSERT denied", c4)

    def c5():
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ecg-uploads'")).scalar()
        assert n == 1, f"doctor must see authorized patient's object, saw {n}"
        expect_error(conn, f"""
            INSERT INTO storage.objects (bucket_id, name) VALUES ('ecg-uploads', '{PID1}/doc/x.csv')
        """, "42501")
        r = conn.execute(text("DELETE FROM storage.objects WHERE bucket_id = 'ecg-uploads' RETURNING id")).fetchall()
        assert len(r) == 0, "doctor DELETE must affect 0 rows"
    check("C5. doctor SELECT authorized; INSERT/DELETE denied", c5)

    def c6():
        as_user(conn, None)
        n = conn.execute(text("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ecg-uploads'")).scalar()
        assert n == 0, f"anon must see 0 objects, saw {n}"
        expect_error(conn, f"""
            INSERT INTO storage.objects (bucket_id, name) VALUES ('ecg-uploads', '{PID1}/anon/x.csv')
        """, "42501")
    check("C6. anon sees 0 objects; INSERT denied", c6)

    def c7():
        as_user(conn, U_PATIENT)
        n = conn.execute(text(
            "DELETE FROM storage.objects WHERE bucket_id = 'ecg-uploads' RETURNING id")).fetchall()
        assert len(n) == 1, f"patient DELETE own object must affect 1 row, affected {len(n)}"
    check("C7. patient DELETE own object succeeds", c7)

    # ==================================================================
    print("=== D. ecg_records.upload_id link + regressions ===")

    def d1():
        as_user(conn, U_PATIENT)
        up = conn.execute(text("SELECT id FROM public.ecg_uploads LIMIT 1")).scalar()
        rec = conn.execute(text("""
            INSERT INTO public.ecg_records (patient_id, recorded_at, upload_id)
            VALUES (:p, now(), :up) RETURNING id, upload_id
        """), {"p": PID1, "up": up}).fetchone()
        assert rec and str(rec[1]) == str(up)
        # ON DELETE SET NULL behavior
        conn.exec_driver_sql("RESET ROLE")
        conn.execute(text("DELETE FROM public.ecg_uploads WHERE id = :up"), {"up": up})
        as_user(conn, U_PATIENT)
        n = conn.execute(text(
            "SELECT upload_id FROM public.ecg_records WHERE id = :r"), {"r": rec[0]}).scalar()
        assert n is None, "upload_id must be SET NULL after upload deletion"
        conn.exec_driver_sql("RESET ROLE")
        conn.execute(text("DELETE FROM public.ecg_records WHERE id = :r"), {"r": rec[0]})
    check("D1. ecg_records.upload_id FK works; ON DELETE SET NULL", d1)

    def d2():
        as_user(conn, U_PATIENT)
        conn.execute(text("""
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:id, 'patx@test.local', 'patient', 'Pat', 'X', 'Pat X', 'supabase-auth-managed')
            ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
        """), {"id": U_PATIENT})
    check("D2. 008 regression: own-user upsert still works", d2)

    def d3():
        as_user(conn, U_DOCTOR)
        n = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert n == 1, f"doctor should see own appointment, saw {n}"
    check("D3. 007 regression: appointment authorization intact", d3)

    # RLS flags + policy inventory
    def d4():
        conn.exec_driver_sql("RESET ROLE")
        rows = conn.execute(text("""
            SELECT c.relname, c.relrowsecurity FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname IN ('ecg_uploads', 'ecg_records')
        """)).fetchall()
        assert all(r[1] for r in rows), f"RLS must stay enabled: {rows}"
        pols = conn.execute(text("""
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'ecg_uploads'
        """)).fetchall()
        names = {p[0] for p in pols}
        expected = {"ecg_uploads_insert_own", "ecg_uploads_select_own",
                    "ecg_uploads_delete_own", "ecg_uploads_select_doctor_authorized"}
        assert expected.issubset(names), f"missing policies: {expected - names}"
        storage_pols = conn.execute(text("""
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname LIKE 'ecg_uploads%'
        """)).fetchall()
        spol_names = {p[0] for p in storage_pols}
        expected_spol = {"ecg_uploads_patient_insert_own", "ecg_uploads_patient_select_own",
                         "ecg_uploads_patient_delete_own", "ecg_uploads_doctor_select_authorized"}
        assert expected_spol.issubset(spol_names), f"missing storage policies: {expected_spol - spol_names}"
        # helpers must NOT be callable by anon
        as_user(conn, None)
        expect_error(conn, "SELECT public.ecg_storage_own_patient_id()", "42501")
    check("D4. RLS enabled + all 009 policies exist; helper denied to anon", d4)

    conn.exec_driver_sql("RESET ROLE")

print("\n=== SUMMARY ===")
fails = [r for r in RESULTS if not r[1].startswith("PASS")]
for name, status in RESULTS:
    print(f"  {status:<5} {name}" if status == "PASS" else f"  {status}")
passed = len(RESULTS) - len(fails)
print(f"\n{passed}/{len(RESULTS)} checks passed")
sys.exit(1 if fails else 0)
