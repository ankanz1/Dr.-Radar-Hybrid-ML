import { AamiClassCode } from './aamiClassSystem';

export interface ReproducibilityInfo {
  seed: number;
  datasetSplit: string;
  backend: string;
  runTimestamp: string;
  frameworkVersions: {
    python: string;
    qiskit?: string;
    pennylane?: string;
    pytorch: string;
    numpy: string;
  };
  gitCommitHash: string;
  hardwareDevice: string;
  deterministicMode: boolean;
}

export interface ExperimentMetricItem {
  classCode: AamiClassCode;
  className: string;
  support: number;
  precision: number;
  sensitivity: number; // Recall
  specificity: number;
  f1Score: number;
}

export interface ExperimentRecord {
  id: string;
  dataset: string;
  datasetFullName: string;
  encoder: string;
  encoderType: 'Supervised AE' | 'CNN 1D' | 'PCA-Whiten' | 'Raw Amplitude' | 'Dense AE';
  qubits: number | null; // null or 0 for classical
  circuitDepth: number | null; // null for classical
  model: string;
  modelType: 'VQC' | 'QSVC' | 'MLP' | '1D CNN' | 'RBF-SVM' | 'XGBoost';
  macroF1: number;
  accuracy: number;
  latencyMs: number;
  status: 'Completed' | 'In Progress' | 'Failed' | 'Queued';
  date: string;
  description: string;
  reproducibility: ReproducibilityInfo;

  // Detail sections
  configuration: {
    ansatz?: string;
    entanglementTopology?: string;
    measurementOperators?: string;
    inputScaling?: string;
    parameterCount: number;
    initializationMethod: string;
    learningRate: number;
    batchSize: number;
    epochs: number;
  };
  encoderDetails: {
    architecture: string;
    inputDim: number;
    latentDim: number;
    reconstructionMse: number | null;
    latentVarianceExplained?: string;
    layerSummary: string[];
  };
  quantumCircuitDetails?: {
    singleQubitGates: number;
    twoQubitGates: number;
    totalGates: number;
    depth: number;
    qubitWires: number;
    ansatzFamily: string;
    gradientMethod: string;
  };
  trainingDetails: {
    lossFunction: string;
    optimizer: string;
    scheduler: string;
    convergenceEpoch: number;
    finalTrainLoss: number;
    finalValLoss: number;
    gradientNormAvg: number;
    trainingTimeSec: number;
  };
  metrics: {
    macroF1: number;
    accuracy: number;
    macroPrecision: number;
    macroRecall: number;
    perClass: ExperimentMetricItem[];
  };
  predictionSample: {
    sampleId: string;
    lead: string;
    groundTruth: AamiClassCode;
    predictedClass: AamiClassCode;
    confidence: number;
    probabilities: { code: AamiClassCode; prob: number }[];
  };
  explainability: {
    attributionMethod: string;
    dominantRegion: string;
    qrsAttributionPct: number;
    topLatentFeatures: { feature: string; importance: number; direction: 'positive' | 'negative' }[];
    backProjectionVerified: boolean;
    clinicalAlignmentNote: string;
  };
  benchmarkComparison: {
    deltaMacroF1VsMLP: number | null;
    pValSignificance: string;
    parameterComparison: string;
    quantumAdvantageClaim: string;
  };
}

export const EXPERIMENTS_DATABASE: ExperimentRecord[] = [
  {
    id: 'EXP-024',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2 Benchmark)',
    encoder: 'Supervised AE',
    encoderType: 'Supervised AE',
    qubits: 10,
    circuitDepth: 4,
    model: 'VQC',
    modelType: 'VQC',
    macroF1: 0.918,
    accuracy: 0.946,
    latencyMs: 4.8,
    status: 'Completed',
    date: '2026-09-02',
    description: '10-Qubit Variational Quantum Classifier with 4-layer StronglyEntangling ansatz on Supervised Autoencoder latents.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train (50%) + DS1 Val (10%) / DS2 Inter-Patient Test (40%)',
      backend: 'PennyLane default.qubit (Statevector Analytic)',
      runTimestamp: '2026-09-02T14:32:08Z',
      frameworkVersions: {
        python: '3.11.8',
        pennylane: '0.36.0',
        qiskit: '1.1.0',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: 'e8a4d7b (tag: v1.4-vqc-eval)',
      hardwareDevice: 'Simulated (Analytic CPU Vectorized)',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'StronglyEntanglingLayers (PennyLane template)',
      entanglementTopology: 'Periodic / Circular CNOT Ladder',
      measurementOperators: 'Local Pauli-Z on all 10 wires (⟨Z₁⟩..⟨Z₁₀⟩)',
      inputScaling: 'Angle encoding with arctan(zᵢ) · π mapping',
      parameterCount: 90, // 80 rotation angles + 10 weight scale parameters
      initializationMethod: 'Normal distribution N(0, 0.05) to avoid barren plateaus',
      learningRate: 0.01,
      batchSize: 64,
      epochs: 50,
    },
    encoderDetails: {
      architecture: '1D Convolutional Supervised Autoencoder',
      inputDim: 187,
      latentDim: 10,
      reconstructionMse: 0.0028,
      latentVarianceExplained: '94.6%',
      layerSummary: [
        'Conv1D(1, 16, kernel_size=5, stride=2, padding=2) + BatchNorm1D + GELU',
        'Conv1D(16, 32, kernel_size=5, stride=2, padding=2) + BatchNorm1D + GELU',
        'Conv1D(32, 64, kernel_size=5, stride=2, padding=2) + BatchNorm1D + GELU',
        'Flatten (64 × 24 = 1536) -> Linear(1536, 10) -> Latent z ∈ ℝ¹⁰',
        'Decoder: ConvTranspose1D symmetrical expansion back to 187 samples',
      ],
    },
    quantumCircuitDetails: {
      singleQubitGates: 80,
      twoQubitGates: 36,
      totalGates: 116,
      depth: 4,
      qubitWires: 10,
      ansatzFamily: 'StronglyEntanglingLayers',
      gradientMethod: 'Analytic Adjoint Differentiation',
    },
    trainingDetails: {
      lossFunction: 'Weighted Categorical Cross-Entropy (Class balanced for AAMI imbalance)',
      optimizer: 'Adam (β₁=0.9, β₂=0.999, ε=1e-8)',
      scheduler: 'CosineAnnealingLR (T_max=50, η_min=1e-4)',
      convergenceEpoch: 38,
      finalTrainLoss: 0.142,
      finalValLoss: 0.188,
      gradientNormAvg: 0.041,
      trainingTimeSec: 428.5,
    },
    metrics: {
      macroF1: 0.918,
      accuracy: 0.946,
      macroPrecision: 0.925,
      macroRecall: 0.912,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.978, sensitivity: 0.985, specificity: 0.942, f1Score: 0.981 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.884, sensitivity: 0.842, specificity: 0.989, f1Score: 0.862 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.942, sensitivity: 0.951, specificity: 0.988, f1Score: 0.946 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.865, sensitivity: 0.835, specificity: 0.995, f1Score: 0.850 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.958, sensitivity: 0.946, specificity: 0.992, f1Score: 0.952 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II (250Hz)',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.942,
      probabilities: [
        { code: 'N', prob: 0.021 },
        { code: 'S', prob: 0.024 },
        { code: 'V', prob: 0.942 },
        { code: 'F', prob: 0.009 },
        { code: 'Q', prob: 0.004 },
      ],
    },
    explainability: {
      attributionMethod: 'Integrated Gradients + Parameter Shift Saliency',
      dominantRegion: 'QRS complex (samples 75-115)',
      qrsAttributionPct: 68.4,
      topLatentFeatures: [
        { feature: 'z₃ (Width & Depolarization)', importance: 0.284, direction: 'positive' },
        { feature: 'z₇ (Repolarization Discordance)', importance: 0.211, direction: 'positive' },
        { feature: 'z₁ (Primary Baseline Amplitude)', importance: 0.163, direction: 'positive' },
        { feature: 'z₅ (ST Segment Gradient)', importance: 0.118, direction: 'negative' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: 'Attribution aligns with classic PVC broad monophasic wavefront with inverted T-wave discordance.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.034, // +3.4% vs matched MLP
      pValSignificance: 'p = 0.0042 (Wilcoxon signed-rank across 5-fold CV)',
      parameterComparison: 'VQC uses 90 params vs MLP 1,040 params (11.5x parameter efficiency)',
      quantumAdvantageClaim: 'Demonstrates improved minority-class boundary separation (F and S classes) in Hilbert space under matched parameter constraints.',
    },
  },
  {
    id: 'EXP-023',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2)',
    encoder: 'Supervised AE',
    encoderType: 'Supervised AE',
    qubits: 8,
    circuitDepth: 2,
    model: 'QSVC',
    modelType: 'QSVC',
    macroF1: 0.907,
    accuracy: 0.934,
    latencyMs: 18.2,
    status: 'Completed',
    date: '2026-08-30',
    description: 'Quantum Support Vector Classifier utilizing ZZ-FeatureMap quantum kernel on 8 compressed autoencoder features.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train / DS2 Inter-Patient Test',
      backend: 'Qiskit AerSimulator (Statevector)',
      runTimestamp: '2026-08-30T19:15:42Z',
      frameworkVersions: {
        python: '3.11.8',
        qiskit: '1.1.0',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: 'b492f10 (tag: v1.3-qsvc-kernel)',
      hardwareDevice: 'Simulated (Analytic CPU Vectorized)',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'ZZFeatureMap (reps=2, linear entanglement)',
      entanglementTopology: 'Linear nearest-neighbor',
      measurementOperators: 'Fidelity |⟨ψ(x)|ψ(x\')⟩|² kernel evaluation',
      inputScaling: 'Linear min-max normalization [0, 2π]',
      parameterCount: 0, // Non-parametric quantum kernel + dual coefficients
      initializationMethod: 'Fixed quantum feature map without variational training',
      learningRate: 0.001,
      batchSize: 128,
      epochs: 30,
    },
    encoderDetails: {
      architecture: '1D Convolutional Autoencoder (8D latent space)',
      inputDim: 187,
      latentDim: 8,
      reconstructionMse: 0.0034,
      latentVarianceExplained: '92.1%',
      layerSummary: [
        'Conv1D(1, 16, k=5, s=2) + Conv1D(16, 32, k=5, s=2)',
        'Linear(1536, 8) -> Latent z ∈ ℝ⁸',
      ],
    },
    quantumCircuitDetails: {
      singleQubitGates: 32,
      twoQubitGates: 14,
      totalGates: 46,
      depth: 2,
      qubitWires: 8,
      ansatzFamily: 'ZZFeatureMap',
      gradientMethod: 'N/A (Kernel Matrix Computation)',
    },
    trainingDetails: {
      lossFunction: 'Dual quadratic programming SVM objective',
      optimizer: 'SMO (Sequential Minimal Optimization)',
      scheduler: 'N/A',
      convergenceEpoch: 24,
      finalTrainLoss: 0.185,
      finalValLoss: 0.210,
      gradientNormAvg: 0.025,
      trainingTimeSec: 890.2,
    },
    metrics: {
      macroF1: 0.907,
      accuracy: 0.934,
      macroPrecision: 0.912,
      macroRecall: 0.903,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.971, sensitivity: 0.979, specificity: 0.938, f1Score: 0.975 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.865, sensitivity: 0.821, specificity: 0.984, f1Score: 0.842 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.931, sensitivity: 0.942, specificity: 0.985, f1Score: 0.936 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.832, sensitivity: 0.812, specificity: 0.993, f1Score: 0.822 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.948, sensitivity: 0.939, specificity: 0.990, f1Score: 0.943 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.928,
      probabilities: [
        { code: 'N', prob: 0.032 },
        { code: 'S', prob: 0.031 },
        { code: 'V', prob: 0.928 },
        { code: 'F', prob: 0.007 },
        { code: 'Q', prob: 0.002 },
      ],
    },
    explainability: {
      attributionMethod: 'Kernel PCA Projection',
      dominantRegion: 'QRS complex',
      qrsAttributionPct: 62.1,
      topLatentFeatures: [
        { feature: 'z₂ (Wavefront Energy)', importance: 0.251, direction: 'positive' },
        { feature: 'z₄ (Conduction Velocity)', importance: 0.203, direction: 'positive' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: 'Kernel distance captures nonlinear ectopic morphology separation effectively.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.023,
      pValSignificance: 'p = 0.018',
      parameterComparison: 'Kernel-based non-parametric model (high memory during test time)',
      quantumAdvantageClaim: 'Higher sample efficiency on small subsets; computational bottleneck during quadratic kernel scaling.',
    },
  },
  {
    id: 'EXP-021',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2)',
    encoder: 'Raw Amplitude',
    encoderType: 'Raw Amplitude',
    qubits: null,
    circuitDepth: null,
    model: '1D CNN',
    modelType: '1D CNN',
    macroF1: 0.904,
    accuracy: 0.938,
    latencyMs: 1.8,
    status: 'Completed',
    date: '2026-08-27',
    description: 'Classical deep 1D Convolutional Neural Network baseline trained directly on full 187-sample raw ECG heartbeats.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train (60%) / DS2 Inter-Patient Test (40%)',
      backend: 'PyTorch CUDA / CPU Native',
      runTimestamp: '2026-08-27T11:08:19Z',
      frameworkVersions: {
        python: '3.11.8',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: '9a31bc4 (tag: v1.2-cnn-baseline)',
      hardwareDevice: 'NVIDIA T4 / CPU FP32',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'N/A (Classical 1D Convolutional Network)',
      entanglementTopology: 'N/A',
      measurementOperators: 'Softmax output layer (5 units)',
      inputScaling: 'Standard Z-score normalization per beat',
      parameterCount: 14850,
      initializationMethod: 'Kaiming Normal',
      learningRate: 0.001,
      batchSize: 64,
      epochs: 45,
    },
    encoderDetails: {
      architecture: 'Direct 187-sample raw feedforward convolutional layers',
      inputDim: 187,
      latentDim: 187,
      reconstructionMse: null,
      layerSummary: [
        'Conv1D(1, 32, k=5) + MaxPool(2) + Dropout(0.2)',
        'Conv1D(32, 64, k=5) + MaxPool(2) + Dropout(0.2)',
        'Conv1D(64, 128, k=3) + GlobalAvgPool',
        'Dense(128, 64) -> Dense(64, 5)',
      ],
    },
    trainingDetails: {
      lossFunction: 'Weighted Cross Entropy',
      optimizer: 'AdamW (lr=1e-3, weight_decay=1e-4)',
      scheduler: 'ReduceLROnPlateau(patience=3)',
      convergenceEpoch: 34,
      finalTrainLoss: 0.118,
      finalValLoss: 0.165,
      gradientNormAvg: 0.120,
      trainingTimeSec: 142.0,
    },
    metrics: {
      macroF1: 0.904,
      accuracy: 0.938,
      macroPrecision: 0.910,
      macroRecall: 0.899,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.973, sensitivity: 0.980, specificity: 0.940, f1Score: 0.976 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.852, sensitivity: 0.819, specificity: 0.982, f1Score: 0.835 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.925, sensitivity: 0.941, specificity: 0.984, f1Score: 0.933 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.821, sensitivity: 0.801, specificity: 0.991, f1Score: 0.811 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.950, sensitivity: 0.938, specificity: 0.991, f1Score: 0.944 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.915,
      probabilities: [
        { code: 'N', prob: 0.041 },
        { code: 'S', prob: 0.033 },
        { code: 'V', prob: 0.915 },
        { code: 'F', prob: 0.008 },
        { code: 'Q', prob: 0.003 },
      ],
    },
    explainability: {
      attributionMethod: 'Grad-CAM 1D',
      dominantRegion: 'QRS complex',
      qrsAttributionPct: 64.2,
      topLatentFeatures: [
        { feature: 'Conv_Filter_38 (Peak R-wave detector)', importance: 0.312, direction: 'positive' },
        { feature: 'Conv_Filter_14 (S-T Slope)', importance: 0.185, direction: 'positive' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: 'Filters detect high-frequency QRS transitions and low-frequency T-wave morphology.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.020,
      pValSignificance: 'p = 0.022',
      parameterComparison: '14,850 classical parameters vs 90 VQC parameters (165x more parameters)',
      quantumAdvantageClaim: 'VQC (+1.4% F1) matches or slightly exceeds 1D CNN while operating on 10 compressed latent features.',
    },
  },
  {
    id: 'EXP-020',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2)',
    encoder: 'Supervised AE',
    encoderType: 'Supervised AE',
    qubits: null,
    circuitDepth: null,
    model: 'MLP',
    modelType: 'MLP',
    macroF1: 0.884,
    accuracy: 0.919,
    latencyMs: 0.6,
    status: 'Completed',
    date: '2026-08-22',
    description: 'Parameter-matched classical Multi-Layer Perceptron trained on the identical 10D Supervised AE latents.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train / DS2 Inter-Patient Test (Strictly Matched)',
      backend: 'PyTorch Native Classical',
      runTimestamp: '2026-08-22T09:41:02Z',
      frameworkVersions: {
        python: '3.11.8',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: '6f18cc3 (tag: v1.1-mlp-matched)',
      hardwareDevice: 'CPU Native FP32',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'N/A (Classical Feed-Forward MLP)',
      entanglementTopology: 'N/A',
      measurementOperators: 'Softmax 5-class logits',
      inputScaling: 'Latent z ∈ ℝ¹⁰',
      parameterCount: 1040, // 10 -> 48 -> 16 -> 5
      initializationMethod: 'He Normal',
      learningRate: 0.01,
      batchSize: 64,
      epochs: 50,
    },
    encoderDetails: {
      architecture: '1D Convolutional Supervised Autoencoder (Identical to EXP-024)',
      inputDim: 187,
      latentDim: 10,
      reconstructionMse: 0.0028,
      latentVarianceExplained: '94.6%',
      layerSummary: [
        'Identical frozen encoder from EXP-024',
        'Input: Latent vector z ∈ ℝ¹⁰',
      ],
    },
    trainingDetails: {
      lossFunction: 'Weighted Categorical Cross-Entropy (identical weights)',
      optimizer: 'Adam (lr=1e-2)',
      scheduler: 'CosineAnnealingLR',
      convergenceEpoch: 41,
      finalTrainLoss: 0.178,
      finalValLoss: 0.224,
      gradientNormAvg: 0.038,
      trainingTimeSec: 48.2,
    },
    metrics: {
      macroF1: 0.884,
      accuracy: 0.919,
      macroPrecision: 0.892,
      macroRecall: 0.878,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.962, sensitivity: 0.971, specificity: 0.925, f1Score: 0.966 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.814, sensitivity: 0.772, specificity: 0.978, f1Score: 0.792 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.902, sensitivity: 0.921, specificity: 0.979, f1Score: 0.911 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.784, sensitivity: 0.762, specificity: 0.988, f1Score: 0.773 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.928, sensitivity: 0.915, specificity: 0.987, f1Score: 0.921 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.889,
      probabilities: [
        { code: 'N', prob: 0.052 },
        { code: 'S', prob: 0.048 },
        { code: 'V', prob: 0.889 },
        { code: 'F', prob: 0.008 },
        { code: 'Q', prob: 0.003 },
      ],
    },
    explainability: {
      attributionMethod: 'Saliency Back-propagation',
      dominantRegion: 'QRS complex',
      qrsAttributionPct: 58.6,
      topLatentFeatures: [
        { feature: 'z₃', importance: 0.245, direction: 'positive' },
        { feature: 'z₇', importance: 0.188, direction: 'positive' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: 'MLP exhibits weaker decision boundaries on boundary cases (Fusion & Supraventricular).',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.0,
      pValSignificance: 'Baseline reference model',
      parameterComparison: '1,040 parameters (approx. 11.5x larger than VQC 90 params)',
      quantumAdvantageClaim: 'Direct control comparison: VQC achieves +3.4% higher Macro-F1 using fewer parameters on identical input representations.',
    },
  },
  {
    id: 'EXP-025',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2 Benchmark)',
    encoder: 'Supervised AE',
    encoderType: 'Supervised AE',
    qubits: 12,
    circuitDepth: 6,
    model: 'VQC',
    modelType: 'VQC',
    macroF1: 0.921,
    accuracy: 0.949,
    latencyMs: 9.4,
    status: 'Completed',
    date: '2026-09-03',
    description: 'High-capacity 12-Qubit, 6-layer deep quantum variational architecture evaluating expressibility scaling.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train / DS2 Inter-Patient Test',
      backend: 'PennyLane default.qubit (Analytic Statevector)',
      runTimestamp: '2026-09-03T18:04:31Z',
      frameworkVersions: {
        python: '3.11.8',
        pennylane: '0.36.0',
        qiskit: '1.1.0',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: 'd28a410 (tag: v1.5-depth6-eval)',
      hardwareDevice: 'Simulated (Analytic CPU Vectorized)',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'StronglyEntanglingLayers (6 layers)',
      entanglementTopology: 'All-to-all entangling ring',
      measurementOperators: 'Local Pauli-Z on all 12 wires',
      inputScaling: 'Arctan angle embedding',
      parameterCount: 156, // 144 rotation angles + 12 measurement scales
      initializationMethod: 'Normal N(0, 0.02) with layer-dependent scaling',
      learningRate: 0.008,
      batchSize: 64,
      epochs: 60,
    },
    encoderDetails: {
      architecture: '1D Convolutional Supervised AE (12D latent space)',
      inputDim: 187,
      latentDim: 12,
      reconstructionMse: 0.0024,
      latentVarianceExplained: '96.2%',
      layerSummary: [
        'Conv1D(1, 16, k=5, s=2) -> Conv1D(16, 32, k=5, s=2) -> Conv1D(32, 64, k=5, s=2)',
        'Linear(1536, 12) -> Latent z ∈ ℝ¹²',
      ],
    },
    quantumCircuitDetails: {
      singleQubitGates: 144,
      twoQubitGates: 66,
      totalGates: 210,
      depth: 6,
      qubitWires: 12,
      ansatzFamily: 'StronglyEntanglingLayers',
      gradientMethod: 'Adjoint Differentiation',
    },
    trainingDetails: {
      lossFunction: 'Weighted Categorical Cross-Entropy',
      optimizer: 'Adam (lr=8e-3)',
      scheduler: 'CosineAnnealingLR',
      convergenceEpoch: 46,
      finalTrainLoss: 0.129,
      finalValLoss: 0.174,
      gradientNormAvg: 0.034,
      trainingTimeSec: 1140.8,
    },
    metrics: {
      macroF1: 0.921,
      accuracy: 0.949,
      macroPrecision: 0.928,
      macroRecall: 0.915,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.980, sensitivity: 0.987, specificity: 0.945, f1Score: 0.983 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.891, sensitivity: 0.850, specificity: 0.990, f1Score: 0.870 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.948, sensitivity: 0.954, specificity: 0.990, f1Score: 0.951 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.871, sensitivity: 0.841, specificity: 0.996, f1Score: 0.856 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.961, sensitivity: 0.950, specificity: 0.993, f1Score: 0.955 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.951,
      probabilities: [
        { code: 'N', prob: 0.018 },
        { code: 'S', prob: 0.019 },
        { code: 'V', prob: 0.951 },
        { code: 'F', prob: 0.008 },
        { code: 'Q', prob: 0.004 },
      ],
    },
    explainability: {
      attributionMethod: 'Integrated Gradients on 12 Qubit Wires',
      dominantRegion: 'QRS complex & ST junction',
      qrsAttributionPct: 71.2,
      topLatentFeatures: [
        { feature: 'z₅ (QRS Peak & Duration)', importance: 0.292, direction: 'positive' },
        { feature: 'z₈ (Repolarization Amplitude)', importance: 0.224, direction: 'positive' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: '12-qubit expansion captures fine repolarization morphology nuances in ST segment.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.037,
      pValSignificance: 'p = 0.0028',
      parameterComparison: '156 parameters vs classical models with 10k+ params',
      quantumAdvantageClaim: 'Highest overall Macro-F1 in benchmark suite with slight increase in simulation latency (9.4ms).',
    },
  },
  {
    id: 'EXP-022',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2)',
    encoder: 'PCA-Whiten',
    encoderType: 'PCA-Whiten',
    qubits: null,
    circuitDepth: null,
    model: 'RBF-SVM',
    modelType: 'RBF-SVM',
    macroF1: 0.892,
    accuracy: 0.921,
    latencyMs: 3.2,
    status: 'Completed',
    date: '2026-08-25',
    description: 'Classical Support Vector Machine with Radial Basis Function kernel trained on 10 PCA whitened features.',
    reproducibility: {
      seed: 42,
      datasetSplit: 'DS1 Train / DS2 Inter-Patient Test',
      backend: 'Scikit-Learn LibSVM',
      runTimestamp: '2026-08-25T16:20:00Z',
      frameworkVersions: {
        python: '3.11.8',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: '3c81e9f (tag: v1.1-rbf-svm)',
      hardwareDevice: 'CPU Single-Threaded LibSVM',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'N/A (Classical Kernel)',
      entanglementTopology: 'N/A',
      measurementOperators: 'Decision function sign / probability calibration via Platt scaling',
      inputScaling: 'PCA Whitening (10 principal components)',
      parameterCount: 2840, // Support vectors count
      initializationMethod: 'N/A',
      learningRate: 0.001,
      batchSize: 256,
      epochs: 20,
    },
    encoderDetails: {
      architecture: 'Principal Component Analysis (PCA) with whitening',
      inputDim: 187,
      latentDim: 10,
      reconstructionMse: 0.0082,
      latentVarianceExplained: '87.4%',
      layerSummary: ['Linear orthogonal projection onto top 10 eigenvectors of covariance matrix'],
    },
    trainingDetails: {
      lossFunction: 'Hinge Loss with L2 regularization (C=10.0, gamma=0.1)',
      optimizer: 'SMO LibSVM',
      scheduler: 'N/A',
      convergenceEpoch: 18,
      finalTrainLoss: 0.165,
      finalValLoss: 0.208,
      gradientNormAvg: 0.021,
      trainingTimeSec: 88.4,
    },
    metrics: {
      macroF1: 0.892,
      accuracy: 0.921,
      macroPrecision: 0.899,
      macroRecall: 0.886,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.965, sensitivity: 0.974, specificity: 0.930, f1Score: 0.969 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.825, sensitivity: 0.789, specificity: 0.980, f1Score: 0.807 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.912, sensitivity: 0.930, specificity: 0.981, f1Score: 0.921 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.801, sensitivity: 0.778, specificity: 0.990, f1Score: 0.789 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.938, sensitivity: 0.926, specificity: 0.988, f1Score: 0.932 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.902,
      probabilities: [
        { code: 'N', prob: 0.046 },
        { code: 'S', prob: 0.042 },
        { code: 'V', prob: 0.902 },
        { code: 'F', prob: 0.007 },
        { code: 'Q', prob: 0.003 },
      ],
    },
    explainability: {
      attributionMethod: 'Permutation Feature Importance',
      dominantRegion: 'PCA Component 1 & 3',
      qrsAttributionPct: 56.4,
      topLatentFeatures: [
        { feature: 'PC₁ (Overall Amplitude Variance)', importance: 0.261, direction: 'positive' },
        { feature: 'PC₃ (QRS Width Coefficient)', importance: 0.215, direction: 'positive' },
      ],
      backProjectionVerified: false,
      clinicalAlignmentNote: 'Linear PCA projection loses localized high-frequency morphologic features compared to AE.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.008,
      pValSignificance: 'p = 0.12 (not statistically significant vs MLP)',
      parameterComparison: '2,840 support vectors stored in memory',
      quantumAdvantageClaim: 'VQC achieves higher sensitivity on Fusion and Supraventricular classes than classical RBF-SVM.',
    },
  },
  {
    id: 'EXP-027',
    dataset: 'ECG Heartbeat Dataset',
    datasetFullName: 'MIT-BIH Arrhythmia Database (AAMI EC57 DS1/DS2)',
    encoder: 'Supervised AE',
    encoderType: 'Supervised AE',
    qubits: 10,
    circuitDepth: 4,
    model: 'VQC',
    modelType: 'VQC',
    macroF1: 0.912,
    accuracy: 0.941,
    latencyMs: 4.8,
    status: 'In Progress',
    date: '2026-09-04',
    description: 'Active ablation study: Comparing All-to-all CZ entanglement vs circular CNOT ladders on barren plateau mitigation.',
    reproducibility: {
      seed: 1337,
      datasetSplit: 'DS1 Train / DS2 Inter-Patient Test (Cross-Validation fold 3/5)',
      backend: 'PennyLane default.qubit (Active Job)',
      runTimestamp: '2026-09-04T07:12:44Z',
      frameworkVersions: {
        python: '3.11.8',
        pennylane: '0.36.0',
        pytorch: '2.3.0',
        numpy: '1.26.4',
      },
      gitCommitHash: 'f4019ab (branch: exp/cz-ablation)',
      hardwareDevice: 'Simulated (Analytic CPU)',
      deterministicMode: true,
    },
    configuration: {
      ansatz: 'CZ-Entangled Alternating Layer Ansatz',
      entanglementTopology: 'Star / All-to-all CZ Gates',
      measurementOperators: 'Local Pauli-Z on all 10 wires',
      inputScaling: 'Angle encoding with arctan(z)',
      parameterCount: 90,
      initializationMethod: 'Beta distribution initialization',
      learningRate: 0.01,
      batchSize: 64,
      epochs: 50,
    },
    encoderDetails: {
      architecture: 'Supervised 1D Convolutional Autoencoder',
      inputDim: 187,
      latentDim: 10,
      reconstructionMse: 0.0028,
      latentVarianceExplained: '94.6%',
      layerSummary: ['Supervised Autoencoder identical to EXP-024 benchmark specification'],
    },
    quantumCircuitDetails: {
      singleQubitGates: 80,
      twoQubitGates: 45,
      totalGates: 125,
      depth: 4,
      qubitWires: 10,
      ansatzFamily: 'CZ-Star Entangled Ansatz',
      gradientMethod: 'Adjoint Differentiation',
    },
    trainingDetails: {
      lossFunction: 'Weighted Categorical Cross-Entropy',
      optimizer: 'Adam (lr=1e-2)',
      scheduler: 'CosineAnnealingLR',
      convergenceEpoch: 28,
      finalTrainLoss: 0.158,
      finalValLoss: 0.199,
      gradientNormAvg: 0.044,
      trainingTimeSec: 284.0,
    },
    metrics: {
      macroF1: 0.912,
      accuracy: 0.941,
      macroPrecision: 0.918,
      macroRecall: 0.906,
      perClass: [
        { classCode: 'N', className: 'Normal', support: 18124, precision: 0.975, sensitivity: 0.982, specificity: 0.939, f1Score: 0.978 },
        { classCode: 'S', className: 'Supraventricular ectopic', support: 612, precision: 0.871, sensitivity: 0.831, specificity: 0.986, f1Score: 0.850 },
        { classCode: 'V', className: 'Ventricular ectopic', support: 1508, precision: 0.938, sensitivity: 0.947, specificity: 0.986, f1Score: 0.942 },
        { classCode: 'F', className: 'Fusion', support: 176, precision: 0.851, sensitivity: 0.824, specificity: 0.994, f1Score: 0.837 },
        { classCode: 'Q', className: 'Unknown/Paced', support: 1472, precision: 0.952, sensitivity: 0.941, specificity: 0.991, f1Score: 0.946 },
      ],
    },
    predictionSample: {
      sampleId: 'MIT-BIH #208 Record',
      lead: 'Lead II',
      groundTruth: 'V',
      predictedClass: 'V',
      confidence: 0.938,
      probabilities: [
        { code: 'N', prob: 0.024 },
        { code: 'S', prob: 0.026 },
        { code: 'V', prob: 0.938 },
        { code: 'F', prob: 0.008 },
        { code: 'Q', prob: 0.004 },
      ],
    },
    explainability: {
      attributionMethod: 'Parameter-Shift Gradient Saliency',
      dominantRegion: 'QRS complex',
      qrsAttributionPct: 67.1,
      topLatentFeatures: [
        { feature: 'z₃', importance: 0.276, direction: 'positive' },
        { feature: 'z₇', importance: 0.205, direction: 'positive' },
      ],
      backProjectionVerified: true,
      clinicalAlignmentNote: 'Evaluating whether CZ entanglement modifies latent feature alignment with ventricular wavefront.',
    },
    benchmarkComparison: {
      deltaMacroF1VsMLP: 0.028,
      pValSignificance: 'Run currently in progress (fold 3/5)',
      parameterComparison: '90 parameters',
      quantumAdvantageClaim: 'CZ topology maintains comparable accuracy with slightly reduced two-qubit crosstalk potential.',
    },
  },
];
