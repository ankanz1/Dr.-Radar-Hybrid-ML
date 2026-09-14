from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

from .data import CLASS_NAMES, ensure_project_structure, load_csv_dataset
from .quantum_model_pca12 import HybridQuantumClassifierPCA12, N_CLASSES, N_QUBITS
from .train_qml_pca12 import save_confusion_matrix_plot

MODEL_FILENAME = "ecg_hybrid_qml_pca12.pt"
PREPROCESSING_FILENAME = "ecg_qml_pca12_preprocessing.joblib"


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    labels = list(range(N_CLASSES))
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_precision": float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "macro_f1": float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, labels=labels, average="weighted", zero_division=0)),
        "per_class_precision": {
            str(label): float(value)
            for label, value in zip(labels, precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "per_class_recall": {
            str(label): float(value)
            for label, value in zip(labels, recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "per_class_f1": {
            str(label): float(value)
            for label, value in zip(labels, f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }
    cm = confusion_matrix(y_true, y_pred, labels=labels).astype(float)
    row_sums = cm.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    metrics["row_normalized_confusion_matrix"] = (cm / row_sums).tolist()
    return metrics


def evaluate_qml_pca12() -> dict[str, Any]:
    project_root = get_project_root()
    ensure_project_structure()

    model_path = project_root / "models" / MODEL_FILENAME
    if not model_path.exists():
        raise FileNotFoundError(f"Trained PCA-12 QML model not found. Run python -m src.train_qml_pca12 first.")

    preprocessing_path = project_root / "models" / PREPROCESSING_FILENAME
    preprocessor = joblib.load(preprocessing_path)
    model = HybridQuantumClassifierPCA12(n_qubits=N_QUBITS, n_layers=4)
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    test_df = load_csv_dataset(project_root / "data" / "mitbih_test.csv")
    X = test_df.iloc[:, :-1].to_numpy(dtype=float)
    y = test_df.iloc[:, -1].to_numpy(dtype=int)

    standard_scaler = preprocessor["scaler"]
    pca = preprocessor["pca"]
    quantum_scaler = preprocessor["quantum_scaler"]

    pca_features = pca.transform(standard_scaler.transform(X))
    q_inputs = quantum_scaler.transform(pca_features)
    q_tensor = torch.tensor(q_inputs, dtype=torch.float32)

    with torch.no_grad():
        logits = model(q_tensor)
        preds = torch.argmax(logits, dim=1).numpy()

    metrics = compute_metrics(y, preds)

    metrics_path = project_root / "outputs" / "qml_pca12_test_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as fp:
        json.dump({"mode": "pca12_balanced", "test_samples": int(len(y)), "metrics": metrics}, fp, indent=2)

    predictions_path = project_root / "outputs" / "qml_pca12_test_predictions.json"
    with open(predictions_path, "w", encoding="utf-8") as fp:
        json.dump({"mode": "pca12_balanced", "test_samples": int(len(y)), "true_labels": y.tolist(), "predicted_labels": preds.tolist()}, fp, indent=2)

    save_confusion_matrix_plot(
        y,
        preds,
        project_root / "outputs" / "qml_pca12_test_confusion_matrix.png",
        normalized=False,
    )
    save_confusion_matrix_plot(
        y,
        preds,
        project_root / "outputs" / "qml_pca12_test_confusion_matrix_normalized.png",
        normalized=True,
    )
    print(f"Evaluated test samples: {len(y)}")

    return {"mode": "pca12_balanced", "metrics": metrics}


def main() -> None:
    result = evaluate_qml_pca12()
    metrics = result["metrics"]
    print(f"Test sample count: {len(y) if 'y' in locals() else 'N/A'}")
    print(f"Test accuracy: {metrics['accuracy']:.4f}")
    print(f"Test balanced accuracy: {metrics['balanced_accuracy']:.4f}")
    print(f"Test macro precision: {metrics['macro_precision']:.4f}")
    print(f"Test macro recall: {metrics['macro_recall']:.4f}")
    print(f"Test macro F1: {metrics['macro_f1']:.4f}")
    print(f"Test weighted F1: {metrics['weighted_f1']:.4f}")
    print(f"Test per-class precision: {metrics['per_class_precision']}")
    print(f"Test per-class recall: {metrics['per_class_recall']}")
    print(f"Test per-class F1: {metrics['per_class_f1']}")
    print(f"Test confusion matrix: {metrics['confusion_matrix']}")
    print()
    print("Comparison:")
    print("Baseline PCA-8 QML test Macro-F1: 0.3518")
    print(f"PCA-12 QML test Macro-F1: {metrics['macro_f1']:.4f}")
    print("PCA-12 XGBoost test Macro-F1: 0.6312")


if __name__ == "__main__":
    main()