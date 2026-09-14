from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

from .data import CLASS_NAMES, ensure_project_structure, get_train_validation_split, load_csv_dataset
from .quantum_model import HybridQuantumClassifier, N_CLASSES, N_QUBITS
from .train_qml import save_confusion_matrix_plot


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
        "per_class_precision": {str(label): float(value) for label, value in zip(labels, precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0))},
        "per_class_recall": {str(label): float(value) for label, value in zip(labels, recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0))},
        "per_class_f1": {str(label): float(value) for label, value in zip(labels, f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0))},
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }
    cm = confusion_matrix(y_true, y_pred, labels=labels).astype(float)
    row_sums = cm.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    metrics["row_normalized_confusion_matrix"] = (cm / row_sums).tolist()
    return metrics


def evaluate_qml(mode: str = "debug") -> dict[str, Any]:
    project_root = get_project_root()
    ensure_project_structure()

    if mode == "selected":
        model_filename = "ecg_hybrid_qml_selected.pt"
    elif mode == "balanced":
        model_filename = "ecg_hybrid_qml_balanced.pt"
    elif mode == "medium":
        model_filename = "ecg_hybrid_qml_medium.pt"
    else:
        model_filename = "ecg_hybrid_qml.pt"
    model_path = project_root / "models" / model_filename
    if not model_path.exists():
        raise FileNotFoundError(f"Trained {mode} hybrid quantum model not found. Run python -m src.train_qml --mode {mode} first.")

    preprocessing_filename = {"medium": "ecg_qml_medium_preprocessing.joblib", "balanced": "ecg_qml_balanced_preprocessing.joblib", "selected": "ecg_qml_selected_preprocessing.joblib"}.get(mode, "ecg_qml_preprocessing.joblib")
    preprocessing_path = project_root / "models" / preprocessing_filename
    preprocessor = joblib.load(preprocessing_path)
    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=4)
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    if mode == "debug":
        train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
        _, val_df, _, _ = get_train_validation_split(train_df_raw, test_size=0.2, random_state=42)
        val_df = val_df.head(500).reset_index(drop=True)
        X = val_df.drop(columns=["label"]).to_numpy(dtype=float)
        y = val_df["label"].to_numpy(dtype=int)
    elif mode in {"medium", "balanced", "selected", "full"}:
        test_df = load_csv_dataset(project_root / "data" / "mitbih_test.csv")
        X = test_df.iloc[:, :-1].to_numpy(dtype=float)
        y = test_df.iloc[:, -1].to_numpy(dtype=int)
    else:
        raise ValueError("Mode must be 'debug', 'medium', 'balanced', 'selected', or 'full'.")

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
    metrics_filename = {"medium": "qml_medium_test_metrics.json", "balanced": "qml_balanced_test_metrics.json", "selected": "qml_selected_test_metrics.json"}.get(mode, "qml_metrics.json")
    metrics_path = project_root / "outputs" / metrics_filename
    with open(metrics_path, "w", encoding="utf-8") as fp:
        json.dump({"mode": mode, "test_samples": int(len(y)), "metrics": metrics}, fp, indent=2)

    predictions_path = project_root / "outputs" / f"qml_{mode}_test_predictions.json"
    with open(predictions_path, "w", encoding="utf-8") as fp:
        json.dump({"mode": mode, "test_samples": int(len(y)), "true_labels": y.tolist(), "predicted_labels": preds.tolist()}, fp, indent=2)
    save_confusion_matrix_plot(
        y,
        preds,
        project_root / "outputs" / f"qml_{mode}_test_confusion_matrix.png",
        normalized=False,
    )
    save_confusion_matrix_plot(
        y,
        preds,
        project_root / "outputs" / f"qml_{mode}_test_confusion_matrix_normalized.png",
        normalized=True,
    )
    print(f"Evaluated test samples: {len(y)}")

    return {"mode": mode, "metrics": metrics}


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the hybrid quantum-classical ECG prototype.")
    parser.add_argument("--mode", choices=["debug", "medium", "balanced", "selected", "full"], default="debug")
    args = parser.parse_args()
    result = evaluate_qml(mode=args.mode)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
