# Dr. Radar — Hybrid Quantum–Classical Healthcare Intelligence

## Overview

Dr. Radar is a patient-centered healthcare interface for AI-powered health analysis. The ECG analysis module integrates with a hybrid classical-quantum ECG classification backend to provide heartbeat morphology classification with explainability.

**Important**: This is a research prototype. The ECG analysis provides heartbeat morphology classification, not medical diagnosis.

## Features

- **ECG Analysis**: Real-time heartbeat classification using a frozen 8-qubit, 4-layer QML model
- **5-Class Classification**: N (Normal), S (Supraventricular ectopic), V (Ventricular ectopic), F (Fusion), Q (Unknown)
- **XAI Explanation**: PCA perturbation with loading-weighted back-projection showing top features and waveform importance
- **Medical Disclaimer**: Clear labeling that results are model predictions, not clinical diagnoses
- **AI Assistant**: Integrated healthcare assistant for result interpretation

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: TailwindCSS 4
- **Backend**: FastAPI (Python) with PennyLane QML
- **Communication**: REST API with CORS

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+ (for backend)
- npm or yarn

### Backend Setup

```bash
cd ecg-qml
pip install -r requirements.txt
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Backend runs at `http://127.0.0.1:8000`

### Frontend Setup

```bash
cd Dr.-Radar-Uii
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### Environment Variable

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required variable:
- `VITE_ECG_API_URL=http://127.0.0.1:8000` — Backend API URL for ECG inference

The `.env` file is gitignored. Only `.env.example` is committed.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite + Express) |
| `npm run build` | Production build (Vite + esbuild server) |
| `npm run start` | Start production server |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type check |

## ECG Analysis Flow

1. User opens **ECG Analysis** screen
2. Selects a sample ECG heartbeat (from MIT-BIH test set) or inputs custom 187 values
3. Clicks **Run Analysis**
4. Frontend sends 187 values to `POST /analyze` on backend
5. Backend runs frozen QML pipeline:
   - StandardScaler → PCA(8) → MinMaxScaler[0,π]
   - 8-qubit VQC (4 layers) → Pauli-Z expectations
   - Linear 8→5 head → Softmax
6. Backend returns prediction + XAI explanation
7. Frontend displays:
   - Predicted heartbeat class (N/S/V/F/Q) with human-readable name
   - Model confidence
   - 5-class probability distribution
   - XAI: Top 3 PCA features + waveform importance (187 samples)
   - Medical disclaimer

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Verify backend availability |
| `/model-info` | GET | Get model metadata |
| `/analyze` | POST | Full prediction + XAI |

## Project Structure

```
Dr.-Radar-Uii/
├── src/
│   ├── components/
│   │   ├── ECGAnalysisScreen.tsx    # Main ECG analysis UI
│   │   ├── ECGWaveformModal.tsx     # Waveform viewer
│   │   ├── ClinicalDisclaimer.tsx   # Medical disclaimer
│   │   └── ...                      # Other UI components
│   ├── services/
│   │   └── ecgApi.ts                # Backend API client
│   ├── data/
│   │   └── ecgQuantumData.ts        # Benchmark ECG samples
│   └── App.tsx                      # Main app with routing
├── server.ts                        # Express + Vite dev server
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example                     # Environment template
└── .gitignore
```

## Backend Dependency

The frontend requires the **ecg-qml backend** running at `VITE_ECG_API_URL` (default `http://127.0.0.1:8000`).

Start the backend first:
```bash
cd ecg-qml && python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Then start the frontend:
```bash
cd Dr.-Radar-Uii && npm run dev
```

## Production Build

```bash
npm run build
npm run start
```

Outputs to `dist/` with bundled server at `dist/server.cjs`.

## Verification

Test with real MIT-BIH sample (row 0):

```bash
# Backend direct test
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"ecg": [...187 values from mitbih_test.csv row 0...]}'

# Expected: class N (Normal), confidence ~35.42%
```

## Medical Disclaimer

> This system is a research prototype for ECG heartbeat classification and is not a medical diagnosis tool.

The UI displays:
- "Predicted heartbeat class" (not "diagnosis" or "disease")
- Confidence = model posterior probability, not clinical certainty
- XAI regions = model sensitivity, not clinical causality