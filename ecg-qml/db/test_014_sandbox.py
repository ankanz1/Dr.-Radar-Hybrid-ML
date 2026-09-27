"""TEMPORARY sandbox proof for migrations 014 + 015 (availability & booking).

Replicates the test_009_sandbox harness: scratch local Postgres DB with
Supabase semantics (anon/authenticated roles, auth.uid() from JWT claims),
built from the real supabase_schema.sql plus migrations 006/007/008 (RLS),
011 (directory + booking), 013, 014 and 015 (request_appointment VOLATILE).

Verifies the required end-to-end flow:
  1. doctor publishes tomorrow's slots  -> doctors.slots + availability_date
  2. patient sees those slots in list_doctor_directory() (dated, no bookings)
  3. patient books 10:00 with request_appointment() -> appointment row
  4. patient reads their own appointment; doctor reads it through
     doctor_own_appointment_ids() + RLS (the dashboard query)
  5. booked slot disappears from the directory (booked_slots) and any second
     booking of the same doctor/date/time is rejected
  6. 4 concurrent bookings of one slot: exactly one succeeds (advisory lock)
   7. wrong-day / unoffered / past-dated bookings, invalid labels, past
      publish dates and anon callers are all rejected
   8. request_appointment() is VOLATILE (015): a STABLE copy (the state
      011/013 leave behind) fails the final INSERT with "INSERT is not
      allowed in a non-volatile function", and re-applying 015 heals it
      idempotently without touching grants/SECURITY DEFINER

Run: DATABASE_URL=... python3 test_014_sandbox.py   (needs a reachable PG)
"""

import json
import os
import re
import threading
from datetime import date, timedelta

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

DB_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(DB_DIR, "..", ".env"))

BASE_URL = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
SCRATCH_DB = "dr_radar_availability_test_014"
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

U_PATIENT = "b1000000-0000-0000-0000-000000000001"
U_PATIENT2 = "b1000000-0000-0000-0000-000000000002"
U_PATIENT3 = "b1000000-0000-0000-0000-000000000003"
U_PATIENT4 = "b1000000-0000-0000-0000-000000000004"
U_PATIENT5 = "b1000000-0000-0000-0000-000000000005"
U_PATIENT6 = "b1000000-0000-0000-0000-000000000006"
U_DOCTOR = "b2000000-0000-0000-0000-000000000001"
U_DOCTOR2 = "b2000000-0000-0000-0000-000000000002"

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


REQUEST_APPOINTMENT_OID = (
    "to_regprocedure('public.request_appointment(uuid,text,text,text,date)')"
)


def request_appointment_volatility(conn):
    """'v'/'s' for the 5-arg request_appointment currently installed."""
    return conn.execute(
        text(
            "SELECT p.provolatile FROM pg_proc p "
            "WHERE p.oid = " + REQUEST_APPOINTMENT_OID
        )
    ).scalar()


def day_after_tomorrow():
    return (date.today() + timedelta(days=2)).isoformat()


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
                   (:p4, 'pat4@test.local', 'patient', 'Pat', 'Four', 'Pat Four', 'x'),
                   (:p5, 'pat5@test.local', 'patient', 'Pat', 'Five', 'Pat Five', 'x'),
                   (:p6, 'pat6@test.local', 'patient', 'Pat', 'Six', 'Pat Six', 'x'),
                   (:d1, 'doc1@test.local', 'doctor', 'Dot', 'One', 'Dot One', 'x'),
                   (:d2, 'doc2@test.local', 'doctor', 'Dot', 'Two', 'Dot Two', 'x')
            """
        ),
        {
            "p1": U_PATIENT, "p2": U_PATIENT2, "p3": U_PATIENT3,
            "p4": U_PATIENT4, "p5": U_PATIENT5, "p6": U_PATIENT6,
            "d1": U_DOCTOR, "d2": U_DOCTOR2,
        },
    )
    for uid in (U_PATIENT, U_PATIENT2, U_PATIENT3, U_PATIENT4, U_PATIENT5, U_PATIENT6):
        conn.execute(text("INSERT INTO public.patients (user_id) VALUES (:u)"), {"u": uid})
    for uid in (U_DOCTOR, U_DOCTOR2):
        conn.execute(
            text("INSERT INTO public.doctors (user_id, title, specialty) VALUES (:u, 'Dr', 'Cardiology')"),
            {"u": uid},
        )
    print("[sandbox] seeded 2 doctors + 6 patients\n")

    DOC = conn.execute(text("SELECT id FROM public.doctors WHERE user_id = :u"), {"u": U_DOCTOR}).scalar()
    DOC2 = conn.execute(text("SELECT id FROM public.doctors WHERE user_id = :u"), {"u": U_DOCTOR2}).scalar()
    PID1 = conn.execute(text("SELECT id FROM public.patients WHERE user_id = :u"), {"u": U_PATIENT}).scalar()
    TOMORROW = tomorrow()

    # =========================================================
    print("=== A. doctor publishes availability (publish_doctor_slots) ===")

    def a1():
        as_user(conn, U_DOCTOR)
        got = publish(conn, ["11:00", "10:00", "10:00", "17:30"], TOMORROW)
        assert set(got) == {"10:00", "11:00", "17:30"}, f"got {got}"
        row = conn.execute(
            text(
                "SELECT slots, availability_date, is_available_today, next_available "
                "FROM public.doctors WHERE user_id = :u"
            ),
            {"u": U_DOCTOR},
        ).one()
        assert set(row.slots) == {"10:00", "11:00", "17:30"}, f"slots={row.slots}"
        assert str(row.availability_date) == TOMORROW, f"availability_date={row.availability_date}"
        assert row.is_available_today is False, "tomorrow is not 'today'"
        assert row.next_available is not None, "next_available should be set"
    check("A1. publish tomorrow's slots to own doctors row (deduped)", a1)

    def a2():
        as_user(conn, U_DOCTOR)
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps(["25:99"]), "d": TOMORROW}, contains="24-hour HH:MM")
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps(["10:00 AM"]), "d": TOMORROW}, contains="24-hour HH:MM")
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps(["10:00"]), "d": (date.today() - timedelta(days=1)).isoformat()},
                     contains="cannot be in the past")
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps("10:00"), "d": TOMORROW}, contains="JSON array")
    check("A2. invalid labels / past dates / non-array rejected", a2)

    def a3():
        as_user(conn, U_PATIENT)
        n = conn.execute(text("SELECT count(*) FROM public.doctors")).scalar()
        assert n == 0, f"patient must not see raw doctors table, saw {n}"
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps(["10:00"]), "d": TOMORROW}, contains="No doctor profile")
    check("A3. patient cannot publish / read raw doctors table", a3)

    # =========================================================
    print("\n=== B. patient sees published slots (list_doctor_directory) ===")

    def b1():
        as_user(conn, U_PATIENT)
        row = conn.execute(
            text("SELECT doctor_id, slots, availability_date, booked_slots FROM public.list_doctor_directory() "
                 "WHERE doctor_id = :d"),
            {"d": DOC},
        ).one()
        assert set(row.slots) == {"10:00", "11:00", "17:30"}, f"slots={row.slots}"
        assert str(row.availability_date) == TOMORROW, f"availability_date={row.availability_date}"
        assert list(row.booked_slots) == [], f"booked_slots={row.booked_slots}"
    check("B1. patient sees published slots + date, nothing booked yet", b1)

    # =========================================================
    print("\n=== C. patient books 10:00 (request_appointment) ===")

    def c1():
        as_user(conn, U_PATIENT)
        appt = book(conn, DOC, "10:00", TOMORROW, "telehealth", "Review my ECG")
        assert appt, "no appointment id returned"
        row = conn.execute(
            text("SELECT start_time, end_time, status, patient_id, doctor_id FROM public.appointments WHERE id = :i"),
            {"i": appt},
        ).one()
        assert row.status == "scheduled"
        assert row.patient_id == PID1 and row.doctor_id == DOC
        # stored as UTC wall clock == the published label (session-TZ independent)
        assert row.start_time.isoformat()[:16] == f"{TOMORROW}T10:00", f"start={row.start_time}"
        assert (row.end_time - row.start_time).total_seconds() == 1800, "30-minute slot"
    check("C1. booking stores 30-min appointment at the published UTC time", c1)

    def c2():
        as_user(conn, U_PATIENT)
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "10:00", "ptype": "telehealth", "reason": None, "day": TOMORROW},
                     contains="already been booked")
    check("C2. same patient re-booking the taken slot rejected", c2)

    def c3():
        as_user(conn, U_PATIENT2)
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "10:00", "ptype": "in_person", "reason": None, "day": TOMORROW},
                     contains="already been booked")
    check("C3. a SECOND patient cannot double-book the same slot", c3)

    def c4():
        as_user(conn, U_PATIENT2)
        appt = book(conn, DOC, "11:00", TOMORROW, "in_person")
        assert appt, "11:00 should still be free"
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "12:00", "ptype": "telehealth", "reason": None, "day": TOMORROW},
                     contains="not offered")
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "17:30", "ptype": "telehealth", "reason": None,
                      "day": day_after_tomorrow()},
                     contains="has not published availability")
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "10:00", "ptype": "telehealth", "reason": None,
                      "day": (date.today() - timedelta(days=1)).isoformat()},
                     contains="cannot be in the past")
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC2, "slot": "10:00", "ptype": "telehealth", "reason": None, "day": TOMORROW},
                     contains="not offered")
    check("C4. other slots book; unoffered/wrong-day/past bookings rejected", c4)

    # =========================================================
    print("\n=== D. booked slots disappear from the directory ===")

    def d1():
        as_user(conn, U_PATIENT)
        row = conn.execute(
            text("SELECT slots, booked_slots FROM public.list_doctor_directory() WHERE doctor_id = :d"),
            {"d": DOC},
        ).one()
        assert set(row.slots) == {"10:00", "11:00", "17:30"}, f"slots={row.slots}"
        assert set(row.booked_slots) == {"10:00", "11:00"}, f"booked_slots={row.booked_slots}"
        open_slots = [s for s in row.slots if s not in set(row.booked_slots)]
        assert open_slots == ["17:30"], f"open slots should be only 17:30, got {open_slots}"
    check("D1. directory hides booked slots (open slots = ['17:30'])", d1)

    def d2():
        as_user(conn, U_DOCTOR)
        expect_error(conn, "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "17:30", "ptype": "telehealth", "reason": None, "day": TOMORROW},
                     contains="No patient profile")
    check("D2. doctor account cannot book (no patient profile)", d2)

    # =========================================================
    print("\n=== E. both sides read the appointment ===")

    def e1():
        as_user(conn, U_PATIENT)
        # Same shape the frontend uses (PostgREST embed = LEFT JOIN). Patients
        # may not read doctors/users rows under RLS, so the embedded doctor
        # columns are NULL and the UI falls back to a generic "Doctor" label.
        rows = conn.execute(
            text(
                "SELECT a.id, a.status, a.start_time, u.display_name AS doctor_name "
                "FROM public.appointments a "
                "LEFT JOIN public.doctors d ON d.id = a.doctor_id "
                "LEFT JOIN public.users u ON u.id = d.user_id"
            )
        ).fetchall()
        assert len(rows) == 1, f"patient1 should see exactly own appointment, saw {len(rows)}"
        assert rows[0].status == "scheduled", f"status={rows[0].status}"
        assert rows[0].doctor_name in (None, "Dot One"), f"doctor_name={rows[0].doctor_name}"
    check("E1. patient sees their own appointment (doctor embed RLS-safe)", e1)

    def e2():
        as_user(conn, U_DOCTOR)
        rows = conn.execute(
            text(
                "SELECT a.id, a.start_time, a.status, a.consultation_type, u.display_name AS patient_name "
                "FROM public.appointments a "
                "JOIN public.patients p ON p.id = a.patient_id "
                "JOIN public.users u ON u.id = p.user_id "
                "WHERE a.id IN (SELECT public.doctor_own_appointment_ids()) "
                "ORDER BY a.start_time"
            )
        ).fetchall()
        assert len(rows) == 2, f"doctor should see both appointments, saw {len(rows)}"
        names = {r.patient_name for r in rows}
        assert names == {"Pat One", "Pat Two"}, f"patient names={names}"
        assert all(r.consultation_type in ("telehealth", "in_person") for r in rows)
    check("E2. doctor dashboard query returns both appointments + patient names", e2)

    def e3():
        as_user(conn, U_PATIENT2)
        rows = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert rows == 1, f"patient2 must see only own row, saw {rows}"
        as_user(conn, U_DOCTOR2)
        rows = conn.execute(text("SELECT count(*) FROM public.appointments")).scalar()
        assert rows == 0, f"unrelated doctor must see no rows, saw {rows}"
    check("E3. RLS: patients/other doctors see only their own rows", e3)

    # =========================================================
    print("\n=== F. concurrent bookings of one slot (advisory lock) ===")

    def f1():
        as_user(conn, U_DOCTOR)
        publish(conn, ["10:00", "11:00", "14:00", "17:30"], TOMORROW)

        racers = [U_PATIENT3, U_PATIENT4, U_PATIENT5, U_PATIENT6]
        results = [None] * len(racers)
        errors = [None] * len(racers)

        def racer(idx, uid):
            local = engine.connect()
            try:
                as_user(local, uid)
                results[idx] = book(local, DOC, "14:00", TOMORROW, "telehealth")
            except Exception as e:  # noqa: BLE001
                errors[idx] = str(e)[:160]
            finally:
                local.close()

        threads = [threading.Thread(target=racer, args=(i, u)) for i, u in enumerate(racers)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        ok = [r for r in results if r]
        assert len(ok) == 1, f"exactly one racer must win, got {len(ok)} (results={results}, errors={errors})"
        assert sum(1 for e in errors if e) == len(racers) - 1, f"errors={errors}"
        assert any("already been booked" in (e or "") or "duplicate key" in (e or "") for e in errors), \
            f"losers must be rejected, got {errors}"

        as_user(conn, U_DOCTOR)  # count under RLS, as the doctor who owns the slot
        n = conn.execute(
            text("SELECT count(*) FROM public.appointments WHERE doctor_id = :d AND status = 'scheduled' "
                 "AND (start_time AT TIME ZONE 'UTC')::time = '14:00'::time"),
            {"d": DOC},
        ).scalar()
        assert n == 1, f"exactly one 14:00 appointment must exist, saw {n}"
    check("F1. 4 concurrent bookings -> exactly one succeeds", f1)

    # =========================================================
    print("\n=== G. anon callers and republish cleanup ===")

    def g1():
        as_user(conn, None)
        expect_error(conn, "SELECT public.publish_doctor_slots(CAST(:s AS jsonb), CAST(:d AS date))",
                     {"s": json.dumps(["10:00"]), "d": TOMORROW}, code="42501")
        expect_error(conn, "SELECT count(*) FROM public.list_doctor_directory()", {}, code="42501")
        expect_error(conn,
                     "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
                     {"doc": DOC, "slot": "17:30", "ptype": "telehealth", "reason": None, "day": TOMORROW},
                     code="42501")
    check("G1. anon cannot publish, list the directory, or book", g1)

    def g2():
        as_user(conn, U_DOCTOR)
        publish(conn, [], TOMORROW)
        row = conn.execute(
            text("SELECT slots, availability_date FROM public.doctors WHERE user_id = :u"),
            {"u": U_DOCTOR},
        ).one()
        assert list(row.slots) == [], f"slots={row.slots}"
        assert row.availability_date is None, f"availability_date={row.availability_date}"
        as_user(conn, U_PATIENT)
        row = conn.execute(
            text("SELECT slots, booked_slots, availability_date FROM public.list_doctor_directory() "
                 "WHERE doctor_id = :d"),
            {"d": DOC},
        ).one()
        # Once the day is unpublished, booked_slots falls back to the legacy
        # "all future bookings" scope, but no slots are offered anymore.
        assert list(row.slots) == [], f"slots={row.slots}, booked={row.booked_slots}"
        assert row.availability_date is None, f"availability_date={row.availability_date}"
    check("G2. publishing an empty list unpublishes the day", g2)

    # =========================================================
    print("\n=== H. request_appointment volatility (migration 015) ===")

    def apply(mig):
        conn.exec_driver_sql("RESET ROLE")  # DDL needs the DB owner role
        run_file(conn, os.path.join(DB_DIR, mig))
        print(f"[sandbox] applied migration {mig}")

    def h1():
        as_user(conn, U_PATIENT)
        row = conn.execute(
            text(
                "SELECT p.provolatile, p.prosecdef, "
                "       has_function_privilege('authenticated', "
                "           'public.request_appointment(uuid,text,text,text,date)', 'EXECUTE') AS grant_auth, "
                "       has_function_privilege('anon', "
                "           'public.request_appointment(uuid,text,text,text,date)', 'EXECUTE') AS grant_anon "
                "FROM pg_proc p WHERE p.oid = " + REQUEST_APPOINTMENT_OID
            )
        ).one()
        assert row.provolatile == "v", f"provolatile={row.provolatile!r}; must be 'v' (015)"
        assert row.prosecdef is True, "SECURITY DEFINER must be preserved"
        assert row.grant_auth is True, "authenticated must keep EXECUTE"
        assert row.grant_anon is False, "anon must not get EXECUTE"
    check("H1. function is VOLATILE + SECURITY DEFINER, grants unchanged", h1)

    def h2():
        as_user(conn, U_DOCTOR)
        publish(conn, ["09:00", "09:30"], TOMORROW)

        # Reproduce the reported live state: 011/013 declare the function
        # STABLE and share the same signature, so re-running either one
        # (out-of-order apply) flips the installed function back to STABLE.
        apply("013_doctor_availability_and_slot_exclusivity.sql")
        vol = request_appointment_volatility(conn)
        assert vol == "s", f"degradation did not take effect, provolatile={vol!r}"

        as_user(conn, U_PATIENT2)
        expect_error(
            conn,
            "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
            {"doc": DOC, "slot": "09:00", "ptype": "telehealth", "reason": None, "day": TOMORROW},
            contains="INSERT is not allowed in a non-volatile function",
        )

        # 015 heals it (idempotent CREATE OR REPLACE, volatility flips to 'v')
        apply("015_request_appointment_volatile.sql")
        vol = request_appointment_volatility(conn)
        assert vol == "v", f"015 did not restore VOLATILE, provolatile={vol!r}"

        as_user(conn, U_PATIENT2)
        appt = book(conn, DOC, "09:00", TOMORROW, "telehealth")
        assert appt, "booking must succeed after 015"
        row = conn.execute(
            text("SELECT start_time, end_time, status FROM public.appointments WHERE id = :i"),
            {"i": appt},
        ).one()
        assert row.status == "scheduled"
        assert row.start_time.isoformat()[:16] == f"{TOMORROW}T09:00", f"start={row.start_time}"
        assert (row.end_time - row.start_time).total_seconds() == 1800, "30-minute slot"

        # Applying 015 a second time is a no-op (still VOLATILE, booking works)
        apply("015_request_appointment_volatile.sql")
        assert request_appointment_volatility(conn) == "v", "second apply of 015 broke volatility"
        expect_error(
            conn,
            "SELECT public.request_appointment(CAST(:doc AS uuid), :slot, :ptype, :reason, CAST(:day AS date))",
            {"doc": DOC, "slot": "09:00", "ptype": "telehealth", "reason": None, "day": TOMORROW},
            contains="already been booked",
        )
        appt2 = book(conn, DOC, "09:30", TOMORROW, "in_person")
        assert appt2, "second distinct slot must still be bookable"
    check(
        "H2. STABLE copy reproduces the reported INSERT error; 015 heals it (idempotent)",
        h2,
    )

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
