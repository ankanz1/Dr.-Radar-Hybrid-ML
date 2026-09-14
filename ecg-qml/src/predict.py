from __future__ import annotations

from typing import Any

import numpy as np
import torch

from .data import CLASS_NAMES, CLASS_IDS
from .model import ECGMLP

MODEL_PATH = "models/ecg_mlp.pth"
SCALER_PATH = "models/ecg_scaler.joblib"


def load_trained_model() -> tuple[ECGMLP, Any]:
    import joblib
    from pathlib import Path

    model = ECGMLP()
    model.load_state_dict(torch.load(Path(__file__).resolve().parents[1] / MODEL_PATH, map_location="cpu"))
    model.eval()
    scaler = joblib.load(Path(__file__).resolve().parents[1] / SCALER_PATH)
    return model, scaler


def predict_ecg(ecg_values: list[float] | np.ndarray) -> dict[str, Any]:
    values = np.asarray(ecg_values, dtype=float)
    if values.shape != (187,):
        raise ValueError(f"ECG input must contain exactly 187 numeric values, received shape {values.shape}.")
    if not np.isfinite(values).all():
        raise ValueError("ECG values must be finite numeric values.")

    model, scaler = load_trained_model()
    x = scaler.transform(values.reshape(1, -1))
    tensor = torch.tensor(x, dtype=torch.float32)
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    class_id = int(np.argmax(probs))
    class_name = CLASS_NAMES.get(class_id, str(class_id))
    confidence = float(probs[class_id])
    probability_dict = {name: float(probs[idx]) for idx, name in CLASS_NAMES.items()}

    return {
        "prediction": {
            "class_id": class_id,
            "class_name": class_name,
            "confidence": confidence,
        },
        "probabilities": probability_dict,
    }
