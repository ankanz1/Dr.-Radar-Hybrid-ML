from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from .data import CLASS_NAMES, ensure_project_structure, load_csv_dataset
from .train_xgboost import (
    LABELS,
    compute_xgboost_metrics,
    save_confusion_matrix_plot,
)

RANDOM_SEED = 42
TARGET_TRAINING_COUNTS = {0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000}
N_COMPONENTS = 8


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def select_balanced_training_pool(
    X: np.ndarray,
    y: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    training_pool_indices, _ = train_test_split(
        np.arange(len(y)),
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )

    rng = np.random.RandomState(RANDOM_SEED)
    balanced_indices: list[int] = []
    for class_id, target_count in TARGET_TRAINING_COUNTS.items():
        class_indices = training_pool_indices[y[training_pool_indices] == class_id]
        balanced_indices.extend(
            rng.choice(
                class_indices,
                size=target_count,
                replace=len(class_indices) < target_count,
            ).tolist()
        )

    return X[np.asarray(balanced_indices)], y[np.asarray(balanced_indices)]


def main() -> None:
    ensure_project_structure()
    project_root = get_project_root()

    model_path = project_root / "models" / "ecg_xgb_pca8.json"
    if not model_path.exists():
        raise FileNotFoundError("PCA-8 XGBoost model not found. Train the model first with python -m src.train_xgb_pca.")

    raw_df = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X_raw = raw_df.iloc[:, :-1].to_numpy(dtype=float)
    y = raw_df.iloc[:, -1].astype(int).to_numpy()

    X_train_balanced, y_train_balanced = select_balanced_training_pool(X_raw, y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_balanced)
    pca = PCA(n_components=N_COMPONENTS, random_state=RANDOM_SEED)
    pca.fit(X_train_scaled)

    test_df = pd.read_csv(project_root / "data" / "mitbih_test.csv", header=None)
    X_test = test_df.iloc[:, :-1].to_numpy(dtype=float)
    y_test = test_df.iloc[:, -1].to_numpy(dtype=int)

    X_test_scaled = scaler.transform(X_test)
    X_test_pca = pca.transform(X_test_scaled)

    model = XGBClassifier()
    model.load_model(str(model_path))

    y_pred = model.predict(X_test_pca).astype(int)
    metrics = compute_xgboost_metrics(y_test, y_pred, labels=LABELS)

    metrics_path = project_root / "outputs" / "xgb_pca8_test_metrics.json"
    metrics_path.parent.mkdir(exist_ok=True, parents=True)
    with open(metrics_path, "w", encoding="utf-8") as fp:
        json.dump({"test_metrics": metrics}, fp, indent=2)

    save_confusion_matrix_plot(
        y_test,
        y_pred,
        LABELS,
        project_root / "outputs" / "xgb_pca8_test_confusion_matrix.png",
        normalized=False,
    )
    save_confusion_matrix_plot(
        y_test,
        y_pred,
        LABELS,
        project_root / "outputs" / "xgb_pca8_test_confusion_matrix_normalized.png",
        normalized=True,
    )

    print(f"Test sample count: {len(y_test)}")
    print(json.dumps(metrics, indent=2))

    print("\nComparison:")
    print("Full XGBoost test Macro-F1: 0.8586")
    print(f"PCA-8 XGBoost test Macro-F1: {metrics['macro_f1']:.4f}")
    print("PCA-8 QML test Macro-F1: 0.3518")


if __name__ == "__main__":
    main()