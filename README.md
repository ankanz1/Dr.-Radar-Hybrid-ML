# Dr. Radar

## AI-Powered Preventive Healthcare & Clinical Intelligence Platform

Dr. Radar is a healthcare technology research platform designed to support **early health-risk identification, clinical decision support, and preventive healthcare**.

It brings patient information and AI-assisted analysis into one platform, with a working **ECG/QML module** today and a broader roadmap covering **multidisease detection, multimodal AI, and clinical research**.

> **Core idea:** Help clinicians and patients understand important health signals earlier — without replacing clinical judgment.

---

## What Dr. Radar Does

Dr. Radar is **not an ECG-only platform**. It is being developed as a modular healthcare intelligence platform.

### Current Working Capabilities

- Patient and doctor experiences
- Secure authentication and role-based workflows
- Patient health/profile management
- ECG data upload and analysis
- ECG heartbeat classification using a hybrid quantum-classical model
- ECG history and stored records
- Explainable model analysis for supported ECG predictions
- Clinical-facing views for patient ECG information
- API-based backend architecture
- Secure cloud database and storage integration

### Platform Roadmap

**Multidisease Detection**
- Skin disease analysis
- Medical-image analysis
- Additional cardiovascular models
- Laboratory-based risk models
- Disease-specific prediction modules

**Multimodal AI**
- Clinical history + laboratory data
- Imaging + clinical information
- Multimodal patient risk profile
- Longitudinal health tracking

**Clinical Research**
- External validation
- Prospective evaluation
- Explainability
- Calibration
- Bias/fairness analysis
- Clinical workflow evaluation

The Phase 5–7 modules are currently presented as **prototype/roadmap UI** and do not claim to provide real clinical predictions where models are not yet implemented.

---

## Current AI Module: ECG + Hybrid QML

The currently implemented AI pipeline focuses on **ECG heartbeat classification**, not generic cardiovascular disease diagnosis.

```text
ECG Signal
    ↓
Preprocessing
    ↓
PCA-8
    ↓
8-dimensional quantum representation
    ↓
8-qubit Variational Quantum Classifier
    ↓
4-layer VQC
    ↓
5-class heartbeat classification
```

Current heartbeat classes:

| Class | Meaning |
|---|---|
| N | Normal heartbeat |
| S | Supraventricular ectopic heartbeat |
| V | Ventricular ectopic heartbeat |
| F | Fusion heartbeat |
| Q | Unknown / other heartbeat |

The system uses real MIT-BIH test ECG samples for its built-in demonstration workflow.

### Important

Dr. Radar's current ECG model is a **heartbeat classification research prototype**. It should not be presented as an autonomous diagnostic system for cardiovascular disease.

---

## ECG Data Input

The platform supports ECG analysis through:

- Built-in MIT-BIH demonstration samples
- CSV upload
- TXT upload
- PDF ECG upload workflow

Uploaded ECG data is validated before analysis. Supported signal data can be segmented into deterministic 187-point windows for the current prototype pipeline.

The segmentation approach is a technical prototype mechanism; it is **not a clinical beat-detection algorithm**.

---

## Explainability

Dr. Radar is designed around **interpretable AI rather than unexplained predictions**.

The current ECG workflow provides:

- Prediction class
- Class probabilities
- Model analysis/explanation information
- Patient-facing and clinician-facing result views

The platform's research roadmap includes more advanced explainability methods and evaluation.

**SHAP/LIME should only be considered implemented when the corresponding model integration is present and validated in the codebase.**

---

## Platform Architecture

```text
                    DR. RADAR
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   Patient App     Doctor Workspace   Research UI
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                 Frontend Application
                        │
                        ▼
                  FastAPI Backend
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   AI / QML        Authentication     Health Data
    Services          & Users          & Storage
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                 Supabase / PostgreSQL
```

The architecture is modular so that additional disease-specific models and multimodal analysis can be added without making ECG the entire platform.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic

### Machine Learning

- NumPy
- Pandas
- scikit-learn
- XGBoost
- PyTorch

### Quantum Machine Learning

- PennyLane
- PennyLane Lightning
- Variational Quantum Classifier (VQC)
- 8-qubit quantum representation for the current ECG module

### Healthcare Data

- ECG signal processing
- MIT-BIH demonstration data
- CSV / TXT / PDF ingestion
- PyMuPDF for PDF processing

### Database & Storage

- Supabase
- PostgreSQL
- Supabase Storage
- Row Level Security (RLS)

### Testing & Development

- Vitest
- Testing Library
- ESLint
- TypeScript
- Git / GitHub

---

## Repository Structure

```text
Dr.-Radar-Hybrid-ML/
│
├── Dr.-Radar-Uii/      # React + TypeScript frontend
│
├── ecg-qml/            # Python/FastAPI backend and ECG/QML module
│
├── .gitignore
└── README.md
```

### Frontend

The frontend contains:

- Authentication and onboarding
- Patient dashboard
- Doctor dashboard
- ECG analysis screens
- ECG history
- Patient/doctor clinical views
- Multidisease roadmap
- Multimodal AI roadmap
- Clinical research roadmap

### Backend

The backend contains:

- FastAPI application
- ECG/QML inference
- ECG file processing
- Authentication support
- Persistence/database integration
- Health and model information endpoints

---

## Main API

Current backend endpoints include:

```text
GET  /health
GET  /model-info
GET  /samples
POST /predict
POST /analyze
POST /ecg/upload
```

Authentication:

```text
POST /auth/register
POST /auth/login
GET  /auth/me
```

---

## Running Locally

### Backend

```powershell
cd "ecg-qml"
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd "Dr.-Radar-Uii"
npm install
npm run dev
```

The frontend connects to the configured backend and Supabase services through the project's environment configuration.

---

## Security & Privacy

Dr. Radar uses Supabase authentication, PostgreSQL, private storage, and Row Level Security for protected application data.

Important principles:

- Authenticated access
- Role-based access
- Patient-owned data policies
- Doctor access limited to authorized patient data
- Private ECG storage
- No secrets committed to source control
- Healthcare data should only be used with appropriate privacy, security, consent, and regulatory controls

The current project is a **research/prototype platform**, not a certified medical device.

---

## Validation & Testing

The project includes automated frontend and backend validation for core workflows.

Current frontend verification includes:

- Unit/component tests
- ECG workflow tests
- Account/auth provisioning tests
- Roadmap UI tests
- Lint/type checking
- Production build verification

The Phase 5–7 UI currently uses honest status labels such as:

- **Available**
- **Prototype**
- **Coming Soon**
- **Research Preview**

This prevents future capabilities from being presented as already validated medical models.

---

## Product Direction

Dr. Radar is being developed in three connected layers:

```text
PHASE 1
Working AI foundation
        │
        ▼
ECG / Hybrid QML
        │
        ▼
PHASE 2
Multidisease Intelligence
        │
        ▼
Imaging + Labs + Disease Modules
        │
        ▼
PHASE 3
Multimodal Healthcare Intelligence
        │
        ▼
History + Labs + Imaging + Longitudinal Data
        │
        ▼
PHASE 4
Clinical Research & Validation
        │
        ▼
Explainability + Calibration + Fairness
+ External / Prospective Evaluation
```

The goal is to evolve from a working research prototype into a broader **AI-assisted preventive healthcare platform**.

---

## Research Philosophy

Dr. Radar does not assume that quantum machine learning is automatically better than classical machine learning.

The research direction is:

> **Use classical ML where it is effective, use quantum ML where it is meaningful to evaluate, and measure the difference honestly.**

Future model development should compare classical, quantum, and hybrid approaches using appropriate validation, robustness, calibration, fairness, and clinical workflow evaluation.

---

## Limitations

Dr. Radar is currently a research and prototype platform.

It does **not**:

- Replace a doctor
- Provide autonomous medical diagnosis
- Guarantee clinical outcomes
- Establish clinical efficacy without appropriate validation
- Claim quantum advantage without experimental evidence

Real-world clinical deployment would require appropriate clinical validation, external validation, regulatory review, privacy/security controls, and human oversight.

---

## Future Scope

The platform can be extended with:

- Additional disease-specific models
- Medical-image AI
- Laboratory risk models
- Multimodal patient representations
- Longitudinal risk analysis
- Stronger explainability
- Calibration and uncertainty analysis
- Fairness/bias evaluation
- Prospective clinical studies
- External validation datasets
- Additional quantum and classical models
- Clinical system integrations

---

## Project Vision

> **Dr. Radar aims to bring multiple health signals, AI-assisted analysis, and clinical intelligence together in one platform — helping healthcare move from isolated data and reactive decisions toward earlier, more informed, and explainable preventive care.**

---

## Disclaimer

Dr. Radar is an experimental research and educational prototype. It is not a medical device and does not provide a definitive medical diagnosis or treatment recommendation.

Any clinical use would require appropriate medical, regulatory, privacy, security, and validation processes.
