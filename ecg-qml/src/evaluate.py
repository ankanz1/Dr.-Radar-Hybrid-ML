from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import confusion_matrix

from .data import CLASS_NAMES
from .model import ECGMLP
from .train import compute_classification_metrics

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def load_model_artifacts(project_root: Path) -> tuple[ECGMLP, Any]:
    model_path = project_root / "models" / "ecg_mlp.pth"
    scaler_path = project_root / "models" / "ecg_scaler.joblib"
    if not model_path.exists() or not scaler_path.exists():
        raise FileNotFoundError("Trained model or scaler not found. Train the model first.")

    model = ECGMLP()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    scaler = joblib.load(scaler_path)
    return model, scaler


def evaluate_model(model: ECGMLP, X: np.ndarray, y: np.ndarray, scaler, labels: list[int]) -> dict[str, Any]:
    X_scaled = scaler.transform(X)
    inputs = torch.tensor(X_scaled, dtype=torch.float32)
    model.eval()
    with torch.no_grad():
        logits = model(inputs)
        preds = torch.argmax(logits, dim=1).numpy()

    metrics = compute_classification_metrics(y, preds, labels=labels)
    metrics["majority_baseline_accuracy"] = float(np.bincount(y).max() / len(y))
    return metrics


def save_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, labels: list[int], output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    cm = confusion_matrix(y_true, y_pred, labels=labels)

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels([CLASS_NAMES.get(i, str(i)) for i in labels])
    ax.set_yticklabels([CLASS_NAMES.get(i, str(i)) for i in labels])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title("ECG confusion matrix")
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center", color="black", fontsize=9)
    fig.colorbar(im, ax=ax)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def plot_sample_prediction(ecg_values: np.ndarray, actual_label: int, prediction: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(ecg_values, color="tab:blue", linewidth=2)
    ax.axhline(0, color="black", linewidth=1, linestyle="--", alpha=0.5)
    ax.set_title(f"ECG sample | Predicted: {prediction['prediction']['class_name']} | Confidence: {prediction['prediction']['confidence']:.2%}")
    ax.set_xlabel("Lead index")
    ax.set_ylabel("Amplitude")
    ax.text(0.02, 0.95, f"Actual: {CLASS_NAMES.get(actual_label, str(actual_label))}", transform=ax.transAxes, fontsize=11)
    ax.text(0.02, 0.87, f"Predicted: {prediction['prediction']['class_name']}", transform=ax.transAxes, fontsize=11)
    ax.text(0.02, 0.79, f"Confidence: {prediction['prediction']['confidence']:.2%}", transform=ax.transAxes, fontsize=11)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def full_evaluation(project_root: Path) -> dict[str, Any]:
    model, scaler = load_model_artifacts(project_root)
    df = pd.read_csv(project_root / "data" / "mitbih_test.csv", header=None)
    X = df.iloc[:, :-1].to_numpy(dtype=float)
    y = df.iloc[:, -1].to_numpy(dtype=int)
    metrics = evaluate_model(model, X, y, scaler, list(range(5)))
    save_confusion_matrix(y, np.argmax(model(torch.tensor(scaler.transform(X), dtype=torch.float32)).detach().numpy(), axis=1), list(range(5)), project_root / "outputs" / "confusion_matrix.png")
    return metrics


def save_metrics_json(path: Path, metrics: dict[str, Any]) -> None:
    path.parent.mkdir(exist_ok=True, parents=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)
