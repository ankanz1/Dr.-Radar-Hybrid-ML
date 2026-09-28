"""TEMPORARY sandbox proof for migration 016 (appointment-scoped messages).

Replicates the test_014_sandbox harness: scratch local Postgres DB with
Supabase semantics (anon/authenticated roles, auth.uid() from JWT claims),
built from the real supabase_schema.sql plus migrations 006/007/008 (RLS),
011 (directory + booking), 013, 014, 015 (booking refinements) and 016
(messages).

Covers every required RLS/security case for messages:
  1. authorized patient can read messages of their appointment
  2. authorized doctor can read messages of their appointment
  3. patient can INSERT as themselves into their own appointment
  4. doctor can INSERT as themselves into their own appointment
  5. unrelated user cannot read (zero rows / other appointment's rows hidden)
  6. unrelated user cannot INSERT (participant-only helper blocks it)
  7. sender cannot impersonate another user (sender_user_id = auth.uid())
  8. invalid/nonexistent appointment_id cannot be used
  plus: cross-appointment isolation between two of the doctor's appointments,
  anon read/insert blocked, immutability (no UPDATE/DELETE), empty-body
  rejection, oversized-body rejection, FK to real appointments, helper
  properties (SECURITY DEFINER/STABLE/search_path/grants), RLS enabled+forced,
  realtime publication membership, index existence, idempotent re-apply.

Run: DATABASE_URL=... python3 test_016_sandbox.py   (needs a reachable PG)
"""

import json
import os
import re
from datetime import date, timedelta

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

DB_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(DB_DIR, "..", ".env"))

BASE_URL = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
SCRATCH_DB = "dr_radar_messages_test_016"
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

U_PATIENT = "c1000000-0000-0000-0000-000000000001"
U_PATIENT2 = "c1000000-0000-0000-0000-000000000002"
U_PATIENT3 = "c1000000-0000-0000-0000-000000000003"
U_DOCTOR = "c2000000-0000-0000-0000-000000000001"

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


def tomorrow():
    return (date.today() + timedelta(days=1)).isoformat()


def publish(conn, slots, day):
    return conn.execute(
        text("SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))"),
        {"s": json.dumps(slots), "d": day},
    ).scalar()


def book(conn, doctor_id, slot, day, ptype="telehealth", reason=None):
    return conn.execute(
        text(
            "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))"
        ),
        {"doc": doctor_id, "slot": slot, "ptype": ptype, "reason": reason, "day": day},
    ).scalar()


def send_msg(conn, appt, sender, body="hello"):
    return conn.execute(
        text(
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), :b) RETURNING id"
        ),
        {"a": appt, "s": sender, "b": body},
    ).scalar()


print("[sandbox] creating schema (mirrors live Supabase schema)...")

SETUP = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
"""

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

    for mig in (
        "006_doctor_ecg_access_rls.sql",
        "007_fix_appointments_rls_recursion.sql",
        "008_ensure_core_rls_policies.sql",
        "011_doctor_directory_and_booking.sql",
        "013_doctor_availability_and_slot_exclusivity.sql",
        "014_doctor_availability_date.sql",
        "015_request_appointment_volatile.sql",
        "016_appointment_messages.sql",
    ):
        run_file(conn, os.path.join(DB_DIR, mig))
        print(f"[sandbox] applied migration {mig}")

    # ------------------------------------------------------------------ seed
    conn.execute(
        text(
            """
            INSERT INTO public.users (id, email, role, first_name, last_name, display_name, password_hash)
            VALUES (:p1, 'pat1@test.local', 'patient', 'Pat', 'One', 'Pat One', 'x'),
                   (:p2, 'pat2@test.local', 'patient', 'Pat', 'Two', 'Pat Two', 'x'),
                   (:p3, 'pat3@test.local', 'patient', 'Pat', 'Three', 'Pat Three', 'x'),
                   (:d1, 'doc1@test.local', 'doctor', 'Dot', 'One', 'Dot One', 'x')
            """
        ),
        {"p1": U_PATIENT, "p2": U_PATIENT2, "p3": U_PATIENT3, "d1": U_DOCTOR},
    )
    for uid in (U_PATIENT, U_PATIENT2, U_PATIENT3):
        conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u)"), {"u": uid})
    conn.execute(
        text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (:u, 'Dr', 'Cardiology')"),
        {"u": U_DOCTOR},
    )
    print("[sandbox] seeded 1 doctor + 3 patients\n")

    DOC = conn.execute(text("SELECT id FROM public.doctors WHERE user_id = :u"), {"u": U_DOCTOR}).scalar()
    PID1 = conn.execute(text("SELECT id FROM public.patients WHERE user_id = :u"), {"u": U_PATIENT}).scalar()
    PID2 = conn.execute(text("SELECT id FROM public.patients WHERE user_id = :u"), {"u": U_PATIENT2}).scalar()

    # Doctor publishes and two patients book -> two appointments for the SAME doctor
    as_user(conn, U_DOCTOR)
    publish(conn, ["10:00", "11:00"], tomorrow())
    as_user(conn, U_PATIENT)
    APPT1 = book(conn, DOC, "10:00", tomorrow(), "telehealth", "Review my ECG")
    as_user(conn, U_PATIENT2)
    APPT2 = book(conn, DOC, "11:00", tomorrow(), "follow_up")
    assert APPT1 and APPT2 and APPT1 != APPT2, "two distinct appointments required for isolation tests"
    print(f"[sandbox] appointments booked: APPT1={APPT1} (Pat One), APPT2={APPT2} (Pat Two)\n")

    # =========================================================
    print("=== A. participants read their appointment's messages ===")

    # Seed some history as the participants themselves (validated INSERT path)
    as_user(conn, U_PATIENT)
    M1 = send_msg(conn, APPT1, U_PATIENT, "Hello doctor, my ECG felt odd yesterday.")
    as_user(conn, U_DOCTOR)
    M2 = send_msg(conn, APPT1, U_DOCTOR, "Please describe the symptoms.")
    assert M1 and M2 and M1 != M2

    def a1():
        as_user(conn, U_PATIENT)
        rows = conn.execute(
            text("SELECT id, sender_user_id, body FROM public.messages WHERE appointment_id = CAST(:a AS uuid) "
                 "ORDER BY created_at"),
            {"a": APPT1},
        ).fetchall()
        assert len(rows) == 2, f"patient must see both messages of own appointment, saw {len(rows)}"
        assert {str(r.sender_user_id) for r in rows} == {U_PATIENT, U_DOCTOR}
    check("1. authorized patient can read messages", a1)

    def a2():
        as_user(conn, U_DOCTOR)
        rows = conn.execute(
            text("SELECT id, body FROM public.messages WHERE appointment_id = CAST(:a AS uuid) ORDER BY created_at"),
            {"a": APPT1},
        ).fetchall()
        assert len(rows) == 2, f"doctor must see both messages, saw {len(rows)}"
        assert [r.body for r in rows] == [
            "Hello doctor, my ECG felt odd yesterday.",
            "Please describe the symptoms.",
        ]
    check("2. authorized doctor can read messages", a2)

    # =========================================================
    print("\n=== B. both participants can insert as themselves ===")

    def b1():
        as_user(conn, U_PATIENT)
        mid = send_msg(conn, APPT1, U_PATIENT, "It happens when I climb stairs.")
        assert mid, "patient INSERT must return the new message id"
        n = conn.execute(
            text("SELECT count(*) FROM public.messages WHERE appointment_id = CAST(:a AS uuid)"),
            {"a": APPT1},
        ).scalar()
        assert n == 3, f"expected 3 messages, saw {n}"
    check("3. patient can insert as themselves", b1)

    def b2():
        as_user(conn, U_DOCTOR)
        mid = send_msg(conn, APPT1, U_DOCTOR, "Please upload your latest ECG.")
        assert mid, "doctor INSERT must return the new message id"
    check("4. doctor can insert as themselves", b2)

    # =========================================================
    print("\n=== C. unrelated users are blocked ===")

    def c1():
        # patient3 has no appointment at all
        as_user(conn, U_PATIENT3)
        n = conn.execute(text("SELECT count(*) FROM public.messages")).scalar()
        assert n == 0, f"unrelated user must see zero messages, saw {n}"
        # patient2 is a participant but must NOT see the OTHER appointment's rows
        as_user(conn, U_PATIENT2)
        n = conn.execute(
            text("SELECT count(*) FROM public.messages WHERE appointment_id = CAST(:a AS uuid)"),
            {"a": APPT1},
        ).scalar()
        assert n == 0, f"participant of APPT2 must not read APPT1 rows, saw {n}"
    check("5. unrelated user cannot read (and cross-appointment rows hidden)", c1)

    def c2():
        as_user(conn, U_PATIENT3)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'hi')",
            {"a": APPT1, "s": U_PATIENT3},
            code="42501",
        )
        # patient2 (APPT2 participant) must not write into APPT1 either
        as_user(conn, U_PATIENT2)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'hi')",
            {"a": APPT1, "s": U_PATIENT2},
            code="42501",
        )
    check("6. unrelated user cannot insert", c2)

    # =========================================================
    print("\n=== D. impersonation is impossible ===")

    def d1():
        as_user(conn, U_PATIENT)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'forged')",
            {"a": APPT1, "s": U_DOCTOR},
            code="42501",
        )
        as_user(conn, U_DOCTOR)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'forged')",
            {"a": APPT1, "s": U_PATIENT},
            code="42501",
        )
    check("7. sender cannot impersonate another user", d1)

    # =========================================================
    print("\n=== E. invalid appointments are rejected ===")

    def e1():
        fake = "deadbeef-0000-0000-0000-00000000dead"
        as_user(conn, U_PATIENT)
        # WITH CHECK fails for nonexistent appointment (NOT the FK error: the
        # policy is evaluated first and yields 42501, proving RLS guards it)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'ghost')",
            {"a": fake, "s": U_PATIENT},
            code="42501",
        )
        # a REAL appointment the sender does not belong to is also rejected
        as_user(conn, U_PATIENT3)
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'intruder')",
            {"a": APPT2, "s": U_PATIENT3},
            code="42501",
        )
    check("8. invalid/nonexistent appointment cannot be used", e1)

    # =========================================================
    print("\n=== F. anon is fully blocked; messages are immutable ===")

    def f1():
        as_user(conn, None)
        expect_error(conn, "SELECT count(*) FROM public.messages", {}, code="42501")
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), 'anon')",
            {"a": APPT1, "s": "00000000-0000-0000-0000-000000000000"},
            code="42501",
        )
    check("9. anon cannot read or insert messages", f1)

    def f2():
        as_user(conn, U_PATIENT)
        # no UPDATE path: privilege error before any policy is evaluated
        expect_error(
            conn,
            "UPDATE public.messages SET body = 'edited' WHERE id = CAST(:m AS uuid)",
            {"m": M1},
            code="42501",
        )
        # no DELETE path either
        expect_error(
            conn,
            "DELETE FROM public.messages WHERE id = CAST(:m AS uuid)",
            {"m": M1},
            code="42501",
        )
        # participant cannot tamper via updated_at either (trigger keeps it server-set)
        row = conn.execute(
            text("SELECT created_at, updated_at FROM public.messages WHERE id = CAST(:m AS uuid)"),
            {"m": M1},
        ).one()
        assert row.created_at is not None and row.updated_at is not None
    check("10. messages immutable for participants (no UPDATE/DELETE path)", f2)

    # =========================================================
    print("\n=== G. schema-level validation ===")

    def g1():
        as_user(conn, U_PATIENT)
        # empty / whitespace-only body rejected by CHECK
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), '   ')",
            {"a": APPT1, "s": U_PATIENT},
            contains="messages_body_check",
        )
        # body > 4000 chars rejected
        expect_error(
            conn,
            "INSERT INTO public.messages (appointment_id, sender_user_id, body) "
            "VALUES (CAST(:a AS uuid), CAST(:s AS uuid), repeat('x', 4001))",
            {"a": APPT1, "s": U_PATIENT},
            contains="messages_body_check",
        )        # appointment_id must reference a REAL appointments row (FK + CASCADE).
        # Verified via catalog: for a nonexistent id the RLS WITH CHECK fires
        # before the FK (42501), so the FK itself is only observable when the
        # sender IS a participant — covered by check 8 already.
        fk = conn.execute(
            text(
                "SELECT confdeltype FROM pg_constraint "
                "WHERE conname = 'messages_appointment_id_fkey' "
                "AND conrelid = 'public.messages'::regclass"
            )
        ).scalar()
        assert fk == "c", f"FK to appointments must exist with ON DELETE CASCADE, got {fk!r}"
        # 4000 chars exactly is allowed (boundary)
        mid = send_msg(conn, APPT1, U_PATIENT, "x" * 4000)
        assert mid, "4000-char body must be accepted"
    check("11. CHECK constraints + FK to appointments enforced", g1)

    def g2():
        # helper: SECURITY DEFINER, STABLE, search_path pinned, least privilege
        row = conn.execute(
            text(
                "SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig, "
                "       has_function_privilege('anon', 'public.user_appointment_ids()', 'EXECUTE') AS grant_anon, "
                "       has_function_privilege('authenticated', 'public.user_appointment_ids()', 'EXECUTE') AS grant_auth "
                "FROM pg_proc p WHERE p.oid = to_regprocedure('public.user_appointment_ids()')"
            )
        ).one()
        assert row.prosecdef is True, "helper must be SECURITY DEFINER"
        assert row.provolatile == "s", f"helper must be STABLE, got {row.provolatile!r}"
        assert row.proconfig is not None and any(
            c.startswith("search_path=") and c[len("search_path="):].strip('"') == ""
            for c in row.proconfig
        ), f"search_path must be pinned to empty, got {row.proconfig}"
        assert row.grant_anon is False, "anon must not hold EXECUTE on the helper"
        assert row.grant_auth is True, "authenticated must hold EXECUTE on the helper"

        # RLS enabled + forced on messages
        row = conn.execute(
            text(
                "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                "WHERE oid = 'public.messages'::regclass"
            )
        ).one()
        assert row.relrowsecurity is True and row.relforcerowsecurity is True, "RLS must be enabled + forced"

        # table grants: authenticated SELECT+INSERT only; anon nothing
        row = conn.execute(
            text(
                "SELECT "
                "  has_table_privilege('authenticated', 'public.messages', 'SELECT') AS sel_auth, "
                "  has_table_privilege('authenticated', 'public.messages', 'INSERT') AS ins_auth, "
                "  has_table_privilege('authenticated', 'public.messages', 'UPDATE') AS upd_auth, "
                "  has_table_privilege('authenticated', 'public.messages', 'DELETE') AS del_auth, "
                "  has_table_privilege('anon', 'public.messages', 'SELECT') AS sel_anon, "
                "  has_table_privilege('anon', 'public.messages', 'INSERT') AS ins_anon"
            )
        ).one()
        assert row.sel_auth and row.ins_auth, "authenticated needs SELECT+INSERT"
        assert not row.upd_auth and not row.del_auth, "no UPDATE/DELETE for authenticated"
        assert not row.sel_anon and not row.ins_anon, "anon must hold no privileges"
    check("12. helper properties + RLS flags + least-privilege grants", g2)

    def g3():
        # realtime publication contains messages
        n = conn.execute(
            text(
                "SELECT count(*) FROM pg_publication_tables "
                "WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'"
            )
        ).scalar()
        assert n == 1, f"messages must be in supabase_realtime publication, saw {n}"
        # replica identity FULL
        ri = conn.execute(
            text("SELECT relreplident FROM pg_class WHERE oid = 'public.messages'::regclass")
        ).scalar()
        assert ri == "f", f"replica identity must be FULL ('f'), got {ri!r}"
        # the three required indexes exist
        idx = conn.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE schemaname = 'public' AND tablename = 'messages' ORDER BY indexname"
            )
        ).scalars().all()
        assert "ix_messages_appointment_created" in idx, f"indexes={idx}"
        assert "ix_messages_sender_user_id" in idx, f"indexes={idx}"
        assert "ix_messages_created_at" in idx, f"indexes={idx}"
    check("13. realtime publication + replica identity + indexes", g3)

    # =========================================================
    print("\n=== H. migration 016 is idempotent ===")

    def h1():
        conn.exec_driver_sql("RESET ROLE")  # DDL needs the DB owner role
        run_file(conn, os.path.join(DB_DIR, "016_appointment_messages.sql"))
        print("[sandbox] re-applied migration 016_appointment_messages.sql")
        as_user(conn, U_PATIENT)
        n = conn.execute(
            text("SELECT count(*) FROM public.messages WHERE appointment_id = CAST(:a AS uuid)"),
            {"a": APPT1},
        ).scalar()
        assert n == 5, f"data must survive re-apply, saw {n}"
        as_user(conn, None)
        expect_error(conn, "SELECT count(*) FROM public.messages", {}, code="42501")
    check("14. re-applying 016 is a no-op (data + security intact)", h1)

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
