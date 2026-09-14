from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .data import ensure_project_structure, get_train_validation_split, load_csv_dataset
from .pca_features import COMPRESSED_FEATURE_COUNT, ORIGINAL_FEATURE_COUNT, transform_ecg_to_pca


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def evaluate_pca_transforms() -> dict:
    project_root = get_project_root()
    ensure_project_structure()

    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    train_df, val_df, _, _ = get_train_validation_split(train_df_raw, test_size=0.2, random_state=42)
    test_df = load_csv_dataset(project_root / "data" / "mitbih_test.csv")

    X_train = train_df.drop(columns=["label"]).to_numpy(dtype=float)
    X_val = val_df.drop(columns=["label"]).to_numpy(dtype=float)
    X_test = test_df.iloc[:, :-1].to_numpy(dtype=float)

    sample = X_test[0]
    transformed = transform_ecg_to_pca(sample)

    checks = {
        "input_shape": list(sample.shape),
        "output_shape": list(transformed.shape),
        "output_shape_is_8": transformed.shape == (COMPRESSED_FEATURE_COUNT,),
        "no_nan": bool(np.isfinite(transformed).all()),
        "deterministic": bool(np.allclose(transformed, transform_ecg_to_pca(sample))),
    }

    reports = {
        "train_shape": [int(X_train.shape[0]), int(X_train.shape[1])],
        "validation_shape": [int(X_val.shape[0]), int(X_val.shape[1])],
        "test_shape": [int(X_test.shape[0]), int(X_test.shape[1])],
        "original_feature_count": ORIGINAL_FEATURE_COUNT,
        "compressed_feature_count": COMPRESSED_FEATURE_COUNT,
        "transform_checks": checks,
    }

    metrics_path = project_root / "outputs" / "pca_validation.json"
    with open(metrics_path, "w", encoding="utf-8") as fp:
        json.dump(reports, fp, indent=2)

    return reports


def main() -> None:
    result = evaluate_pca_transforms()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
