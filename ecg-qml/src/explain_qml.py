from __future__ import annotations

import argparse
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
import torch

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .data import CLASS_NAMES, load_csv_dataset
from .pca_features import COMPRESSED_FEATURE_COUNT, ORIGINAL_FEATURE_COUNT, transform_ecg_to_pca
from .quantum_model import HybridQuantumClassifier, N_CLASSES, N_QUBITS, transform_to_quantum_features


DEFAULT_MODEL_MODE = "balanced"
MODEL_FILENAMES = {
    "debug": "ecg_hybrid_qml.pt",
    "medium": "ecg_hybrid_qml_medium.pt",
    "balanced": "ecg_hybrid_qml_balanced.pt",
    "selected": "ecg_hybrid_qml_selected.pt",
}
PREPROCESSING_FILENAMES = {
    "debug": "ecg_qml_preprocessing.joblib",
    "medium": "ecg_qml_medium_preprocessing.joblib",
    "balanced": "ecg_qml_balanced_preprocessing.joblib",
    "selected": "ecg_qml_selected_preprocessing.joblib",
}


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


@lru_cache(maxsize=4)
def _load_frozen_qml_artifacts(model_mode: str) -> tuple[HybridQuantumClassifier, dict[str, Any]]:
    if model_mode not in MODEL_FILENAMES:
        raise ValueError(f"Unknown model mode {model_mode!r}; choose from {sorted(MODEL_FILENAMES)}.")

    project_root = get_project_root()
    model_path = project_root / "models" / MODEL_FILENAMES[model_mode]
    preprocessing_path = project_root / "models" / PREPROCESSING_FILENAMES[model_mode]
    if not model_path.exists():
        raise FileNotFoundError(f"Frozen QML model not found: {model_path}")
    if not preprocessing_path.exists():
        raise FileNotFoundError(f"Frozen QML preprocessing not found: {preprocessing_path}")

    preprocessing = joblib.load(preprocessing_path)
    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=4)
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    return model, preprocessing


def _predict_from_pca(model: HybridQuantumClassifier, preprocessing: dict[str, Any], pca_features: np.ndarray) -> np.ndarray:
    quantum_features = preprocessing["quantum_scaler"].transform(np.asarray(pca_features, dtype=float))
    quantum_tensor = torch.tensor(quantum_features, dtype=torch.float32)
    with torch.inference_mode():
        probabilities = model.predict_proba(quantum_tensor).cpu().numpy()
    return probabilities


def _build_original_position_importance(pca_importance: np.ndarray, pca_components: np.ndarray) -> np.ndarray:
    importance = np.abs(np.asarray(pca_components, dtype=float)).T @ np.asarray(pca_importance, dtype=float)
    maximum = float(np.max(importance))
    if maximum > 0.0:
        return importance / maximum
    return np.zeros(ORIGINAL_FEATURE_COUNT, dtype=float)


def save_explanation_plot(explanation: dict[str, Any], output_path: str | Path) -> None:
    waveform = np.asarray(explanation["waveform"], dtype=float)
    position_importance = np.asarray(explanation["original_position_importance"], dtype=float)
    output_path = Path(output_path)
    output_path.parent.mkdir(exist_ok=True, parents=True)

    figure, waveform_axis = plt.subplots(figsize=(13, 5.5))
    positions = np.arange(ORIGINAL_FEATURE_COUNT)
    waveform_axis.plot(positions, waveform, color="black", linewidth=1.1, label="ECG waveform")
    waveform_axis.set_xlabel("Original ECG position")
    waveform_axis.set_ylabel("ECG value")
    waveform_axis.set_title(
        f"Model interpretability: predicted class {explanation['prediction']['class_id']} "
        f"({explanation['prediction']['class_name']})"
    )

    importance_axis = waveform_axis.twinx()
    importance_axis.fill_between(
        positions,
        0.0,
        position_importance,
        color="tab:red",
        alpha=0.28,
        label="PCA-loading-weighted importance",
    )
    importance_axis.plot(positions, position_importance, color="tab:red", linewidth=1.0)
    importance_axis.set_ylabel("Relative model importance")
    importance_axis.set_ylim(0.0, 1.05)

    handles, labels = waveform_axis.get_legend_handles_labels()
    other_handles, other_labels = importance_axis.get_legend_handles_labels()
    waveform_axis.legend(handles + other_handles, labels + other_labels, loc="upper right")
    figure.text(
        0.01,
        0.01,
        "Model interpretability only; highlighted regions are not medically causal or diagnostic.",
        fontsize=9,
    )
    figure.tight_layout(rect=(0, 0.04, 1, 1))
    figure.savefig(output_path, dpi=150)
    plt.close(figure)


def explain_ecg(
    ecg_values: list[float] | np.ndarray,
    model_mode: str = DEFAULT_MODEL_MODE,
    perturbation_value: float = 0.0,
) -> dict[str, Any]:
    """Explain one frozen QML prediction with PCA-feature permutation importance.

    The perturbation replaces one fitted PCA coordinate at a time with zero, the
    PCA-centered reference value, and measures the selected-class probability drop.
    """
    values = np.asarray(ecg_values, dtype=float)
    if values.shape != (ORIGINAL_FEATURE_COUNT,):
        raise ValueError(f"ECG input must contain exactly {ORIGINAL_FEATURE_COUNT} numeric values, received shape {values.shape}.")
    if not np.isfinite(values).all():
        raise ValueError("ECG values must be finite numeric values.")

    model, preprocessing = _load_frozen_qml_artifacts(model_mode)
    pca_features = transform_ecg_to_pca(values)
    pca = preprocessing["pca"]
    if pca_features.shape != (COMPRESSED_FEATURE_COUNT,):
        raise ValueError(f"Expected {COMPRESSED_FEATURE_COUNT} PCA features, got {pca_features.shape}.")

    baseline_probabilities = _predict_from_pca(model, preprocessing, pca_features.reshape(1, -1))[0]
    predicted_class = int(np.argmax(baseline_probabilities))
    baseline_score = float(baseline_probabilities[predicted_class])
    perturbation_scores: list[float] = []
    score_changes: list[float] = []
    for feature_index in range(COMPRESSED_FEATURE_COUNT):
        perturbed = pca_features.copy()
        perturbed[feature_index] = perturbation_value
        perturbed_probabilities = _predict_from_pca(model, preprocessing, perturbed.reshape(1, -1))[0]
        perturbed_score = float(perturbed_probabilities[predicted_class])
        perturbation_scores.append(perturbed_score)
        score_changes.append(baseline_score - perturbed_score)

    pca_importance = np.abs(np.asarray(score_changes, dtype=float))
    ranking = np.argsort(-pca_importance, kind="stable")
    ranked_features = [
        {
            "pca_feature": int(feature_index),
            "rank": rank + 1,
            "importance": float(pca_importance[feature_index]),
            "score_change": float(score_changes[feature_index]),
            "baseline_score": baseline_score,
            "perturbed_score": float(perturbation_scores[feature_index]),
            "pca_value": float(pca_features[feature_index]),
            "perturbation_value": float(perturbation_value),
        }
        for rank, feature_index in enumerate(ranking)
    ]
    original_position_importance = _build_original_position_importance(pca_importance, pca.components_)

    return {
        "interpretability_notice": (
            "This is model interpretability, not clinical diagnosis. "
            "Highlighted ECG positions are not medically causal."
        ),
        "model": {
            "mode": model_mode,
            "model_file": MODEL_FILENAMES[model_mode],
            "preprocessing_file": PREPROCESSING_FILENAMES[model_mode],
            "n_qubits": N_QUBITS,
            "n_layers": 4,
            "n_classes": N_CLASSES,
        },
        "prediction": {
            "class_id": predicted_class,
            "class_name": CLASS_NAMES.get(predicted_class, str(predicted_class)),
            "score": baseline_score,
            "probabilities": {
                CLASS_NAMES.get(class_id, str(class_id)): float(probability)
                for class_id, probability in enumerate(baseline_probabilities)
            },
        },
        "permutation_method": {
            "space": "8 PCA features before quantum scaling",
            "reference": "PCA zero-centered coordinate",
            "importance": "absolute change in predicted-class probability",
        },
        "waveform": values.tolist(),
        "pca_features": pca_features.tolist(),
        "ranked_pca_features": ranked_features,
        "original_position_importance": original_position_importance.tolist(),
    }


def explain_test_sample(
    sample_index: int,
    model_mode: str = DEFAULT_MODEL_MODE,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    project_root = get_project_root()
    test_df = load_csv_dataset(project_root / "data" / "mitbih_test.csv")
    if sample_index < 0 or sample_index >= len(test_df):
        raise IndexError(f"Test sample index must be between 0 and {len(test_df) - 1}.")

    row = test_df.iloc[sample_index]
    explanation = explain_ecg(row.iloc[:-1].to_numpy(dtype=float), model_mode=model_mode)
    explanation["sample_index"] = int(sample_index)
    explanation["actual_class"] = int(row.iloc[-1])
    output_path = Path(output_dir) if output_dir is not None else project_root / "outputs"
    output_path.mkdir(exist_ok=True, parents=True)
    json_path = output_path / f"qml_explanation_sample_{sample_index}.json"
    plot_path = output_path / f"qml_explanation_sample_{sample_index}.png"
    with json_path.open("w", encoding="utf-8") as file:
        json.dump(explanation, file, indent=2)
    save_explanation_plot(explanation, plot_path)
    explanation["output_data"] = str(json_path)
    explanation["output_plot"] = str(plot_path)
    return explanation


def main() -> None:
    parser = argparse.ArgumentParser(description="Explain frozen QML predictions for ECG test samples.")
    parser.add_argument("--indices", nargs="+", type=int, default=[0, 1, 2])
    parser.add_argument("--mode", choices=sorted(MODEL_FILENAMES), default=DEFAULT_MODEL_MODE)
    args = parser.parse_args()

    results = []
    for sample_index in args.indices:
        explanation = explain_test_sample(sample_index, model_mode=args.mode)
        top_three = [item["pca_feature"] for item in explanation["ranked_pca_features"][:3]]
        results.append(
            {
                "sample_index": sample_index,
                "predicted_class": explanation["prediction"]["class_id"],
                "top_3_pca_features": top_three,
                "plot_generated": Path(explanation["output_plot"]).exists(),
                "plot": explanation["output_plot"],
                "data": explanation["output_data"],
            }
        )
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()