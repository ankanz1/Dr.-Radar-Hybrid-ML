import { useState } from 'react';
import { ExperimentRecord } from '../data/experimentsData';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';

interface ExperimentDetailModalProps {
  experiment: ExperimentRecord | null;
  onClose: () => void;
  onNavigateToQuantumLab?: () => void;
  onNavigateToExplainability?: () => void;
}

type DetailTab = 'overview' | 'config-circuit' | 'training' | 'metrics' | 'explainability';

export const ExperimentDetailModal = ({
  experiment,
  onClose,
  onNavigateToQuantumLab,
  onNavigateToExplainability,
}: ExperimentDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!experiment) return null;

  const handleCopy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isQuantum = experiment.qubits !== null && experiment.qubits > 0;

  return (
    <div
      id="experiment-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in overflow-y-auto"
    >
      <div
        id="experiment-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden my-0 sm:my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#bc000a]/10 text-[#bc000a] border border-[#bc000a]/20">
                {experiment.id}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  experiment.status === 'Completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : experiment.status === 'In Progress'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {experiment.status}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {experiment.date}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#101c28] truncate">
              {experiment.model} • {experiment.dataset}
            </h2>
            <p className="text-xs text-[#5c7b99] line-clamp-1">
              {experiment.description}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="Close Experiment Details"
            aria-label="Close Experiment Details"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 pb-1 border-b border-slate-100 bg-[#f8fbfe] overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'overview', label: 'Reproducibility', icon: 'history_edu' },
            { id: 'config-circuit', label: 'Circuit & Encoder', icon: 'memory' },
            { id: 'training', label: 'Training', icon: 'trending_up' },
            { id: 'metrics', label: 'Metrics & Pred', icon: 'query_stats' },
            { id: 'explainability', label: 'Explain & Compare', icon: 'insights' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#bc000a] font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: REPRODUCIBILITY & OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Top Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Macro-F1</span>
                  <span className="text-base font-bold font-mono text-[#bc000a] block mt-0.5">
                    {(experiment.macroF1 * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500">AAMI EC57</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Qubits</span>
                  <span className="text-base font-bold font-mono text-[#101c28] block mt-0.5">
                    {experiment.qubits ? `${experiment.qubits} Qubits` : 'N/A (Classical)'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {experiment.circuitDepth ? `Depth ${experiment.circuitDepth}` : 'No Circuit'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Encoder</span>
                  <span className="text-base font-bold text-[#101c28] block mt-0.5 truncate">
                    {experiment.encoder}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {experiment.encoderDetails.latentDim} Latent features
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inference Latency</span>
                  <span className="text-base font-bold font-mono text-emerald-700 block mt-0.5">
                    {experiment.latencyMs} ms
                  </span>
                  <span className="text-[10px] text-slate-500">Per beat inference</span>
                </div>
              </div>

              {/* REPRODUCIBILITY SECTION (Explicitly required) */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[18px]">
                      verified_user
                    </span>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Reproducibility Specification
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                    Strict Protocol
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Seed */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Random Seed</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {experiment.reproducibility.seed}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy('seed', String(experiment.reproducibility.seed))}
                      className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                    >
                      {copiedField === 'seed' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Backend */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Execution Backend</span>
                    <span className="font-mono font-semibold text-slate-800 truncate block">
                      {experiment.reproducibility.backend}
                    </span>
                  </div>

                  {/* Dataset Split */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Dataset Split</span>
                    <span className="font-medium text-slate-800 block mt-0.5">
                      {experiment.reproducibility.datasetSplit}
                    </span>
                  </div>

                  {/* Run Timestamp */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Run Timestamp</span>
                    <span className="font-mono font-medium text-slate-700">
                      {experiment.reproducibility.runTimestamp}
                    </span>
                  </div>

                  {/* Git Commit Hash */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between">
                    <div className="truncate mr-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Git Commit</span>
                      <span className="font-mono text-slate-800 truncate block">
                        {experiment.reproducibility.gitCommitHash}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy('commit', experiment.reproducibility.gitCommitHash)}
                      className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono shrink-0"
                    >
                      {copiedField === 'commit' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Framework Versions */}
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Software Environment & Packages
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-700">
                    <span className="bg-slate-100 px-2 py-0.5 rounded">Python {experiment.reproducibility.frameworkVersions.python}</span>
                    {experiment.reproducibility.frameworkVersions.pennylane && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded">PennyLane {experiment.reproducibility.frameworkVersions.pennylane}</span>
                    )}
                    {experiment.reproducibility.frameworkVersions.qiskit && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Qiskit {experiment.reproducibility.frameworkVersions.qiskit}</span>
                    )}
                    <span className="bg-slate-100 px-2 py-0.5 rounded">PyTorch {experiment.reproducibility.frameworkVersions.pytorch}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">NumPy {experiment.reproducibility.frameworkVersions.numpy}</span>
                  </div>
                </div>
              </div>

              {/* Dataset Description */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Benchmark Dataset Details</span>
                <p className="font-semibold text-slate-800">{experiment.datasetFullName}</p>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Heartbeat windows sampled at 250 Hz (187 samples per single heartbeat R-peak centered). Inter-patient protocol partitions recordings strictly between training (DS1) and testing (DS2) to prevent data leakage across individuals.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION, ENCODER & QUANTUM CIRCUIT */}
          {activeTab === 'config-circuit' && (
            <div className="space-y-4">
              {/* Configuration Panel */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#bc000a] text-[18px]">settings</span>
                  Model Configuration
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Ansatz</span>
                    <span className="font-semibold text-slate-800 block truncate">{experiment.configuration.ansatz || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Entanglement</span>
                    <span className="font-semibold text-slate-800 block truncate">{experiment.configuration.entanglementTopology || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Parameters</span>
                    <span className="font-mono font-bold text-[#bc000a] block">{experiment.configuration.parameterCount} Trainable</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Learning Rate</span>
                    <span className="font-mono font-semibold text-slate-800 block">{experiment.configuration.learningRate}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Batch Size</span>
                    <span className="font-mono font-semibold text-slate-800 block">{experiment.configuration.batchSize}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Epochs</span>
                    <span className="font-mono font-semibold text-slate-800 block">{experiment.configuration.epochs}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1">
                  <span className="text-slate-400 font-semibold block">Initialization & Measurement:</span>
                  <div className="text-slate-700 space-y-0.5">
                    <div>• <strong>Initialization:</strong> {experiment.configuration.initializationMethod}</div>
                    <div>• <strong>Measurement:</strong> {experiment.configuration.measurementOperators}</div>
                    <div>• <strong>Encoding Scaling:</strong> {experiment.configuration.inputScaling}</div>
                  </div>
                </div>
              </div>

              {/* Encoder Details */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0369a1] text-[18px]">compress</span>
                    Encoder Architecture ({experiment.encoder})
                  </h3>
                  {experiment.encoderDetails.reconstructionMse !== null && (
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      Reconstruction MSE: {experiment.encoderDetails.reconstructionMse}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Input Dimension</span>
                    <span className="font-mono font-bold text-slate-800">{experiment.encoderDetails.inputDim} samples (Lead II)</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Latent Output</span>
                    <span className="font-mono font-bold text-[#0369a1]">{experiment.encoderDetails.latentDim} features (z₁..z{experiment.encoderDetails.latentDim})</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-700 block">Encoder Forward Pipeline:</span>
                  <div className="space-y-1 font-mono text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    {experiment.encoderDetails.layerSummary.map((layer, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-slate-700">
                        <span className="text-slate-400 font-bold shrink-0">{idx + 1}.</span>
                        <span>{layer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quantum Circuit Section */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#6d28d9] text-[18px]">grain</span>
                    Quantum Circuit Topology
                  </h3>
                  {isQuantum && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToQuantumLab?.();
                      }}
                      className="text-[11px] font-semibold text-[#bc000a] hover:underline flex items-center gap-1"
                    >
                      Open in Quantum Lab
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  )}
                </div>

                {isQuantum && experiment.quantumCircuitDetails ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Qubits</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{experiment.quantumCircuitDetails.qubitWires}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Circuit Depth</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{experiment.quantumCircuitDetails.depth}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">1-Qubit Gates</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{experiment.quantumCircuitDetails.singleQubitGates}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">2-Qubit Entanglers</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{experiment.quantumCircuitDetails.twoQubitGates}</span>
                      </div>
                    </div>

                    {/* Visual Circuit Mini Schematic */}
                    <div className="bg-[#101c28] p-3 rounded-xl text-slate-200 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                      <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                        <span>Wire Schematic (q₀ .. q₉)</span>
                        <span className="text-emerald-400">{experiment.quantumCircuitDetails.ansatzFamily}</span>
                      </div>
                      <div className="space-y-1 pt-1 whitespace-nowrap text-[10px]">
                        <div>|0⟩ q₀: ──[ Ry(θ₀) ]──[ Rz(φ₀) ]──●──────────────[ M(Z₀) ]──</div>
                        <div>|0⟩ q₁: ──[ Ry(θ₁) ]──[ Rz(φ₁) ]──X──●───────────[ M(Z₁) ]──</div>
                        <div>|0⟩ q₂: ──[ Ry(θ₂) ]──[ Rz(φ₂) ]─────X──●────────[ M(Z₂) ]──</div>
                        <div>|0⟩ q₃: ──[ Ry(θ₃) ]──[ Rz(φ₃) ]────────X──●─────[ M(Z₃) ]──</div>
                        <div>... [q₄-q₈ identical parameterized layers] ...</div>
                        <div>|0⟩ q₉: ──[ Ry(θ₉) ]──[ Rz(φ₉) ]───────────X──●──[ M(Z₉) ]──</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500">
                    <span className="material-symbols-outlined text-slate-400 text-2xl block mb-1">domain_disabled</span>
                    Classical model evaluation. Quantum circuits and entanglement gates are not applicable for this baseline run.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TRAINING */}
          {activeTab === 'training' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700 text-[18px]">tune</span>
                  Optimization & Convergence Dynamics
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Convergence Epoch</span>
                    <span className="font-mono font-bold text-slate-800 block">
                      Epoch {experiment.trainingDetails.convergenceEpoch} / {experiment.configuration.epochs}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Final Train Loss</span>
                    <span className="font-mono font-bold text-emerald-700 block">
                      {experiment.trainingDetails.finalTrainLoss.toFixed(3)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Final Val Loss</span>
                    <span className="font-mono font-bold text-emerald-700 block">
                      {experiment.trainingDetails.finalValLoss.toFixed(3)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Avg Gradient Norm</span>
                    <span className="font-mono font-bold text-slate-800 block">
                      ‖∇L‖ = {experiment.trainingDetails.gradientNormAvg}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Training Wall Time</span>
                    <span className="font-mono font-bold text-slate-800 block">
                      {experiment.trainingDetails.trainingTimeSec} s
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Optimizer</span>
                    <span className="font-medium text-slate-800 block truncate">
                      {experiment.trainingDetails.optimizer}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Loss Formulation</span>
                  <p className="font-medium text-slate-800">{experiment.trainingDetails.lossFunction}</p>
                  <p className="text-[11px] text-slate-500">
                    Scheduler: {experiment.trainingDetails.scheduler}
                  </p>
                </div>

                {/* Simulated Loss Curve Graphic */}
                <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-300">Loss Trajectory (50 Epochs)</span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400" /> Train</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-400" /> Val</span>
                    </div>
                  </div>
                  <div className="h-20 w-full relative border-b border-slate-700 flex items-end">
                    <svg className="w-full h-full text-emerald-400" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path
                        d="M 0 35 Q 20 20 40 12 T 70 8 T 100 6"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2"
                      />
                      <path
                        d="M 0 38 Q 20 24 40 16 T 70 12 T 100 9"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="2,2"
                      />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>Epoch 0 (Loss ~1.42)</span>
                    <span>Convergence (Epoch {experiment.trainingDetails.convergenceEpoch})</span>
                    <span>Epoch 50 (Loss {experiment.trainingDetails.finalValLoss.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: METRICS & PREDICTION */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {/* Macro Performance Table */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#bc000a] text-[18px]">assessment</span>
                    AAMI EC57 Per-Class Evaluation
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-[#bc000a]">
                    Macro-F1: {(experiment.metrics.macroF1 * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                        <th className="py-2 pr-2">Class</th>
                        <th className="py-2 px-2 text-right">Support</th>
                        <th className="py-2 px-2 text-right">Precision</th>
                        <th className="py-2 px-2 text-right">Sensitivity</th>
                        <th className="py-2 px-2 text-right">Specificity</th>
                        <th className="py-2 pl-2 text-right font-bold text-slate-900">F1</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {experiment.metrics.perClass.map((item) => (
                        <tr key={item.classCode} className="hover:bg-slate-50/70">
                          <td className="py-2 pr-2 font-sans font-medium">
                            <div className="flex items-center gap-1.5">
                              <AamiClassBadge code={item.classCode} variant="compact" size="xs" />
                              <span className="text-slate-800 text-xs">{item.className}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {item.support.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700">
                            {(item.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700 font-semibold">
                            {(item.sensitivity * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700">
                            {(item.specificity * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 pl-2 text-right font-bold text-[#bc000a]">
                            {(item.f1Score * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Prediction Inspection */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#047857] text-[18px]">biotech</span>
                    Sample Beat Prediction Inspection
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {experiment.predictionSample.sampleId} • {experiment.predictionSample.lead}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Ground Truth</span>
                      <AamiClassBadge code={experiment.predictionSample.groundTruth} variant="full" size="xs" />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Model Output</span>
                      <AamiClassBadge code={experiment.predictionSample.predictedClass} variant="full" size="xs" />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Confidence</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {(experiment.predictionSample.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* 5-class Posterior Bar */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Posterior Distribution</span>
                    {experiment.predictionSample.probabilities.map((p) => (
                      <AamiClassDistributionBar
                        key={p.code}
                        code={p.code}
                        probability={p.prob * 100}
                        isDominant={p.code === experiment.predictionSample.predictedClass}
                        isPredictionTarget={p.code === experiment.predictionSample.predictedClass}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXPLAINABILITY & BENCHMARK COMPARISON */}
          {activeTab === 'explainability' && (
            <div className="space-y-4">
              {/* Saliency & Feature Attribution */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#bc000a] text-[18px]">query_stats</span>
                    Explainability Attribution
                  </h3>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToExplainability?.();
                    }}
                    className="text-[11px] font-semibold text-[#bc000a] hover:underline flex items-center gap-1"
                  >
                    Open Explainability Screen
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Attribution Method</span>
                    <span className="font-semibold text-slate-800 block">{experiment.explainability.attributionMethod}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Dominant Waveform Region</span>
                    <span className="font-semibold text-[#bc000a] block">
                      {experiment.explainability.dominantRegion} ({experiment.explainability.qrsAttributionPct}% mass)
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-700 block">Top Contributing Latent Features:</span>
                  <div className="space-y-1.5">
                    {experiment.explainability.topLatentFeatures.map((f) => (
                      <div key={f.feature} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-mono text-slate-800 text-xs">{f.feature}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.direction === 'positive' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {f.direction === 'positive' ? '+' : '-'}{(f.importance * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                  <strong>Clinical Correlation:</strong> {experiment.explainability.clinicalAlignmentNote}
                </div>
              </div>

              {/* Benchmark Comparison */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#6d28d9] text-[18px]">compare_arrows</span>
                  Benchmark Comparison vs Baselines
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200/70">
                    <span className="text-[10px] text-purple-700 font-bold uppercase block">Delta F1 vs Matched MLP</span>
                    <span className="font-mono font-bold text-purple-900 text-lg block mt-0.5">
                      {experiment.benchmarkComparison.deltaMacroF1VsMLP !== null
                        ? `${experiment.benchmarkComparison.deltaMacroF1VsMLP >= 0 ? '+' : ''}${(experiment.benchmarkComparison.deltaMacroF1VsMLP * 100).toFixed(1)}%`
                        : 'Baseline (0.0%)'}
                    </span>
                    <span className="text-[10px] text-purple-700">Strictly matched DS1/DS2 split</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Statistical Significance</span>
                    <span className="font-mono font-semibold text-slate-800 block mt-0.5">
                      {experiment.benchmarkComparison.pValSignificance}
                    </span>
                    <span className="text-[10px] text-slate-500">Cross-validated hypothesis testing</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-[11px]">
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Parameter Efficiency</span>
                  <p className="font-medium text-slate-800">{experiment.benchmarkComparison.parameterComparison}</p>
                  <p className="text-slate-600 pt-1 border-t border-slate-200/60 leading-relaxed">
                    {experiment.benchmarkComparison.quantumAdvantageClaim}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Deterministic Seed: {experiment.reproducibility.seed}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
