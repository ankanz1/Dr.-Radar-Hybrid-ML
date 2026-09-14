from __future__ import annotations

import torch
from torch import nn


class ECGMLP(nn.Module):
    """Small classical MLP baseline for ECG heartbeat classification."""

    def __init__(self, input_size: int = 187, hidden1: int = 64, hidden2: int = 32, num_classes: int = 5):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden1),
            nn.ReLU(),
            nn.Linear(hidden1, hidden2),
            nn.ReLU(),
            nn.Linear(hidden2, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)
