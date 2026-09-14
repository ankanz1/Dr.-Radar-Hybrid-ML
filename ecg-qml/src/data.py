from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd

CLASS_NAMES = {0: "N", 1: "S", 2: "V", 3: "F", 4: "Q"}
CLASS_IDS = {name: idx for idx, name in CLASS_NAMES.items()}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"


def load_csv_dataset(path: str | Path) -> pd.DataFrame:
    data_path = Path(path)
    df = pd.read_csv(data_path, header=None)
    validate_dataset_shape(df)
    return df


def validate_dataset_shape(df: pd.DataFrame) -> None:
    if df.shape[1] != 188:
        raise ValueError(f"Expected 188 columns (187 features + 1 label), found {df.shape[1]} columns.")

    features = df.iloc[:, :-1]
    labels = df.iloc[:, -1]

    if features.shape[1] != 187:
        raise ValueError(f"Expected 187 ECG values, found {features.shape[1]}.")

    if not np.isfinite(features.to_numpy(dtype=float)).all():
        raise ValueError("Non-finite values detected in ECG feature columns.")

    if labels.isnull().any():
        raise ValueError("Label column contains NaN values.")


def get_train_validation_split(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    from sklearn.model_selection import train_test_split

    X = df.iloc[:, :-1].copy()
    y = df.iloc[:, -1].astype(int).copy()
    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )
    train_df = X_train.copy()
    train_df["label"] = y_train.to_numpy()
    val_df = X_val.copy()
    val_df["label"] = y_val.to_numpy()
    return train_df, val_df, y_train, y_val


def ensure_project_structure() -> None:
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    MODELS_DIR.mkdir(exist_ok=True, parents=True)
    OUTPUTS_DIR.mkdir(exist_ok=True, parents=True)
