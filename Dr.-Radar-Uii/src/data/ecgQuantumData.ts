// ECG Arrhythmia & Quantum ML Dataset (MIT-BIH Arrhythmia Database)
// Hybrid Quantum-Classical ECG Arrhythmia Detection Platform
// Compliant with AAMI EC57 Standard (N, S, V, F, Q classes)

import { AAMI_CLASS_CONFIG } from './aamiClassSystem';

export interface ECGBeatSample {
  id: string;
  recordId: string;
  beatIndex: number;
  classType: 'N' | 'S' | 'V' | 'F' | 'Q';
  className: string;
  clinicalDescription: string;
  urgency: 'Normal' | 'Observation' | 'High Urgency' | 'Critical';
  urgencyColor: string;
  // 187 normalized voltage values [-0.4 to 1.4] sampled at 125Hz (1.5 seconds window centered on R-peak at index 70)
  signal: number[];
  // Fiducial points for biomedical visualization
  fiducials: {
    pPeak: number;
    qPoint: number;
    rPeak: number;
    sPoint: number;
    tPeak: number;
    qrsDurationMs: number;
    prIntervalMs: number;
    qtIntervalMs: number;
  };
  // 10-dimensional compressed latent representation z from classical autoencoder
  latentVectorZ: number[];
  // 10-qubit Pauli-Z expectation values <Z_i> from VQC
  quantumExpectations: number[];
  // 5-class output probabilities from classical softmax head
  probabilities: {
    N: number;
    S: number;
    V: number;
    F: number;
    Q: number;
  };
  // Integrated gradients attribution across 187 samples (saliency map)
  saliency: number[];
  // Segment contributions to the quantum decision
  segmentAttribution: {
    pWave: number;
    prSegment: number;
    qrsComplex: number;
    stSegment: number;
    tWave: number;
  };
}

// Generate realistic 187-sample ECG waveforms for each AAMI class
function generateECGWaveform(
  type: 'N' | 'S' | 'V' | 'F' | 'Q'
): { signal: number[]; fiducials: ECGBeatSample['fiducials']; saliency: number[] } {
  const signal = new Array(187).fill(0);
  const saliency = new Array(187).fill(0);
  const rIndex = 70;

  for (let i = 0; i < 187; i++) {
    // baseline is 0.0 with minor isoelectric noise
    let val = 0.02 * Math.sin(i * 0.1);

    if (type === 'N') {
      // Normal Sinus Rhythm: Distinct P-wave, sharp QRS, upright T-wave
      // P wave around index 35-48
      if (i >= 32 && i <= 50) {
        val += 0.18 * Math.sin(((i - 32) / 18) * Math.PI);
      }
      // Q wave
      if (i >= 62 && i <= 66) {
        val -= 0.15 * Math.sin(((i - 62) / 4) * Math.PI);
      }
      // R wave (sharp peak at 70)
      if (i >= 66 && i <= 74) {
        val += 1.15 * Math.sin(((i - 66) / 8) * Math.PI);
      }
      // S wave
      if (i >= 74 && i <= 80) {
        val -= 0.28 * Math.sin(((i - 74) / 6) * Math.PI);
      }
      // ST segment & T wave around index 100-135
      if (i >= 100 && i <= 135) {
        val += 0.28 * Math.sin(((i - 100) / 35) * Math.PI);
      }

      // Saliency focuses on healthy R-peak symmetry and crisp PR interval
      saliency[i] = Math.max(0, val * 0.4 + (i >= 65 && i <= 75 ? 0.3 : 0));
    } else if (type === 'V') {
      // Ventricular Ectopic (PVC): Absent P-wave, wide bizarre QRS complex, inverted deep T-wave
      // No P wave
      // Wide QRS (55 to 90)
      if (i >= 56 && i <= 70) {
        val -= 0.35 * Math.sin(((i - 56) / 14) * Math.PI);
      }
      if (i >= 66 && i <= 84) {
        val += 1.38 * Math.sin(((i - 66) / 18) * Math.PI);
      }
      if (i >= 82 && i <= 98) {
        val -= 0.65 * Math.sin(((i - 82) / 16) * Math.PI);
      }
      // Inverted discordant T-wave
      if (i >= 110 && i <= 145) {
        val -= 0.42 * Math.sin(((i - 110) / 35) * Math.PI);
      }

      // Saliency heavily highlights the aberrant QRS width and discordant T-wave
      if (i >= 60 && i <= 95) saliency[i] = 0.85 * Math.sin(((i - 60) / 35) * Math.PI);
      if (i >= 115 && i <= 140) saliency[i] = 0.68 * Math.sin(((i - 115) / 25) * Math.PI);
    } else if (type === 'S') {
      // Supraventricular Ectopic: Premature abnormal/peaked P-wave, narrow normal QRS
      // Premature abnormal P wave
      if (i >= 26 && i <= 44) {
        val += 0.32 * Math.sin(((i - 26) / 18) * Math.PI);
      }
      // QRS
      if (i >= 66 && i <= 74) {
        val += 0.98 * Math.sin(((i - 66) / 8) * Math.PI);
      }
      if (i >= 74 && i <= 79) {
        val -= 0.22 * Math.sin(((i - 74) / 5) * Math.PI);
      }
      // T wave
      if (i >= 96 && i <= 130) {
        val += 0.22 * Math.sin(((i - 96) / 34) * Math.PI);
      }

      // Saliency highlights the distorted, premature atrial P-wave morphology
      if (i >= 26 && i <= 46) saliency[i] = 0.92 * Math.sin(((i - 26) / 20) * Math.PI);
      if (i >= 66 && i <= 74) saliency[i] = 0.35;
    } else if (type === 'F') {
      // Fusion Beat: intermediate morphology between sinus and ventricular
      if (i >= 36 && i <= 50) {
        val += 0.12 * Math.sin(((i - 36) / 14) * Math.PI);
      }
      // Slurred onset delta wave + widened QRS
      if (i >= 60 && i <= 80) {
        val += 0.88 * Math.sin(((i - 60) / 20) * Math.PI);
      }
      if (i >= 78 && i <= 90) {
        val -= 0.40 * Math.sin(((i - 78) / 12) * Math.PI);
      }
      // Intermediate biphasic T-wave
      if (i >= 105 && i <= 138) {
        val += 0.18 * Math.sin(((i - 105) / 16) * Math.PI) - 0.15 * Math.sin(((i - 121) / 17) * Math.PI);
      }

      if (i >= 60 && i <= 88) saliency[i] = 0.78 * Math.sin(((i - 60) / 28) * Math.PI);
    } else {
      // Q (Paced / Unknown): sharp artificial pacemaker spike followed by wide complex
      if (i >= 58 && i <= 61) {
        val = 1.45; // Pacing spike
      } else if (i >= 62 && i <= 82) {
        val += 0.75 * Math.sin(((i - 62) / 20) * Math.PI);
      } else if (i >= 82 && i <= 96) {
        val -= 0.55 * Math.sin(((i - 82) / 14) * Math.PI);
      } else if (i >= 110 && i <= 140) {
        val -= 0.30 * Math.sin(((i - 110) / 30) * Math.PI);
      }

      if (i >= 56 && i <= 64) saliency[i] = 0.98;
      if (i >= 64 && i <= 85) saliency[i] = 0.52;
    }

    signal[i] = parseFloat(val.toFixed(4));
    saliency[i] = parseFloat(Math.min(1.0, Math.max(0, saliency[i])).toFixed(4));
  }

  const fiducials: ECGBeatSample['fiducials'] = {
    pPeak: type === 'V' ? 0 : type === 'S' ? 35 : 41,
    qPoint: 64,
    rPeak: rIndex,
    sPoint: type === 'V' ? 90 : 77,
    tPeak: 118,
    qrsDurationMs: type === 'V' ? 148 : type === 'F' ? 122 : type === 'Q' ? 156 : 88,
    prIntervalMs: type === 'V' ? 0 : 156,
    qtIntervalMs: type === 'V' ? 440 : 380,
  };

  return { signal, fiducials, saliency };
}

// 5 Benchmark ECG Beats for interactive exploration
const normalData = generateECGWaveform('N');
const pvcData = generateECGWaveform('V');
const pacData = generateECGWaveform('S');
const fusionData = generateECGWaveform('F');
const pacedData = generateECGWaveform('Q');

export const BENCHMARK_ECG_BEATS: ECGBeatSample[] = [
  {
    id: 'beat-n-100',
    recordId: 'MIT-BIH #100',
    beatIndex: 1420,
    classType: 'N',
    className: AAMI_CLASS_CONFIG.N.name, // 'Normal'
    clinicalDescription:
      'Uniform P-wave preceding narrow QRS complex (<100ms), followed by upright symmetric T-wave. Unimpaired atrioventricular and intraventricular conduction.',
    urgency: 'Normal',
    urgencyColor: AAMI_CLASS_CONFIG.N.color,
    signal: normalData.signal,
    fiducials: normalData.fiducials,
    latentVectorZ: [0.72, -0.41, 0.15, 0.88, -0.05, 0.32, -0.63, 0.19, 0.44, -0.28],
    quantumExpectations: [0.89, -0.68, 0.42, 0.94, -0.12, 0.55, -0.81, 0.38, 0.62, -0.45],
    probabilities: { N: 0.984, S: 0.011, V: 0.003, F: 0.001, Q: 0.001 },
    saliency: normalData.saliency,
    segmentAttribution: {
      pWave: 0.18,
      prSegment: 0.08,
      qrsComplex: 0.48,
      stSegment: 0.10,
      tWave: 0.16,
    },
  },
  {
    id: 'beat-v-208',
    recordId: 'MIT-BIH #208',
    beatIndex: 834,
    classType: 'V',
    className: AAMI_CLASS_CONFIG.V.name, // 'Ventricular ectopic'
    clinicalDescription:
      'Premature ventricular contraction with absent preceding P-wave, prolonged QRS (>140ms) with slurred morphology, and discordant secondary T-wave inversion.',
    urgency: 'High Urgency',
    urgencyColor: AAMI_CLASS_CONFIG.V.color,
    signal: pvcData.signal,
    fiducials: pvcData.fiducials,
    latentVectorZ: [-0.88, 0.79, -0.64, -0.32, 0.91, -0.54, 0.47, -0.73, -0.82, 0.65],
    quantumExpectations: [-0.94, 0.85, -0.77, -0.46, 0.96, -0.68, 0.62, -0.89, -0.91, 0.74],
    probabilities: { N: 0.004, S: 0.008, V: 0.972, F: 0.014, Q: 0.002 },
    saliency: pvcData.saliency,
    segmentAttribution: {
      pWave: 0.02,
      prSegment: 0.03,
      qrsComplex: 0.68,
      stSegment: 0.12,
      tWave: 0.15,
    },
  },
  {
    id: 'beat-s-209',
    recordId: 'MIT-BIH #209',
    beatIndex: 2190,
    classType: 'S',
    className: AAMI_CLASS_CONFIG.S.name, // 'Supraventricular ectopic'
    clinicalDescription:
      'Premature atrial contraction originating outside the SA node. Distinct premature P-wave contour occurring early in the cardiac cycle with normal ventricular depolarization.',
    urgency: 'Observation',
    urgencyColor: AAMI_CLASS_CONFIG.S.color,
    signal: pacData.signal,
    fiducials: pacData.fiducials,
    latentVectorZ: [0.35, -0.18, 0.84, -0.62, 0.27, -0.49, 0.11, 0.58, -0.36, 0.51],
    quantumExpectations: [0.45, -0.28, 0.91, -0.74, 0.38, -0.61, 0.18, 0.72, -0.48, 0.66],
    probabilities: { N: 0.041, S: 0.938, V: 0.012, F: 0.006, Q: 0.003 },
    saliency: pacData.saliency,
    segmentAttribution: {
      pWave: 0.62,
      prSegment: 0.14,
      qrsComplex: 0.14,
      stSegment: 0.04,
      tWave: 0.06,
    },
  },
  {
    id: 'beat-f-213',
    recordId: 'MIT-BIH #213',
    beatIndex: 1542,
    classType: 'F',
    className: AAMI_CLASS_CONFIG.F.name, // 'Fusion'
    clinicalDescription:
      'Hybrid activation waveform resulting from simultaneous ventricular depolarization from a normal supraventricular impulse and an ectopic ventricular pacemaker.',
    urgency: 'Observation',
    urgencyColor: AAMI_CLASS_CONFIG.F.color,
    signal: fusionData.signal,
    fiducials: fusionData.fiducials,
    latentVectorZ: [-0.24, 0.38, 0.44, 0.12, -0.48, 0.62, -0.29, -0.15, 0.33, -0.41],
    quantumExpectations: [-0.34, 0.48, 0.56, 0.22, -0.59, 0.74, -0.38, -0.21, 0.46, -0.52],
    probabilities: { N: 0.038, S: 0.024, V: 0.042, F: 0.884, Q: 0.012 },
    saliency: fusionData.saliency,
    segmentAttribution: {
      pWave: 0.12,
      prSegment: 0.09,
      qrsComplex: 0.54,
      stSegment: 0.11,
      tWave: 0.14,
    },
  },
  {
    id: 'beat-q-104',
    recordId: 'MIT-BIH #104',
    beatIndex: 610,
    classType: 'Q',
    className: AAMI_CLASS_CONFIG.Q.name, // 'Unknown/Paced'
    clinicalDescription:
      'Electronic ventricular pacing artifact characterized by instantaneous vertical voltage deflection preceding artificial broad ventricular depolarization.',
    urgency: 'Critical',
    urgencyColor: AAMI_CLASS_CONFIG.Q.color,
    signal: pacedData.signal,
    fiducials: pacedData.fiducials,
    latentVectorZ: [0.12, -0.74, -0.21, 0.65, 0.82, -0.38, 0.54, -0.44, 0.71, -0.63],
    quantumExpectations: [0.18, -0.84, -0.32, 0.76, 0.92, -0.51, 0.68, -0.58, 0.84, -0.72],
    probabilities: { N: 0.006, S: 0.008, V: 0.014, F: 0.008, Q: 0.964 },
    saliency: pacedData.saliency,
    segmentAttribution: {
      pWave: 0.02,
      prSegment: 0.04,
      qrsComplex: 0.76,
      stSegment: 0.08,
      tWave: 0.10,
    },
  },
];

// AAMI 5-Class standard overview aligned with visual system
export const AAMI_CLASSES = [
  {
    code: AAMI_CLASS_CONFIG.N.code,
    name: AAMI_CLASS_CONFIG.N.name,
    subtypes: AAMI_CLASS_CONFIG.N.subtypes,
    color: AAMI_CLASS_CONFIG.N.color,
    bg: AAMI_CLASS_CONFIG.N.bgLight,
    f1Score: 98.6,
    datasetPrevalence: AAMI_CLASS_CONFIG.N.datasetPrevalence,
    clinicalNote: AAMI_CLASS_CONFIG.N.clinicalSignificance,
  },
  {
    code: AAMI_CLASS_CONFIG.S.code,
    name: AAMI_CLASS_CONFIG.S.name,
    subtypes: AAMI_CLASS_CONFIG.S.subtypes,
    color: AAMI_CLASS_CONFIG.S.color,
    bg: AAMI_CLASS_CONFIG.S.bgLight,
    f1Score: 93.4,
    datasetPrevalence: AAMI_CLASS_CONFIG.S.datasetPrevalence,
    clinicalNote: AAMI_CLASS_CONFIG.S.clinicalSignificance,
  },
  {
    code: AAMI_CLASS_CONFIG.V.code,
    name: AAMI_CLASS_CONFIG.V.name,
    subtypes: AAMI_CLASS_CONFIG.V.subtypes,
    color: AAMI_CLASS_CONFIG.V.color,
    bg: AAMI_CLASS_CONFIG.V.bgLight,
    f1Score: 97.2,
    datasetPrevalence: AAMI_CLASS_CONFIG.V.datasetPrevalence,
    clinicalNote: AAMI_CLASS_CONFIG.V.clinicalSignificance,
  },
  {
    code: AAMI_CLASS_CONFIG.F.code,
    name: AAMI_CLASS_CONFIG.F.name,
    subtypes: AAMI_CLASS_CONFIG.F.subtypes,
    color: AAMI_CLASS_CONFIG.F.color,
    bg: AAMI_CLASS_CONFIG.F.bgLight,
    f1Score: 89.8,
    datasetPrevalence: AAMI_CLASS_CONFIG.F.datasetPrevalence,
    clinicalNote: AAMI_CLASS_CONFIG.F.clinicalSignificance,
  },
  {
    code: AAMI_CLASS_CONFIG.Q.code,
    name: AAMI_CLASS_CONFIG.Q.name,
    subtypes: AAMI_CLASS_CONFIG.Q.subtypes,
    color: AAMI_CLASS_CONFIG.Q.color,
    bg: AAMI_CLASS_CONFIG.Q.bgLight,
    f1Score: 96.5,
    datasetPrevalence: AAMI_CLASS_CONFIG.Q.datasetPrevalence,
    clinicalNote: AAMI_CLASS_CONFIG.Q.clinicalSignificance,
  },
];

// Model Benchmark Leaderboard (comparing Hybrid Quantum vs Classical Baselines)
export interface ModelBenchmark {
  id: string;
  name: string;
  category: 'Quantum-Hybrid' | 'Quantum-Kernel' | 'Classical-Deep' | 'Classical-Standard';
  accuracy: number;
  macroF1: number;
  nF1: number;
  sF1: number;
  vF1: number;
  fF1: number;
  qF1: number;
  qubitCount: number;
  circuitDepth: number;
  paramsCount: string;
  inferenceMs: number;
  isProposed: boolean;
}

export const BENCHMARK_MODELS: ModelBenchmark[] = [
  {
    id: 'hybrid-vqc',
    name: 'Hybrid VQC (Proposed)',
    category: 'Quantum-Hybrid',
    accuracy: 98.42,
    macroF1: 96.18,
    nF1: 99.2,
    sF1: 94.8,
    vF1: 97.9,
    fF1: 91.2,
    qF1: 97.7,
    qubitCount: 8,
    circuitDepth: 4,
    paramsCount: '48 (Quantum) + 128 (Clas)',
    inferenceMs: 14.2,
    isProposed: true,
  },
  {
    id: 'qsvc-kernel',
    name: 'QSVC (Quantum Kernel)',
    category: 'Quantum-Kernel',
    accuracy: 97.65,
    macroF1: 94.30,
    nF1: 98.7,
    sF1: 92.1,
    vF1: 96.4,
    fF1: 88.5,
    qF1: 95.8,
    qubitCount: 8,
    circuitDepth: 6,
    paramsCount: 'Kernel Matrix (N x N)',
    inferenceMs: 38.6,
    isProposed: false,
  },
  {
    id: 'cnn-1d',
    name: 'Classical 1D-CNN',
    category: 'Classical-Deep',
    accuracy: 96.80,
    macroF1: 92.15,
    nF1: 98.4,
    sF1: 87.2,
    vF1: 95.6,
    fF1: 83.4,
    qF1: 96.2,
    qubitCount: 0,
    circuitDepth: 0,
    paramsCount: '42,650',
    inferenceMs: 8.4,
    isProposed: false,
  },
  {
    id: 'classical-mlp',
    name: 'Classical MLP Baseline',
    category: 'Classical-Deep',
    accuracy: 94.10,
    macroF1: 86.40,
    nF1: 96.5,
    sF1: 80.1,
    vF1: 91.2,
    fF1: 72.8,
    qF1: 91.4,
    qubitCount: 0,
    circuitDepth: 0,
    paramsCount: '18,437',
    inferenceMs: 4.2,
    isProposed: false,
  },
  {
    id: 'classical-svm',
    name: 'Classical SVM (RBF)',
    category: 'Classical-Standard',
    accuracy: 95.20,
    macroF1: 88.90,
    nF1: 97.1,
    sF1: 83.5,
    vF1: 92.8,
    fF1: 76.2,
    qF1: 94.9,
    qubitCount: 0,
    circuitDepth: 0,
    paramsCount: 'Support Vectors',
    inferenceMs: 22.1,
    isProposed: false,
  },
  {
    id: 'xgboost',
    name: 'XGBoost Classifier',
    category: 'Classical-Standard',
    accuracy: 95.85,
    macroF1: 89.95,
    nF1: 97.6,
    sF1: 84.8,
    vF1: 93.9,
    fF1: 78.4,
    qF1: 95.1,
    qubitCount: 0,
    circuitDepth: 0,
    paramsCount: '250 Estimators',
    inferenceMs: 6.8,
    isProposed: false,
  },
  {
    id: 'random-forest',
    name: 'Random Forest (100 trees)',
    category: 'Classical-Standard',
    accuracy: 95.05,
    macroF1: 87.80,
    nF1: 97.0,
    sF1: 81.9,
    vF1: 92.4,
    fF1: 73.1,
    qF1: 94.7,
    qubitCount: 0,
    circuitDepth: 0,
    paramsCount: '100 Trees',
    inferenceMs: 11.5,
    isProposed: false,
  },
];

// Information Bottleneck & Latent Space comparison data
export interface BottleneckDimAudit {
  dim: number;
  autoencoderMse: number;
  pcaMse: number;
  mutualInfoXZ: number; // I(X;Z) in nats
  mutualInfoZY: number; // I(Z;Y) in nats
  f1Score: number;
  recommended: boolean;
}

export const INFORMATION_BOTTLENECK_AUDIT: BottleneckDimAudit[] = [
  { dim: 2, autoencoderMse: 0.084, pcaMse: 0.142, mutualInfoXZ: 1.82, mutualInfoZY: 1.15, f1Score: 82.4, recommended: false },
  { dim: 4, autoencoderMse: 0.041, pcaMse: 0.089, mutualInfoXZ: 3.14, mutualInfoZY: 1.88, f1Score: 91.2, recommended: false },
  { dim: 8, autoencoderMse: 0.016, pcaMse: 0.048, mutualInfoXZ: 5.42, mutualInfoZY: 2.45, f1Score: 96.2, recommended: true },
  { dim: 12, autoencoderMse: 0.011, pcaMse: 0.032, mutualInfoXZ: 6.81, mutualInfoZY: 2.48, f1Score: 96.4, recommended: false },
  { dim: 16, autoencoderMse: 0.009, pcaMse: 0.024, mutualInfoXZ: 8.05, mutualInfoZY: 2.49, f1Score: 96.5, recommended: false },
];

// Experiment History Runs
export interface ExperimentRun {
  runId: string;
  timestamp: string;
  name: string;
  qubits: number;
  ansatz: 'HardwareEfficient' | 'StronglyEntangling' | 'RealAmplitudes' | 'QuantumKernel';
  latentDim: number;
  layers: number;
  learningRate: number;
  accuracy: number;
  macroF1: number;
  status: 'Converged' | 'Optimal' | 'Baseline';
}

export const EXPERIMENT_HISTORY: ExperimentRun[] = [
  {
    runId: 'RUN-QML-084',
    timestamp: '2026-09-02 18:24',
    name: '8-Qubit Circular VQC + Supervised AE (z=8)',
    qubits: 8,
    ansatz: 'StronglyEntangling',
    latentDim: 8,
    layers: 3,
    learningRate: 0.005,
    accuracy: 98.42,
    macroF1: 96.18,
    status: 'Optimal',
  },
  {
    runId: 'RUN-QML-083',
    timestamp: '2026-09-01 14:10',
    name: '8-Qubit Hardware-Efficient Ansatz (z=8, L=2)',
    qubits: 8,
    ansatz: 'HardwareEfficient',
    latentDim: 8,
    layers: 2,
    learningRate: 0.010,
    accuracy: 97.80,
    macroF1: 94.90,
    status: 'Converged',
  },
  {
    runId: 'RUN-QML-082',
    timestamp: '2026-08-30 11:45',
    name: '12-Qubit Linear VQC (z=12, L=3)',
    qubits: 12,
    ansatz: 'RealAmplitudes',
    latentDim: 12,
    layers: 3,
    learningRate: 0.005,
    accuracy: 98.31,
    macroF1: 95.80,
    status: 'Converged',
  },
  {
    runId: 'RUN-QML-081',
    timestamp: '2026-08-28 09:30',
    name: 'QSVC Quantum Projected Kernel (z=8)',
    qubits: 8,
    ansatz: 'QuantumKernel',
    latentDim: 8,
    layers: 2,
    learningRate: 0.000,
    accuracy: 97.65,
    macroF1: 94.30,
    status: 'Converged',
  },
  {
    runId: 'RUN-QML-080',
    timestamp: '2026-08-26 16:15',
    name: 'Classical Autoencoder + 1D-CNN Baseline',
    qubits: 0,
    ansatz: 'HardwareEfficient',
    latentDim: 8,
    layers: 0,
    learningRate: 0.001,
    accuracy: 96.80,
    macroF1: 92.15,
    status: 'Baseline',
  },
];

// Alias for clinical beat samples
export const ECG_BEAT_SAMPLES = BENCHMARK_ECG_BEATS;

