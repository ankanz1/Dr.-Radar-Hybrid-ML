# ECG Hybrid Quantum Machine Learning

## Overview

This project implements a hybrid classical-quantum ECG heartbeat classification pipeline. The system uses a frozen QML (Quantum Machine Learning) model to classify individual ECG heartbeat patterns into five morphological classes.

**Important**: This is a research prototype for heartbeat classification, not a medical diagnosis system. It classifies heartbeat morphology patterns and does not diagnose disease.

## Dataset

**Source**: MIT-BIH Arrhythmia Database (derived ECG Heartbeat Categorization Dataset)

**Format**: CSV files with 188 columns per row
- 187 ECG signal values (Lead II, 125 Hz, centered on R-peak)
- 1 label column (0-4)

**Classes** (AAMI EC57 standard):
- **N (0)**: Normal heartbeat
- **S (1)**: Supraventricular ectopic heartbeat
- **V (2)**: Ventricular ectopic heartbeat
- **F (3)**: Fusion heartbeat
- **Q (4)**: Unknown/other heartbeat

**Files**:
- `data/mitbih_train.csv` — Training set
- `data/mitbih_test.csv` — Held-out test set
- `data/ptbdb_normal.csv` / `ptbdb_abnormal.csv` — Additional PTB data

## Architecture

The preprocessing and inference pipeline:

```
187 ECG values
→ StandardScaler (fitted on training data)
→ PCA with 8 components (fitted on training data)
→ MinMaxScaler [0, π] (quantum feature scaling, fitted on training PCA output)
→ 8-qubit VQC (Variational Quantum Circuit)
   - RY angle encoding
   - 4 VQC layers: RX/RY/RZ rotations + nearest-neighbor CNOT entanglement
→ Pauli-Z expectation measurements (8 values)
→ Linear head (8 → 5)
→ Softmax → 5-class probabilities
```

**Model artifacts (frozen, do not retrain)**:
- `models/ecg_hybrid_qml_balanced.pt` — QML model weights
- `models/ecg_qml_balanced_preprocessing.joblib` — StandardScaler + PCA + MinMaxScaler

## QML Details

- **Encoding**: RY angle encoding (each of 8 PCA features → qubit rotation angle)
- **Ansatz**: 4 layers of trainable RX, RY, RZ rotations per qubit + nearest-neighbor CNOT entanglement
- **Measurement**: Pauli-Z expectation values on all 8 qubits
- **Classical head**: Linear layer (8 → 5) + Softmax
- **Framework**: PennyLane with lightning.qubit simulator (falls back to default.qubit)

## XAI (Explainability)

**Method**: PCA perturbation with loading-weighted back-projection

The explanation computes the absolute change in predicted-class probability when each of the 8 PCA features is perturbed to its zero-centered reference value. The PCA feature importance is then back-projected to the original 187 ECG positions using the absolute PCA component loadings.

**Output**:
- Top 3 PCA features by importance (with rank, importance score, score change, PCA value)
- Waveform importance array (187 values, normalized 0-1)
- Method description

**Disclaimer**: These regions indicate where the model's input representation was most sensitive to perturbation. They describe model behavior and are not clinical causal evidence.

## Backend API

The FastAPI server (`api.py`) exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check — verifies model and preprocessing load |
| `/model-info` | GET | Model metadata (architecture, classes, test macro F1) |
| `/predict` | POST | Prediction only — accepts 187 ECG values, returns class + probabilities |
| `/analyze` | POST | Full analysis — prediction + XAI explanation (top PCA features, waveform importance, method) |

**Request format** (`POST /predict` and `POST /analyze`):
```json
{
  "ecg": [187 numeric values]
}
```

**Response format** (`/predict`):
```json
{
  "predicted_class_id": 0,
  "predicted_class": "N",
  "predicted_class_name": "Normal heartbeat",
  "confidence": 0.3542,
  "probabilities": {
    "N": 0.3542,
    "S": 0.2375,
    "V": 0.1108,
    "F": 0.1953,
    "Q": 0.1022
  }
}
```

**Response format** (`/analyze`):
```json
{
  "prediction": { ... },
  "explanation": {
    "top_pca_features": [
      {"pca_feature": 0, "rank": 1, "importance": 0.0631, "score_change": 0.0631, ...},
      {"pca_feature": 6, "rank": 2, "importance": 0.0376, ...},
      {"pca_feature": 7, "rank": 3, "importance": 0.0107, ...}
    ],
    "waveform_importance": [187 float values],
    "method": "PCA perturbation with loading-weighted back-projection"
  }
}
```

**CORS**: Configured for `http://localhost:3000` and `http://127.0.0.1:3000`

## Installation

```bash
cd ecg-qml
pip install -r requirements.txt
```

**Requirements**:
- Python 3.10+
- pandas, numpy, scikit-learn, torch, matplotlib, joblib
- xgboost, pennylane, pennylane-lightning
- fastapi, uvicorn[standard]

## Running

### Backend (FastAPI)

```bash
cd ecg-qml
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Server runs at `http://127.0.0.1:8000`

### Frontend (React + Vite)

```bash
cd Dr.-Radar-Uii
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` (proxies `/api/ecg/*` to backend via `VITE_ECG_API_URL`)

## Testing

### Direct QML Inference (Python)

```bash
cd ecg-qml
python -c "
import pandas as pd
import numpy as np
import joblib, torch
from src.quantum_model import HybridQuantumClassifier, N_QUBITS
from src.pca_features import transform_ecg_to_pca

# Load test sample
test_df = pd.read_csv('data/mitbih_test.csv', header=None)
ecg = test_df.iloc[0, :-1].to_numpy()

# Load frozen artifacts
preprocessing = joblib.load('models/ecg_qml_balanced_preprocessing.joblib')
model = HybridQuantumClassifier(n_qubits=8, n_layers=4)
model.load_state_dict(torch.load('models/ecg_hybrid_qml_balanced.pt', map_location='cpu'))
model.eval()

# Inference
pca = transform_ecg_to_pca(ecg)
q = preprocessing['quantum_scaler'].transform(pca.reshape(1,-1))
with torch.inference_mode():
    probs = model.predict_proba(torch.tensor(q, dtype=torch.float32)).numpy()[0]
print('Predicted:', np.argmax(probs), 'Confidence:', probs.max())
print('Probs:', dict(zip('NSVFQ', probs)))
"
```

### API Endpoints

```bash
# Health
curl http://127.0.0.1:8000/health

# Model info
curl http://127.0.0.1:8000/model-info

# Prediction
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"ecg": [0.1, 0.2, ... 187 values ...]}'

# Full analysis with XAI
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"ecg": [0.1, 0.2, ... 187 values ...]}'
```

### Invalid Input Validation

```bash
# 186 values (too short) → 422
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d '{"ecg": [0.0]*186}'

# 188 values (too long) → 422
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d '{"ecg": [0.0]*188}'

# Non-numeric → 422
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d '{"ecg": ["a"]*187}'
```

### Real MIT-BIH Test Sample (Row 0)

```bash
cd ecg-qml
python -c "
import pandas as pd
import requests
test_df = pd.read_csv('data/mitbih_test.csv', header=None)
ecg = test_df.iloc[0, :-1].tolist()
r = requests.post('http://127.0.0.1:8000/analyze', json={'ecg': ecg})
print(r.json())
"
```

**Expected result** (row 0, actual class N):
- Predicted class: 0 (N)
- Confidence: ~35.42%
- Probabilities: N≈35.42%, S≈23.75%, V≈11.08%, F≈19.53%, Q≈10.22%
- XAI: Top 3 PCA features [0, 6, 7], waveform importance (187 values)

### Integration Verification

The integration verification confirmed:
1. ✅ Direct QML inference and API prediction produce **identical** predicted class (0)
2. ✅ Probability vectors match with **max absolute difference = 0.0**
3. ✅ Frontend successfully receives API response via `/analyze`
4. ✅ Model artifacts unchanged (SHA-256 verified)

## Benchmark Results

| Model | Test Macro F1 | Notes |
|-------|--------------|-------|
| Classical MLP | 0.8206 | Baseline |
| Full XGBoost | 0.8586 | Best classical |
| PCA-8 XGBoost | 0.6086 | 8-component PCA |
| PCA-12 XGBoost | 0.6312 | 12-component PCA |
| PCA-16 XGBoost | 0.6419 | 16-component PCA |
| PCA-8 QML Linear Head | **0.3518** | **Production model** |
| PCA-8 QML MLP Head | 0.3566 | Ablation |

**Validation-only (not held-out test)**:
| PCA-12 QML | 0.3004 | Validation set only — not reported as held-out performance |

## Limitations

- **No quantum advantage**: Current QML models do not outperform classical baselines (MLP 0.8206, XGBoost 0.8586 vs QML 0.3518 Macro F1)
- **Research prototype**: The QML implementation is an experimental hybrid architecture for heartbeat morphology classification
- **Not a medical diagnosis system**: Dataset samples represent heartbeat classes (N, S, V, F, Q) rather than direct patient-level disease diagnosis
- **XAI is model interpretability only**: Highlighted regions show model sensitivity to perturbation, not clinical causality
- **Single-lead, single-beat**: Uses Lead II, 187-sample window centered on R-peak at 125 Hz

## Project Structure

```
ecg-qml/
├── api.py                 # FastAPI server (production inference)
├── app.py                 # Streamlit demo (optional)
├── requirements.txt
├── data/                  # MIT-BIH CSV datasets
├── models/                # Frozen model + preprocessing artifacts
├── src/
│   ├── api.py             # (not used, api.py is at root)
│   ├── data.py            # Data loading + CLASS_NAMES
│   ├── explain_qml.py     # XAI: PCA permutation + back-projection
│   ├── pca_features.py    # StandardScaler + PCA transform
│   ├── quantum_model.py   # HybridQuantumClassifier (8-qubit, 4-layer)
│   ├── evaluate_*.py      # Evaluation scripts (various models)
│   └── train_*.py         # Training scripts (various models)
├── outputs/               # Generated plots, metrics, explanations
├── tests/
└── scripts/test_model.py  # Simple test script
```