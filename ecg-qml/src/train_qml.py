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
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .data import CLASS_NAMES, ensure_project_structure, get_train_validation_split, load_csv_dataset
from .quantum_model import HybridQuantumClassifier, N_CLASSES, N_QUBITS, build_quantum_preprocessing, transform_to_quantum_features

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
    axes[0].set_title("Hybrid QML training history")
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
    ax.set_title("Hybrid QML confusion matrix" if not normalized else "Hybrid QML confusion matrix (row-normalized)")

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


def prepare_debug_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    project_root = get_project_root()
    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X, y = dataset_diagnostic(train_df_raw, "mitbih_train.csv")

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )

    train_idx = []
    val_idx = []
    for class_id in np.unique(y_train):
        class_indices = np.where(y_train == class_id)[0]
        train_idx.extend(class_indices[: min(400, len(class_indices))])
    for class_id in np.unique(y_val):
        class_indices = np.where(y_val == class_id)[0]
        val_idx.extend(class_indices[: min(100, len(class_indices))])

    X_train_debug = X_train[np.array(sorted(train_idx))]
    y_train_debug = y_train[np.array(sorted(train_idx))]
    X_val_debug = X_val[np.array(sorted(val_idx))]
    y_val_debug = y_val[np.array(sorted(val_idx))]

    return X_train_debug, X_val_debug, y_train_debug, y_val_debug


def prepare_full_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    project_root = get_project_root()
    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X, y = dataset_diagnostic(train_df_raw, "mitbih_train.csv")
    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    return X_train, X_val, y_train, y_val


def prepare_medium_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    project_root = get_project_root()
    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X, y = dataset_diagnostic(train_df_raw, "mitbih_train.csv")
    selected_indices, _ = train_test_split(
        np.arange(len(y)),
        train_size=min(10000, len(y)),
        random_state=RANDOM_SEED,
        stratify=y,
    )
    selected_indices = np.sort(selected_indices)
    X_selected = X[selected_indices]
    y_selected = y[selected_indices]
    X_train, X_val, y_train, y_val = train_test_split(
        X_selected,
        y_selected,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y_selected,
    )
    print(f"[medium] selected training samples: {len(y_selected)}")
    print(f"[medium] validation samples: {len(y_val)}")
    print(f"[medium] selected class distribution: {np.bincount(y_selected, minlength=N_CLASSES).tolist()}")
    return X_train, X_val, y_train, y_val, y_selected


def prepare_balanced_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    project_root = get_project_root()
    train_df_raw = load_csv_dataset(project_root / "data" / "mitbih_train.csv")
    X, y = dataset_diagnostic(train_df_raw, "mitbih_train.csv")

    print(f"[balanced] full dataset class distribution: {np.bincount(y, minlength=N_CLASSES).tolist()}")
    training_pool_indices, validation_pool_indices = train_test_split(
        np.arange(len(y)),
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    print(
        f"[balanced] pre-balancing training-pool class distribution: "
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
    print(f"[balanced] balanced training class distribution: {np.bincount(y_train, minlength=N_CLASSES).tolist()}")
    print(f"[balanced] validation class distribution: {np.bincount(y_val, minlength=N_CLASSES).tolist()}")
    if set(np.unique(y_val)) != set(range(N_CLASSES)):
        raise ValueError(f"Validation set must contain all five classes, found {np.unique(y_val).tolist()}.")
    print(f"[balanced] total selected samples: {len(selected_indices)}")
    print(f"[balanced] training samples: {len(y_train)}")
    print(f"[balanced] validation samples: {len(y_val)}")
    return X_train, X_val, y_train, y_val, y_train.copy(), y_val.copy()


def load_preprocessor() -> dict[str, Any]:
    project_root = get_project_root()
    pca_artifact = joblib.load(project_root / "models" / "ecg_scaler_pca.joblib")
    return pca_artifact


def build_quantum_dataset(df: pd.DataFrame, preprocessor: dict[str, Any], mode: str) -> tuple[np.ndarray, np.ndarray]:
    standard_scaler = preprocessor["scaler"]
    pca = preprocessor["pca"]
    raw_X = df.iloc[:, :-1].to_numpy(dtype=float)
    pca_features = pca.transform(standard_scaler.transform(raw_X))

    quantum_scaler = build_quantum_preprocessing(pca_features)["quantum_scaler"]
    quantum_features = quantum_scaler.transform(pca_features)

    if mode == "debug":
        quantum_features = quantum_features[: min(quantum_features.shape[0], 2000)]

    y = df.iloc[:, -1].astype(int).to_numpy()
    if mode == "debug":
        y = y[: min(len(y), 2000)]
    return quantum_features, y


def train_hybrid_qml(mode: str = "debug") -> dict[str, Any]:
    ensure_project_structure()
    project_root = get_project_root()
    preprocessor = load_preprocessor()

    if mode == "debug":
        X_train_raw, X_val_raw, y_train, y_val = prepare_debug_data()
        selected_y = None
        epochs = 5
    elif mode == "full":
        X_train_raw, X_val_raw, y_train, y_val = prepare_full_data()
        selected_y = None
        epochs = 5
    elif mode == "medium":
        X_train_raw, X_val_raw, y_train, y_val, selected_y = prepare_medium_data()
        epochs = 10
    elif mode in {"balanced", "selected"}:
        X_train_raw, X_val_raw, y_train, y_val, selected_y, validation_y = prepare_balanced_data()
        epochs = 10
        np.random.seed(RANDOM_SEED)
        torch.manual_seed(RANDOM_SEED)
    else:
        raise ValueError("Mode must be 'debug', 'medium', 'balanced', or 'full'.")

    standard_scaler = preprocessor["scaler"]
    pca = preprocessor["pca"]

    if mode == "medium":
        print(f"[medium] training samples: {len(y_train)}")
        print(f"[medium] validation samples: {len(y_val)}")
        print(f"[medium] training class distribution: {np.bincount(y_train, minlength=N_CLASSES).tolist()}")
        print(f"[medium] number of qubits: {N_QUBITS}")
        print("[medium] number of VQC layers: 4")
    elif mode in {"balanced", "selected"}:
        print(f"[{mode}] number of qubits: {N_QUBITS}")
        print(f"[{mode}] number of VQC layers: {DEFAULT_VQC_LAYERS}")
    else:
        print(f"[qml debug] final X shape: {X_train_raw.shape}")
        print(f"[qml debug] final y shape: {y_train.shape}")
        print(f"[qml debug] unique target classes: {np.unique(y_train).tolist()}")

    if X_train_raw.shape[1] != 187:
        raise ValueError(f"Expected 187 ECG values, found {X_train_raw.shape[1]}.")
    if len(np.unique(y_train)) != 5:
        raise ValueError(f"Expected 5 classes in training target, found {np.unique(y_train).tolist()}.")

    X_train_pca = pca.transform(standard_scaler.transform(X_train_raw))
    X_val_pca = pca.transform(standard_scaler.transform(X_val_raw))

    quantum_scaler = build_quantum_preprocessing(X_train_pca)["quantum_scaler"]
    X_train_q = quantum_scaler.transform(X_train_pca)
    X_val_q = quantum_scaler.transform(X_val_pca)

    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=DEFAULT_VQC_LAYERS, seed=RANDOM_SEED)
    if mode == "medium":
        print(f"[medium] trainable parameters: {model.count_parameters()}")
    criterion = torch.nn.CrossEntropyLoss() if mode in {"balanced", "selected"} else torch.nn.CrossEntropyLoss(
        weight=torch.tensor(compute_class_weights(y_train), dtype=torch.float32)
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    train_dataset = TensorDataset(torch.tensor(X_train_q, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    val_dataset = TensorDataset(torch.tensor(X_val_q, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long))
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

    quantum_grad_is_none = None
    quantum_grad_norm = None
    classical_grad_norm = None
    quantum_weight_change_norm = None
    if mode in {"balanced", "selected"}:
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
        print(f"[balanced] quantum_grad_is_none: {quantum_grad_is_none}")
        print(f"[balanced] quantum_grad_norm: {quantum_grad_norm:.8f}")
        print(f"[balanced] quantum_parameter_gradient_norm: {quantum_grad_norm:.8f}")
        print(f"[balanced] classical_head_gradient_norm: {classical_grad_norm:.8f}")
        assert not quantum_grad_is_none, "Quantum variational parameter gradient is None."
        assert quantum_grad_norm > 0.0, "Quantum variational parameter gradient norm must be positive."
        optimizer.step()
        quantum_weight_change_norm = float((model.variational_weights.detach() - quantum_weights_before).norm().item())
        print(f"[balanced] quantum_weight_change_norm: {quantum_weight_change_norm:.8f}")
        assert quantum_weight_change_norm > 0.0, "Quantum variational weights did not change after optimizer.step()."
        optimizer.zero_grad()

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
        if mode in {"medium", "balanced", "selected"} and val_metrics["macro_f1"] > best_macro_f1:
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

    if mode in {"medium", "balanced", "selected"} and best_state_dict is not None:
        model.load_state_dict(best_state_dict)
        print(f"[{mode}] best validation Macro-F1: {best_macro_f1:.4f} at epoch {best_epoch}")
        model.eval()
        with torch.no_grad():
            val_logits_tensor = torch.cat([model(batch_x) for batch_x, _ in val_loader], dim=0)
        val_pred = torch.argmax(val_logits_tensor, dim=1).cpu().numpy()
        metrics = compute_metrics(y_val, val_pred)
        if mode in {"balanced", "selected"}:
            print(f"[{mode}] validation per-class F1: {metrics['per_class_f1']}")
            medium_metrics_path = project_root / "outputs" / "qml_medium_metrics.json"
            if medium_metrics_path.exists():
                with open(medium_metrics_path, "r", encoding="utf-8") as fp:
                    medium_payload = json.load(fp)
                medium_macro_f1 = medium_payload.get("metrics", {}).get("macro_f1")
                if medium_macro_f1 is not None:
                    print(f"[balanced] medium validation Macro-F1: {float(medium_macro_f1):.4f}")
                    print(f"[balanced] Macro-F1 change versus medium: {best_macro_f1 - float(medium_macro_f1):+.4f}")

    if mode == "selected":
        model_filename = "ecg_hybrid_qml_selected.pt"
    elif mode == "balanced":
        model_filename = "ecg_hybrid_qml_balanced.pt"
    elif mode == "medium":
        model_filename = "ecg_hybrid_qml_medium.pt"
    else:
        model_filename = "ecg_hybrid_qml.pt"
    model_path = project_root / "models" / model_filename
    torch.save(model.state_dict(), model_path)

    preprocessing_payload = {
        "scaler": standard_scaler,
        "pca": pca,
        "quantum_scaler": quantum_scaler,
        "n_qubits": N_QUBITS,
        "n_classes": N_CLASSES,
        "class_names": CLASS_NAMES,
        "mode": mode,
    }
    preprocessing_filename = {"medium": "ecg_qml_medium_preprocessing.joblib", "balanced": "ecg_qml_balanced_preprocessing.joblib", "selected": "ecg_qml_selected_preprocessing.joblib"}.get(mode, "ecg_qml_preprocessing.joblib")
    preprocessing_path = project_root / "models" / preprocessing_filename
    joblib.dump(preprocessing_payload, preprocessing_path)

    output_prefix = {"medium": "qml_medium", "balanced": "qml_balanced", "selected": "qml_selected"}.get(mode, "qml")
    save_confusion_matrix_plot(val_y, val_pred, project_root / "outputs" / f"{output_prefix}_confusion_matrix.png", normalized=False)
    save_confusion_matrix_plot(val_y, val_pred, project_root / "outputs" / f"{output_prefix}_confusion_matrix_normalized.png", normalized=True)
    plot_training_history(history, project_root / "outputs" / f"{output_prefix}_training_history.png")

    metrics_filename = {"medium": "qml_medium_metrics.json", "balanced": "qml_balanced_metrics.json", "selected": "qml_selected_metrics.json"}.get(mode, "qml_metrics.json")
    save_metrics_json(project_root / "outputs" / metrics_filename, {
        "mode": mode,
        "n_qubits": N_QUBITS,
        "n_layers": DEFAULT_VQC_LAYERS,
        "train_samples": int(len(train_dataset)),
        "validation_samples": int(len(val_dataset)),
        "trainable_parameters": model.count_parameters(),
        "history": history,
        "metrics": metrics,
        "best_validation_macro_f1": best_macro_f1 if mode in {"medium", "balanced", "selected"} else None,
        "best_epoch": best_epoch if mode in {"medium", "balanced", "selected"} else None,
        "training_class_distribution": np.bincount(y_train, minlength=N_CLASSES).tolist(),
        "validation_class_distribution": np.bincount(y_val, minlength=N_CLASSES).tolist(),
        "validation_contains_all_classes": set(np.unique(y_val)) == set(range(N_CLASSES)),
        "quantum_grad_is_none": quantum_grad_is_none,
        "quantum_parameter_gradient_norm": quantum_grad_norm,
        "classical_head_gradient_norm": classical_grad_norm,
        "quantum_weight_change_norm": quantum_weight_change_norm,
    })
    if mode == "selected":
        save_metrics_json(project_root / "outputs" / "qml_selected_config.json", {
            "selected": True,
            "n_qubits": N_QUBITS,
            "n_layers": DEFAULT_VQC_LAYERS,
            "pca_components": 8,
            "random_seed": RANDOM_SEED,
            "optimizer": "Adam",
            "learning_rate": 1e-3,
            "batch_size": 32,
            "epochs": 10,
            "model_path": "models/ecg_hybrid_qml_selected.pt",
            "metrics_path": "outputs/qml_selected_metrics.json",
        })

    debug_summary = {
        "mode": mode,
        "quantum_forward_pass": True,
        "backpropagation": True,
        "n_qubits": N_QUBITS,
        "n_variational_layers": 4,
        "trainable_parameters": model.count_parameters(),
        "training_loss": history[-1]["train_loss"],
        "validation_loss": history[-1]["val_loss"],
        "validation_macro_f1": history[-1]["val_macro_f1"],
        "metrics": metrics,
    }
    return debug_summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the hybrid quantum-classical ECG prototype.")
    parser.add_argument("--mode", choices=["debug", "medium", "balanced", "selected", "full", "depth_scan"], default="debug")
    args = parser.parse_args()
    if args.mode == "depth_scan":
        from .qml_depth_scan import main as depth_scan_main

        depth_scan_main()
        return
    summary = train_hybrid_qml(mode=args.mode)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
