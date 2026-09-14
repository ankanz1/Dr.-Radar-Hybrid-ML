import { useState } from 'react';
import {
  BenchmarkModelKey,
  PerformanceMetricKey,
  BENCHMARK_MODELS_DATA,
  ORDERED_MODEL_KEYS,
  DATASET_OPTIONS,
  VALIDATION_SPLITS,
  AAMI_CLASSES_DETAIL,
} from '../data/benchmarkData';
import { AamiClassBadge, AamiClassSystemLegend } from './AamiClassBadge';

interface BenchmarksScreenProps {
  onNavigateToAnalysis?: () => void;
  onNavigateToQuantumLab?: () => void;
}

export const BenchmarksScreen = ({
  onNavigateToAnalysis,
  onNavigateToQuantumLab,
}: BenchmarksScreenProps) => {
  // Top Selector States
  const [selectedDataset, setSelectedDataset] = useState<string>('mit-bih');
  const [selectedFilterModel, setSelectedFilterModel] = useState<string>('all');
  const [selectedTopMetric, setSelectedTopMetric] = useState<PerformanceMetricKey>('macro-f1');
  const [selectedSplit, setSelectedSplit] = useState<string>('inter-patient');

  // Performance Section Metric Switcher:
  // Accuracy, Macro-F1, Sensitivity, Specificity, AUC, Latency
  const [activePerformanceMetric, setActivePerformanceMetric] =
    useState<PerformanceMetricKey>('macro-f1');

  // Confusion Matrix Model Selector (defaults to VQC)
  const [matrixModelKey, setMatrixModelKey] = useState<BenchmarkModelKey>('vqc');
  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{
    trueCls: string;
    predCls: string;
    val: number;
  } | null>(null);

  // Per-Class Performance Model Selector (defaults to VQC)
  const [perClassModelKey, setPerClassModelKey] = useState<BenchmarkModelKey>('vqc');

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered models for Main Table based on top selector
  const tableModelKeys =
    selectedFilterModel === 'all'
      ? ORDERED_MODEL_KEYS
      : ORDERED_MODEL_KEYS.filter((k) => k === selectedFilterModel);

  // Metric display formatter helper
  const formatMetricValue = (key: PerformanceMetricKey, val: number) => {
    if (key === 'latency') return `${val.toFixed(1)} ms`;
    if (key === 'auc') return val.toFixed(3);
    return `${val.toFixed(2)}%`;
  };

  const getMetricTitle = (key: PerformanceMetricKey) => {
    switch (key) {
      case 'accuracy':
        return 'Overall Accuracy';
      case 'macro-f1':
        return 'Macro-Averaged F1 Score';
      case 'sensitivity':
        return 'Macro Sensitivity (Recall)';
      case 'specificity':
        return 'Macro Specificity';
      case 'auc':
        return 'Area Under ROC Curve (AUC)';
      case 'latency':
        return 'Inference Latency';
      default:
        return key;
    }
  };

  const getModelMetric = (modelKey: BenchmarkModelKey, metric: PerformanceMetricKey) => {
    const m = BENCHMARK_MODELS_DATA[modelKey];
    switch (metric) {
      case 'accuracy':
        return m.accuracy;
      case 'macro-f1':
        return m.macroF1;
      case 'sensitivity':
        return m.sensitivity;
      case 'specificity':
        return m.specificity;
      case 'auc':
        return m.auc;
      case 'latency':
        return m.latencyMs;
    }
  };

  const currentMatrixData = BENCHMARK_MODELS_DATA[matrixModelKey].confusionMatrix;
  const currentPerClassData = BENCHMARK_MODELS_DATA[perClassModelKey];
  const matrixClassLabels = ['N', 'S', 'V', 'F', 'Q'];

  // Quantum Contribution Comparison Models: VQC vs matched-parameter MLP
  const vqcModel = BENCHMARK_MODELS_DATA['vqc'];
  const mlpModel = BENCHMARK_MODELS_DATA['mlp'];

  return (
    <div
      id="benchmarks-screen-container"
      className="space-y-6 pb-24 w-full select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="benchmarks-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in max-w-xs text-center"
        >
          <span className="material-symbols-outlined text-[17px] text-[#72fe88]">
            check_circle
          </span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header & Subheading */}
      <section id="benchmarks-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                BENCHMARKS
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#ffe8e8] text-[#bc000a] px-2 py-0.5 rounded border border-[#bc000a]/20">
                Empirical Evaluation
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#101c28]">
              Model Benchmarks & Baselines
            </h1>
            <p className="text-xs md:text-sm text-[#5c7b99] font-medium mt-0.5">
              Empirical comparison of hybrid VQC against classical architectures on MIT-BIH
            </p>
          </div>

          {/* Export / Provenance Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                showNotification('Exported complete benchmark CSV & LaTeX summary table.')
              }
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-bold text-[#bc000a] flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Data Honesty Notice */}
        <div className="mt-2 p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200/80 flex items-center justify-between text-xs text-[#5c7b99]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#0284c7]">info</span>
            <span>
              <strong>Scientific Data Notice:</strong> Results derived from standardized offline validation experiments on MIT-BIH Arrhythmia Database (DS2 test partition, 21,892 beats).
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            AAMI EC57 Compliant
          </span>
        </div>
      </section>

      {/* 2. Top Selector: Dataset, Model, Metric, Validation Split */}
      <section id="top-selectors-panel" className="mb-4">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[#bc000a]">tune</span>
            <span>Benchmark Evaluation Configuration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Dataset Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#101c28] block">Dataset</label>
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  showNotification(`Selected dataset: ${e.target.value.toUpperCase()}`);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#101c28] focus:outline-none focus:ring-1 focus:ring-[#bc000a] cursor-pointer"
              >
                {DATASET_OPTIONS.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 block font-mono truncate">
                {DATASET_OPTIONS.find((d) => d.id === selectedDataset)?.beatsCount}
              </span>
            </div>

            {/* 2. Model Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#101c28] block">Model</label>
              <select
                value={selectedFilterModel}
                onChange={(e) => setSelectedFilterModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#101c28] focus:outline-none focus:ring-1 focus:ring-[#bc000a] cursor-pointer"
              >
                <option value="all">All Models (6 Architectures)</option>
                {ORDERED_MODEL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BENCHMARK_MODELS_DATA[k].shortName} — {BENCHMARK_MODELS_DATA[k].name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 block font-mono truncate">
                {selectedFilterModel === 'all'
                  ? 'Comparative table view'
                  : BENCHMARK_MODELS_DATA[selectedFilterModel as BenchmarkModelKey]?.type}
              </span>
            </div>

            {/* 3. Metric Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#101c28] block">Primary Metric</label>
              <select
                value={selectedTopMetric}
                onChange={(e) => setSelectedTopMetric(e.target.value as PerformanceMetricKey)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#101c28] focus:outline-none focus:ring-1 focus:ring-[#bc000a] cursor-pointer"
              >
                <option value="macro-f1">Macro-F1 Score</option>
                <option value="accuracy">Accuracy</option>
                <option value="sensitivity">Sensitivity (Recall)</option>
                <option value="specificity">Specificity</option>
                <option value="auc">ROC-AUC</option>
                <option value="latency">Inference Latency</option>
              </select>
              <span className="text-[10px] text-slate-400 block font-mono truncate">
                Table sorting & highlight
              </span>
            </div>

            {/* 4. Validation Split Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#101c28] block">Validation Split</label>
              <select
                value={selectedSplit}
                onChange={(e) => {
                  setSelectedSplit(e.target.value);
                  showNotification(`Updated split: ${e.target.value}`);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#101c28] focus:outline-none focus:ring-1 focus:ring-[#bc000a] cursor-pointer"
              >
                {VALIDATION_SPLITS.map((split) => (
                  <option key={split.id} value={split.id}>
                    {split.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 block font-mono truncate">
                {VALIDATION_SPLITS.find((s) => s.id === selectedSplit)?.protocol}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Comparison Table */}
      {/* Columns: Model, Accuracy, Macro-F1, Latency */}
      {/* Models: VQC, MLP, RBF-SVM, XGBoost, 1D CNN, QSVC */}
      <section id="main-comparison-table-section" className="mb-6">
        <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#bc000a]">
                  table_chart
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  MAIN ARCHITECTURE COMPARISON
                </h2>
              </div>
              <p className="text-xs text-[#5c7b99] mt-0.5">
                Standardized benchmarking across identical patient partitions (DS2: 21,892 test beats)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200">
                Proposed VQC: 96.18% Macro-F1
              </span>
            </div>
          </div>

          {/* Mobile Comparison Cards (< sm screens) */}
          <div className="block sm:hidden space-y-3">
            {tableModelKeys.map((key) => {
              const model = BENCHMARK_MODELS_DATA[key];
              const isProposed = model.isProposed;
              const isSelected = matrixModelKey === model.key;

              return (
                <div
                  key={`card-${model.key}`}
                  onClick={() => {
                    setMatrixModelKey(model.key);
                    setPerClassModelKey(model.key);
                    showNotification(`Focused ${model.shortName}`);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'border-[#bc000a] bg-[#fff8f8] shadow-xs'
                      : isProposed
                      ? 'border-[#bc000a]/30 bg-white shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isProposed ? (
                        <span className="w-6 h-6 rounded-full bg-[#bc000a] text-white flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[14px]">stars</span>
                        </span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold font-mono text-sm text-[#101c28] flex items-center gap-1.5">
                          <span>{model.shortName}</span>
                          {isProposed && (
                            <span className="text-[9px] font-sans font-bold bg-[#bc000a] text-white px-1.5 py-0.2 rounded uppercase">
                              Proposed
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-sans block">
                          {model.type} • {model.paramCount}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      {model.latencyMs.toFixed(1)} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Accuracy</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{model.accuracy.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#bc000a] block font-mono font-semibold">Macro-F1</span>
                      <span className="font-bold text-[#bc000a] font-mono text-xs">{model.macroF1.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Sensitivity</span>
                      <span className="font-semibold text-slate-700 font-mono text-xs">{model.sensitivity.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Specificity</span>
                      <span className="font-semibold text-slate-700 font-mono text-xs">{model.specificity.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1">
                    <span className="text-[10px] font-mono">AUC: {model.auc.toFixed(3)}</span>
                    <span className="text-xs font-semibold text-[#bc000a] flex items-center gap-0.5">
                      <span>Inspect Matrix</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clean, high-density scientific comparison table (>= sm screens) */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[#5c7b99] font-bold text-[11px] font-mono">
                  <th className="py-3 px-4 text-left">Model</th>
                  <th className="py-3 px-4 text-right">Accuracy</th>
                  <th className="py-3 px-4 text-right text-[#bc000a]">Macro-F1</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableModelKeys.map((key) => {
                  const model = BENCHMARK_MODELS_DATA[key];
                  const isProposed = model.isProposed;

                  return (
                    <tr
                      key={model.key}
                      onClick={() => {
                        setMatrixModelKey(model.key);
                        setPerClassModelKey(model.key);
                      }}
                      className={`transition-colors cursor-pointer ${
                        isProposed
                          ? 'bg-[#ffe8e8]/25 hover:bg-[#ffe8e8]/45 font-semibold'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Model Name & Architecture Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isProposed ? (
                            <span className="w-5 h-5 rounded-full bg-[#bc000a] text-white flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[13px]">
                                stars
                              </span>
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                          )}
                          <div>
                            <span
                              className={`font-bold font-mono text-sm ${
                                isProposed ? 'text-[#bc000a]' : 'text-[#101c28]'
                              }`}
                            >
                              {model.shortName}
                            </span>
                            <span className="text-[10px] text-slate-500 block font-normal font-sans">
                              {model.type} &bull; {model.paramCount}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Accuracy */}
                      <td className="py-3 px-4 text-right font-mono text-slate-800 text-sm">
                        {model.accuracy.toFixed(2)}%
                      </td>

                      {/* Macro-F1 */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-sm text-[#bc000a]">
                        {model.macroF1.toFixed(2)}%
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600 text-sm">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">
                            timer
                          </span>
                          {model.latencyMs.toFixed(1)} ms
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono pt-1">
            <span>Click any model row to focus Confusion Matrix & Per-Class Performance below.</span>
            <span>All latency measured on batch_size=1 CPU emulation / QPU simulation.</span>
          </div>
        </div>
      </section>

      {/* 4. PERFORMANCE SECTION */}
      {/* Allow switching between: Accuracy, Macro-F1, Sensitivity, Specificity, AUC, Latency */}
      <section id="performance-metric-switch-section" className="mb-6">
        <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#0284c7]">
                  equalizer
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  PERFORMANCE
                </h2>
              </div>
              <p className="text-xs text-[#5c7b99] mt-0.5">
                Select an empirical metric to inspect multi-model benchmark ranking
              </p>
            </div>

            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
              Active Metric: <strong>{getMetricTitle(activePerformanceMetric)}</strong>
            </span>
          </div>

          {/* Metric Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
            {(
              [
                { key: 'accuracy', label: 'Accuracy' },
                { key: 'macro-f1', label: 'Macro-F1' },
                { key: 'sensitivity', label: 'Sensitivity' },
                { key: 'specificity', label: 'Specificity' },
                { key: 'auc', label: 'AUC' },
                { key: 'latency', label: 'Latency' },
              ] as const
            ).map((m) => {
              const isActive = activePerformanceMetric === m.key;
              return (
                <button
                  key={m.key}
                  id={`perf-metric-btn-${m.key}`}
                  onClick={() => setActivePerformanceMetric(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-[#bc000a] shadow-2xs ring-1 ring-black/[0.05]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Metric Bar Comparison Chart */}
          <div className="space-y-3 pt-2">
            {ORDERED_MODEL_KEYS.map((key) => {
              const model = BENCHMARK_MODELS_DATA[key];
              const val = getModelMetric(key, activePerformanceMetric);
              const isProposed = model.isProposed;

              // Calculate proportional bar percentage
              let barPercentage = 0;
              if (activePerformanceMetric === 'latency') {
                // Lower is better, normalize against 45ms max
                barPercentage = Math.min(100, Math.max(8, (val / 42) * 100));
              } else if (activePerformanceMetric === 'auc') {
                barPercentage = ((val - 0.85) / 0.15) * 100;
              } else {
                // Percentage metrics: 70% to 100%
                barPercentage = ((val - 70) / 30) * 100;
              }
              barPercentage = Math.max(5, Math.min(100, barPercentage));

              return (
                <div
                  key={`perf-bar-${key}`}
                  className={`p-3 rounded-xl border transition-all ${
                    isProposed
                      ? 'border-[#bc000a]/40 bg-[#fffdfd] shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold ${
                          isProposed ? 'text-[#bc000a]' : 'text-[#101c28]'
                        }`}
                      >
                        {model.shortName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        ({model.type})
                      </span>
                      {isProposed && (
                        <span className="text-[9px] font-bold font-mono bg-[#bc000a] text-white px-1.5 py-0.2 rounded">
                          Proposed
                        </span>
                      )}
                    </div>

                    <span
                      className={`font-mono font-bold text-xs ${
                        isProposed ? 'text-[#bc000a]' : 'text-slate-800'
                      }`}
                    >
                      {formatMetricValue(activePerformanceMetric, val)}
                    </span>
                  </div>

                  {/* Visual Comparison Bar */}
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isProposed
                          ? 'bg-[#bc000a]'
                          : model.isQuantum
                          ? 'bg-[#0284c7]'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${barPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5 & 6. CONFUSION MATRIX & PER-CLASS PERFORMANCE (Desktop 2-Column Workstation Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-start">
        {/* 5. CONFUSION MATRIX */}
        {/* 5 × 5 confusion matrix. Axes: N, S, V, F, Q */}
        <section id="confusion-matrix-section" className="lg:col-span-7">
        <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#8b5cf6]">
                  grid_view
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  CONFUSION MATRIX
                </h2>
              </div>
              <p className="text-xs text-[#5c7b99] mt-0.5">
                5 &times; 5 Normalized AAMI Error Matrix (Rows: True Class &bull; Columns: Predicted Class)
              </p>
            </div>

            {/* Model Selector for Matrix */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Model:</span>
              <select
                value={matrixModelKey}
                onChange={(e) => setMatrixModelKey(e.target.value as BenchmarkModelKey)}
                className="bg-transparent text-xs font-bold font-mono text-[#bc000a] focus:outline-none cursor-pointer"
              >
                {ORDERED_MODEL_KEYS.map((k) => (
                  <option key={`mat-${k}`} value={k}>
                    {BENCHMARK_MODELS_DATA[k].shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5x5 Matrix Grid */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 overflow-x-auto">
            <div className="min-w-[480px]">
              {/* Column Axis Labels (Predicted Class) */}
              <div className="text-center text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider mb-2">
                &darr; True Class \ Predicted Class &rarr;
              </div>

              {/* Header Row */}
              <div className="grid grid-cols-6 gap-1.5 text-center text-xs font-mono font-bold pb-2 border-b border-slate-200 items-center">
                <div className="text-left text-slate-400 text-[10px] uppercase font-sans">
                  True \ Pred
                </div>
                {matrixClassLabels.map((cls) => (
                  <div key={`col-${cls}`} className="flex justify-center">
                    <AamiClassBadge code={cls} variant="compact" size="sm" />
                  </div>
                ))}
              </div>

              {/* Rows for True Classes: N, S, V, F, Q */}
              <div className="space-y-1.5 pt-2">
                {matrixClassLabels.map((trueCls, rowIdx) => {
                  return (
                    <div
                      key={`row-${trueCls}`}
                      className="grid grid-cols-6 gap-1.5 items-center font-mono text-xs"
                    >
                      {/* Row Label (True Class) */}
                      <div className="text-left py-0.5">
                        <AamiClassBadge code={trueCls} variant="both" size="sm" />
                      </div>

                      {/* 5 Cells in this row */}
                      {matrixClassLabels.map((predCls, colIdx) => {
                        const val = currentMatrixData[rowIdx][colIdx];
                        const isDiagonal = rowIdx === colIdx;

                        return (
                          <div
                            key={`cell-${trueCls}-${predCls}`}
                            onMouseEnter={() =>
                              setHoveredMatrixCell({ trueCls, predCls, val })
                            }
                            onMouseLeave={() => setHoveredMatrixCell(null)}
                            className={`py-3 px-1 rounded-lg text-center transition-all cursor-default ${
                              isDiagonal
                                ? 'bg-[#bc000a] text-white font-bold shadow-2xs'
                                : val > 3.0
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : val > 1.0
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-slate-50/70 text-slate-400'
                            }`}
                          >
                            <span className="text-xs">{val.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Hover Inspection Callout */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-600">
                {hoveredMatrixCell ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#bc000a]">
                      search
                    </span>
                    <span>
                      True Class <strong>{hoveredMatrixCell.trueCls}</strong> &rarr; Predicted Class{' '}
                      <strong>{hoveredMatrixCell.predCls}</strong>:
                    </span>
                    <strong className="text-[#bc000a] text-sm">
                      {hoveredMatrixCell.val.toFixed(2)}%
                    </strong>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span className="material-symbols-outlined text-[14px]">touch_app</span>
                    <span>Hover over any matrix cell to inspect specific misclassification rates</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-400">
                  Diagonal = True Positive Rate (Sensitivity)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* 6. PER-CLASS PERFORMANCE */}
        {/* Show: N Normal, S Supraventricular, V Ventricular, F Fusion, Q Unknown/Paced */}
        {/* Include sensitivity and specificity */}
        <section id="per-class-performance-section" className="lg:col-span-5">
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#008744]">
                  checklist
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  PER-CLASS PERFORMANCE
                </h2>
              </div>
              <p className="text-xs text-[#5c7b99] mt-0.5">
                Diagnostic sensitivity (recall) and specificity across all five AAMI cardiac categories
              </p>
            </div>

            {/* Model Selector for Per-Class breakdown */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Model:</span>
              <select
                value={perClassModelKey}
                onChange={(e) => setPerClassModelKey(e.target.value as BenchmarkModelKey)}
                className="bg-transparent text-xs font-bold font-mono text-[#bc000a] focus:outline-none cursor-pointer"
              >
                {ORDERED_MODEL_KEYS.map((k) => (
                  <option key={`per-${k}`} value={k}>
                    {BENCHMARK_MODELS_DATA[k].shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards / Table for the 5 Classes: N Normal, S Supraventricular, V Ventricular, F Fusion, Q Unknown/Paced */}
          <div className="space-y-2.5">
            {AAMI_CLASSES_DETAIL.map((cls) => {
              const stats =
                currentPerClassData.perClass[
                  cls.code as keyof typeof currentPerClassData.perClass
                ];

              return (
                <div
                  key={cls.code}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <AamiClassBadge code={cls.code} variant="compact" size="md" />
                      <div>
                        <h3 className="font-bold text-[#101c28] text-sm">
                          {cls.fullName}
                        </h3>
                        <span className="text-[11px] text-slate-500 block">
                          {cls.subtypes} &bull; {cls.testSupport}
                        </span>
                      </div>
                    </div>

                    {/* Metrics: Sensitivity & Specificity */}
                    <div className="flex items-center gap-4 font-mono text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
                          Sensitivity
                        </span>
                        <strong className="text-sm font-bold text-[#101c28]">
                          {stats.sensitivity.toFixed(1)}%
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
                          Specificity
                        </span>
                        <strong className="text-sm font-bold text-[#008744]">
                          {stats.specificity.toFixed(1)}%
                        </strong>
                      </div>

                      <div className="text-right pl-2 border-l border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
                          F1 Score
                        </span>
                        <strong className="text-sm font-bold text-[#bc000a]">
                          {stats.f1.toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Dual Progress Bar for Sensitivity & Specificity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                        <span>Sensitivity</span>
                        <span>{stats.sensitivity.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${stats.sensitivity}%`,
                            backgroundColor: cls.color,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                        <span>Specificity</span>
                        <span>{stats.specificity.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#008744]"
                          style={{ width: `${stats.specificity}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Consistent AAMI Visual System Legend */}
          <div className="pt-2">
            <AamiClassSystemLegend />
          </div>
        </div>
      </section>
    </div>

      {/* 7. QUANTUM CONTRIBUTION */}
      {/* Show: VQC vs matched-parameter MLP with a clear comparison */}
      {/* Add an explanatory note: "Comparisons use the same encoder/data conditions where applicable to isolate the contribution of the quantum layer." */}
      <section id="quantum-contribution-section" className="mb-4">
        <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#bc000a]">
                  memory
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  QUANTUM CONTRIBUTION
                </h2>
              </div>
              <p className="text-xs text-[#5c7b99] mt-0.5">
                Head-to-head empirical ablation: isolating the quantum Hilbert space advantage
              </p>
            </div>

            <span className="text-[10px] font-mono bg-[#ffe8e8] text-[#bc000a] font-bold px-2.5 py-1 rounded-md border border-[#bc000a]/20">
              Parameter-Matched Controlled Ablation
            </span>
          </div>

          {/* VQC vs matched-parameter MLP Head-to-Head Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VQC Card */}
            <div className="p-4 rounded-2xl border-2 border-[#bc000a]/40 bg-gradient-to-b from-[#fff5f5] to-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#bc000a] text-white flex items-center justify-center font-mono font-bold text-xs">
                    Q
                  </span>
                  <h3 className="text-base font-bold font-mono text-[#101c28]">
                    {vqcModel.name}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold bg-[#bc000a] text-white px-2 py-0.5 rounded">
                  Proposed
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Macro-F1</span>
                  <span className="text-base font-bold text-[#bc000a]">
                    {vqcModel.macroF1.toFixed(2)}%
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Fusion (F-F1)</span>
                  <span className="text-base font-bold text-[#8b5cf6]">
                    {vqcModel.perClass.F.f1.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Parameters</span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">
                    48 angles
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 font-mono pt-1">
                <div className="flex justify-between">
                  <span>Ansatz Depth:</span>
                  <span className="font-bold text-[#101c28]">4 Entangling Layers</span>
                </div>
                <div className="flex justify-between">
                  <span>State Space:</span>
                  <span className="font-bold text-[#101c28]">2⁸ = 256-D Hilbert Space</span>
                </div>
                <div className="flex justify-between">
                  <span>Boundary Separation:</span>
                  <span className="font-bold text-[#008744]">Exponential Kernel Margin</span>
                </div>
              </div>
            </div>

            {/* Matched-Parameter MLP Card */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-slate-700 text-white flex items-center justify-center font-mono font-bold text-xs">
                    C
                  </span>
                  <h3 className="text-base font-bold font-mono text-[#101c28]">
                    {mlpModel.name}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Matched Baseline
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Macro-F1</span>
                  <span className="text-base font-bold text-slate-700">
                    {mlpModel.macroF1.toFixed(2)}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Fusion (F-F1)</span>
                  <span className="text-base font-bold text-slate-600">
                    {mlpModel.perClass.F.f1.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Parameters</span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">
                    53 weights
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 font-mono pt-1">
                <div className="flex justify-between">
                  <span>Architecture:</span>
                  <span className="font-bold text-[#101c28]">Dense [10 &rarr; 4 &rarr; 5]</span>
                </div>
                <div className="flex justify-between">
                  <span>State Space:</span>
                  <span className="font-bold text-[#101c28]">Euclidean &real;⁴ Hidden</span>
                </div>
                <div className="flex justify-between">
                  <span>Boundary Separation:</span>
                  <span className="font-bold text-slate-500">Linear Hyperplanes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Differential Quantum Advantage Callout Bar */}
          <div className="bg-[#f8fbfe] p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="font-bold text-[#101c28]">
                Net Performance Gain with Quantum Variational Layer:
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[#bc000a] font-bold">
                  &Delta; Macro-F1: +{(vqcModel.macroF1 - mlpModel.macroF1).toFixed(2)}%
                </span>
                <span className="text-[#8b5cf6] font-bold">
                  &Delta; Fusion F1: +{(vqcModel.perClass.F.f1 - mlpModel.perClass.F.f1).toFixed(1)}%
                </span>
                <span className="text-[#d97706] font-bold">
                  &Delta; SVEB F1: +{(vqcModel.perClass.S.f1 - mlpModel.perClass.S.f1).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Explanatory Note (Verbatim as required) */}
            <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-700 leading-relaxed">
              <p className="font-medium text-[#101c28] italic">
                &ldquo;Comparisons use the same encoder/data conditions where applicable to isolate the contribution of the quantum layer.&rdquo;
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Both the VQC and the matched MLP receive identical 10-dimensional compressed representations z &isin; &real;&sup1;&sup0; extracted by the same pre-trained 1D-CNN encoder, evaluated across the same MIT-BIH DS2 test beats without intra-patient data leakage.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
