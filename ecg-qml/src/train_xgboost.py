from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from xgboost import XGBClassifier

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .data import CLASS_NAMES, ensure_project_structure, get_train_validation_split, load_csv_dataset

RANDOM_SEED = 42
LABELS = list(range(5))


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def get_xgboost_model() -> XGBClassifier:
    return XGBClassifier(
        objective="multi:softprob",
        num_class=5,
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="mlogloss",
        random_state=RANDOM_SEED,
        n_jobs=-1,
        tree_method="hist",
        verbosity=0,
    )


def compute_class_weights(y: np.ndarray) -> np.ndarray:
    counts = np.bincount(y.astype(int), minlength=5)
    counts = np.where(counts == 0, 1, counts)
    class_weights = (counts.sum() / (len(counts) * counts)).astype(float)
    return class_weights


def compute_xgboost_metrics(y_true: np.ndarray, y_pred: np.ndarray, labels: list[int] | None = None) -> dict[str, Any]:
    label_list = labels if labels is not None else LABELS
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_precision": float(precision_score(y_true, y_pred, labels=label_list, average="macro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, y_pred, labels=label_list, average="macro", zero_division=0)),
        "macro_f1": float(f1_score(y_true, y_pred, labels=label_list, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, labels=label_list, average="weighted", zero_division=0)),
        "per_class_precision": {
            str(label): float(value)
            for label, value in zip(
                label_list,
                precision_score(y_true, y_pred, labels=label_list, average=None, zero_division=0),
            )
        },
        "per_class_recall": {
            str(label): float(value)
            for label, value in zip(
                label_list,
                recall_score(y_true, y_pred, labels=label_list, average=None, zero_division=0),
            )
        },
        "per_class_f1": {
            str(label): float(value)
            for label, value in zip(
                label_list,
                f1_score(y_true, y_pred, labels=label_list, average=None, zero_division=0),
            )
        },
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=label_list).tolist(),
    }
    cm = confusion_matrix(y_true, y_pred, labels=label_list).astype(float)
    row_sums = cm.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    metrics["row_normalized_confusion_matrix"] = (cm / row_sums).tolist()
    return metrics


def save_confusion_matrix_plot(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    labels: list[int],
    output_path: Path,
    normalized: bool = False,
) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    cm = confusion_matrix(y_true, y_pred, labels=labels).astype(float)
    if normalized:
        row_sums = cm.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        cm = cm / row_sums
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels([CLASS_NAMES.get(idx, str(idx)) for idx in labels])
    ax.set_yticklabels([CLASS_NAMES.get(idx, str(idx)) for idx in labels])
    ax.set_xlabel("Predicted class")
    ax.set_ylabel("Actual class")
    title = "XGBoost confusion matrix" if not normalized else "XGBoost confusion matrix (row-normalized)"
    ax.set_title(title)

    for row_index in range(cm.shape[0]):
        for col_index in range(cm.shape[1]):
            value = cm[row_index, col_index]
            ax.text(
                col_index,
                row_index,
                f"{value:.2f}" if normalized else f"{int(value)}",
                ha="center",
                va="center",
                color="black" if value <= 0.75 else "white",
                fontsize=8,
            )

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def save_metrics_json(path: Path, metrics: dict[str, Any]) -> None:
    path.parent.mkdir(exist_ok=True, parents=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)


def predict_ecg_xgboost(ecg_values: list[float] | np.ndarray) -> dict[str, Any]:
    values = np.asarray(ecg_values, dtype=float)
    if values.shape != (187,):
        raise ValueError(f"ECG input must contain exactly 187 numeric values. Received shape {values.shape}.")
    if not np.isfinite(values).all():
        raise ValueError("ECG values must be finite numeric values.")

    model_path = get_project_root() / "models" / "ecg_xgboost.json"
    if not model_path.exists():
        raise FileNotFoundError("XGBoost model not found. Train the model first with python -m src.train_xgboost.")

    model = XGBClassifier()
    model.load_model(str(model_path))
    probabilities = model.predict_proba(values.reshape(1, -1))[0]
    class_id = int(np.argmax(probabilities))
    class_name = CLASS_NAMES.get(class_id, str(class_id))
    confidence = float(probabilities[class_id])
    probability_dict = {CLASS_NAMES.get(i, str(i)): float(probabilities[i]) for i in range(len(CLASS_NAMES))}

    return {
        "prediction": {
            "class_id": class_id,
            "class_name": class_name,
            "confidence": confidence,
        },
        "probabilities": probability_dict,
    }


def predict_ecg(ecg_values: list[float] | np.ndarray) -> dict[str, Any]:
    return predict_ecg_xgboost(ecg_values)


def train_xgboost_model(train_df: pd.DataFrame, val_df: pd.DataFrame) -> tuple[XGBClassifier, dict[str, Any]]:
    X_train = train_df.drop(columns=["label"]).to_numpy(dtype=float)
    y_train = train_df["label"].to_numpy(dtype=int)
    X_val = val_df.drop(columns=["label"]).to_numpy(dtype=float)
    y_val = val_df["label"].to_numpy(dtype=int)

    class_weights = compute_class_weights(y_train)
    sample_weights = np.array([class_weights[label] for label in y_train], dtype=float)

    model = get_xgboost_model()
    model.fit(X_train, y_train, sample_weight=sample_weights, eval_set=[(X_val, y_val)], verbose=False)

    val_pred = model.predict(X_val)
    metrics = compute_xgboost_metrics(y_val, val_pred, labels=LABELS)
    return model, metrics


def main() -> None:
    project_root = get_project_root()
    ensure_project_structure()

    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    train_df, val_df, _, _ = get_train_validation_split(train_df_raw, test_size=0.2, random_state=RANDOM_SEED)
    model, validation_metrics = train_xgboost_model(train_df, val_df)

    model_path = project_root / "models" / "ecg_xgboost.json"
    model.save_model(str(model_path))

    metrics_path = project_root / "outputs" / "xgboost_metrics.json"
    save_metrics_json(metrics_path, {"validation_metrics": validation_metrics})

    raw_cm_path = project_root / "outputs" / "xgboost_confusion_matrix.png"
    norm_cm_path = project_root / "outputs" / "xgboost_confusion_matrix_normalized.png"
    val_pred = model.predict(val_df.drop(columns=["label"]).to_numpy(dtype=float))
    val_true = val_df["label"].to_numpy(dtype=int)
    save_confusion_matrix_plot(val_true, val_pred, LABELS, raw_cm_path, normalized=False)
    save_confusion_matrix_plot(val_true, val_pred, LABELS, norm_cm_path, normalized=True)

    print(json.dumps({"validation_metrics": validation_metrics}, indent=2))


if __name__ == "__main__":
    main()
