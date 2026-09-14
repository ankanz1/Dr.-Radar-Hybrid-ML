from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.explain_qml import _load_frozen_qml_artifacts, explain_ecg
from src.data import CLASS_NAMES


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


app = FastAPI(title="ECG-QML Inference API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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