from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import math
import uuid

import cv2
import numpy as np
import pymupdf as fitz

from fastapi import FastAPI, File, HTTPException, Header, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.explain_qml import _load_frozen_qml_artifacts, explain_ecg
from src.data import CLASS_NAMES, load_csv_dataset

from dotenv import load_dotenv
load_dotenv(dotenv_path="ecg-qml/.env")

# --- Auth module ---
from auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    MeResponse,
    create_access_token,
    decode_token,
    verify_password,
    hash_password,
    get_user_by_email,
    create_user,
    get_user_by_id,
)


PROJECT_ROOT = Path(__file__).resolve().parent
TEST_DATA_PATH = PROJECT_ROOT / "data" / "mitbih_test.csv"
CLASS_FULL_NAMES = {
    "N": "Normal heartbeat",
    "S": "Supraventricular ectopic heartbeat",
    "V": "Ventricular ectopic heartbeat",
    "F": "Fusion heartbeat",
    "Q": "Unknown/other heartbeat",
}


class EcgRequest(BaseModel):
    ecg: list[float] = Field(..., min_length=187, max_length=187)


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model: str
    input_features: int
    pca_components: int
    qubits: int
    vqc_layers: int


class ModelInfoResponse(BaseModel):
    model: str
    input_features: int
    pca_components: int
    qubits: int
    vqc_layers: int
    classes: dict[str, str]
    test_macro_f1: float
    research_prototype: bool


class PredictionResponse(BaseModel):
    predicted_class_id: int
    predicted_class: str
    predicted_class_name: str
    confidence: float
    probabilities: dict[str, float]


class AnalyzeResponse(BaseModel):
    prediction: PredictionResponse
    explanation: dict[str, Any]


class ECGSample(BaseModel):
    id: str
    index: int
    sample_index: int
    class_id: int
    class_code: str
    class_name: str
    signal: list[float] = Field(..., min_length=187, max_length=187)


class SamplesResponse(BaseModel):
    samples: list[ECGSample]


class EcgUploadMetadata(BaseModel):
    format: str
    source: str = "upload"
    original_sample_count: int
    generated_beat_count: int
    segmentation_method: str
    segmentation_note: str
    delimiter: str


class EcgUploadResponse(BaseModel):
    upload_id: str
    filename: str
    sample_count: int
    beats: list[list[float]]
    metadata: EcgUploadMetadata


app = FastAPI(title="ECG-QML Inference API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://dr-radar-hybrid-ml.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        _load_frozen_qml_artifacts("balanced")
        model_loaded = True
    except Exception:
        model_loaded = False
    return HealthResponse(
        status="ok",
        model_loaded=model_loaded,
        model="PCA-8 Hybrid QML",
        input_features=187,
        pca_components=8,
        qubits=8,
        vqc_layers=4,
    )


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    return ModelInfoResponse(
        model="PCA-8 Hybrid QML",
        input_features=187,
        pca_components=8,
        qubits=8,
        vqc_layers=4,
        classes={
            "N": "Normal heartbeat",
            "S": "Supraventricular ectopic heartbeat",
            "V": "Ventricular ectopic heartbeat",
            "F": "Fusion heartbeat",
            "Q": "Unknown/other heartbeat",
        },
        test_macro_f1=0.3518437223,
        research_prototype=True,
    )


@lru_cache(maxsize=1)
def _load_test_dataset():
    """Load the evaluation dataset once for the small research-sample endpoint."""
    return load_csv_dataset(TEST_DATA_PATH)


def _sample_from_row(index: int, row: Any) -> ECGSample:
    class_id = int(row.iloc[-1])
    class_code = CLASS_NAMES.get(class_id, str(class_id))
    return ECGSample(
        id=f"test-{index}",
        index=index,
        sample_index=index,
        class_id=class_id,
        class_code=class_code,
        class_name=CLASS_FULL_NAMES.get(class_code, class_code),
        signal=[float(value) for value in row.iloc[:-1].to_numpy(dtype=float)],
    )


@app.get("/samples", response_model=SamplesResponse)
def get_samples(
    class_id: int | None = Query(default=None, ge=0, le=4),
    sample_index: int | None = Query(default=None, ge=0),
) -> SamplesResponse:
    """Return a bounded, deterministic set of real MIT-BIH test beats.

    With no filters, the first test-set row for each available AAMI class is
    returned. ``sample_index`` selects one exact CSV row; ``class_id`` selects
    the first row for that class. The full CSV is never returned.
    """
    try:
        test_df = _load_test_dataset()
        if sample_index is not None:
            if sample_index >= len(test_df):
                raise HTTPException(
                    status_code=404,
                    detail=f"Test sample index must be between 0 and {len(test_df) - 1}.",
                )
            row = test_df.iloc[sample_index]
            if class_id is not None and int(row.iloc[-1]) != class_id:
                raise HTTPException(
                    status_code=404,
                    detail=f"Test sample {sample_index} does not have class_id {class_id}.",
                )
            return SamplesResponse(samples=[_sample_from_row(sample_index, row)])

        if class_id is not None:
            matching = test_df.index[test_df.iloc[:, -1].astype(int) == class_id]
            if matching.empty:
                raise HTTPException(status_code=404, detail=f"No test sample found for class_id {class_id}.")
            index = int(matching[0])
            return SamplesResponse(samples=[_sample_from_row(index, test_df.iloc[index])])

        samples: list[ECGSample] = []
        for available_class_id in sorted(CLASS_NAMES):
            matching = test_df.index[test_df.iloc[:, -1].astype(int) == available_class_id]
            if not matching.empty:
                index = int(matching[0])
                samples.append(_sample_from_row(index, test_df.iloc[index]))
        return SamplesResponse(samples=samples)
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _build_prediction_response(explanation: dict[str, Any]) -> PredictionResponse:
    prediction = explanation["prediction"]
    probs = prediction["probabilities"]
    class_id = prediction["class_id"]
    class_name = CLASS_NAMES.get(class_id, str(class_id))
    class_full_name = {
        "N": "Normal heartbeat",
        "S": "Supraventricular ectopic heartbeat",
        "V": "Ventricular ectopic heartbeat",
        "F": "Fusion heartbeat",
        "Q": "Unknown/other heartbeat",
    }.get(class_name, class_name)
    return PredictionResponse(
        predicted_class_id=class_id,
        predicted_class=class_name,
        predicted_class_name=class_full_name,
        confidence=prediction["score"],
        probabilities={
            "N": probs.get("N", 0.0),
            "S": probs.get("S", 0.0),
            "V": probs.get("V", 0.0),
            "F": probs.get("F", 0.0),
            "Q": probs.get("Q", 0.0),
        },
    )


@app.post("/predict", response_model=PredictionResponse)
def predict_ecg(request: EcgRequest) -> PredictionResponse:
    try:
        explanation = explain_ecg(request.ecg, model_mode="balanced")
        return _build_prediction_response(explanation)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ECG inference failed: {exc}") from exc


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_ecg(request: EcgRequest) -> AnalyzeResponse:
    try:
        explanation = explain_ecg(request.ecg, model_mode="balanced")
        prediction_response = _build_prediction_response(explanation)
        return AnalyzeResponse(
            prediction=prediction_response,
            explanation={
                "top_pca_features": explanation["ranked_pca_features"][:3],
                "waveform_importance": explanation["original_position_importance"],
                "method": "PCA perturbation with loading-weighted back-projection",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ECG analysis failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest) -> TokenResponse:
    # Validate role
    if payload.role not in ("patient", "doctor"):
        raise HTTPException(status_code=400, detail="Role must be 'patient' or 'doctor'")

    # Validate password length
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Validate email format
    if "@" not in payload.email or "." not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    # Check duplicate email
    existing = get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Hash password
    pw_hash = hash_password(payload.password)

    # Create user + side table row
    user = create_user(
        email=payload.email,
        password_hash=pw_hash,
        first_name=payload.first_name,
        last_name=payload.last_name,
        display_name=payload.display_name,
        role=payload.role,
    )

    # Create access token
    access_token = create_access_token(user_id=str(user.id), role=user.role)

    return TokenResponse(
        access_token=access_token,
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(user_id=str(user.id), role=user.role)

    return TokenResponse(
        access_token=access_token,
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
    )


@app.get("/auth/me", response_model=MeResponse)
def me(authorization: str = Header(None)) -> MeResponse:
    """Require a valid Bearer access token via the Authorization header."""

    auth: str | None = Header(None)
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    access_token = auth.split(" ", 1)[1]
    try:
        payload = decode_token(access_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    if user_id is None or role is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return MeResponse(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
    )


# ---------------------------------------------------------------------------
# ECG file upload (Phase 1A): CSV/TXT -> deterministic 187-value segments
# PDF slice: PDF (page 1) -> OpenCV trace digitization -> one 187-value beat
# ---------------------------------------------------------------------------

UPLOAD_ALLOWED_EXTENSIONS = {".csv", ".txt", ".pdf"}
UPLOAD_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
UPLOAD_MAX_SAMPLES = 1_000_000
BEAT_LENGTH = 187

# PDF trace-digitization parameters (fixed values -> deterministic output).
PDF_RENDER_DPI = 150                  # page-1 render resolution
PDF_MIN_USABLE_COLUMNS = 187          # >= 1 trace column per output sample
PDF_MIN_TRACE_PIXELS = 187            # absolute floor of trace ink pixels
PDF_MIN_AMPLITUDE_PX = 5.0            # flatter than this = no plausible trace
PDF_DARK_LEVEL_MAX = 140              # trace ink is near-black; grid/paper is lighter


def _extract_waveform_from_pdf(raw: bytes) -> tuple[list[float], str]:
    """Digitize ONE ECG waveform from page 1 of a PDF into exactly 187 samples.

    Deterministic pipeline (no randomness, no OCR, no CNN):
      1. Render ONLY page 1 with PyMuPDF at PDF_RENDER_DPI.
      2. Decode to BGR -> grayscale (OpenCV).
      3. Trace-ink mask: the trace is drawn near-black while the ECG paper
         grid and background are much lighter, so the Otsu level is CAPPED at
         PDF_DARK_LEVEL_MAX and only dark trace ink is kept.
      4. Grid-line removal: only PAGE-SPANNING axis-aligned dark lines
         (printed grid / borders) are removed with morphological opening
         using horizontal / vertical kernels of half the page width / height.
         Trace features (steep QRS strokes, P/T waves) never span half a
         page, so they survive; shorter kernels would erase them.
      5. Per column, the trace position is the MEDIAN y of the remaining ink
         pixels; empty columns are gaps.
      6. Per-column positions are linearly resampled left-to-right to exactly
         BEAT_LENGTH values, the y axis is inverted (up on the page = positive
         amplitude), the signal is centered on its median (isoelectric-line
         estimate) and scaled to unit maximum absolute deviation in PIXEL
         units.

    Amplitude is NOT clinically calibrated: pixel positions are never
    converted to mm/mV. This is waveform digitization to feed the existing
    classifier, not a diagnostic-grade ECG measurement. Raises ValueError
    (-> HTTP 422) when no plausible waveform can be extracted; sample data is
    never substituted (no MIT-BIH fallback). Works best on a clean
    single-lead, dark-trace-on-light-grid strip; overlapping text or
    multi-lead layouts can degrade extraction and may be rejected.
    """
    try:
        document = fitz.open(stream=raw, filetype="pdf")
    except Exception as exc:
        raise ValueError("The file is not a readable PDF document.") from exc
    try:
        if document.page_count < 1:
            raise ValueError("The PDF contains no pages.")
        page = document.load_page(0)  # ONLY page 1 is used
        zoom = PDF_RENDER_DPI / 72.0
        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        png_bytes = pixmap.tobytes("png")
    finally:
        document.close()

    bgr = cv2.imdecode(np.frombuffer(png_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError(
            "The PDF page could not be rendered to an image for waveform extraction."
        )
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]
    if height < 50 or width < PDF_MIN_USABLE_COLUMNS:
        raise ValueError(
            f"The rendered PDF page is too small to contain an ECG waveform "
            f"({width}x{height} pixels)."
        )

    # 3. Trace-ink mask (see docstring step 3). cv2.threshold returns
    #    (retval, dst): retval is the Otsu level, dst is the binary mask.
    otsu_level, _ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    dark_level = min(float(otsu_level), PDF_DARK_LEVEL_MAX)
    ink_dark = np.where(gray < dark_level, 255, 0).astype(np.uint8)

    # 4. Grid removal: page-spanning axis-aligned lines only (see docstring
    #    step 4).
    horizontal_grid = cv2.morphologyEx(
        ink_dark,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, width // 2), 1)),
    )
    vertical_grid = cv2.morphologyEx(
        ink_dark,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, height // 2))),
    )
    trace_mask = cv2.subtract(cv2.subtract(ink_dark, horizontal_grid), vertical_grid)
    trace_mask = cv2.morphologyEx(trace_mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    if int(np.count_nonzero(trace_mask)) < PDF_MIN_TRACE_PIXELS:
        raise ValueError(
            "No plausible ECG waveform was found on page 1 of the PDF "
            "(too little trace ink after grid removal)."
        )

    # 5. Per-column median trace position (see docstring step 5).
    column_xs: list[float] = []
    column_ys: list[float] = []
    for x in range(width):
        ys = np.flatnonzero(trace_mask[:, x])
        if ys.size:
            column_xs.append(float(x))
            column_ys.append(float(np.median(ys)))
    if len(column_xs) < PDF_MIN_USABLE_COLUMNS:
        raise ValueError(
            f"Only {len(column_xs)} usable waveform columns were found on page 1; "
            f"at least {PDF_MIN_USABLE_COLUMNS} are required to digitize one "
            "heartbeat segment."
        )

    xs = np.asarray(column_xs)
    ys = np.asarray(column_ys)
    if float(ys.max() - ys.min()) < PDF_MIN_AMPLITUDE_PX:
        raise ValueError(
            "No plausible ECG waveform was found on page 1 of the PDF "
            "(the extracted trace is flat)."
        )

    # 6. Deterministic resample to exactly BEAT_LENGTH values (see docstring).
    horizontal_span = float(xs.max() - xs.min())
    if horizontal_span <= 0.0:
        raise ValueError(
            "No plausible ECG waveform was found on page 1 of the PDF "
            "(zero horizontal extent)."
        )
    resampled = np.interp(
        np.linspace(0.0, 1.0, BEAT_LENGTH), (xs - xs.min()) / horizontal_span, ys
    )

    signal = -resampled  # image y grows downward -> invert so up = positive
    signal = signal - float(np.median(signal))
    max_deviation = float(np.max(np.abs(signal)))
    if not math.isfinite(max_deviation) or max_deviation <= 0.0:
        raise ValueError(
            "No plausible ECG waveform was found on page 1 of the PDF "
            "(degenerate amplitude)."
        )
    signal = signal / max_deviation

    values = [float(value) for value in signal]
    if len(values) != BEAT_LENGTH or not all(math.isfinite(value) for value in values):
        raise ValueError(
            "Internal error: digitized PDF waveform is not 187 finite values."
        )

    normalization_note = (
        "PDF page 1 digitized with OpenCV: capped-Otsu dark-ink mask -> "
        "page-spanning grid-line removal -> per-column median trace "
        "position -> linear resample to 187 values. Normalization: "
        "median-centered (isoelectric estimate), unit max absolute deviation "
        "in PIXEL units — NOT clinically calibrated (no mm/mV conversion). "
        "Waveform digitization for the classifier only, not a diagnostic-"
        "grade ECG measurement. Not clinically derived beat detection."
    )
    return values, normalization_note


def _parse_numeric_samples(raw: bytes) -> tuple[list[float], str]:
    """Parse a 1-D numeric ECG signal from CSV/TXT bytes.

    Accepts comma- or whitespace-separated values (including single-column
    CSVs). Values must use '.' as the decimal separator. Raises ValueError
    with a user-facing message on empty, non-numeric, or non-finite input.
    Returns (samples, delimiter_description).
    """
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    samples: list[float] = []
    saw_comma = False

    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if "," in stripped:
            saw_comma = True
            tokens = stripped.split(",")
        else:
            tokens = stripped.split()
        for column, token in enumerate(tokens, start=1):
            value_text = token.strip()
            if not value_text:
                continue  # tolerate empty cells / trailing separators
            try:
                value = float(value_text)
            except ValueError:
                raise ValueError(
                    f"Non-numeric value {value_text!r} on line {line_number} "
                    f"(column {column}): ECG files must contain numeric samples "
                    "separated by commas or whitespace, using '.' as the decimal point."
                ) from None
            if not math.isfinite(value):
                raise ValueError(
                    f"Non-finite value {value_text!r} on line {line_number} "
                    f"(column {column}): NaN/Infinity samples are not accepted."
                )
            samples.append(value)

    if not samples:
        raise ValueError("The file contains no numeric ECG samples.")

    if len(samples) > UPLOAD_MAX_SAMPLES:
        raise ValueError(
            f"The file contains {len(samples)} samples; the maximum accepted is {UPLOAD_MAX_SAMPLES}."
        )

    return samples, ("comma" if saw_comma else "whitespace")


def _segment_into_beats(samples: list[float]) -> tuple[list[list[float]], int]:
    """Deterministically split the signal into contiguous 187-value windows.

    No physiological beat detection is attempted: when the sample count is not
    an exact multiple of 187, the trailing remainder is discarded (returned so
    it can be surfaced in the upload metadata).
    """
    beat_count = len(samples) // BEAT_LENGTH
    beats = [
        samples[offset : offset + BEAT_LENGTH]
        for offset in range(0, beat_count * BEAT_LENGTH, BEAT_LENGTH)
    ]
    discarded = len(samples) - beat_count * BEAT_LENGTH
    return beats, discarded


@app.post("/ecg/upload", response_model=EcgUploadResponse)
async def upload_ecg(file: UploadFile = File(...)) -> EcgUploadResponse:
    """Convert an uploaded CSV/TXT/PDF ECG recording into 187-value model inputs.

    CSV/TXT: returns every deterministic contiguous 187-point window of the
    uploaded 1-D signal. PDF: digitizes the page-1 ECG trace with OpenCV into
    exactly one 187-value waveform (beats: [[187 floats]]). There is
    deliberately NO fallback to the MIT-BIH dataset: if the file cannot be
    parsed or digitized, or holds too little data, the request fails with
    HTTP 422 and nothing else is returned.
    """
    filename = file.filename or "upload"
    extension = Path(filename).suffix.lower()
    if extension not in UPLOAD_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{extension or 'unknown'}'. Only .csv, "
                ".txt and .pdf ECG files are accepted."
            ),
        )

    raw = await file.read(UPLOAD_MAX_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(raw) > UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded file is too large; the limit is 5 MB.")

    if extension == ".pdf":
        # ---- PDF: OpenCV page-1 trace digitization -> one 187-value beat ----
        try:
            pdf_signal, pdf_note = _extract_waveform_from_pdf(raw)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="The PDF could not be processed for ECG waveform extraction.",
            ) from exc
        beats = [pdf_signal]
        sample_count = len(pdf_signal)
        segmentation_method = (
            f"OpenCV page-1 trace digitization (single waveform, left-to-right, "
            f"resampled to {BEAT_LENGTH} values)"
        )
        segmentation_note = pdf_note
        delimiter = "not applicable (PDF)"
    else:
        # ---- CSV/TXT: parse into beats (unchanged behavior) ----
        try:
            samples, delimiter = _parse_numeric_samples(raw)
            beats, discarded = _segment_into_beats(samples)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if not beats:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Only {len(samples)} numeric sample(s) were found; the QML model requires "
                    f"at least {BEAT_LENGTH} values to form one heartbeat segment."
                ),
            )

        sample_count = len(samples)
        remainder_note = (
            f" {discarded} trailing value(s) beyond the last full window were discarded."
            if discarded
            else " The sample count is an exact multiple of 187, so no values were discarded."
        )
        segmentation_method = f"contiguous fixed {BEAT_LENGTH}-value windows (left-to-right)"
        segmentation_note = (
            "Fixed-size windowing for model input only — not clinically derived beat "
            "detection and not claimed to align with physiological heartbeat boundaries."
            + remainder_note
        )

    # Defensive final check of the model contract (every beat: exactly 187
    # finite values). The parser already guarantees finite floats and the
    # slicing is fixed-size, but an upload must never return a beat that
    # POST /analyze would reject.
    for index, beat in enumerate(beats):
        if len(beat) != BEAT_LENGTH or not all(math.isfinite(value) for value in beat):
            raise HTTPException(
                status_code=422,
                detail=f"Internal error: generated segment {index} is not {BEAT_LENGTH} finite values.",
            )

    upload_id = f"upl-{uuid.uuid4().hex[:12]}"

    return EcgUploadResponse(
        upload_id=upload_id,
        filename=filename,
        sample_count=sample_count,
        beats=beats,
        metadata=EcgUploadMetadata(
            format=extension.lstrip("."),
            source="upload",
            original_sample_count=sample_count,
            generated_beat_count=len(beats),
            segmentation_method=segmentation_method,
            segmentation_note=segmentation_note,
            delimiter=delimiter,
        ),
    )
