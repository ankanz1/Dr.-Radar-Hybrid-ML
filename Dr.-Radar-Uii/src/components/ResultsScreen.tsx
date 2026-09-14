import { useState } from 'react';
import {
  BENCHMARK_MODELS,
  EXPERIMENT_HISTORY,
  BENCHMARK_ECG_BEATS,
  AAMI_CLASSES,
} from '../data/ecgQuantumData';
import { FullReportModal } from './FullReportModal';

interface ResultsScreenProps {
  onNavigateToPipeline?: () => void;
  onNavigateToCircuit?: () => void;
}

export const ResultsScreen = ({
  onNavigateToPipeline,
  onNavigateToCircuit,
}: ResultsScreenProps) => {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'matrix' | 'saliency' | 'history'>('benchmarks');
  const [selectedBeatIdx, setSelectedBeatIdx] = useState<number>(1); // Beat #208 (V)
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeBeat = BENCHMARK_ECG_BEATS[selectedBeatIdx];

  const handleDownloadFullReport = () => {
    setToastMessage('Exporting Technical Benchmark & Quantum Telemetry Dossier (PDF)...');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Normalized 5x5 Confusion Matrix data for Hybrid VQC (N, S, V, F, Q)
  // Rows: True Class, Columns: Predicted Class
  const confusionMatrix = [
    { trueCls: 'N', row: [99.2, 0.4, 0.2, 0.1, 0.1] },
    { trueCls: 'S', row: [3.8, 94.8, 0.8, 0.4, 0.2] },
    { trueCls: 'V', row: [0.8, 0.6, 97.9, 0.5, 0.2] },
    { trueCls: 'F', row: [4.2, 1.8, 2.6, 91.2, 0.2] },
    { trueCls: 'Q', row: [1.2, 0.4, 0.5, 0.2, 97.7] },
  ];

  return (
    <div
      id="results-screen-container"
      className="relative min-h-screen pb-32 pt-2 w-full max-w-full overflow-y-auto px-4 md:px-6"
    >
      {/* Toast */}
      {toastMessage && (
        <div
          id="results-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-center max-w-xs"
        >
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">
            file_download
          </span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div id="results-header" className="pt-2 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="material-symbols-outlined text-[14px] text-[#bc000a]">query_stats</span>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#bc000a]">
                Evaluation & Validation
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#101c28] tracking-tight">
              Model Benchmarks & Saliency
            </h2>
            <p className="text-xs text-[#5d3f3b]">
              Comparative Evaluation Against Classical Baselines & Waveform Explainability
            </p>
          </div>

          <button
            onClick={handleDownloadFullReport}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs text-xs font-bold text-[#bc000a] flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Dossier
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar pb-1">
          <button
            id="tab-benchmarks"
            onClick={() => setActiveTab('benchmarks')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'benchmarks'
                ? 'bg-[#bc000a] text-white shadow-xs'
                : 'bg-white/80 text-[#34485e] hover:bg-white border border-slate-200/80'
            }`}
          >
            Model Leaderboard
          </button>
          <button
            id="tab-matrix"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'matrix'
                ? 'bg-[#bc000a] text-white shadow-xs'
                : 'bg-white/80 text-[#34485e] hover:bg-white border border-slate-200/80'
            }`}
          >
            AAMI Confusion Matrix
          </button>
          <button
            id="tab-saliency"
            onClick={() => setActiveTab('saliency')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'saliency'
                ? 'bg-[#bc000a] text-white shadow-xs'
                : 'bg-white/80 text-[#34485e] hover:bg-white border border-slate-200/80'
            }`}
          >
            Waveform Saliency
          </button>
          <button
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'history'
                ? 'bg-[#bc000a] text-white shadow-xs'
                : 'bg-white/80 text-[#34485e] hover:bg-white border border-slate-200/80'
            }`}
          >
            Experiment History
          </button>
        </div>
      </div>

      {/* Tab 1: Model Leaderboard */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-4">
          <div className="matte-3d-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#101c28]">
                  Comparative Performance on MIT-BIH Arrhythmia Dataset
                </h3>
                <p className="text-[11px] text-[#5c7b99]">
                  Evaluated following AAMI EC57 inter-patient split protocol
                </p>
              </div>

              <span className="text-[11px] font-semibold text-[#008744] bg-[#e6f7ec] px-2.5 py-1 rounded-full border border-[#008744]/20">
                Proposed Model: +4.03% Macro F1 vs 1D-CNN
              </span>
            </div>

            {/* Model Comparison Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[#5c7b99] font-bold text-[11px]">
                    <th className="py-2.5 px-3">Model Architecture</th>
                    <th className="py-2.5 px-2.5 text-right">Accuracy</th>
                    <th className="py-2.5 px-2.5 text-right text-[#bc000a]">Macro F1</th>
                    <th className="py-2.5 px-2 text-right">S-F1</th>
                    <th className="py-2.5 px-2 text-right">V-F1</th>
                    <th className="py-2.5 px-2 text-right">F-F1</th>
                    <th className="py-2.5 px-2.5 text-center">Qubits</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {BENCHMARK_MODELS.map((model) => (
                    <tr
                      key={model.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        model.isProposed ? 'bg-[#ffe8e8]/30 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {model.isProposed && (
                            <span className="material-symbols-outlined text-[14px] text-[#bc000a]">
                              stars
                            </span>
                          )}
                          <span
                            className={model.isProposed ? 'text-[#bc000a] font-bold' : 'text-[#101c28]'}
                          >
                            {model.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#5c7b99] block font-normal">
                          {model.paramsCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-[#101c28]">
                        {model.accuracy.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-[#bc000a]">
                        {model.macroF1.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                        {model.sF1}%
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                        {model.vF1}%
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                        {model.fF1}%
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono">
                        {model.qubitCount > 0 ? (
                          <span className="bg-[#e0f2fe] text-[#0284c7] font-bold px-1.5 py-0.5 rounded text-[10px]">
                            {model.qubitCount}q
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#5c7b99]">
                        {model.inferenceMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Benchmark Analysis Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-[#101c28] block mb-1">
                  Why Quantum Entanglement Matters Here:
                </span>
                <p className="text-[11px] text-[#5d3f3b] leading-relaxed">
                  Classical networks struggle on class <strong className="text-[#101c28]">F (Fusion)</strong>{' '}
                  (83.4% F1 on 1D-CNN) due to severe morphological overlap with normal beats. Our 8-qubit
                  variational circuit maps non-linear correlations through multi-qubit CNOT entanglement,
                  boosting Fusion F1 to <strong className="text-[#008744]">91.2%</strong>.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-[#101c28] block mb-1">
                  Edge & Embedded Feasibility:
                </span>
                <p className="text-[11px] text-[#5d3f3b] leading-relaxed">
                  With only 48 trainable quantum parameters and an 8-qubit statevector, inference takes just{' '}
                  <strong className="text-[#101c28]">14.2 ms</strong>. This makes hybrid deployment on edge
                  microcontrollers or real-time Holter monitors completely practical.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: AAMI Confusion Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="matte-3d-card rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#101c28]">
                  Normalized AAMI 5-Class Confusion Matrix
                </h3>
                <p className="text-[11px] text-[#5c7b99]">
                  Hybrid VQC Test Set Evaluations (Values in %)
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
                Diagonal Avg: 96.16%
              </span>
            </div>

            {/* 5x5 Matrix */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 overflow-x-auto">
              <div className="min-w-[420px]">
                {/* Column Headers */}
                <div className="grid grid-cols-6 gap-1 text-[10px] font-bold text-center text-[#5c7b99] pb-1 border-b border-slate-100">
                  <div className="text-left">True \ Pred</div>
                  <div className="text-[#008744]">N (Norm)</div>
                  <div className="text-[#d97706]">S (SVEB)</div>
                  <div className="text-[#bc000a]">V (VEB)</div>
                  <div className="text-[#8b5cf6]">F (Fusion)</div>
                  <div className="text-[#0284c7]">Q (Unknown)</div>
                </div>

                {/* Rows */}
                <div className="space-y-1 pt-1.5">
                  {confusionMatrix.map((item) => (
                    <div key={item.trueCls} className="grid grid-cols-6 gap-1 text-xs font-mono items-center">
                      <div className="font-bold text-[#101c28] text-left text-[11px]">
                        Class {item.trueCls}
                      </div>
                      {item.row.map((val, colIdx) => {
                        const isDiag = (
                          (item.trueCls === 'N' && colIdx === 0) ||
                          (item.trueCls === 'S' && colIdx === 1) ||
                          (item.trueCls === 'V' && colIdx === 2) ||
                          (item.trueCls === 'F' && colIdx === 3) ||
                          (item.trueCls === 'Q' && colIdx === 4)
                        );
                        return (
                          <div
                            key={colIdx}
                            className={`py-2 rounded text-center transition-all ${
                              isDiag
                                ? 'bg-[#bc000a] text-white font-bold shadow-2xs'
                                : val > 2
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : val > 0.5
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {val.toFixed(1)}%
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Matrix Legend */}
            <div className="text-[11px] text-[#5d3f3b] flex items-center justify-between pt-1">
              <span>Rows represent ground truth; columns represent hybrid quantum model outputs.</span>
              <span className="text-[#bc000a] font-semibold">Deep red denotes high diagonal precision</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Waveform Saliency */}
      {activeTab === 'saliency' && (
        <div className="space-y-4">
          <div className="matte-3d-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#101c28]">
                  Integrated Gradients Waveform Explainability
                </h3>
                <p className="text-[11px] text-[#5c7b99]">
                  Electrophysiological attribution across all 187 temporal features
                </p>
              </div>

              {/* Beat Selector */}
              <div className="flex gap-1">
                {BENCHMARK_ECG_BEATS.map((beat, idx) => (
                  <button
                    key={beat.id}
                    onClick={() => setSelectedBeatIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedBeatIdx === idx
                        ? 'bg-[#bc000a] text-white'
                        : 'bg-white border border-slate-200 text-[#34485e]'
                    }`}
                  >
                    Class {beat.classType}
                  </button>
                ))}
              </div>
            </div>

            {/* Saliency Heatmap Overview */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#101c28]">
                  {activeBeat.className} ({activeBeat.recordId}) — Attribution Profile
                </span>
                <span className="text-[#bc000a] font-mono text-[11px]">
                  QRS Duration: {activeBeat.fiducials.qrsDurationMs} ms
                </span>
              </div>

              {/* Segment Bars */}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#101c28]">QRS Complex (Ventricular Depolarization)</span>
                    <span className="font-mono font-bold text-[#bc000a]">
                      {(activeBeat.segmentAttribution.qrsComplex * 100).toFixed(0)}% Saliency
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#bc000a] rounded-full"
                      style={{ width: `${activeBeat.segmentAttribution.qrsComplex * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#101c28]">P-Wave (Atrial Depolarization)</span>
                    <span className="font-mono font-bold text-[#0284c7]">
                      {(activeBeat.segmentAttribution.pWave * 100).toFixed(0)}% Saliency
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0284c7] rounded-full"
                      style={{ width: `${activeBeat.segmentAttribution.pWave * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#101c28]">T-Wave (Ventricular Repolarization)</span>
                    <span className="font-mono font-bold text-[#008744]">
                      {(activeBeat.segmentAttribution.tWave * 100).toFixed(0)}% Saliency
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#008744] rounded-full"
                      style={{ width: `${activeBeat.segmentAttribution.tWave * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Verification Note */}
              <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80 text-xs text-[#5d3f3b] leading-relaxed">
                <span className="font-bold text-[#101c28]">Clinical Decision Rationale:</span>{' '}
                {activeBeat.clinicalDescription}
              </div>

              {onNavigateToPipeline && (
                <button
                  onClick={onNavigateToPipeline}
                  className="text-xs font-semibold text-[#bc000a] flex items-center gap-1 hover:underline pt-1 cursor-pointer"
                >
                  View full interactive 187-sample signal & fiducial overlays
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Experiment History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="matte-3d-card rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#101c28]">
                  Quantum ML Experiment Run Logs
                </h3>
                <p className="text-[11px] text-[#5c7b99]">
                  Hyperparameter iterations & ansatz ablation tracking
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#5c7b99]">
                5 Runs Recorded
              </span>
            </div>

            {/* Run List */}
            <div className="space-y-2">
              {EXPERIMENT_HISTORY.map((run) => (
                <div
                  key={run.runId}
                  className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#101c28]">
                        {run.runId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          run.status === 'Optimal'
                            ? 'bg-[#e6f7ec] text-[#008744]'
                            : run.status === 'Converged'
                            ? 'bg-[#e0f2fe] text-[#0284c7]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {run.status}
                      </span>
                      <span className="text-[10px] text-[#5c7b99]">{run.timestamp}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#34485e]">{run.name}</h4>
                    <span className="text-[10px] text-[#5c7b99] font-mono block">
                      Ansatz: {run.ansatz} • z = {run.latentDim} • Layers: {run.layers} • LR:{' '}
                      {run.learningRate}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] text-[#5c7b99] block uppercase">Accuracy</span>
                      <span className="font-mono font-bold text-xs text-[#101c28]">
                        {run.accuracy.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#bc000a] block uppercase font-semibold">
                        Macro F1
                      </span>
                      <span className="font-mono font-bold text-xs text-[#bc000a]">
                        {run.macroF1.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
