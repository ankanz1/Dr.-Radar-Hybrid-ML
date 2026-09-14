from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from .data import CLASS_NAMES, ensure_project_structure, get_train_validation_split, load_csv_dataset
from .model import ECGMLP

RANDOM_SEED = 42
MAX_TRAIN_SAMPLES = 10000
EPOCHS = 20
BATCH_SIZE = 128
LEARNING_RATE = 1e-3


def set_seed(seed: int = RANDOM_SEED) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def majority_baseline_accuracy(y_true: np.ndarray) -> float:
    counts = pd.Series(y_true).value_counts()
    return float(counts.max() / len(y_true))


def compute_classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, labels: list[int]) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, labels=labels, average="weighted", zero_division=0)),
        "precision": float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
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
    return metrics


def save_model_artifacts(
    model: ECGMLP,
    scaler: StandardScaler,
    metadata: dict[str, Any],
    metrics: dict[str, Any],
    project_root: Path,
) -> None:
    model_dir = project_root / "models"
    model_dir.mkdir(exist_ok=True, parents=True)
    torch.save(model.state_dict(), model_dir / "ecg_mlp.pth")
    joblib.dump(scaler, model_dir / "ecg_scaler.joblib")
    with open(model_dir / "model_metadata.json", "w", encoding="utf-8") as fp:
        json.dump(metadata, fp, indent=2)
    with open(project_root / "outputs" / "results.json", "w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)


def train_model(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    max_train_samples: int | None = MAX_TRAIN_SAMPLES,
    epochs: int = EPOCHS,
    batch_size: int = BATCH_SIZE,
    learning_rate: float = LEARNING_RATE,
    random_seed: int = RANDOM_SEED,
    patience: int = 6,
) -> tuple[ECGMLP, StandardScaler, dict[str, Any], dict[str, Any]]:
    set_seed(random_seed)
    ensure_project_structure()

    X_train = train_df.drop(columns=["label"]).to_numpy(dtype=float)
    y_train = train_df["label"].to_numpy(dtype=int)
    X_val = val_df.drop(columns=["label"]).to_numpy(dtype=float)
    y_val = val_df["label"].to_numpy(dtype=int)

    if max_train_samples is not None:
        rng = np.random.default_rng(random_seed)
        sample_idx = rng.choice(len(X_train), size=min(max_train_samples, len(X_train)), replace=False)
        X_train = X_train[sample_idx]
        y_train = y_train[sample_idx]

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    train_dataset = TensorDataset(torch.tensor(X_train_scaled, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    val_dataset = TensorDataset(torch.tensor(X_val_scaled, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long))
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    model = ECGMLP(input_size=187, hidden1=64, hidden2=32, num_classes=5)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    best_val_f1 = -1.0
    best_state = None
    patience_counter = 0
    history: list[dict[str, float]] = []
    last_epoch = 0
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()

        model.eval()
        val_logits = []
        with torch.no_grad():
            for xb, yb in val_loader:
                val_logits.append(model(xb))

        val_predictions = torch.cat(val_logits, dim=0)
        val_pred_idx = torch.argmax(val_predictions, dim=1).cpu().numpy()
        metrics = compute_classification_metrics(y_val, val_pred_idx, labels=list(range(5)))
        history.append({"epoch": epoch, "loss": float(loss.item()), "val_macro_f1": metrics["macro_f1"]})
        last_epoch = epoch
        print(f"Epoch {epoch}/{epochs} | val_macro_f1={metrics['macro_f1']:.4f} | val_accuracy={metrics['accuracy']:.4f}")

        if metrics["macro_f1"] > best_val_f1:
            best_val_f1 = metrics["macro_f1"]
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping triggered at epoch {epoch}.")
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    training_time = time.time() - start_time
    metadata = {
        "model_name": "ecg_mlp_baseline",
        "input_size": 187,
        "num_classes": 5,
        "class_mapping": {str(k): v for k, v in CLASS_NAMES.items()},
        "training_seed": random_seed,
        "training_samples": int(len(X_train)),
        "validation_samples": int(len(X_val)),
        "epochs": last_epoch,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "training_time_seconds": round(training_time, 2),
        "history": history,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    val_pred_logits = model(torch.tensor(X_val_scaled, dtype=torch.float32))
    val_pred_idx = torch.argmax(val_pred_logits, dim=1).numpy()
    val_metrics = compute_classification_metrics(y_val, val_pred_idx, labels=list(range(5)))
    return model, scaler, metadata, val_metrics


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[1]
    raw_train = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    train_df, val_df, _, _ = get_train_validation_split(raw_train, test_size=0.2, random_state=RANDOM_SEED)
    model, scaler, metadata, val_metrics = train_model(train_df, val_df)
    save_model_artifacts(model, scaler, metadata, {"validation": val_metrics}, project_root)
    print(json.dumps({"validation_metrics": val_metrics}, indent=2))
