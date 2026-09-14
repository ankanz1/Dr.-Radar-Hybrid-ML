from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import explained_variance_score
from sklearn.preprocessing import StandardScaler

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .data import CLASS_NAMES, ensure_project_structure, get_train_validation_split, load_csv_dataset

RANDOM_SEED = 42
ORIGINAL_FEATURE_COUNT = 187
COMPRESSED_FEATURE_COUNT = 8


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def fit_pca_preprocessor(train_df: pd.DataFrame) -> tuple[StandardScaler, PCA, np.ndarray, np.ndarray, np.ndarray]:
    X_train = train_df.drop(columns=["label"]).to_numpy(dtype=float)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    pca = PCA(n_components=COMPRESSED_FEATURE_COUNT, random_state=RANDOM_SEED)
    X_train_pca = pca.fit_transform(X_train_scaled)

    return scaler, pca, X_train_scaled, X_train_pca, pca.explained_variance_ratio_


def transform_split_data(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    scaler: StandardScaler,
    pca: PCA,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    X_train = train_df.drop(columns=["label"]).to_numpy(dtype=float)
    X_val = val_df.drop(columns=["label"]).to_numpy(dtype=float)
    X_test = test_df.iloc[:, :-1].to_numpy(dtype=float)

    X_train_scaled = scaler.transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    X_train_pca = pca.transform(X_train_scaled)
    X_val_pca = pca.transform(X_val_scaled)
    X_test_pca = pca.transform(X_test_scaled)
    return X_train_pca, X_val_pca, X_test_pca


def save_preprocessor(scaler: StandardScaler, pca: PCA, output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    joblib.dump({"scaler": scaler, "pca": pca}, output_path)


def save_variance_report(variance: np.ndarray, cumulative: np.ndarray, output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    payload = {
        "original_feature_count": ORIGINAL_FEATURE_COUNT,
        "compressed_feature_count": COMPRESSED_FEATURE_COUNT,
        "explained_variance_ratio": [float(v) for v in variance],
        "cumulative_explained_variance": [float(v) for v in cumulative],
    }
    with open(output_path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)


def save_variance_plot(variance: np.ndarray, cumulative: np.ndarray, output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    axes[0].bar(range(1, len(variance) + 1), variance, color="steelblue")
    axes[0].set_title("PCA Explained Variance Ratio (8 components)")
    axes[0].set_xlabel("Principal component")
    axes[0].set_ylabel("Explained variance ratio")
    axes[0].grid(axis="y", linestyle="--", alpha=0.3)

    axes[1].plot(range(1, len(cumulative) + 1), cumulative, color="darkorange", marker="o")
    axes[1].set_title("Cumulative Explained Variance")
    axes[1].set_xlabel("Principal component")
    axes[1].set_ylabel("Cumulative explained variance")
    axes[1].grid(True, linestyle="--", alpha=0.3)

    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def transform_ecg_to_pca(ecg_values: list[float] | np.ndarray) -> np.ndarray:
    values = np.asarray(ecg_values, dtype=float)
    if values.shape != (ORIGINAL_FEATURE_COUNT,):
        raise ValueError(f"ECG input must contain exactly {ORIGINAL_FEATURE_COUNT} numeric values, received shape {values.shape}.")
    if not np.isfinite(values).all():
        raise ValueError("ECG values must be finite numeric values.")

    artifact_path = get_project_root() / "models" / "ecg_scaler_pca.joblib"
    if not artifact_path.exists():
        raise FileNotFoundError("PCA preprocessing pipeline not found. Train the PCA stage first with python -m src.pca_features.")

    pipeline = joblib.load(artifact_path)
    scaler = pipeline["scaler"]
    pca = pipeline["pca"]

    scaled = scaler.transform(values.reshape(1, -1))
    transformed = pca.transform(scaled)
    transformed = np.asarray(transformed, dtype=float).reshape(-1)

    if transformed.shape != (COMPRESSED_FEATURE_COUNT,):
        raise ValueError(f"Expected output shape {(COMPRESSED_FEATURE_COUNT,)}, got {transformed.shape}.")
    if np.isnan(transformed).any():
        raise ValueError("PCA transformation produced NaN values.")
    return transformed


def main() -> None:
    project_root = get_project_root()
    ensure_project_structure()

    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    train_df, val_df, _, _ = get_train_validation_split(train_df_raw, test_size=0.2, random_state=RANDOM_SEED)
    test_df = load_csv_dataset(project_root / "data" / "mitbih_test.csv")

    scaler, pca, _, _, variance = fit_pca_preprocessor(train_df)
    X_train_pca, X_val_pca, X_test_pca = transform_split_data(train_df, val_df, test_df, scaler, pca)
    cumulative = np.cumsum(variance)

    pipeline_path = project_root / "models" / "ecg_scaler_pca.joblib"
    save_preprocessor(scaler, pca, pipeline_path)

    variance_path = project_root / "outputs" / "pca_variance.json"
    save_variance_report(variance, cumulative, variance_path)

    plot_path = project_root / "outputs" / "pca_variance_plot.png"
    save_variance_plot(variance, cumulative, plot_path)

    print(json.dumps({
        "original_feature_count": ORIGINAL_FEATURE_COUNT,
        "compressed_feature_count": COMPRESSED_FEATURE_COUNT,
        "explained_variance_ratio": [float(v) for v in variance],
        "cumulative_explained_variance": [float(v) for v in cumulative],
        "train_shape": list(X_train_pca.shape),
        "val_shape": list(X_val_pca.shape),
        "test_shape": list(X_test_pca.shape),
    }, indent=2))


if __name__ == "__main__":
    main()
