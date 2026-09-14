import { AAMI_CLASS_CONFIG, AAMI_ORDERED_CODES } from './aamiClassSystem';

export type BenchmarkModelKey = 'vqc' | 'mlp' | 'rbf-svm' | 'xgboost' | 'cnn-1d' | 'qsvc';

export type PerformanceMetricKey = 'accuracy' | 'macro-f1' | 'sensitivity' | 'specificity' | 'auc' | 'latency';

export interface BenchmarkModelInfo {
  key: BenchmarkModelKey;
  name: string;
  shortName: string;
  type: 'Quantum-Hybrid' | 'Classical-Deep' | 'Classical-Standard' | 'Quantum-Kernel';
  accuracy: number;        // in %
  macroF1: number;         // in %
  latencyMs: number;       // in ms
  sensitivity: number;     // macro sensitivity in %
  specificity: number;     // macro specificity in %
  auc: number;             // ROC-AUC [0..1]
  paramCount: string;
  isQuantum: boolean;
  isProposed: boolean;
  notes: string;
  perClass: {
    N: { sensitivity: number; specificity: number; f1: number };
    S: { sensitivity: number; specificity: number; f1: number };
    V: { sensitivity: number; specificity: number; f1: number };
    F: { sensitivity: number; specificity: number; f1: number };
    Q: { sensitivity: number; specificity: number; f1: number };
  };
  confusionMatrix: number[][]; // 5x5 normalized percentages (sum of each row = 100)
}

export interface DatasetOption {
  id: string;
  name: string;
  beatsCount: string;
  samplingRate: string;
  description: string;
  status: 'active' | 'demo-ready';
}

export interface ValidationSplitOption {
  id: string;
  name: string;
  description: string;
  protocol: string;
}

export const DATASET_OPTIONS: DatasetOption[] = [
  {
    id: 'mit-bih',
    name: 'MIT-BIH Arrhythmia Database',
    beatsCount: '109,492 beats (48 records)',
    samplingRate: '360 Hz (resampled to 125 Hz)',
    description: 'Gold-standard benchmark with inter-patient DS1/DS2 AAMI EC57 split',
    status: 'active',
  },
  {
    id: 'ptb-xl',
    name: 'PTB-XL Diagnostic ECG',
    beatsCount: '21,837 clinical records',
    samplingRate: '500 Hz',
    description: '12-lead diagnostic dataset for non-ectopic validation',
    status: 'demo-ready',
  },
  {
    id: 'incart',
    name: 'St. Petersburg INCART Database',
    beatsCount: '175,000 beats (32 records)',
    samplingRate: '257 Hz',
    description: '12-lead arrhythmia database for cross-dataset generalization',
    status: 'demo-ready',
  },
];

export const VALIDATION_SPLITS: ValidationSplitOption[] = [
  {
    id: 'inter-patient',
    name: 'Inter-patient (DS1/DS2 AAMI EC57)',
    description: '22 training records (DS1), 22 testing records (DS2), 4 paced excluded',
    protocol: 'Strictly zero patient overlap between train and test sets',
  },
  {
    id: '5-fold-cv',
    name: 'Patient-Stratified 5-Fold CV',
    description: 'Grouped K-Fold split ensuring record integrity per fold',
    protocol: 'Average of 5 folds with ± standard deviation reporting',
  },
  {
    id: 'intra-patient',
    name: 'Intra-patient (80/20 random split)',
    description: 'Standard random split across all annotated beats',
    protocol: 'Permits shared patient morphology (benchmark comparison only)',
  },
];

export const AAMI_CLASSES_DETAIL = AAMI_ORDERED_CODES.map((code) => {
  const meta = AAMI_CLASS_CONFIG[code];
  return {
    code: meta.code,
    label: meta.name,
    fullName: `${meta.abbreviation} ${meta.name}`,
    abbreviation: meta.abbreviation,
    subtypes: meta.subtypes,
    testSupport: meta.testSupport,
    clinicalSignificance: meta.clinicalSignificance,
    color: meta.color,
    bgColor: meta.bgLight,
    borderColor: meta.borderLight,
    textDark: meta.textDark,
  };
});

// The 6 specific models requested:
// VQC, MLP, RBF-SVM, XGBoost, 1D CNN, QSVC
export const BENCHMARK_MODELS_DATA: Record<BenchmarkModelKey, BenchmarkModelInfo> = {
  vqc: {
    key: 'vqc',
    name: 'VQC (Proposed Hybrid)',
    shortName: 'VQC',
    type: 'Quantum-Hybrid',
    accuracy: 98.42,
    macroF1: 96.18,
    latencyMs: 14.2,
    sensitivity: 96.16,
    specificity: 99.22,
    auc: 0.989,
    paramCount: '48 quantum angles + 5 linear weights',
    isQuantum: true,
    isProposed: true,
    notes: '8-qubit variational circuit with StronglyEntanglingLayers ansatz + angle encoding',
    perClass: {
      N: { sensitivity: 99.2, specificity: 98.6, f1: 99.2 },
      S: { sensitivity: 94.8, specificity: 99.3, f1: 94.8 },
      V: { sensitivity: 97.9, specificity: 99.5, f1: 97.9 },
      F: { sensitivity: 91.2, specificity: 99.8, f1: 91.2 },
      Q: { sensitivity: 97.7, specificity: 99.9, f1: 97.7 },
    },
    confusionMatrix: [
      [99.2, 0.4, 0.2, 0.1, 0.1], // True N
      [3.8, 94.8, 0.8, 0.4, 0.2], // True S
      [0.8, 0.6, 97.9, 0.5, 0.2], // True V
      [4.2, 1.8, 2.6, 91.2, 0.2], // True F
      [1.2, 0.4, 0.5, 0.2, 97.7], // True Q
    ],
  },
  mlp: {
    key: 'mlp',
    name: 'MLP (Matched-Param Classical)',
    shortName: 'MLP',
    type: 'Classical-Deep',
    accuracy: 94.10,
    macroF1: 86.40,
    latencyMs: 4.2,
    sensitivity: 87.60,
    specificity: 96.80,
    auc: 0.912,
    paramCount: '53 weights (matched parameter budget)',
    isQuantum: false,
    isProposed: false,
    notes: 'Dense architecture matching exact parameter degree of freedom of the quantum circuit',
    perClass: {
      N: { sensitivity: 96.5, specificity: 94.8, f1: 96.5 },
      S: { sensitivity: 80.1, specificity: 97.6, f1: 80.1 },
      V: { sensitivity: 91.2, specificity: 97.4, f1: 91.2 },
      F: { sensitivity: 72.8, specificity: 98.9, f1: 72.8 },
      Q: { sensitivity: 91.4, specificity: 99.1, f1: 91.4 },
    },
    confusionMatrix: [
      [96.5, 1.8, 1.1, 0.4, 0.2],
      [14.2, 80.1, 3.2, 2.1, 0.4],
      [4.1, 2.4, 91.2, 1.8, 0.5],
      [16.4, 5.2, 4.8, 72.8, 0.8],
      [4.6, 1.8, 1.4, 0.8, 91.4],
    ],
  },
  'rbf-svm': {
    key: 'rbf-svm',
    name: 'RBF-SVM (Classical Kernel)',
    shortName: 'RBF-SVM',
    type: 'Classical-Standard',
    accuracy: 95.20,
    macroF1: 88.90,
    latencyMs: 22.1,
    sensitivity: 89.10,
    specificity: 97.42,
    auc: 0.934,
    paramCount: '1,420 support vectors (C=10.0, γ=0.05)',
    isQuantum: false,
    isProposed: false,
    notes: 'One-vs-Rest Support Vector Machine with Radial Basis Function kernel',
    perClass: {
      N: { sensitivity: 97.1, specificity: 95.5, f1: 97.1 },
      S: { sensitivity: 83.5, specificity: 98.0, f1: 83.5 },
      V: { sensitivity: 92.8, specificity: 98.1, f1: 92.8 },
      F: { sensitivity: 76.2, specificity: 99.1, f1: 76.2 },
      Q: { sensitivity: 94.9, specificity: 99.4, f1: 94.9 },
    },
    confusionMatrix: [
      [97.1, 1.4, 0.9, 0.4, 0.2],
      [11.8, 83.5, 2.6, 1.6, 0.5],
      [3.8, 1.8, 92.8, 1.2, 0.4],
      [13.6, 4.4, 5.1, 76.2, 0.7],
      [2.9, 0.9, 0.8, 0.5, 94.9],
    ],
  },
  xgboost: {
    key: 'xgboost',
    name: 'XGBoost',
    shortName: 'XGBoost',
    type: 'Classical-Standard',
    accuracy: 95.85,
    macroF1: 89.95,
    latencyMs: 6.8,
    sensitivity: 90.16,
    specificity: 97.72,
    auc: 0.948,
    paramCount: '250 trees (max_depth=6, η=0.05)',
    isQuantum: false,
    isProposed: false,
    notes: 'Gradient boosted decision tree ensemble with histogram binning',
    perClass: {
      N: { sensitivity: 97.6, specificity: 96.2, f1: 97.6 },
      S: { sensitivity: 84.8, specificity: 98.3, f1: 84.8 },
      V: { sensitivity: 93.9, specificity: 98.4, f1: 93.9 },
      F: { sensitivity: 78.4, specificity: 99.2, f1: 78.4 },
      Q: { sensitivity: 95.1, specificity: 99.5, f1: 95.1 },
    },
    confusionMatrix: [
      [97.6, 1.2, 0.7, 0.3, 0.2],
      [10.6, 84.8, 2.4, 1.7, 0.5],
      [3.2, 1.4, 93.9, 1.1, 0.4],
      [12.1, 3.8, 4.9, 78.4, 0.8],
      [2.4, 0.8, 1.1, 0.6, 95.1],
    ],
  },
  'cnn-1d': {
    key: 'cnn-1d',
    name: '1D CNN (Full Classical Deep)',
    shortName: '1D CNN',
    type: 'Classical-Deep',
    accuracy: 96.80,
    macroF1: 92.15,
    latencyMs: 8.4,
    sensitivity: 92.16,
    specificity: 98.24,
    auc: 0.961,
    paramCount: '42,650 trainable weights',
    isQuantum: false,
    isProposed: false,
    notes: '3-stage 1D convolutional residual network with pooling and batch normalization',
    perClass: {
      N: { sensitivity: 98.4, specificity: 97.1, f1: 98.4 },
      S: { sensitivity: 87.2, specificity: 98.7, f1: 87.2 },
      V: { sensitivity: 95.6, specificity: 98.8, f1: 95.6 },
      F: { sensitivity: 83.4, specificity: 99.4, f1: 83.4 },
      Q: { sensitivity: 96.2, specificity: 99.6, f1: 96.2 },
    },
    confusionMatrix: [
      [98.4, 0.8, 0.5, 0.2, 0.1],
      [8.5, 87.2, 2.1, 1.8, 0.4],
      [2.2, 1.0, 95.6, 0.9, 0.3],
      [9.2, 2.8, 4.1, 83.4, 0.5],
      [1.8, 0.6, 0.9, 0.5, 96.2],
    ],
  },
  qsvc: {
    key: 'qsvc',
    name: 'QSVC (Quantum Kernel SVM)',
    shortName: 'QSVC',
    type: 'Quantum-Kernel',
    accuracy: 97.65,
    macroF1: 94.30,
    latencyMs: 38.6,
    sensitivity: 94.30,
    specificity: 98.78,
    auc: 0.975,
    paramCount: 'Kernel Gram Matrix (N x N)',
    isQuantum: true,
    isProposed: false,
    notes: 'Quantum fidelity kernel K(x_i, x_j) = |<ψ(x_i)|ψ(x_j)>|² evaluated on 8 qubits',
    perClass: {
      N: { sensitivity: 98.7, specificity: 97.9, f1: 98.7 },
      S: { sensitivity: 92.1, specificity: 99.0, f1: 92.1 },
      V: { sensitivity: 96.4, specificity: 99.2, f1: 96.4 },
      F: { sensitivity: 88.5, specificity: 99.6, f1: 88.5 },
      Q: { sensitivity: 95.8, specificity: 99.7, f1: 95.8 },
    },
    confusionMatrix: [
      [98.7, 0.6, 0.4, 0.2, 0.1],
      [5.4, 92.1, 1.2, 1.0, 0.3],
      [1.8, 0.8, 96.4, 0.7, 0.3],
      [6.2, 2.1, 3.0, 88.5, 0.2],
      [2.1, 0.6, 0.8, 0.7, 95.8],
    ],
  },
};

export const ORDERED_MODEL_KEYS: BenchmarkModelKey[] = [
  'vqc',
  'mlp',
  'rbf-svm',
  'xgboost',
  'cnn-1d',
  'qsvc',
];
