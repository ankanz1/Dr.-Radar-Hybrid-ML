from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pennylane as qml
import torch
from torch import nn

from .data import CLASS_NAMES

N_QUBITS = 8
N_CLASSES = 5


class QuantumAngleEncoder(nn.Module):
    def __init__(self, n_qubits: int = N_QUBITS):
        super().__init__()
        self.n_qubits = n_qubits

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.shape[-1] != self.n_qubits:
            raise ValueError(f"Expected {self.n_qubits} quantum features, got {x.shape[-1]}.")
        return x


class HybridQuantumClassifier(nn.Module):
    def __init__(self, n_qubits: int = N_QUBITS, n_layers: int = 4, seed: int = 42):
        super().__init__()
        self.n_qubits = n_qubits
        self.n_layers = n_layers
        self.seed = seed

        try:
            self.device = qml.device("lightning.qubit", wires=n_qubits)
            self.circuit = qml.QNode(self._circuit, self.device, interface="torch", diff_method="backprop")
        except Exception:
            self.device = qml.device("default.qubit", wires=n_qubits)
            self.circuit = qml.QNode(self._circuit, self.device, interface="torch", diff_method="backprop")

        self.variational_weights = nn.Parameter(
            torch.empty(n_layers, n_qubits, 3, dtype=torch.float32),
            requires_grad=True,
        )
        torch.nn.init.normal_(self.variational_weights, mean=0.0, std=0.1)

        self.encoder = QuantumAngleEncoder(n_qubits=n_qubits)
        self.classifier = nn.Linear(n_qubits, N_CLASSES)

    def _circuit(self, inputs: torch.Tensor, weights: torch.Tensor):
        for wire in range(self.n_qubits):
            qml.RY(inputs[wire], wires=wire)

        for layer in range(self.n_layers):
            for wire in range(self.n_qubits):
                qml.RX(weights[layer, wire, 0], wires=wire)
                qml.RY(weights[layer, wire, 1], wires=wire)
                qml.RZ(weights[layer, wire, 2], wires=wire)
            for wire in range(self.n_qubits - 1):
                qml.CNOT(wires=[wire, wire + 1])

        return [qml.expval(qml.PauliZ(wire)) for wire in range(self.n_qubits)]

    def quantum_embedding(self, x: torch.Tensor) -> torch.Tensor:
        x = self.encoder(x)
        if x.ndim == 1:
            x = x.unsqueeze(0)

        outputs = []
        for sample in x:
            output = self.circuit(sample, self.variational_weights)
            if isinstance(output, torch.Tensor):
                output = output.to(dtype=torch.float32)
            elif isinstance(output, (tuple, list)):
                output = torch.stack([
                    item.to(dtype=torch.float32) if isinstance(item, torch.Tensor)
                    else torch.as_tensor(item, dtype=torch.float32)
                    for item in output
                ])
            else:
                output = torch.as_tensor(output, dtype=torch.float32)
            outputs.append(output)

        quantum_features = torch.stack(outputs)
        return quantum_features

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 2 or x.shape[1] != self.n_qubits:
            raise ValueError(f"Expected input shape (batch, {self.n_qubits}), got {tuple(x.shape)}.")
        if not torch.isfinite(x).all():
            raise ValueError("Quantum input contains NaN or infinite values.")

        q_out = self.quantum_embedding(x)
        logits = self.classifier(q_out)
        return logits

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        logits = self.forward(x)
        return torch.softmax(logits, dim=1)

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


def build_quantum_preprocessing(train_pca: np.ndarray) -> dict[str, Any]:
    from sklearn.preprocessing import MinMaxScaler

    quantum_scaler = MinMaxScaler(feature_range=(0.0, np.pi))
    quantum_scaler.fit(train_pca)

    payload = {
        "quantum_scaler": quantum_scaler,
        "n_qubits": N_QUBITS,
        "n_classes": N_CLASSES,
        "class_names": CLASS_NAMES,
    }
    return payload


def transform_to_quantum_features(pca_values: np.ndarray, quantum_scaler: Any) -> np.ndarray:
    scaled = quantum_scaler.transform(np.asarray(pca_values, dtype=float).reshape(1, -1))
    scaled = np.asarray(scaled, dtype=float).reshape(-1)
    if scaled.shape != (N_QUBITS,):
        raise ValueError(f"Expected scaled quantum feature length {N_QUBITS}, got {scaled.shape}.")
    if not np.isfinite(scaled).all():
        raise ValueError("Scaled quantum features contain NaN or infinity.")
    return scaled


def build_model_and_preprocessor() -> tuple[HybridQuantumClassifier, dict[str, Any]]:
    model = HybridQuantumClassifier(n_qubits=N_QUBITS, n_layers=4, seed=42)
    return model, {"n_qubits": N_QUBITS, "n_classes": N_CLASSES}
