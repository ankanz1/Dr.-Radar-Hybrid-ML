from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
import torch
from sklearn.decomposition import PCA
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .data import CLASS_NAMES, ensure_project_structure, load_csv_dataset
from .quantum_model_pca12 import HybridQuantumClassifierPCA12, N_CLASSES, N_QUBITS, build_quantum_preprocessing

RANDOM_SEED = 42
DEFAULT_VQC_LAYERS = 4


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def compute_class_weights(y: np.ndarray) -> np.ndarray:
    counts = np.bincount(y.astype(int), minlength=N_CLASSES)
    counts = np.where(counts == 0, 1, counts)
    weights = (counts.sum() / (N_CLASSES * counts)).astype(float)
    return weights


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    labels = list(range(N_CLASSES))
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_precision": float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "macro_f1": float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, labels=labels, average="weighted", zero_division=0)),
        "per_class_precision": {
            str(label): float(value)
            for label, value in zip(labels, precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "per_class_recall": {
            str(label): float(value)
            for label, value in zip(labels, recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "per_class_f1": {
            str(label): float(value)
            for label, value in zip(labels, f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0))
        },
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }
    cm = confusion_matrix(y_true, y_pred, labels=labels).astype(float)
    row_sums = cm.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    metrics["row_normalized_confusion_matrix"] = (cm / row_sums).tolist()
    return metrics


def plot_training_history(history: list[dict[str, float]], output_path: Path) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    epochs = [entry["epoch"] for entry in history]
    train_loss = [entry["train_loss"] for entry in history]
    val_loss = [entry["val_loss"] for entry in history]
    val_macro_f1 = [entry.get("val_macro_f1", entry["macro_f1"]) for entry in history]

    axes[0].plot(epochs, train_loss, label="train loss", color="tab:blue")
    axes[0].plot(epochs, val_loss, label="val loss", color="tab:orange")
    axes[0].set_title("Hybrid QML PCA-12 training history")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(True, linestyle="--", alpha=0.3)

    axes[1].plot(epochs, val_macro_f1, label="val macro F1", color="tab:green")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Macro F1")
    axes[1].legend()
    axes[1].grid(True, linestyle="--", alpha=0.3)

    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def save_confusion_matrix_plot(y_true: np.ndarray, y_pred: np.ndarray, output_path: Path, normalized: bool = False) -> None:
    output_path.parent.mkdir(exist_ok=True, parents=True)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(N_CLASSES))).astype(float)
    if normalized:
        row_sums = cm.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        cm = cm / row_sums

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(N_CLASSES))
    ax.set_yticks(range(N_CLASSES))
    ax.set_xticklabels([CLASS_NAMES.get(i, str(i)) for i in range(N_CLASSES)])
    ax.set_yticklabels([CLASS_NAMES.get(i, str(i)) for i in range(N_CLASSES)])
    ax.set_xlabel("Predicted class")
    ax.set_ylabel("Actual class")
    title = "Hybrid QML PCA-12 confusion matrix"
    if normalized:
        title += " (row-normalized)"
    ax.set_title(title)

    for row_index in range(cm.shape[0]):
        for col_index in range(cm.shape[1]):
            val = cm[row_index, col_index]
            ax.text(
                col_index,
                row_index,
                f"{val:.2f}" if normalized else f"{int(val)}",
                ha="center",
                va="center",
                color="black" if val <= 0.75 else "white",
                fontsize=8,
            )

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def save_metrics_json(path: Path, metrics: dict[str, Any]) -> None:
    path.parent.mkdir(exist_ok=True, parents=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)


def dataset_diagnostic(df: pd.DataFrame, dataset_name: str) -> tuple[np.ndarray, np.ndarray]:
    X = df.iloc[:, :-1].to_numpy(dtype=float)
    y = df.iloc[:, -1].astype(int).to_numpy()
    print(f"[{dataset_name}] dataframe shape: {df.shape}")
    print(f"[{dataset_name}] detected feature count: {X.shape[1]}")
    print(f"[{dataset_name}] target extraction: df.iloc[:, -1] (CSV loaded with header=None; last column is target)")
    print(f"[{dataset_name}] unique target classes: {np.unique(y).tolist()}")
    print(f"[{dataset_name}] final X shape: {X.shape}")
    print(f"[{dataset_name}] final y shape: {y.shape}")
    return X, y


def prepare_balanced_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    project_root = get_project_root()
    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X, y = dataset_diagnostic(train_df_raw, "mitbih_train.csv")

    print(f"[pca12_balanced] full dataset class distribution: {np.bincount(y, minlength=N_CLASSES).tolist()}")
    training_pool_indices, validation_pool_indices = train_test_split(
        np.arange(len(y)),
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    print(
        f"[pca12_balanced] pre-balancing training-pool class distribution: "
        f"{np.bincount(y[training_pool_indices], minlength=N_CLASSES).tolist()}"
    )

    requested_counts = {0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000}
    rng = np.random.RandomState(RANDOM_SEED)
    selected_indices = []
    for class_id, requested_count in requested_counts.items():
        class_indices = training_pool_indices[y[training_pool_indices] == class_id]
        selected_indices.extend(rng.choice(class_indices, size=requested_count, replace=len(class_indices) < requested_count).tolist())

    selected_indices = np.array(selected_indices, dtype=int)
    validation_indices, _ = train_test_split(
        validation_pool_indices,
        train_size=min(2000, len(validation_pool_indices)),
        random_state=RANDOM_SEED,
        stratify=y[validation_pool_indices],
    )
    validation_indices = np.sort(validation_indices)

    X_train = X[selected_indices]
    y_train = y[selected_indices]
    X_val = X[validation_indices]
    y_val = y[validation_indices]
    print(f"[pca12_balanced] balanced training class distribution: {np.bincount(y_train, minlength=N_CLASSES).tolist()}")
    print(f"[pca12_balanced] validation class distribution: {np.bincount(y_val, minlength=N_CLASSES).tolist()}")
    if set(np.unique(y_val)) != set(range(N_CLASSES)):
        raise ValueError(f"Validation set must contain all five classes, found {np.unique(y_val).tolist()}.")
    print(f"[pca12_balanced] total selected samples: {len(selected_indices)}")
    print(f"[pca12_balanced] training samples: {len(y_train)}")
    print(f"[pca12_balanced] validation samples: {len(y_val)}")
    return X_train, X_val, y_train, y_val


def main() -> None:
    ensure_project_structure()
    project_root = get_project_root()

    X_train_raw, X_val_raw, y_train, y_val = prepare_balanced_data()

    print(f"[pca12] number of qubits: {N_QUBITS}")
    print(f"[pca12] number of VQC layers: {DEFAULT_VQC_LAYERS}")

    if X_train_raw.shape[1] != 187:
        raise ValueError(f"Expected 187 ECG values, found {X_train_raw.shape[1]}.")
    if len(np.unique(y_train)) != 5:
        raise ValueError(f"Expected 5 classes in training target, found {np.unique(y_train).tolist()}.")

    standard_scaler = StandardScaler()
    X_train_scaled = standard_scaler.fit_transform(X_train_raw)
    X_val_scaled = standard_scaler.transform(X_val_raw)

    pca = PCA(n_components=N_QUBITS, random_state=RANDOM_SEED)
    X_train_pca = pca.fit_transform(X_train_scaled)
    X_val_pca = pca.transform(X_val_scaled)

    explained_variance = pca.explained_variance_ratio_
    cumulative_variance = np.cumsum(explained_variance)
    print(f"[pca12] PCA explained variance ratio: {[float(v) for v in explained_variance]}")
    print(f"[pca12] PCA cumulative explained variance: {[float(v) for v in cumulative_variance]}")
    print(f"[pca12] Cumulative explained variance (12 components): {cumulative_variance[-1]:.4f}")

    quantum_scaler = build_quantum_preprocessing(X_train_pca)["quantum_scaler"]
    X_train_q = quantum_scaler.transform(X_train_pca)
    X_val_q = quantum_scaler.transform(X_val_pca)

    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)

    model = HybridQuantumClassifierPCA12(n_qubits=N_QUBITS, n_layers=DEFAULT_VQC_LAYERS, seed=RANDOM_SEED)
    print(f"[pca12] trainable parameters: {model.count_parameters()}")

    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    train_dataset = TensorDataset(torch.tensor(X_train_q, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    val_dataset = TensorDataset(torch.tensor(X_val_q, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long))
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

    quantum_grad_is_none = None
    quantum_grad_norm = None
    classical_grad_norm = None
    quantum_weight_change_norm = None

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
    print(f"[pca12] quantum_grad_is_none: {quantum_grad_is_none}")
    print(f"[pca12] quantum_grad_norm: {quantum_grad_norm:.8f}")
    print(f"[pca12] quantum_parameter_gradient_norm: {quantum_grad_norm:.8f}")
    print(f"[pca12] classical_head_gradient_norm: {classical_grad_norm:.8f}")
    assert not quantum_grad_is_none, "Quantum variational parameter gradient is None."
    assert quantum_grad_norm > 0.0, "Quantum variational parameter gradient norm must be positive."
    optimizer.step()
    quantum_weight_change_norm = float((model.variational_weights.detach() - quantum_weights_before).norm().item())
    print(f"[pca12] quantum_weight_change_norm: {quantum_weight_change_norm:.8f}")
    assert quantum_weight_change_norm > 0.0, "Quantum variational weights did not change after optimizer.step()."
    optimizer.zero_grad()

    epochs = 10
    history: list[dict[str, Any]] = []
    best_macro_f1 = -1.0
    best_epoch = 0
    best_state_dict = None

    for epoch in range(1, epochs + 1):
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
        val_logits = []
        val_targets = []
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                val_logits.append(model(batch_x))
                val_targets.append(batch_y)

        val_logits_tensor = torch.cat(val_logits, dim=0)
        val_pred = torch.argmax(val_logits_tensor, dim=1).cpu().numpy()
        val_y = torch.cat(val_targets, dim=0).cpu().numpy()
        val_metrics = compute_metrics(val_y, val_pred)

        epoch_train_loss = epoch_loss / len(train_dataset)
        epoch_val_loss = float(criterion(val_logits_tensor, torch.tensor(val_y, dtype=torch.long)).item())
        epoch_metrics = {
            "epoch": epoch,
            "train_loss": epoch_train_loss,
            "val_loss": epoch_val_loss,
            "val_macro_f1": val_metrics["macro_f1"],
            **{key: value for key, value in val_metrics.items() if key != "confusion_matrix" and key != "row_normalized_confusion_matrix"},
        }
        history.append(epoch_metrics)
        print(
            f"Epoch {epoch}/{epochs} | train_loss={epoch_train_loss:.4f} | val_loss={epoch_val_loss:.4f} | "
            f"accuracy={val_metrics['accuracy']:.4f} | balanced_accuracy={val_metrics['balanced_accuracy']:.4f} | "
            f"macro_precision={val_metrics['macro_precision']:.4f} | macro_recall={val_metrics['macro_recall']:.4f} | "
            f"macro_f1={val_metrics['macro_f1']:.4f} | weighted_f1={val_metrics['weighted_f1']:.4f}"
        )
        if val_metrics["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_metrics["macro_f1"]
            best_epoch = epoch
            best_state_dict = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    model.eval()
    val_logits = []
    val_targets = []
    with torch.no_grad():
        for batch_x, batch_y in val_loader:
            val_logits.append(model(batch_x))
            val_targets.append(batch_y)

    val_logits_tensor = torch.cat(val_logits, dim=0)
    val_pred = torch.argmax(val_logits_tensor, dim=1).cpu().numpy()
    val_y = torch.cat(val_targets, dim=0).cpu().numpy()
    metrics = compute_metrics(val_y, val_pred)

    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)
        print(f"[pca12] best validation Macro-F1: {best_macro_f1:.4f} at epoch {best_epoch}")
        model.eval()
        with torch.no_grad():
            val_logits_tensor = torch.cat([model(batch_x) for batch_x, _ in val_loader], dim=0)
        val_pred = torch.argmax(val_logits_tensor, dim=1).cpu().numpy()
        metrics = compute_metrics(y_val, val_pred)
        print(f"[pca12] validation per-class F1: {metrics['per_class_f1']}")

    model_path = project_root / "models" / "ecg_hybrid_qml_pca12.pt"
    torch.save(model.state_dict(), model_path)

    preprocessing_payload = {
        "scaler": standard_scaler,
        "pca": pca,
        "quantum_scaler": quantum_scaler,
        "n_qubits": N_QUBITS,
        "n_classes": N_CLASSES,
        "class_names": CLASS_NAMES,
        "mode": "pca12_balanced",
    }
    preprocessing_path = project_root / "models" / "ecg_qml_pca12_preprocessing.joblib"
    joblib.dump(preprocessing_payload, preprocessing_path)

    save_confusion_matrix_plot(y_val, val_pred, project_root / "outputs" / "qml_pca12_confusion_matrix.png", normalized=False)
    save_confusion_matrix_plot(y_val, val_pred, project_root / "outputs" / "qml_pca12_confusion_matrix_normalized.png", normalized=True)
    plot_training_history(history, project_root / "outputs" / "qml_pca12_training_history.png")

    save_metrics_json(project_root / "outputs" / "qml_pca12_metrics.json", {
        "mode": "pca12_balanced",
        "n_qubits": N_QUBITS,
        "n_layers": DEFAULT_VQC_LAYERS,
        "pca_components": N_QUBITS,
        "pca_explained_variance_ratio": [float(v) for v in explained_variance],
        "pca_cumulative_explained_variance": [float(v) for v in cumulative_variance],
        "pca_cumulative_explained_variance_final": float(cumulative_variance[-1]),
        "train_samples": int(len(train_dataset)),
        "validation_samples": int(len(val_dataset)),
        "trainable_parameters": model.count_parameters(),
        "history": history,
        "metrics": metrics,
        "best_validation_macro_f1": best_macro_f1,
        "best_epoch": best_epoch,
        "training_class_distribution": np.bincount(y_train, minlength=N_CLASSES).tolist(),
        "validation_class_distribution": np.bincount(y_val, minlength=N_CLASSES).tolist(),
        "validation_contains_all_classes": set(np.unique(y_val)) == set(range(N_CLASSES)),
        "quantum_grad_is_none": quantum_grad_is_none,
        "quantum_parameter_gradient_norm": quantum_grad_norm,
        "classical_head_gradient_norm": classical_grad_norm,
        "quantum_weight_change_norm": quantum_weight_change_norm,
    })

    print(f"[pca12] Model saved to {model_path}")
    print(f"[pca12] Preprocessing saved to {preprocessing_path}")


if __name__ == "__main__":
    main()