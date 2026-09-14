import { useState, useMemo } from 'react';
import { EXPERIMENTS_DATABASE, ExperimentRecord } from '../data/experimentsData';
import { ExperimentDetailModal } from './ExperimentDetailModal';

interface ExperimentsScreenProps {
  onNavigateToQuantumLab?: () => void;
  onNavigateToOverview?: () => void;
  onNavigateToExplainability?: () => void;
  onNavigateToBenchmarks?: () => void;
}

export const ExperimentsScreen = ({
  onNavigateToQuantumLab,
  onNavigateToOverview,
  onNavigateToExplainability,
  onNavigateToBenchmarks,
}: ExperimentsScreenProps) => {
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentRecord | null>(null);
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredExperiments = useMemo(() => {
    return EXPERIMENTS_DATABASE.filter((exp) => {
      const matchesModel =
        selectedModelFilter === 'all' || exp.modelType.toLowerCase() === selectedModelFilter.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === '' ||
        exp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.encoder.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.dataset.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesModel && matchesSearch;
    });
  }, [selectedModelFilter, searchQuery]);

  return (
    <div id="experiments-screen" className="space-y-6 pb-24 w-full select-none">
      {/* HEADER SECTION (Strictly per user prompt) */}
      <section id="experiments-header-section" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                EXPERIMENT REGISTRY
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#ffe8e8] text-[#bc000a] px-2 py-0.5 rounded border border-[#bc000a]/20">
                Reproducible Framework
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#101c28]">
              Experiments & Run Registry
            </h1>
            <p className="text-xs sm:text-sm text-[#5c7b99] font-medium mt-0.5">
              Reproducible hybrid quantum-classical training runs, hyperparameter sweeps & artifacts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToQuantumLab && (
              <button
                onClick={onNavigateToQuantumLab}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px] text-[#6d28d9]">memory</span>
                Quantum Lab
              </button>
            )}
            {onNavigateToOverview && (
              <button
                onClick={onNavigateToOverview}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px] text-[#0369a1]">hub</span>
                Overview
              </button>
            )}
          </div>
        </div>

        {/* Subheading: "Reproducible model runs and evaluations" */}
        <p className="text-sm font-medium text-[#5c7b99]">
          Reproducible model runs and evaluations
        </p>
      </section>

      {/* Reproducibility Framework Banner */}
      <section id="reproducibility-banner">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">science</span>
            </span>
            <div className="space-y-0.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                Rigorous Evaluation Standards (AAMI EC57)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All experiment entries archive deterministic random seeds, inter-patient DS1/DS2 split manifests, execution backends, and full parameter configurations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold shadow-2xs">
              {EXPERIMENTS_DATABASE.length} Logged Runs
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold shadow-2xs">
              Seed: 42 Locked
            </span>
          </div>
        </div>
      </section>

      {/* SEARCH & FILTERS */}
      <section id="experiments-controls" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Model Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'All Models' },
            { id: 'vqc', label: 'VQC' },
            { id: 'qsvc', label: 'QSVC' },
            { id: 'mlp', label: 'MLP' },
            { id: '1d cnn', label: '1D CNN' },
            { id: 'rbf-svm', label: 'RBF-SVM' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedModelFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedModelFilter === item.id
                  ? 'bg-[#101c28] text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search runs, models, encoders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#bc000a]/20 focus:border-[#bc000a] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </section>

      {/* EXPERIMENTS LISTING */}
      {/*
        Each experiment displays:
        - Experiment ID
        - Dataset
        - Encoder
        - Qubits
        - Circuit Depth
        - Model
        - Macro-F1
        - Status
        - Date
      */}
      <section id="experiments-list-section" className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Showing {filteredExperiments.length} of {EXPERIMENTS_DATABASE.length} evaluation runs</span>
          <span className="text-[11px] font-mono">Click card to open full reproducible specification</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredExperiments.map((exp) => {
            const isCompleted = exp.status === 'Completed';
            const isInProgress = exp.status === 'In Progress';
            const isQuantum = exp.qubits !== null && exp.qubits > 0;

            return (
              <div
                key={exp.id}
                id={`experiment-card-${exp.id.toLowerCase()}`}
                onClick={() => setSelectedExperiment(exp)}
                className="group p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-[#bc000a]/40 hover:shadow-md transition-all cursor-pointer space-y-3.5 relative overflow-hidden"
              >
                {/* Subtle top indicator bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isQuantum ? 'bg-gradient-to-r from-[#bc000a] to-[#6d28d9]' : 'bg-slate-300'
                  }`}
                />

                {/* Primary Row: ID, Dataset, Status, Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2.5">
                    {/* Experiment ID */}
                    <span className="px-2.5 py-1 rounded-lg bg-[#bc000a]/10 text-[#bc000a] font-mono font-bold text-xs border border-[#bc000a]/20">
                      {exp.id}
                    </span>

                    {/* Model Badge */}
                    <span className="font-bold text-sm text-[#101c28] group-hover:text-[#bc000a] transition-colors">
                      {exp.model}
                    </span>

                    {/* Quantum vs Classical Tag */}
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                        isQuantum
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isQuantum ? 'Hybrid Quantum' : 'Classical Baseline'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Status */}
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isInProgress
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {exp.status}
                    </span>

                    {/* Date */}
                    <span className="text-xs font-mono text-slate-500">
                      {exp.date}
                    </span>
                  </div>
                </div>

                {/* Main 6-Parameter Metric Grid */}
                {/*
                  Required:
                  - Dataset
                  - Encoder
                  - Qubits
                  - Circuit Depth
                  - Model
                  - Macro-F1
                */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                  {/* Dataset */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dataset
                    </span>
                    <span className="font-medium text-slate-800 truncate block mt-0.5" title={exp.dataset}>
                      {exp.dataset}
                    </span>
                  </div>

                  {/* Encoder */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Encoder
                    </span>
                    <span className="font-medium text-slate-800 truncate block mt-0.5" title={exp.encoder}>
                      {exp.encoder}
                    </span>
                  </div>

                  {/* Qubits */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Qubits
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block mt-0.5">
                      {exp.qubits !== null ? `${exp.qubits} qubits` : 'N/A'}
                    </span>
                  </div>

                  {/* Circuit Depth */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Circuit Depth
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block mt-0.5">
                      {exp.circuitDepth !== null ? `Depth ${exp.circuitDepth}` : 'N/A'}
                    </span>
                  </div>

                  {/* Model */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Model
                    </span>
                    <span className="font-semibold text-slate-800 truncate block mt-0.5">
                      {exp.model}
                    </span>
                  </div>

                  {/* Macro-F1 */}
                  <div className="sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Macro-F1
                    </span>
                    <span className="font-mono font-bold text-[#bc000a] text-sm block mt-0.5">
                      {(exp.macroF1 * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Description & Open Inspection Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/80 text-[11px] text-slate-500">
                  <p className="line-clamp-1 flex-1 pr-2">
                    {exp.description}
                  </p>

                  <span className="font-semibold text-[#bc000a] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                    Open Run Details
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredExperiments.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
            <span className="material-symbols-outlined text-slate-400 text-3xl">filter_list_off</span>
            <p className="text-slate-700 font-semibold text-sm">No evaluation runs match your criteria</p>
            <p className="text-xs text-slate-500">Try resetting filters or clear your search term.</p>
            <button
              onClick={() => {
                setSelectedModelFilter('all');
                setSearchQuery('');
              }}
              className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* Quick Navigation Footer */}
      <section id="experiments-quick-nav" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div
          onClick={onNavigateToBenchmarks}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#bc000a] text-[18px]">query_stats</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Comparative Benchmarks
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Compare latency, macro-F1, and confusion matrices across models.
          </p>
        </div>

        <div
          onClick={onNavigateToExplainability}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0369a1] text-[18px]">insights</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Explainability & Saliency
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Inspect quantum latent feature back-projection to the 187-sample waveform.
          </p>
        </div>
      </section>

      {/* EXPERIMENT DETAIL MODAL */}
      <ExperimentDetailModal
        experiment={selectedExperiment}
        onClose={() => setSelectedExperiment(null)}
        onNavigateToQuantumLab={onNavigateToQuantumLab}
        onNavigateToExplainability={onNavigateToExplainability}
      />
    </div>
  );
};
