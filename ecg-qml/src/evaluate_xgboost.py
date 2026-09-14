from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .data import CLASS_NAMES, ensure_project_structure
from .train_xgboost import compute_xgboost_metrics, save_confusion_matrix_plot

LABELS = list(range(5))


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def evaluate_xgboost_on_test_set() -> dict[str, Any]:
    project_root = get_project_root()
    ensure_project_structure()

    model_path = project_root / "models" / "ecg_xgboost.json"
    if not model_path.exists():
        raise FileNotFoundError("XGBoost model not found. Train the model first with python -m src.train_xgboost.")

    from xgboost import XGBClassifier

    model = XGBClassifier()
    model.load_model(str(model_path))

    test_df = pd.read_csv(project_root / "data" / "mitbih_test.csv", header=None)
    X_test = test_df.iloc[:, :-1].to_numpy(dtype=float)
    y_test = test_df.iloc[:, -1].to_numpy(dtype=int)

    y_pred = model.predict(X_test)
    metrics = compute_xgboost_metrics(y_test, y_pred, labels=LABELS)

    metrics_path = project_root / "outputs" / "xgboost_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as fp:
        json.dump({"test_metrics": metrics}, fp, indent=2)

    save_confusion_matrix_plot(y_test, y_pred, LABELS, project_root / "outputs" / "xgboost_confusion_matrix.png", normalized=False)
    save_confusion_matrix_plot(y_test, y_pred, LABELS, project_root / "outputs" / "xgboost_confusion_matrix_normalized.png", normalized=True)

    return {"test_metrics": metrics}


def main() -> None:
    result = evaluate_xgboost_on_test_set()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
