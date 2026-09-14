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
    get_xgboost_model,
)

RANDOM_SEED = 42
TARGET_TRAINING_COUNTS = {0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000}
PCA_DIMENSIONS = [8, 12, 16]


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def select_balanced_training_subset(
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


def run_pca_experiment(
    n_components: int,
    X_train_balanced: np.ndarray,
    y_train_balanced: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> dict[str, Any]:
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_balanced)
    X_test_scaled = scaler.transform(X_test)

    pca = PCA(n_components=n_components, random_state=RANDOM_SEED)
    X_train_pca = pca.fit_transform(X_train_scaled)
    X_test_pca = pca.transform(X_test_scaled)

    model = get_xgboost_model()
    model.fit(X_train_pca, y_train_balanced, verbose=False)

    y_pred = model.predict(X_test_pca).astype(int)
    metrics = compute_xgboost_metrics(y_test, y_pred, labels=LABELS)

    explained_variance_ratio = pca.explained_variance_ratio_.tolist()
    cumulative_explained_variance = np.cumsum(explained_variance_ratio).tolist()

    return {
        "pca_components": n_components,
        "pca_explained_variance_ratio": [float(v) for v in explained_variance_ratio],
        "pca_cumulative_explained_variance": [float(v) for v in cumulative_explained_variance],
        "cumulative_explained_variance": float(cumulative_explained_variance[-1]),
        "test_metrics": metrics,
    }


def print_comparison_table(results: list[dict[str, Any]]) -> None:
    print("\nPCA Ablation Results:")
    print("=" * 95)
    print(f"{'PCA components':>15} | {'Cum. Expl. Var.':>18} | {'Accuracy':>10} | {'Bal. Acc.':>10} | {'Macro F1':>10} | {'Weighted F1':>12}")
    print("-" * 95)
    for r in results:
        m = r["test_metrics"]
        print(f"{r['pca_components']:>15} | {r['cumulative_explained_variance']:>18.4f} | {m['accuracy']:>10.4f} | {m['balanced_accuracy']:>10.4f} | {m['macro_f1']:>10.4f} | {m['weighted_f1']:>12.4f}")
    print("=" * 95)


def main() -> None:
    ensure_project_structure()
    project_root = get_project_root()

    raw_df = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X_raw = raw_df.iloc[:, :-1].to_numpy(dtype=float)
    y = raw_df.iloc[:, -1].astype(int).to_numpy()

    X_train_balanced, y_train_balanced = select_balanced_training_subset(X_raw, y)

    test_df = pd.read_csv(project_root / "data" / "mitbih_test.csv", header=None)
    X_test = test_df.iloc[:, :-1].to_numpy(dtype=float)
    y_test = test_df.iloc[:, -1].to_numpy(dtype=int)

    all_results = []
    for n_components in PCA_DIMENSIONS:
        print(f"\nRunning PCA-{n_components} experiment...")
        result = run_pca_experiment(n_components, X_train_balanced, y_train_balanced, X_test, y_test)
        all_results.append(result)
        print(f"  Cumulative explained variance: {result['cumulative_explained_variance']:.4f}")
        print(f"  Test Macro-F1: {result['test_metrics']['macro_f1']:.4f}")

    print_comparison_table(all_results)

    output_path = project_root / "outputs" / "xgb_pca_ablation_metrics.json"
    output_path.parent.mkdir(exist_ok=True, parents=True)
    with open(output_path, "w", encoding="utf-8") as fp:
        json.dump({
            "experiment": "xgboost_pca_ablation",
            "random_seed": RANDOM_SEED,
            "original_feature_count": int(X_raw.shape[1]),
            "pca_dimensions_tested": PCA_DIMENSIONS,
            "training_samples_per_class": TARGET_TRAINING_COUNTS,
            "total_training_samples": int(len(y_train_balanced)),
            "test_samples": int(len(y_test)),
            "results": all_results,
        }, fp, indent=2)

    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()