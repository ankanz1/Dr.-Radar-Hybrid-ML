from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch

from .data import CLASS_NAMES
from .quantum_model import HybridQuantumClassifier, N_CLASSES, N_QUBITS


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def predict_ecg(ecg_values: list[float] | np.ndarray) -> dict[str, Any]:
    values = np.asarray(ecg_values, dtype=float)
    if values.shape != (187,):
        raise ValueError(f"ECG input must contain exactly 187 numeric values, received shape {values.shape}.")
    if not np.isfinite(values).all():
        raise ValueError("ECG values must be finite numeric values.")

    project_root = get_project_root()
    preprocessing = joblib.load(project_root / "models" / "ecg_qml_preprocessing.joblib")
    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=4)
    model.load_state_dict(torch.load(project_root / "models" / "ecg_hybrid_qml.pt", map_location="cpu"))
    model.eval()

    standard_scaler = preprocessing["scaler"]
    pca = preprocessing["pca"]
    quantum_scaler = preprocessing["quantum_scaler"]

    pca_features = pca.transform(standard_scaler.transform(values.reshape(1, -1)))
    q_inputs = quantum_scaler.transform(pca_features)
    q_tensor = torch.tensor(q_inputs, dtype=torch.float32)

    with torch.no_grad():
        logits = model(q_tensor)
        probs = torch.softmax(logits, dim=1).numpy()[0]

    class_id = int(np.argmax(probs))
    class_name = CLASS_NAMES.get(class_id, str(class_id))
    confidence = float(probs[class_id])
    probability_dict = {CLASS_NAMES.get(i, str(i)): float(probs[i]) for i in range(N_CLASSES)}

    return {
        "prediction": {
            "class_id": class_id,
            "class_name": class_name,
            "confidence": confidence,
        },
        "probabilities": probability_dict,
    }
