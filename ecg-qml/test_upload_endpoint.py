"""Phase 1A endpoint tests for POST /ecg/upload (run against a live server).

Usage: .venv/Scripts/python.exe test_upload_endpoint.py [base_url]
Default base_url: http://127.0.0.1:8000

Covers the Phase 1A spec:
- valid CSV / TXT uploads (comma, whitespace, single-column, multi-column, BOM/CRLF)
- deterministic 187-value segmentation (exact multiple, remainder discard)
- rejection paths: non-numeric, empty, NaN/Inf, too few samples, bad extension, too large
- no MIT-BIH fallback: beats must be verbatim slices of the uploaded data
- regression: GET /samples and POST /analyze still work
"""

from __future__ import annotations

import json
import math
import sys
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
BOUNDARY = "----ecgtest" + uuid.uuid4().hex

PASS = 0
FAIL = 0
FAILURES: list[str] = []


def check(name: str, condition: bool, extra: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        FAILURES.append(name)
        print(f"  FAIL  {name}  {extra}")


def multipart(filename: str, content: bytes, field: str = "file") -> tuple[bytes, str]:
    body = (
        f"--{BOUNDARY}\r\n".encode()
        + f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode()
        + b"Content-Type: application/octet-stream\r\n\r\n"
        + content
        + f"\r\n--{BOUNDARY}--\r\n".encode()
    )
    return body, f"multipart/form-data; boundary={BOUNDARY}"


def call(method: str, path: str, body: bytes | None = None, content_type: str | None = None):
    request = urllib.request.Request(BASE + path, data=body, method=method)
    if content_type:
        request.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"raw": raw}


def upload(filename: str, content: bytes):
    body, content_type = multipart(filename, content)
    return call("POST", "/ecg/upload", body, content_type)


def assert_valid_beats(name: str, payload: dict, expected_beats: int, source_values: list[float]) -> None:
    beats = payload["beats"]
    check(f"{name}: beat count == {expected_beats}", len(beats) == expected_beats, f"got {len(beats)}")
    check(
        f"{name}: every beat is exactly 187 finite values",
        all(len(b) == 187 and all(math.isfinite(v) for v in b) for b in beats),
    )
    check(
        f"{name}: metadata counts",
        payload["sample_count"] == len(source_values)
        and payload["metadata"]["generated_beat_count"] == expected_beats
        and payload["metadata"]["original_sample_count"] == len(source_values),
    )
    check(f"{name}: metadata.source == upload", payload["metadata"]["source"] == "upload")
    check(
        f"{name}: no MIT-BIH fallback (beats are verbatim slices of the upload)",
        all(beats[i] == source_values[i * 187 : (i + 1) * 187] for i in range(len(beats))),
    )
    check(
        f"{name}: segmentation note present & non-clinical",
        "not clinically derived" in payload["metadata"]["segmentation_note"],
    )


print("== 1. valid comma-separated CSV, 450 values -> 2 beats, 26 discarded ==")
values = [round(0.001 * i, 4) for i in range(450)]
csv_a = ",".join(str(v) for v in values).encode()
status, payload = upload("ecg_a.csv", csv_a)
check("status 200", status == 200, f"got {status}: {payload}")
if status == 200:
    assert_valid_beats("csv-a", payload, 2, values)
    check("csv-a: upload_id present", payload["upload_id"].startswith("upl-"))
    check("csv-a: filename echoed", payload["filename"] == "ecg_a.csv")
    check("csv-a: format csv / delimiter comma", payload["metadata"]["format"] == "csv" and payload["metadata"]["delimiter"] == "comma")

print("== 2. exact 187-value single-column TXT (CRLF + BOM) -> 1 beat ==")
values_b = [round(0.01 * (i % 37), 3) for i in range(187)]
txt_b = ("﻿" + "\r\n".join(str(v) for v in values_b) + "\r\n").encode("utf-8")
status, payload = upload("ecg_b.txt", txt_b)
check("status 200", status == 200, f"got {status}: {payload}")
if status == 200:
    assert_valid_beats("txt-b", payload, 1, values_b)
    check("txt-b: format txt / delimiter whitespace", payload["metadata"]["format"] == "txt" and payload["metadata"]["delimiter"] == "whitespace")

print("== 3. multi-column CSV (2 cols x 200 rows = 400 values) -> 2 beats ==")
values_c = [round(0.005 * i, 4) for i in range(400)]
rows = [f"{values_c[i]},{values_c[i + 1]}" for i in range(0, 400, 2)]
status, payload = upload("ecg_c.csv", ("\n".join(rows) + "\n").encode())
check("status 200", status == 200, f"got {status}: {payload}")
if status == 200:
    assert_valid_beats("csv-c", payload, 2, values_c)

print("== 4. whitespace TXT, 400 values -> 2 beats, 26 discarded ==")
values_d = [round(0.002 * i, 4) for i in range(400)]
status, payload = upload("ecg_d.txt", " ".join(str(v) for v in values_d).encode())
check("status 200", status == 200, f"got {status}: {payload}")
if status == 200:
    assert_valid_beats("txt-d", payload, 2, values_d)

print("== 5. mixed negative/scientific notation -> accepted ==")
values_e = [round(-1.5e-3 * (i % 90), 6) for i in range(374)]
status, payload = upload("ecg_e.txt", "\n".join(str(v) for v in values_e).encode())
check("status 200", status == 200, f"got {status}: {payload}")
if status == 200:
    assert_valid_beats("txt-e", payload, 2, values_e)

print("== 6. malformed CSV (letters) -> 422, no beats, no fallback ==")
status, payload = upload("bad.csv", b"1.0,2.0,abc,4.0\n")
check("status 422", status == 422, f"got {status}: {payload}")
check("error mentions non-numeric", status == 422 and "on-numeric" in json.dumps(payload))

print("== 7. empty file -> 422 ==")
status, payload = upload("empty.csv", b"")
check("status 422", status == 422, f"got {status}: {payload}")
check("error mentions empty", status == 422 and "empty" in json.dumps(payload).lower())

print("== 8. headers-only CSV -> 422 ==")
status, payload = upload("headers.csv", b"ecg,value\n")
check("status 422", status == 422, f"got {status}: {payload}")

print("== 9. NaN / Inf values -> 422 ==")
status, payload = upload("nan.csv", b"1.0,2.0,NaN,4.0\n")
check("NaN rejected 422", status == 422, f"got {status}: {payload}")
status, payload = upload("inf.txt", b"1.0 2.0 Infinity 4.0\n")
check("Infinity rejected 422", status == 422, f"got {status}: {payload}")

print("== 10. fewer than 187 values -> 422 (zero beats) ==")
status, payload = upload("short.txt", ",".join(str(i * 0.1) for i in range(100)).encode())
check("status 422", status == 422, f"got {status}: {payload}")
check("error mentions 187", status == 422 and "187" in json.dumps(payload))

print("== 11. unsupported extensions -> 415 ==")
status, payload = upload("report.pdf", b"%PDF-1.4 fake pdf bytes")
check("corrupt PDF -> 422 (PDF now accepted, digitization fails loudly)", status == 422, f"got {status}: {payload}")
status, payload = upload("noext", b"1.0 2.0 3.0")
check("no extension -> 415", status == 415, f"got {status}: {payload}")
status, payload = upload("image.png", b"\x89PNG fake")
check("PNG -> 415 (image support intentionally not implemented)", status == 415, f"got {status}: {payload}")
check("415 detail mentions csv/txt", status == 415 and ".csv" in json.dumps(payload))

print("== 12. oversized file (>5 MB) -> 413 ==")
big = (b"0.1\n" * 1_500_000)  # ~6 MB
status, payload = upload("big.csv", big)
check("status 413", status == 413, f"got {status}: {payload}")

print("== 13. GET /samples regression (MIT-BIH untouched) ==")
status, payload = call("GET", "/samples")
check("GET /samples 200", status == 200)
check(
    "samples still 187-length signals",
    status == 200 and all(len(s["signal"]) == 187 for s in payload["samples"]),
)

print("== 14. POST /analyze regression on a real MIT-BIH sample ==")
status, samples = call("GET", "/samples")
if status == 200 and samples["samples"]:
    signal = samples["samples"][0]["signal"]
    status, payload = call("POST", "/analyze", json.dumps({"ecg": signal}).encode(), "application/json")
    check("POST /analyze 200 with MIT-BIH signal", status == 200, f"got {status}")
    check("analyze returns 5 probabilities", status == 200 and len(payload["prediction"]["probabilities"]) == 5)
else:
    check("POST /analyze regression skipped (no samples)", False)

print()
print(f"RESULT: {PASS} passed, {FAIL} failed")
if FAILURES:
    print("Failures:")
    for name in FAILURES:
        print(f"  - {name}")
sys.exit(1 if FAIL else 0)
