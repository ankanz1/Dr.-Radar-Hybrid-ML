import { useState, useEffect, useRef, useMemo } from 'react';
import { ECGBeatSample, BENCHMARK_ECG_BEATS } from '../data/ecgQuantumData';
import { AamiClassCode } from '../data/aamiClassSystem';
import { AamiClassBadge } from './AamiClassBadge';

export type PipelineStageId =
  | 'ecg-beat'
  | 'classical-encoder'
  | 'bottleneck'
  | 'quantum-encoding'
  | 'vqc'
  | 'measurement'
  | 'classical-head'
  | 'five-class-result'
  | 'explainability';

export interface PipelineStageInfo {
  id: PipelineStageId;
  index: number;
  label: string;
  sublabel: string;
  domain: 'classical-input' | 'classical-compression' | 'bottleneck' | 'quantum-state' | 'quantum-circuit' | 'quantum-readout' | 'classical-dense' | 'diagnostic-result' | 'interpretability';
  domainLabel: string;
  icon: string;
  dimensionBadge: string;
  accentColor: string;
  lightBg: string;
  borderColor: string;
  formula: string;
  description: string;
  sampleValueSummary: (sample?: ECGBeatSample) => string;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    id: 'ecg-beat',
    index: 0,
    label: 'ECG BEAT',
    sublabel: '187 dimensions',
    domain: 'classical-input',
    domainLabel: 'Classical Input',
    icon: 'ecg_heart',
    dimensionBadge: '187-D',
    accentColor: '#0369a1', // Sky blue
    lightBg: 'bg-sky-50/70',
    borderColor: 'border-sky-200',
    formula: 'x \\in \\mathbb{R}^{187}, \\quad f_s = 125\\text{ Hz}, \\quad \\Delta t = 8\\text{ ms}',
    description: 'Raw single-beat ECG time series window centered on R-peak (sample index 70), normalized in [0, 1].',
    sampleValueSummary: (s) => (s ? `187 samples (R-peak @ idx ${s.fiducials.rPeak}, QRS: ${s.fiducials.qrsDurationMs}ms)` : '187 normalized samples [0, 1]'),
  },
  {
    id: 'classical-encoder',
    index: 1,
    label: 'CLASSICAL ENCODER',
    sublabel: 'PCA / Supervised AE',
    domain: 'classical-compression',
    domainLabel: 'Classical Encoder',
    icon: 'compress',
    dimensionBadge: '187 → 10',
    accentColor: '#4338ca', // Indigo
    lightBg: 'bg-indigo-50/70',
    borderColor: 'border-indigo-200',
    formula: 'z = \\mathcal{E}_{\\phi}(x) = \\sigma(W_2 \\cdot \\text{ReLU}(W_1 x + b_1) + b_2)',
    description: 'Supervised 1D convolutional autoencoder & PCA projection with focal loss to preserve ectopic morphological nuances.',
    sampleValueSummary: () => 'Conv1D + Dense compression (Compression ratio: 18.7x)',
  },
  {
    id: 'bottleneck',
    index: 2,
    label: 'BOTTLENECK',
    sublabel: '8–12 dimensions',
    domain: 'bottleneck',
    domainLabel: 'Latent Space',
    icon: 'filter_alt',
    dimensionBadge: '10-D Latent',
    accentColor: '#0f766e', // Teal
    lightBg: 'bg-teal-50/70',
    borderColor: 'border-teal-200',
    formula: 'z \\in [-1, 1]^{10}, \\quad \\text{Reconstruction PSNR} = 38.4\\text{ dB}',
    description: 'Optimal low-dimensional latent manifold balancing information preservation with NISQ qubit register budget.',
    sampleValueSummary: (s) => (s ? `z = [${s.latentVectorZ.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}, ..., ${s.latentVectorZ[s.latentVectorZ.length - 1].toFixed(2)}]` : '10-dimensional latent vector z'),
  },
  {
    id: 'quantum-encoding',
    index: 3,
    label: 'QUANTUM ENCODING',
    sublabel: 'Angle Encoding',
    domain: 'quantum-state',
    domainLabel: 'Quantum State Prep',
    icon: 'transform',
    dimensionBadge: '|ψ(z)⟩',
    accentColor: '#6d28d9', // Violet
    lightBg: 'bg-violet-50/70',
    borderColor: 'border-violet-200',
    formula: '|\\psi(z)\\rangle = \\bigotimes_{i=1}^{10} R_y(z_i \\pi) |0\\rangle^{\\otimes 10}',
    description: 'Single-qubit parameterized rotations embedding normalized latent features as Hilbert space state vectors without depth overhead.',
    sampleValueSummary: () => '10 single-qubit Ry rotations on |0⟩^{\\otimes 10} state',
  },
  {
    id: 'vqc',
    index: 4,
    label: 'VQC',
    sublabel: 'Variational + Ring Entanglement',
    domain: 'quantum-circuit',
    domainLabel: 'Variational Circuit',
    icon: 'memory',
    dimensionBadge: '10-Qubit Ansatz',
    accentColor: '#7e22ce', // Purple
    lightBg: 'bg-purple-50/70',
    borderColor: 'border-purple-200',
    formula: 'U(\\vec{\\theta}) = \\prod_{l=1}^{L} \\left[ \\text{CNOT}_{\\text{ring}} \\cdot \\bigotimes_{i=1}^{10} R_y(\\theta_{l,i}) R_z(\\phi_{l,i}) \\right]',
    description: 'Hardware-efficient ansatz with nearest-neighbor ring entanglement creating non-local feature correlations across qubits.',
    sampleValueSummary: () => 'L=3 ansatz layers, 60 trainable variational parameters, 10 CNOTs/layer',
  },
  {
    id: 'measurement',
    index: 5,
    label: 'MEASUREMENT',
    sublabel: 'Z expectations',
    domain: 'quantum-readout',
    domainLabel: 'Observable Readout',
    icon: 'speed',
    dimensionBadge: '⟨Z_i⟩ ∈ [-1,1]',
    accentColor: '#0e7490', // Cyan
    lightBg: 'bg-cyan-50/70',
    borderColor: 'border-cyan-200',
    formula: '\\langle Z_i \\rangle = \\text{Tr}\\left( \\rho(\\vec{\\theta}) \\, \\sigma_z^{(i)} \\right) \\in [-1, 1], \\quad i = 1..10',
    description: 'Hermitian Pauli-Z expectation values sampled via 1024 shots on AerSimulator / IBM Quantum backend.',
    sampleValueSummary: (s) => (s ? `⟨Z⟩ = [${s.quantumExpectations.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}, ..., ${s.quantumExpectations[s.quantumExpectations.length - 1].toFixed(2)}]` : '10 Pauli-Z expectation observables'),
  },
  {
    id: 'classical-head',
    index: 6,
    label: 'CLASSICAL HEAD',
    sublabel: 'Softmax',
    domain: 'classical-dense',
    domainLabel: 'Classification Head',
    icon: 'psychology',
    dimensionBadge: '10 → 5',
    accentColor: '#047857', // Emerald
    lightBg: 'bg-emerald-50/70',
    borderColor: 'border-emerald-200',
    formula: 'p_k = \\frac{e^{W_k \\langle \\vec{Z} \\rangle + b_k}}{\\sum_{j=1}^{5} e^{W_j \\langle \\vec{Z} \\rangle + b_j}}, \\quad k \\in \\{N, S, V, F, Q\\}',
    description: 'Trainable linear projection layer mapping 10 quantum expectation values to normalized 5-class categorical probabilities.',
    sampleValueSummary: () => 'Linear dense layer (10 inputs → 5 logits) + Softmax activation',
  },
  {
    id: 'five-class-result',
    index: 7,
    label: '5-CLASS RESULT',
    sublabel: 'N / S / V / F / Q',
    domain: 'diagnostic-result',
    domainLabel: 'AAMI Prediction',
    icon: 'category',
    dimensionBadge: 'AAMI EC57',
    accentColor: '#bc000a', // Primary Crimson
    lightBg: 'bg-rose-50/70',
    borderColor: 'border-rose-200',
    formula: '\\hat{y} = \\arg\\max_{k} p_k, \\quad \\text{Confidence} = \\max(p) \\times 100\\%',
    description: 'Standardized AAMI EC57 arrhythmia triage categorizing heartbeat into Normal (N), Supraventricular (S), Ventricular (V), Fusion (F), or Unknown (Q).',
    sampleValueSummary: (s) => (s ? `${s.classType} (${s.className}) • ${(s.probabilities[s.classType] * 100).toFixed(1)}%` : 'Class prediction: N, S, V, F, Q'),
  },
  {
    id: 'explainability',
    index: 8,
    label: 'EXPLAINABILITY',
    sublabel: 'Waveform Saliency',
    domain: 'interpretability',
    domainLabel: 'Explainability Map',
    icon: 'insights',
    dimensionBadge: 'Integrated Grad',
    accentColor: '#b45309', // Amber
    lightBg: 'bg-amber-50/70',
    borderColor: 'border-amber-200',
    formula: '\\text{IG}_i(x) = (x_i - x_i\') \\times \\int_{0}^{1} \\frac{\\partial F(x\' + \\alpha(x - x\'))}{\\partial x_i} d\\alpha',
    description: 'Quantum-classical gradient back-propagation mapping output logits back to original 187 ECG sample indices to confirm morphological focus.',
    sampleValueSummary: (s) => (s ? `Peak Saliency on ${s.classType === 'V' ? 'Aberrant QRS Complex' : s.classType === 'S' ? 'Premature P-Wave' : 'R-Peak Depolarization'}` : '187-point attribution saliency vector'),
  },
];

interface HybridPipelineProps {
  /** Optional active stage index (0 to 8). If provided, controls which stage is currently active. */
  activeStageIndex?: number;
  /** Current status of the pipeline */
  status?: 'idle' | 'running' | 'completed';
  /** Currently selected ECG beat sample for live telemetry display */
  sample?: ECGBeatSample;
  /** Optional callback when user clicks a stage to inspect */
  onStageSelect?: (stageIndex: number, stage: PipelineStageInfo) => void;
  /** Optional callback to trigger an analysis run from within the component */
  onRunAnalysis?: () => void;
  /** Layout mode: 'compact' (streamlined single-card strip) or 'standard' (full interactive stepper) */
  compact?: boolean;
  /** Title override */
  title?: string;
  /** Whether to show the bottom technical inspector drawer/card */
  showInspector?: boolean;
  /** Additional custom class names */
  className?: string;
}

export const HybridPipeline = ({
  activeStageIndex: controlledActiveStage,
  status: controlledStatus,
  sample: providedSample,
  onStageSelect,
  onRunAnalysis,
  compact = false,
  title = 'Dr. Radar Hybrid Pipeline',
  showInspector = true,
  className = '',
}: HybridPipelineProps) => {
  // Use default benchmark sample if none provided (ECG-0248 Ventricular Ectopic)
  const sample = providedSample || BENCHMARK_ECG_BEATS[1];

  // Internal simulation state when used standalone
  const [internalStatus, setInternalStatus] = useState<'idle' | 'running' | 'completed'>('completed');
  const [internalStage, setInternalStage] = useState<number>(8);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(4); // Default to VQC stage for inspection
  const [isInspectorExpanded, setIsInspectorExpanded] = useState<boolean>(false);

  const isControlled = controlledActiveStage !== undefined;
  const currentStatus = controlledStatus !== undefined ? controlledStatus : internalStatus;
  const currentStageIndex = isControlled ? controlledActiveStage : internalStage;

  const animationTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Autonomous simulation runner if onRunAnalysis is not externally passed
  const handleInternalRun = () => {
    if (onRunAnalysis) {
      onRunAnalysis();
      return;
    }

    if (internalStatus === 'running') return;

    animationTimersRef.current.forEach(clearTimeout);
    animationTimersRef.current = [];

    setInternalStatus('running');
    setInternalStage(0);
    setSelectedStageIndex(0);

    // Sequence through all 9 stages
    const stageDelays = [0, 350, 700, 1050, 1550, 2000, 2400, 2750, 3100];
    stageDelays.forEach((delay, idx) => {
      const timer = setTimeout(() => {
        setInternalStage(idx);
        setSelectedStageIndex(idx);
      }, delay);
      animationTimersRef.current.push(timer);
    });

    const completionTimer = setTimeout(() => {
      setInternalStatus('completed');
      setInternalStage(8);
    }, 3500);
    animationTimersRef.current.push(completionTimer);
  };

  const activeStageInfo = PIPELINE_STAGES[selectedStageIndex] || PIPELINE_STAGES[4];

  const handleStageClick = (idx: number) => {
    setSelectedStageIndex(idx);
    if (onStageSelect) {
      onStageSelect(idx, PIPELINE_STAGES[idx]);
    }
  };

  // Progress percentage calculation across the 9 stages
  const progressPercent = useMemo(() => {
    if (currentStatus === 'completed') return 100;
    if (currentStatus === 'idle') return 0;
    return Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100);
  }, [currentStatus, currentStageIndex]);

  return (
    <div
      id="qdiag-hybrid-pipeline-component"
      className={`matte-3d-card rounded-2xl p-4 sm:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3.5 select-none transition-all ${className}`}
    >
      {/* 1. PIPELINE HEADER & STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#bc000a] font-bold">
              Hybrid Architecture
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-violet-50 text-violet-700 border border-violet-200">
              NISQ 10-Qubit VQC
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#101c28] flex items-center gap-2">
            <span>{title}</span>
            <span className="text-[11px] font-normal text-slate-400 font-mono">
              (9 Sequential Stages)
            </span>
          </h3>
        </div>

        {/* Status Indicators & Action CTA */}
        <div className="flex items-center gap-2.5">
          {/* Live Progress Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono border transition-all ${
              currentStatus === 'running'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : currentStatus === 'completed'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentStatus === 'running'
                  ? 'bg-amber-500 animate-ping'
                  : currentStatus === 'completed'
                  ? 'bg-emerald-600'
                  : 'bg-slate-400'
              }`}
            />
            <span>
              {currentStatus === 'running'
                ? `Active: Stage ${currentStageIndex + 1}/9 (${progressPercent}%)`
                : currentStatus === 'completed'
                ? 'Pipeline Complete (100%)'
                : 'Pipeline Ready'}
            </span>
          </div>

          {/* Simulate / Run Pipeline CTA */}
          <button
            id="hybrid-pipeline-run-btn"
            onClick={handleInternalRun}
            disabled={currentStatus === 'running'}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-[#bc000a] disabled:bg-slate-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
            title={currentStatus === 'running' ? 'Executing pipeline stages...' : 'Simulate sequential hybrid pipeline execution'}
          >
            <span
              className={`material-symbols-outlined text-[15px] ${
                currentStatus === 'running' ? 'animate-spin' : ''
              }`}
            >
              {currentStatus === 'running' ? 'progress_activity' : 'play_arrow'}
            </span>
            <span className="hidden sm:inline">
              {currentStatus === 'running' ? 'Executing...' : 'Run Pipeline'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. PROGRESS STRIP LINE */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 relative">
          <div
            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-sky-500 via-violet-600 to-[#bc000a]"
            style={{ width: `${progressPercent}%` }}
          />
          {currentStatus === 'running' && (
            <div className="absolute inset-0 bg-white/30 animate-[shimmer_1.5s_infinite]" />
          )}
        </div>
        <div className="flex justify-between items-center text-[9.5px] font-mono text-slate-400 px-0.5">
          <span>187-D ECG Input</span>
          <span className="text-violet-600 font-semibold">Classical ➔ Quantum ➔ Classical</span>
          <span>5-Class Result & Saliency</span>
        </div>
      </div>

      {/* 3. REUSABLE 9-STAGE PIPELINE FLOW VISUALIZATION */}
      <div id="hybrid-pipeline-stages-container" className="pt-1">
        {/* Responsive Layout: Scrollable horizontal track on small screens, wrap/grid on larger */}
        <div className="overflow-x-auto pb-1.5 no-scrollbar">
          <div className="flex items-center min-w-[760px] sm:min-w-full justify-between gap-1 sm:gap-1.5">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isPast = currentStatus === 'completed' || (currentStatus === 'running' && currentStageIndex > idx);
              const isActive = currentStatus === 'running' && currentStageIndex === idx;
              const isSelected = selectedStageIndex === idx;

              return (
                <div key={stage.id} className="flex items-center flex-1 min-w-[76px]">
                  {/* Stage Node Card */}
                  <div
                    id={`pipeline-stage-${stage.id}`}
                    onClick={() => handleStageClick(idx)}
                    className={`relative w-full p-2 rounded-xl border text-left transition-all cursor-pointer group flex flex-col justify-between h-[102px] ${
                      isSelected
                        ? 'ring-2 ring-[#bc000a] shadow-xs bg-white'
                        : 'bg-white hover:bg-slate-50/90'
                    } ${
                      isActive
                        ? 'border-[#bc000a] bg-rose-50/40 shadow-xs ring-2 ring-[#bc000a]/30 animate-pulse'
                        : isPast
                        ? 'border-emerald-200/90'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Top status indicator & number badge */}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isActive ? stage.accentColor : isPast ? '#059669' : '#e2e8f0',
                          color: isActive || isPast ? '#ffffff' : '#64748b',
                        }}
                      >
                        {isPast ? '✓' : idx + 1}
                      </span>

                      {/* Dimension Pill */}
                      <span
                        className="text-[8.5px] font-mono px-1 py-0.2 rounded font-semibold truncate max-w-[56px]"
                        style={{
                          backgroundColor: isActive ? '#ffe8e8' : isPast ? '#ecfdf5' : '#f1f5f9',
                          color: isActive ? '#bc000a' : isPast ? '#047857' : '#64748b',
                        }}
                        title={stage.dimensionBadge}
                      >
                        {stage.dimensionBadge}
                      </span>
                    </div>

                    {/* Stage Label & Exact Subtitle */}
                    <div className="my-auto pt-1">
                      <h4
                        className="text-[10.5px] font-extrabold uppercase tracking-tight leading-tight line-clamp-1 group-hover:text-[#bc000a] transition-colors"
                        style={{ color: isActive ? '#bc000a' : '#101c28' }}
                        title={stage.label}
                      >
                        {stage.label}
                      </h4>
                      <p
                        className="text-[9px] font-mono text-slate-500 leading-tight mt-0.5 line-clamp-2"
                        title={stage.sublabel}
                      >
                        {stage.sublabel}
                      </p>
                    </div>

                    {/* Bottom active radar or domain tag */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100/90 text-[8.5px] font-mono">
                      <span className="text-slate-400 truncate max-w-[50px]">{stage.domainLabel}</span>
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#bc000a] animate-ping" />
                      ) : isPast ? (
                        <span className="text-emerald-600 font-bold">Done</span>
                      ) : (
                        <span className="text-slate-300">Wait</span>
                      )}
                    </div>
                  </div>

                  {/* Flow Arrow Between Stages (except the last stage) */}
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className="shrink-0 px-0.5 sm:px-1 flex flex-col items-center justify-center text-slate-300">
                      <span
                        className={`material-symbols-outlined text-[14px] transition-colors ${
                          isActive
                            ? 'text-[#bc000a] animate-pulse font-bold'
                            : isPast
                            ? 'text-emerald-500'
                            : 'text-slate-300'
                        }`}
                      >
                        arrow_forward
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. ACTIVE STAGE INSPECTOR & MATHEMATICAL STATUS TELEMETRY */}
      {showInspector && (
        <div
          id="pipeline-stage-inspector"
          className="rounded-xl border border-slate-200/90 bg-[#f8fbfe] p-3 sm:p-3.5 space-y-2.5 text-xs transition-all"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-lg text-white flex items-center justify-center shadow-2xs"
                style={{ backgroundColor: activeStageInfo.accentColor }}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {activeStageInfo.icon}
                </span>
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                    STAGE {activeStageInfo.index + 1}/9 SPECS:
                  </span>
                  <span className="font-extrabold text-[#101c28]">
                    {activeStageInfo.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    ({activeStageInfo.sublabel})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold">
                Domain: {activeStageInfo.domainLabel}
              </span>
              <button
                onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={isInspectorExpanded ? 'Show less mathematical detail' : 'Show full mathematical formula & tensor specs'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isInspectorExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {/* Summary Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
            {/* Column 1: Functional Role */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                Functional Specification
              </span>
              <p className="text-slate-700 leading-snug">
                {activeStageInfo.description}
              </p>
            </div>

            {/* Column 2: Live Sample Data */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                Active Sample Binding ({sample.id})
              </span>
              <p className="font-mono text-slate-800 font-semibold break-all leading-snug">
                {activeStageInfo.sampleValueSummary(sample)}
              </p>
              {activeStageInfo.id === 'five-class-result' && (
                <div className="pt-1 flex items-center gap-2">
                  <AamiClassBadge code={sample.classType} variant="both" size="xs" />
                  <span className="text-emerald-700 font-bold font-mono">
                    {(sample.probabilities[sample.classType] * 100).toFixed(1)}% Certainty
                  </span>
                </div>
              )}
            </div>

            {/* Column 3: Mathematical Mapping */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                Mathematical Operator
              </span>
              <div className="font-mono text-[10.5px] text-violet-900 bg-slate-50 p-1.5 rounded border border-slate-100 overflow-x-auto">
                <code>{activeStageInfo.formula}</code>
              </div>
            </div>
          </div>

          {/* Expandable Technical Deep-Dive */}
          {isInspectorExpanded && (
            <div className="pt-2 border-t border-slate-200/70 space-y-2 text-[11px]">
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Full Pipeline Flow Architecture (EC57 Standard):
                </span>
                <div className="text-[10.5px] text-slate-700 space-y-0.5 leading-relaxed">
                  <div>1. <strong>ECG BEAT</strong>: 187 dimensions (125 Hz normalized Lead II signal)</div>
                  <div>2. <strong>CLASSICAL ENCODER</strong>: PCA / Supervised AE (1D Conv layers + Latent compression)</div>
                  <div>3. <strong>BOTTLENECK</strong>: 8–12 dimensions (selected: 10-D latent manifold z)</div>
                  <div>4. <strong>QUANTUM ENCODING</strong>: Angle Encoding (Ry rotations on 10 qubits)</div>
                  <div>5. <strong>VQC</strong>: Variational + Ring Entanglement (L=3 layers with periodic boundary CNOTs)</div>
                  <div>6. <strong>MEASUREMENT</strong>: Z expectations (⟨Z_i⟩ expectation readouts, 1024 shots)</div>
                  <div>7. <strong>CLASSICAL HEAD</strong>: Softmax (dense linear projection to categorical distribution)</div>
                  <div>8. <strong>5-CLASS RESULT</strong>: N / S / V / F / Q (AAMI EC57 diagnostic outcome)</div>
                  <div>9. <strong>EXPLAINABILITY</strong>: Waveform Saliency (Integrated gradients attribution map)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
