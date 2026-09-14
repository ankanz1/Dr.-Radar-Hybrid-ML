from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from .quantum_model import HybridQuantumClassifier, N_CLASSES, N_QUBITS, build_quantum_preprocessing
from .train_qml import (
    RANDOM_SEED,
    compute_metrics,
    get_project_root,
    load_preprocessor,
    prepare_balanced_data,
    plot_training_history,
    save_confusion_matrix_plot,
)

DEPTHS = (2, 4, 6, 8)
EPOCHS = 10
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
BASELINE_MACRO_F1 = 0.3575


def set_random_seed() -> None:
    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(exist_ok=True, parents=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)


def run_depth(
    n_layers: int,
    X_train_q: np.ndarray,
    X_val_q: np.ndarray,
    y_train: np.ndarray,
    y_val: np.ndarray,
    output_dir: Path,
) -> dict[str, Any]:
    set_random_seed()
    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=n_layers, seed=RANDOM_SEED)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    train_dataset = TensorDataset(torch.tensor(X_train_q, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    val_dataset = TensorDataset(torch.tensor(X_val_q, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long))
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    gradient_x, gradient_y = next(iter(train_loader))
    quantum_weights_before = model.variational_weights.detach().clone()
    optimizer.zero_grad()
    gradient_logits = model(gradient_x)
    gradient_loss = criterion(gradient_logits, gradient_y)
    gradient_loss.backward()
    quantum_gradient = model.variational_weights.grad
    classical_gradient = model.classifier.weight.grad
    quantum_grad_is_none = quantum_gradient is None
    quantum_grad_norm = float(quantum_gradient.norm().item()) if quantum_gradient is not None else 0.0
    classical_grad_norm = float(classical_gradient.norm().item()) if classical_gradient is not None else 0.0
    assert not quantum_grad_is_none, "Quantum variational parameter gradient is None."
    assert quantum_grad_norm > 0.0, "Quantum variational parameter gradient norm must be positive."
    optimizer.step()
    quantum_weight_change_norm = float((model.variational_weights.detach() - quantum_weights_before).norm().item())
    assert quantum_weight_change_norm > 0.0, "Quantum variational weights did not change after optimizer.step()."
    optimizer.zero_grad()

    print(f"[depth={n_layers}] parameters: {model.count_parameters()}")
    print(f"[depth={n_layers}] quantum_grad_norm: {quantum_grad_norm:.8f}")
    print(f"[depth={n_layers}] classical_head_gradient_norm: {classical_grad_norm:.8f}")
    print(f"[depth={n_layers}] quantum_weight_change_norm: {quantum_weight_change_norm:.8f}")

    history: list[dict[str, Any]] = []
    best_macro_f1 = -1.0
    best_epoch = 0
    best_state_dict: dict[str, torch.Tensor] | None = None
    best_metrics: dict[str, Any] | None = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        epoch_loss = 0.0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item()) * len(batch_x)

        model.eval()
        val_logits: list[torch.Tensor] = []
        with torch.no_grad():
            for batch_x, _ in val_loader:
                val_logits.append(model(batch_x))
        val_logits_tensor = torch.cat(val_logits, dim=0)
        val_pred = torch.argmax(val_logits_tensor, dim=1).cpu().numpy()
        val_metrics = compute_metrics(y_val, val_pred)
        val_loss = float(criterion(val_logits_tensor, torch.tensor(y_val, dtype=torch.long)).item())
        epoch_metrics = {
            "epoch": epoch,
            "train_loss": epoch_loss / len(train_dataset),
            "val_loss": val_loss,
            "val_macro_f1": val_metrics["macro_f1"],
            **val_metrics,
        }
        history.append(epoch_metrics)
        print(
            f"[depth={n_layers}] epoch {epoch}/{EPOCHS} | "
            f"train_loss={epoch_metrics['train_loss']:.4f} | val_loss={val_loss:.4f} | "
            f"macro_f1={val_metrics['macro_f1']:.4f}"
        )
        if val_metrics["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_metrics["macro_f1"]
            best_epoch = epoch
            best_metrics = val_metrics
            best_state_dict = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    assert best_state_dict is not None and best_metrics is not None
    model.load_state_dict(best_state_dict)
    model.eval()
    with torch.no_grad():
        best_logits = torch.cat([model(batch_x) for batch_x, _ in val_loader], dim=0)
    best_pred = torch.argmax(best_logits, dim=1).cpu().numpy()
    best_metrics = compute_metrics(y_val, best_pred)

    prefix = f"depth_{n_layers}_layers"
    torch.save(model.state_dict(), output_dir / f"{prefix}_model.pt")
    save_confusion_matrix_plot(y_val, best_pred, output_dir / f"{prefix}_confusion_matrix.png", normalized=False)
    save_confusion_matrix_plot(y_val, best_pred, output_dir / f"{prefix}_confusion_matrix_normalized.png", normalized=True)
    try:
        plot_training_history(history, output_dir / f"{prefix}_training_history.png")
    except Exception as exc:
        print(f"[depth={n_layers}] warning: could not save training history plot: {exc}")

    result = {
        "layers": n_layers,
        "qubits": N_QUBITS,
        "parameters": model.count_parameters(),
        "training_samples": int(len(y_train)),
        "validation_samples": int(len(y_val)),
        "training_class_distribution": np.bincount(y_train, minlength=N_CLASSES).tolist(),
        "validation_class_distribution": np.bincount(y_val, minlength=N_CLASSES).tolist(),
        "quantum_grad_is_none": quantum_grad_is_none,
        "quantum_gradient_norm": quantum_grad_norm,
        "classical_head_gradient_norm": classical_grad_norm,
        "quantum_weight_change_norm": quantum_weight_change_norm,
        "best_validation_macro_f1": best_macro_f1,
        "best_epoch": best_epoch,
        "history": history,
        "metrics": best_metrics,
    }
    save_json(output_dir / f"{prefix}_metrics.json", result)
    return result


def main() -> None:
    set_random_seed()
    project_root = get_project_root()
    output_dir = project_root / "outputs" / "qml_depth_scan"
    output_dir.mkdir(exist_ok=True, parents=True)

    X_train_raw, X_val_raw, y_train, y_val, _, _ = prepare_balanced_data()
    if set(np.unique(y_val)) != set(range(N_CLASSES)):
        raise ValueError(f"Validation set must contain all five classes, found {np.unique(y_val).tolist()}.")

    preprocessor = load_preprocessor()
    standard_scaler = preprocessor["scaler"]
    pca = preprocessor["pca"]
    X_train_pca = pca.transform(standard_scaler.transform(X_train_raw))
    X_val_pca = pca.transform(standard_scaler.transform(X_val_raw))
    quantum_scaler = build_quantum_preprocessing(X_train_pca)["quantum_scaler"]
    X_train_q = quantum_scaler.transform(X_train_pca)
    X_val_q = quantum_scaler.transform(X_val_pca)

    print(f"Depth scan training samples: {len(y_train)}")
    print(f"Depth scan validation samples: {len(y_val)}")
    print(f"Depth scan training class distribution: {np.bincount(y_train, minlength=N_CLASSES).tolist()}")
    print(f"Depth scan validation class distribution: {np.bincount(y_val, minlength=N_CLASSES).tolist()}")
    print(f"Depth scan PCA shape: {X_train_pca.shape}")

    results = []
    for n_layers in DEPTHS:
        results.append(run_depth(n_layers, X_train_q, X_val_q, y_train, y_val, output_dir))

    summary = {
        "baseline_4_layer_macro_f1": BASELINE_MACRO_F1,
        "results": [
            {
                "layers": result["layers"],
                "qubits": result["qubits"],
                "parameters": result["parameters"],
                "best_macro_f1": result["best_validation_macro_f1"],
                "balanced_accuracy": result["metrics"]["balanced_accuracy"],
                "accuracy": result["metrics"]["accuracy"],
            }
            for result in results
        ],
    }
    best_result = max(results, key=lambda result: result["best_validation_macro_f1"])
    summary["highest_validation_macro_f1"] = {
        "layers": best_result["layers"],
        "best_macro_f1": best_result["best_validation_macro_f1"],
        "change_vs_4_layer_baseline": best_result["best_validation_macro_f1"] - BASELINE_MACRO_F1,
    }
    save_json(output_dir / "depth_scan_summary.json", summary)

    print("layers | qubits | parameters | best_macro_f1 | balanced_accuracy | accuracy")
    for row in summary["results"]:
        print(
            f"{row['layers']} | {row['qubits']} | {row['parameters']} | "
            f"{row['best_macro_f1']:.4f} | {row['balanced_accuracy']:.4f} | {row['accuracy']:.4f}"
        )
    print(
        f"Highest validation Macro-F1: depth {best_result['layers']} layers "
        f"({best_result['best_validation_macro_f1']:.4f}), "
        f"versus 4-layer baseline {BASELINE_MACRO_F1:.4f} "
        f"({best_result['best_validation_macro_f1'] - BASELINE_MACRO_F1:+.4f})."
    )


if __name__ == "__main__":
    main()
