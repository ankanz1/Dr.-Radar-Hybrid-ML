import { ScreenTab } from '../types';
import {
  AamiClassBadge,
  AamiClassDistributionBar,
  AamiClassSystemLegend,
} from './AamiClassBadge';
import { AAMI_CLASS_CONFIG, AamiClassCode } from '../data/aamiClassSystem';
import { ClinicalDisclaimer, PrototypeResultBadge } from './ClinicalDisclaimer';
import { BENCHMARK_ECG_BEATS } from '../data/ecgQuantumData';
import { HybridPipeline } from './HybridPipeline';

interface OverviewScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings?: () => void;
  onOpenPatientProfile?: () => void;
  onOpenNotifications?: () => void;
  onOpenHealthcareSupport?: () => void;
}

export const OverviewScreen = ({
  onNavigate,
  onOpenSettings,
  onOpenPatientProfile,
  onOpenNotifications,
}: OverviewScreenProps) => {
  // 5-class distribution based on centralized AAMI visual system
  const classDistributions: Array<{
    code: AamiClassCode;
    name: string;
    probability: number;
    color: string;
  }> = [
    { code: 'N', name: AAMI_CLASS_CONFIG.N.fullName, probability: 3.1, color: AAMI_CLASS_CONFIG.N.color },
    { code: 'S', name: AAMI_CLASS_CONFIG.S.fullName, probability: 1.4, color: AAMI_CLASS_CONFIG.S.color },
    { code: 'V', name: AAMI_CLASS_CONFIG.V.fullName, probability: 94.2, color: AAMI_CLASS_CONFIG.V.color },
    { code: 'F', name: AAMI_CLASS_CONFIG.F.fullName, probability: 0.7, color: AAMI_CLASS_CONFIG.F.color },
    { code: 'Q', name: AAMI_CLASS_CONFIG.Q.fullName, probability: 0.6, color: AAMI_CLASS_CONFIG.Q.color },
  ];

  // 3 recent experiment runs with Experiment ID, Dataset, Model, Result, Date, Status
  const recentExperiments: Array<{
    id: string;
    dataset: string;
    model: string;
    classCode: AamiClassCode;
    result: string;
    date: string;
    status: string;
    statusColor: string;
  }> = [
    {
      id: 'EXP-0248',
      dataset: 'MIT-BIH Arrhythmia (DS2)',
      model: 'Hybrid VQC (10-Qubit)',
      classCode: 'V',
      result: 'Ventricular ectopic (V) • 94.2%',
      date: 'Sep 03, 2026',
      status: 'Complete',
      statusColor: 'text-[#008744] bg-[#e6f4ea] border-[#008744]/30',
    },
    {
      id: 'EXP-0247',
      dataset: 'MIT-BIH Arrhythmia (DS1)',
      model: 'QSVC (Fidelity Kernel)',
      classCode: 'N',
      result: 'Normal (N) • 98.1%',
      date: 'Sep 02, 2026',
      status: 'Complete',
      statusColor: 'text-[#008744] bg-[#e6f4ea] border-[#008744]/30',
    },
    {
      id: 'EXP-0246',
      dataset: 'PTB Diagnostic DB',
      model: '1D-CNN Classical Baseline',
      classCode: 'S',
      result: 'Supraventricular ectopic (S) • 89.4%',
      date: 'Aug 30, 2026',
      status: 'Archived',
      statusColor: 'text-slate-600 bg-slate-100 border-slate-200',
    },
  ];

  return (
    <div
      id="research-overview-container"
      className="space-y-6 pb-24 w-full select-none"
    >
      {/* Header & Status Section */}
      <section id="research-overview-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            {/* Header: DR. RADAR / Hybrid Quantum–Classical ECG Intelligence */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                OVERVIEW WORKSPACE
              </span>
              <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                AerSim 10-Qubit Active
              </span>
            </div>

            {/* Title & Subheading */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#101c28] tracking-tight">
                Biomedical Intelligence Overview
              </h1>
              <p className="text-xs sm:text-sm text-[#5c7b99] font-medium mt-0.5">
                Hybrid quantum-classical arrhythmia analysis, live telemetry & benchmark monitoring
              </p>
            </div>
          </div>

          {/* Quick Profile / Utilities */}
          <div className="flex items-center gap-2 pt-1">
            {onOpenNotifications && (
              <button
                id="overview-notifications-btn"
                onClick={onOpenNotifications}
                className="w-9 h-9 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#101c28] hover:text-[#bc000a] hover:border-[#bc000a]/30 transition-all cursor-pointer"
                title="System Notifications"
              >
                <span className="material-symbols-outlined text-[19px]">notifications</span>
              </button>
            )}
            {onOpenSettings && (
              <button
                id="overview-settings-btn"
                onClick={onOpenSettings}
                className="w-9 h-9 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#101c28] hover:text-[#bc000a] hover:border-[#bc000a]/30 transition-all cursor-pointer"
                title="Workspace Settings"
              >
                <span className="material-symbols-outlined text-[19px]">tune</span>
              </button>
            )}
            {onOpenPatientProfile && (
              <button
                id="overview-profile-btn"
                onClick={onOpenPatientProfile}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#bc000a] shadow-xs hover:scale-105 transition-transform cursor-pointer"
                title="Researcher Profile: Ashton"
              >
                <img
                  src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=160"
                  alt="Ashton"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Biomedical Research Pipeline Journey Banner */}
      <section id="biomedical-pipeline-journey" className="relative overflow-hidden">
        <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#101c28] text-white flex items-center justify-center shadow-xs shrink-0">
                <span className="material-symbols-outlined text-[22px] text-rose-400">
                  conversion_path
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/20">
                    Core Investigation Pipeline
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    AAMI EC57 Standard • Lead II 125 Hz
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#101c28] mt-0.5">
                  Hybrid Quantum-Classical Diagnostic Flow
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="overview-launch-analysis-btn"
                onClick={() => onNavigate('ecg-analysis')}
                className="px-4 py-2.5 bg-[#101c28] hover:bg-[#bc000a] text-white rounded-xl text-xs font-bold tracking-wide shadow-xs hover:shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>Launch ECG Analysis</span>
                <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-[#5c7b99] max-w-4xl leading-relaxed">
            Standard workflow connects single-beat morphological segmentation through supervised latent compression, parameterized quantum circuit variational ansatz, 5-class AAMI softmax classification, and back-projected waveform saliency maps.
          </p>

          {/* Sequential Research Flow Stages */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-700">
            <span className="font-bold text-[#bc000a] mr-1">Journey:</span>
            <button
              onClick={() => onNavigate('ecg-analysis')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              1. ECG Sample
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('ecg-analysis')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              2. Waveform
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('ecg-analysis')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              3. Preprocessing
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('ecg-analysis')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              4. Latent Bottleneck (10-D)
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('quantum-lab')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              5. Quantum Circuit (VQC)
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('ecg-analysis')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              6. 5-Class Prediction
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('explainability')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              7. Explainability
            </button>
            <span className="text-slate-300">→</span>
            <button
              onClick={() => onNavigate('benchmarks')}
              className="bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
            >
              8. Benchmarks
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              MIT-BIH Arrhythmia Inter-Patient Protocol (DS1 Train / DS2 Test)
            </span>
            <span className="text-slate-500">
              Backend: IBM AerSim Statevector • Depth 4 StronglyEntangling
            </span>
          </div>
        </div>
      </section>

      {/* Desktop 2-Column Workstation Grid: Latest ECG Analysis & 5-Class Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Card: LATEST ECG ANALYSIS */}
        <section id="primary-analysis-card" className="lg:col-span-7">
          <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          {/* Card Header & Status */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                vital_signs
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                LATEST ECG ANALYSIS
              </h2>
              <PrototypeResultBadge type="sample" size="xs" />
            </div>

            {/* Status: Analysis Complete */}
            <div className="flex items-center gap-1.5 bg-[#ecfdf5] border border-[#059669]/30 text-[#059669] px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
              <span>Sample Result • Ready</span>
            </div>
          </div>

          {/* Core Metrics: Sample, Prediction, Confidence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Sample */}
            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Sample
              </span>
              <span className="text-lg font-bold text-[#101c28] font-mono mt-0.5 block">
                ECG-0248
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Lead II • Record 208</span>
            </div>

            {/* Prediction */}
            <div className="bg-[#ffe8e8]/60 p-3 rounded-xl border border-[#bc000a]/20 sm:col-span-1">
              <span className="text-[11px] text-[#bc000a] uppercase tracking-wider font-semibold block">
                Model Prediction
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <AamiClassBadge code="V" variant="compact" size="xs" />
                <span className="text-base sm:text-lg font-bold text-[#101c28] truncate">
                  Ventricular ectopic (V)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">PVC Premature Beat</span>
            </div>

            {/* Confidence */}
            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Model Confidence
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold text-[#101c28] font-mono">
                  94.2%
                </span>
                <span className="text-[11px] font-semibold text-[#059669]">High certainty</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Hybrid VQC 10-Qubit</span>
            </div>
          </div>

          {/* Small ECG Waveform Preview inside the card */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-[#5c7b99]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                ECG Waveform Preview (187 Samples)
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Wide QRS (142 ms) • Inverted T-Wave
              </span>
            </div>

            <div className="relative w-full h-24 bg-[#0d1620] rounded-xl overflow-hidden border border-slate-300/40 flex items-center justify-center p-2">
              {/* Subtle ECG Grid pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" width="100%" height="100%">
                <defs>
                  <pattern id="ecg-small-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
                  </pattern>
                  <pattern id="ecg-major-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                    <rect width="80" height="80" fill="url(#ecg-small-grid)" />
                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#38bdf8" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ecg-major-grid)" />
              </svg>

              {/* ECG Isoelectric baseline guide */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-sky-500/20 pointer-events-none" />

              {/* Crisp SVG Ventricular Ectopic Waveform */}
              <svg
                viewBox="0 0 400 90"
                preserveAspectRatio="none"
                className="w-full h-full relative z-10"
              >
                {/* Ventricular Ectopic Beat (PVC) Path */}
                <path
                  d="M 0,50 L 50,50 Q 75,50 90,50 L 105,50 Q 115,58 125,48 L 138,12 L 152,40 L 170,82 L 192,54 Q 215,68 238,66 Q 260,54 278,50 L 400,50"
                  fill="none"
                  stroke="#ff4d5a"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Beat marker at QRS peak */}
                <circle cx="138" cy="12" r="3" fill="#ffffff" stroke="#bc000a" strokeWidth="1.5" />
                <text x="144" y="16" fill="#fca5a5" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  R' (PVC)
                </text>

                {/* Fiducial tag for sample */}
                <text x="12" y="20" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  ECG-0248 [Lead II]
                </text>
              </svg>

              {/* Live badge overlay */}
              <div className="absolute bottom-2 right-2.5 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[9.5px] font-mono text-slate-300 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d5a]" />
                <span>Ventricular Ectopic</span>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* 5-CLASS PREDICTION Card */}
        <section id="five-class-prediction-card" className="lg:col-span-5">
          <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                  5-CLASS MODEL PREDICTION
                </h2>
                <PrototypeResultBadge type="sample" size="xs" />
              </div>
              <span className="text-[11px] font-mono font-medium text-[#5c7b99]">
                AAMI EC57 Probability Distribution
              </span>
            </div>

            {/* Clean Horizontal Bars */}
            <div className="space-y-2.5 pt-1">
              {classDistributions.map((item) => {
                const isDominant = item.code === 'V';
                return (
                  <AamiClassDistributionBar
                    key={item.code}
                    code={item.code}
                    probability={item.probability}
                    isDominant={isDominant}
                    isPredictionTarget={isDominant}
                  />
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <AamiClassSystemLegend />
            </div>

            <ClinicalDisclaimer className="mt-3" />
          </div>
        </section>
      </div>

      {/* ANALYSIS PIPELINE */}
      <section id="analysis-pipeline-card">
        <HybridPipeline
          sample={BENCHMARK_ECG_BEATS[1]}
          title="DR. RADAR COMPUTATIONAL PIPELINE"
          onRunAnalysis={() => onNavigate('ecg-analysis')}
          onStageSelect={(_idx, stage) => {
            if (stage.id === 'vqc' || stage.id === 'quantum-encoding' || stage.id === 'measurement' || stage.id === 'bottleneck') {
              onNavigate('quantum-lab');
            } else if (stage.id === 'explainability') {
              onNavigate('explainability');
            } else {
              onNavigate('ecg-analysis');
            }
          }}
        />
      </section>

      {/* ECG HEARTBEAT DATASET BENCHMARK CARD */}
      <section id="ecg-dataset-overview-card">
        <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#bc000a] font-bold">
                  Primary Research Corpus
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold border border-emerald-200">
                  AAMI EC57
                </span>
              </div>
              <h2 className="text-sm font-bold text-[#101c28]">
                ECG Heartbeat Categorization Dataset
              </h2>
              <p className="text-[11px] text-[#5c7b99]">
                MIT-BIH Arrhythmia & PTB Diagnostic standardized benchmarking repository
              </p>
            </div>

            <button
              id="open-dataset-workspace-btn"
              onClick={() => onNavigate('dataset')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#bc000a] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">database</span>
              <span>Open Dataset Workspace</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {/* 3 Metrics Row: ~109K Beats | 187 Samples | 5 AAMI Classes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                Total Volume
              </span>
              <div className="text-xl font-extrabold text-[#101c28] font-mono">
                ~109K Beats
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                109,446 Total (87,554 Train / 21,892 Test)
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                Temporal Features
              </span>
              <div className="text-xl font-extrabold text-[#101c28] font-mono">
                187 Samples
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                125 Hz uniform, Min-Max [0, 1] normalized
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                AAMI EC57 Classes
              </span>
              <div className="text-xl font-extrabold text-[#101c28] font-mono">
                5 Categories
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                N (82.8%), S (2.5%), V (6.6%), F (0.7%), Q (7.4%)
              </div>
            </div>
          </div>

          {/* Distribution Mini Strip */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span className="font-semibold text-slate-700">Class Prevalence Distribution</span>
              <span>Missing Values: 0.00%</span>
            </div>
            <div className="h-3 w-full rounded-lg overflow-hidden flex shadow-2xs border border-slate-200">
              <div style={{ width: '82.77%', backgroundColor: '#0284c7' }} title="N (Normal): 82.8%" />
              <div style={{ width: '2.54%', backgroundColor: '#f59e0b' }} title="S (Supraventricular): 2.5%" />
              <div style={{ width: '6.61%', backgroundColor: '#bc000a' }} title="V (Ventricular): 6.6%" />
              <div style={{ width: '0.73%', backgroundColor: '#7c3aed' }} title="F (Fusion): 0.7%" />
              <div style={{ width: '7.35%', backgroundColor: '#64748b' }} title="Q (Unknown/Paced): 7.4%" />
            </div>
          </div>
        </div>
      </section>

      {/* RECENT EXPERIMENTS */}
      <section id="recent-experiments-card">
        <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                RECENT EXPERIMENTS
              </h2>
              <p className="text-[11px] text-[#5c7b99]">
                Reproducible benchmark runs across model architectures
              </p>
            </div>
            <button
              id="view-all-experiments-btn"
              onClick={() => onNavigate('experiments')}
              className="px-2.5 py-1 rounded-lg bg-[#bc000a]/10 hover:bg-[#bc000a]/20 text-[#bc000a] text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {/* 3 Experiment Cards showing: Experiment ID, Dataset, Model, Result, Date, Status */}
          <div className="space-y-2.5">
            {recentExperiments.map((exp) => (
              <div
                key={exp.id}
                onClick={() => onNavigate('experiments')}
                className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-[#bc000a]/40 hover:shadow-xs transition-all space-y-2 cursor-pointer group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#101c28] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {exp.id}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {exp.dataset}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${exp.statusColor}`}>
                    {exp.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Model</span>
                    <span className="font-semibold text-slate-800">{exp.model}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Result</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <AamiClassBadge code={exp.classCode} variant="compact" size="xs" />
                      <span className="font-semibold text-[#101c28] font-mono text-xs truncate">{exp.result}</span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Date</span>
                    <span className="font-mono text-slate-600">{exp.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section id="quick-actions-section" className="space-y-2.5 pt-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* Action 1: Analyze ECG */}
          <button
            id="action-analyze-ecg"
            onClick={() => onNavigate('ecg-analysis')}
            className="matte-3d-card p-3 rounded-xl text-left hover:border-[#bc000a]/50 transition-all cursor-pointer group flex flex-col justify-between h-24"
          >
            <span className="material-symbols-outlined text-[20px] text-[#bc000a] group-hover:scale-110 transition-transform">
              vital_signs
            </span>
            <div>
              <span className="text-xs font-bold text-[#101c28] block group-hover:text-[#bc000a] transition-colors">
                Analyze ECG
              </span>
              <span className="text-[10px] text-slate-500 block">
                Waveform & classes
              </span>
            </div>
          </button>

          {/* Action 2: ECG Dataset */}
          <button
            id="action-ecg-dataset"
            onClick={() => onNavigate('dataset')}
            className="matte-3d-card p-3 rounded-xl text-left hover:border-[#0369a1]/50 transition-all cursor-pointer group flex flex-col justify-between h-24"
          >
            <span className="material-symbols-outlined text-[20px] text-[#0369a1] group-hover:scale-110 transition-transform">
              database
            </span>
            <div>
              <span className="text-xs font-bold text-[#101c28] block group-hover:text-[#0369a1] transition-colors">
                ECG Dataset
              </span>
              <span className="text-[10px] text-slate-500 block">
                ~109K Beats • 187 feat
              </span>
            </div>
          </button>

          {/* Action 3: Open Quantum Lab */}
          <button
            id="action-open-quantum-lab"
            onClick={() => onNavigate('quantum-lab')}
            className="matte-3d-card p-3 rounded-xl text-left hover:border-[#6d28d9]/50 transition-all cursor-pointer group flex flex-col justify-between h-24"
          >
            <span className="material-symbols-outlined text-[20px] text-[#6d28d9] group-hover:scale-110 transition-transform">
              memory
            </span>
            <div>
              <span className="text-xs font-bold text-[#101c28] block group-hover:text-[#6d28d9] transition-colors">
                Quantum Lab
              </span>
              <span className="text-[10px] text-slate-500 block">
                Circuit & VQC ansatz
              </span>
            </div>
          </button>

          {/* Action 4: Reproducible Experiments */}
          <button
            id="action-experiments"
            onClick={() => onNavigate('experiments')}
            className="matte-3d-card p-3 rounded-xl text-left hover:border-amber-600/50 transition-all cursor-pointer group flex flex-col justify-between h-24"
          >
            <span className="material-symbols-outlined text-[20px] text-amber-700 group-hover:scale-110 transition-transform">
              science
            </span>
            <div>
              <span className="text-xs font-bold text-[#101c28] block group-hover:text-amber-700 transition-colors">
                Experiments
              </span>
              <span className="text-[10px] text-slate-500 block">
                Reproducible runs
              </span>
            </div>
          </button>

          {/* Action 5: Compare Models */}
          <button
            id="action-compare-models"
            onClick={() => onNavigate('benchmarks')}
            className="matte-3d-card p-3 rounded-xl text-left hover:border-[#059669]/50 transition-all cursor-pointer group flex flex-col justify-between h-24 col-span-2 sm:col-span-1"
          >
            <span className="material-symbols-outlined text-[20px] text-[#059669] group-hover:scale-110 transition-transform">
              query_stats
            </span>
            <div>
              <span className="text-xs font-bold text-[#101c28] block group-hover:text-[#059669] transition-colors">
                Benchmarks
              </span>
              <span className="text-[10px] text-slate-500 block">
                F1 scores & metrics
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Subtle Clinical Non-Diagnostic Disclaimer */}
      <section id="overview-disclaimer" className="pt-2 pb-1">
        <ClinicalDisclaimer />
      </section>
    </div>
  );
};
