from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib
import numpy as np
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

matplotlib.use("Agg")

from .data import CLASS_NAMES, ensure_project_structure, load_csv_dataset
from .train_xgboost import (
    LABELS,
    compute_xgboost_metrics,
    get_xgboost_model,
    save_confusion_matrix_plot,
)

RANDOM_SEED = 42
TARGET_TRAINING_COUNTS = {0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000}
N_COMPONENTS = 8


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def select_balanced_training_and_validation(
    X: np.ndarray,
    y: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    training_pool_indices, validation_pool_indices = train_test_split(
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

    validation_indices, _ = train_test_split(
        validation_pool_indices,
        train_size=min(2000, len(validation_pool_indices)),
        random_state=RANDOM_SEED,
        stratify=y[validation_pool_indices],
    )

    y_validation = y[validation_indices]
    if set(np.unique(y_validation)) != set(LABELS):
        raise ValueError(f"Validation set must contain all five classes, found {np.unique(y_validation).tolist()}.")

    return X[np.asarray(balanced_indices)], X[validation_indices], y[np.asarray(balanced_indices)], y_validation


def save_metrics(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(exist_ok=True, parents=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)


def main() -> None:
    ensure_project_structure()
    project_root = get_project_root()
    raw_df = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X_raw = raw_df.iloc[:, :-1].to_numpy(dtype=float)
    y = raw_df.iloc[:, -1].astype(int).to_numpy()

    X_train_raw, X_val_raw, y_train, y_val = select_balanced_training_and_validation(X_raw, y)
    full_train_pool_indices, _ = train_test_split(
        np.arange(len(y)),
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )

    print(f"Training class distribution: {np.bincount(y_train, minlength=len(LABELS)).tolist()}")
    print(f"Validation class distribution: {np.bincount(y_val, minlength=len(LABELS)).tolist()}")
    print(f"Validation contains all five classes: {set(np.unique(y_val)) == set(LABELS)}")
    print(f"Pre-balancing training-pool class distribution: {np.bincount(y[full_train_pool_indices], minlength=len(LABELS)).tolist()}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_val_scaled = scaler.transform(X_val_raw)
    pca = PCA(n_components=N_COMPONENTS, random_state=RANDOM_SEED)
    X_train_pca = pca.fit_transform(X_train_scaled)
    X_val_pca = pca.transform(X_val_scaled)

    model = get_xgboost_model()
    model.fit(X_train_pca, y_train, eval_set=[(X_val_pca, y_val)], verbose=False)
    val_pred = model.predict(X_val_pca).astype(int)
    validation_metrics = compute_xgboost_metrics(y_val, val_pred, labels=LABELS)

    print(f"PCA explained variance ratio: {[float(value) for value in pca.explained_variance_ratio_]}")
    print(f"PCA cumulative explained variance: {[float(value) for value in np.cumsum(pca.explained_variance_ratio_)]}")
    print(json.dumps(validation_metrics, indent=2))

    model.save_model(str(project_root / "models" / "ecg_xgb_pca8.json"))
    save_metrics(
        project_root / "outputs" / "xgb_pca8_metrics.json",
        {
            "experiment": "xgboost_pca8_balanced_training",
            "random_seed": RANDOM_SEED,
            "original_feature_count": int(X_raw.shape[1]),
            "pca_components": N_COMPONENTS,
            "pca_explained_variance_ratio": [float(value) for value in pca.explained_variance_ratio_],
            "pca_cumulative_explained_variance": [float(value) for value in np.cumsum(pca.explained_variance_ratio_)],
            "training_samples": int(len(y_train)),
            "validation_samples": int(len(y_val)),
            "training_class_distribution": np.bincount(y_train, minlength=len(LABELS)).tolist(),
            "validation_class_distribution": np.bincount(y_val, minlength=len(LABELS)).tolist(),
            "validation_contains_all_classes": set(np.unique(y_val)) == set(LABELS),
            "validation_metrics": validation_metrics,
        },
    )
    save_confusion_matrix_plot(
        y_val,
        val_pred,
        LABELS,
        project_root / "outputs" / "xgb_pca8_confusion_matrix.png",
        normalized=False,
    )
    save_confusion_matrix_plot(
        y_val,
        val_pred,
        LABELS,
        project_root / "outputs" / "xgb_pca8_confusion_matrix_normalized.png",
        normalized=True,
    )

    print("Direct validation comparison:")
    print("Full-feature XGBoost Macro-F1: 0.8586")
    print(f"PCA-8 XGBoost Macro-F1: {validation_metrics['macro_f1']:.4f}")
    print("PCA-8 QML Macro-F1: 0.3575")


if __name__ == "__main__":
    main()
