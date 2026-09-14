from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data import CLASS_NAMES
from src.evaluate import full_evaluation, load_model_artifacts, plot_sample_prediction, save_confusion_matrix
from src.predict import predict_ecg


def run_sample_predictions() -> None:
    df = pd.read_csv(PROJECT_ROOT / "data" / "mitbih_test.csv", header=None)
    sample_idx = [0, 1, 2, 3, 4]
    model, scaler = load_model_artifacts(PROJECT_ROOT)

    for idx in sample_idx:
        row = df.iloc[idx].to_numpy(dtype=float)
        actual_label = int(row[-1])
        values = row[:-1]
        prediction = predict_ecg(values)
        print("========================================")
        print("ECG TEST SAMPLE")
        print("========================================")
        print(f"Actual class: {CLASS_NAMES[actual_label]}")
        print(f"Predicted class: {prediction['prediction']['class_name']}")
        print(f"Confidence: {prediction['prediction']['confidence'] * 100:.2f}%")
        print("Probabilities:")
        for class_name, prob in prediction["probabilities"].items():
            print(f"{class_name}: {prob * 100:.2f}%")
        print()
        plot_sample_prediction(values, actual_label, prediction, PROJECT_ROOT / "outputs" / f"sample_prediction_{idx}.png")

    print("Running full untouched test-set evaluation...")
    metrics = full_evaluation(PROJECT_ROOT)
    features = df.iloc[:, :-1].to_numpy(dtype=np.float32)
    with torch.no_grad():
        logits = model(torch.tensor(scaler.transform(features), dtype=torch.float32))
        preds = torch.argmax(logits, dim=1).numpy()
    save_confusion_matrix(df.iloc[:, -1].to_numpy(dtype=int), preds, list(range(5)), PROJECT_ROOT / "outputs" / "confusion_matrix.png")
    with open(PROJECT_ROOT / "outputs" / "results.json", "w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)


if __name__ == "__main__":
    run_sample_predictions()
