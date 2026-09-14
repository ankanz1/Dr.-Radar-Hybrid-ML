import { useState, useMemo } from 'react';
import {
  DATASET_OVERVIEW_STATS,
  AAMI_DATASET_DISTRIBUTION,
  DATA_QUALITY_AUDIT,
  RESEARCH_DATASET_SAMPLES,
  ECGDatasetSample,
} from '../data/ecgDatasetData';
import { AAMI_SYSTEM_DISCLAIMER } from '../data/aamiClassSystem';
import { AamiClassBadge } from './AamiClassBadge';
import { ECGWaveformModal } from './ECGWaveformModal';

interface DatasetScreenProps {
  onNavigateToQuantumLab?: () => void;
  onNavigateToAnalysis?: () => void;
  onNavigateToBenchmarks?: () => void;
  onNavigateToExperiments?: () => void;
}

export const DatasetScreen = ({
  onNavigateToQuantumLab,
  onNavigateToAnalysis,
  onNavigateToBenchmarks,
  onNavigateToExperiments,
}: DatasetScreenProps) => {
  // Filters & State
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedSplitFilter, setSelectedSplitFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [distributionScale, setDistributionScale] = useState<'linear' | 'log'>('linear');
  const [activeTab, setActiveTab] = useState<'all' | 'quality' | 'samples'>('all');

  // Selected sample for waveform modal
  const [activeSampleIndex, setActiveSampleIndex] = useState<number | null>(null);

  // Filtered sample list
  const filteredSamples = useMemo(() => {
    return RESEARCH_DATASET_SAMPLES.filter((s) => {
      const matchClass =
        selectedClassFilter === 'all' || s.classCode.toLowerCase() === selectedClassFilter.toLowerCase();
      const matchSplit =
        selectedSplitFilter === 'all' ||
        (selectedSplitFilter === 'train' && s.split.includes('Train')) ||
        (selectedSplitFilter === 'test' && s.split.includes('Test'));
      const matchSearch =
        searchQuery.trim() === '' ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.recordId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.patientProfile.clinicalDiagnosis.toLowerCase().includes(searchQuery.toLowerCase());

      return matchClass && matchSplit && matchSearch;
    });
  }, [selectedClassFilter, selectedSplitFilter, searchQuery]);

  // Selected active sample object
  const activeSample: ECGDatasetSample | null =
    activeSampleIndex !== null && filteredSamples[activeSampleIndex]
      ? filteredSamples[activeSampleIndex]
      : null;

  const handleSelectSample = (sampleId: string) => {
    const idx = filteredSamples.findIndex((s) => s.id === sampleId);
    if (idx !== -1) {
      setActiveSampleIndex(idx);
    }
  };

  const handleNextSample = () => {
    if (activeSampleIndex !== null && activeSampleIndex < filteredSamples.length - 1) {
      setActiveSampleIndex(activeSampleIndex + 1);
    }
  };

  const handlePrevSample = () => {
    if (activeSampleIndex !== null && activeSampleIndex > 0) {
      setActiveSampleIndex(activeSampleIndex - 1);
    }
  };

  // Sparkline path generator for inline row previews
  const createSparklinePath = (signal: number[], width = 90, height = 24) => {
    const step = width / (signal.length - 1);
    return signal.reduce((acc, val, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - val * height * 0.9 - height * 0.05).toFixed(1);
      return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }, '');
  };

  return (
    <div id="dataset-screen" className="space-y-6 pb-24 w-full select-none">
      {/* 1. HEADER SECTION */}
      <section id="dataset-header-section" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                DATASETS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                AAMI EC57 Standard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#101c28]">
              {DATASET_OVERVIEW_STATS.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#5c7b99] font-medium mt-0.5">
              Standardized MIT-BIH & PTB-XL arrhythmia cohorts and benchmark splits
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToQuantumLab && (
              <button
                onClick={onNavigateToQuantumLab}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#6d28d9]">memory</span>
                Quantum Lab
              </button>
            )}
            {onNavigateToExperiments && (
              <button
                onClick={onNavigateToExperiments}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-700">science</span>
                Experiments
              </button>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#5c7b99] leading-relaxed">
          Standardized benchmark repository derived from PhysioNet MIT-BIH & PTB Diagnostic ECG databases,
          structured for quantum-classical neural classification and beat-level arrhythmia morphology studies.
        </p>
      </section>

      {/* 2. PRIMARY DATASET STATS BANNER (~109K heartbeats, 187 samples/features, 5 AAMI classes) */}
      <section id="dataset-primary-kpi-grid">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* KPI 1: ~109K Labelled Heartbeats */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#bc000a] to-rose-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Primary Corpus Volume
              </span>
              <span className="w-7 h-7 rounded-lg bg-rose-50 text-[#bc000a] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">ecg_heart</span>
              </span>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-[#101c28] tracking-tight font-mono">
                {DATASET_OVERVIEW_STATS.approximateTotal}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                {DATASET_OVERVIEW_STATS.totalFormatted} Labelled Heartbeats
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>DS1 Train: 87,554</span>
              <span>DS2 Test: 21,892</span>
            </div>
          </div>

          {/* KPI 2: 187 Samples / Features per Beat */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0369a1] to-sky-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Temporal Dimensionality
              </span>
              <span className="w-7 h-7 rounded-lg bg-sky-50 text-[#0369a1] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">timeline</span>
              </span>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-[#101c28] tracking-tight font-mono">
                {DATASET_OVERVIEW_STATS.featuresPerBeat}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                Samples / Features per Beat (125 Hz)
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Duration: 1,496 ms</span>
              <span>R-Peak: Index 70</span>
            </div>
          </div>

          {/* KPI 3: 5 AAMI Classes */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#047857] to-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Diagnostic Taxonomy
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#047857] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">category</span>
              </span>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-[#101c28] tracking-tight font-mono">
                {DATASET_OVERVIEW_STATS.classCount}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                Standard AAMI EC57 Classes
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Classes:</span>
              <div className="flex items-center gap-1 font-bold">
                {['N', 'S', 'V', 'F', 'Q'].map((code) => (
                  <span
                    key={code}
                    className="w-4 h-4 rounded text-[9px] flex items-center justify-center bg-slate-100 text-slate-800"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CLASS DISTRIBUTION VISUALIZATION (N, S, V, F, Q) */}
      <section id="class-distribution-section" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#bc000a] font-bold block">
              Prevalence & Epidemiology
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#101c28]">
              Class Distribution Visualization
            </h2>
            <p className="text-xs text-slate-500">
              Taxonomic breakdown of all 109,446 beats across AAMI categories (N, S, V, F, Q).
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[11px] font-bold text-slate-500 px-1.5">Scale:</span>
            <button
              onClick={() => setDistributionScale('linear')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                distributionScale === 'linear'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Linear %
            </button>
            <button
              onClick={() => setDistributionScale('log')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                distributionScale === 'log'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Log10 scale reveals minority classes (F and S) alongside dominant Normal class"
            >
              Log₁₀ Scale
            </button>
          </div>
        </div>

        {/* Stacked Proportional Bar Strip */}
        <div className="space-y-1.5">
          <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-xs border border-slate-200/90 bg-slate-100">
            {AAMI_DATASET_DISTRIBUTION.map((item) => (
              <div
                key={item.code}
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
                className="h-full relative group transition-all cursor-pointer hover:opacity-90"
                title={`${item.code} (${item.name}): ${item.count.toLocaleString()} beats (${item.percentage.toFixed(2)}%)`}
                onClick={() => setSelectedClassFilter(item.code.toLowerCase())}
              />
            ))}
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 px-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100% (109,446 Total Heartbeats)</span>
          </div>
        </div>

        {/* Individual Class Cards Grid: N, S, V, F, Q */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {AAMI_DATASET_DISTRIBUTION.map((item) => {
            const isFilterActive = selectedClassFilter.toLowerCase() === item.code.toLowerCase();

            // Calculate height or width according to scale
            // In linear, N is 82.8%, F is 0.73%
            // In log scale: log10(803) = 2.90, log10(90589) = 4.95
            const logValue = Math.log10(item.count);
            const logPercent = ((logValue - 2.5) / (5.0 - 2.5)) * 100;
            const barWidthPercent = distributionScale === 'linear' ? item.percentage : Math.max(12, logPercent);

            return (
              <div
                key={item.code}
                id={`class-card-${item.code.toLowerCase()}`}
                onClick={() =>
                  setSelectedClassFilter(isFilterActive ? 'all' : item.code.toLowerCase())
                }
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 relative overflow-hidden group ${
                  isFilterActive
                    ? 'border-[#bc000a] ring-2 ring-[#bc000a]/20 bg-white shadow-sm'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                {/* Top status indicator bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 transition-all"
                  style={{ backgroundColor: item.color }}
                />

                {/* Class Badge & Code */}
                <div className="flex items-center justify-between pt-0.5">
                  <span
                    className="w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.code}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Class Title & Count */}
                <div>
                  <h3 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-[#bc000a] transition-colors" title={item.name}>
                    {item.name}
                  </h3>
                  <div className="font-mono text-base font-extrabold text-[#101c28] mt-0.5">
                    {item.count.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">beats</span>
                </div>

                {/* Visual Bar Indicator */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, barWidthPercent)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>DS1: {item.trainCount.toLocaleString()}</span>
                    <span>DS2: {item.testCount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Imbalance Ratio */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">Ratio vs N:</span>
                  <span
                    className={`font-mono font-bold ${
                      item.imbalanceRatioVsMajority > 20
                        ? 'text-amber-700'
                        : item.imbalanceRatioVsMajority > 1
                        ? 'text-slate-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {item.imbalanceRatioVsMajority === 1.0 ? '1.0 (Ref)' : `${item.imbalanceRatioVsMajority}:1`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Note */}
        <p className="text-[11px] text-slate-400 italic">
          {AAMI_SYSTEM_DISCLAIMER}
        </p>
      </section>

      {/* 4. DATA QUALITY SECTION (Samples, Features, Missing values, Class balance, Normalization status) */}
      <section id="data-quality-section" className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#bc000a] font-bold block">
              Biomedical Integrity Audit
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#101c28]">
              DATA QUALITY
            </h2>
            <p className="text-xs text-slate-500">
              Rigorous dataset verification parameters across samples, features, completeness, skew, and scaling.
            </p>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            Audit Pass Rate: 100%
          </span>
        </div>

        {/* The 5 Required Quality Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {DATA_QUALITY_AUDIT.map((item) => {
            const isPassed = item.status === 'passed';
            const isWarning = item.status === 'warning';

            return (
              <div
                key={item.id}
                id={item.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isPassed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isWarning
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>

                  <div className="font-mono font-bold text-sm text-[#101c28]">
                    {item.value}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700">Verification Spec:</div>
                  <ul className="space-y-0.5 list-disc list-inside text-slate-600 leading-tight">
                    {item.technicalDetails.slice(0, 2).map((detail, idx) => (
                      <li key={idx} className="truncate" title={detail}>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Biomedical Protocol Specifications Callout */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </span>
            <div className="space-y-0.5">
              <h4 className="font-bold text-slate-800">
                AAMI EC57 Inter-Patient Validation Guarantee
              </h4>
              <p className="text-slate-500 text-[11px]">
                Patients assigned to DS2 Test split never appear in DS1 Training. This strictly prevents intra-patient identity leakage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
              Sampling: 125 Hz
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
              R-Peak: Idx 70
            </span>
          </div>
        </div>
      </section>

      {/* 5. SAMPLE PREVIEW SECTION (Table/list of ECG samples, selecting opens ECG waveform) */}
      <section id="sample-preview-section" className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#bc000a] font-bold block">
              Morphological Inspection
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#101c28]">
              SAMPLE PREVIEW
            </h2>
            <p className="text-xs text-slate-500">
              Select any beat record to open the interactive 187-sample calibrated ECG waveform.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">
              Showing {filteredSamples.length} of {RESEARCH_DATASET_SAMPLES.length} curated cohort samples
            </span>
          </div>
        </div>

        {/* Search & Filtering Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Class Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Classes' },
              { id: 'n', label: 'N (Normal)' },
              { id: 's', label: 'S (Supraventricular)' },
              { id: 'v', label: 'V (Ventricular)' },
              { id: 'f', label: 'F (Fusion)' },
              { id: 'q', label: 'Q (Paced/Unknown)' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedClassFilter(btn.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedClassFilter === btn.id
                    ? 'bg-[#101c28] text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Split Filter & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start bg-white border border-slate-200 rounded-xl p-0.5 text-xs min-h-[40px]">
              <button
                onClick={() => setSelectedSplitFilter('all')}
                className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg transition-all cursor-pointer min-h-[32px] ${
                  selectedSplitFilter === 'all' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500'
                }`}
              >
                All Splits
              </button>
              <button
                onClick={() => setSelectedSplitFilter('train')}
                className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg transition-all cursor-pointer min-h-[32px] ${
                  selectedSplitFilter === 'train' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500'
                }`}
              >
                DS1 Train
              </button>
              <button
                onClick={() => setSelectedSplitFilter('test')}
                className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg transition-all cursor-pointer min-h-[32px] ${
                  selectedSplitFilter === 'test' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500'
                }`}
              >
                DS2 Test
              </button>
            </div>

            <div className="relative min-w-0 sm:min-w-[180px] flex-1 sm:flex-initial">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search record, ID, diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[40px] pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#bc000a]/20 focus:border-[#bc000a] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="block md:hidden space-y-3">
          {filteredSamples.map((sample) => (
            <div
              key={`mob-${sample.id}`}
              onClick={() => handleSelectSample(sample.id)}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 cursor-pointer active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#bc000a]" />
                  <span className="font-mono font-bold text-sm text-slate-900">{sample.id}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {sample.recordId} • {sample.split}
                  </span>
                </div>
                <AamiClassBadge code={sample.classCode} variant="both" size="xs" />
              </div>

              <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-600 min-w-0">
                  <div className="font-medium text-slate-900">
                    {sample.patientProfile.age}y {sample.patientProfile.gender} • {sample.patientProfile.heartRateBpm} bpm
                  </div>
                  <div className="text-slate-500 line-clamp-1">{sample.patientProfile.clinicalDiagnosis}</div>
                  <div className="font-mono text-[10px] text-slate-600 mt-1">
                    QRS: <strong className="text-slate-800">{sample.fiducials.qrsDurationMs}ms</strong> • PR: {sample.fiducials.prIntervalMs ? `${sample.fiducials.prIntervalMs}ms` : 'None'}
                  </div>
                </div>

                <div className="w-[84px] h-[32px] bg-white rounded-lg p-0.5 border border-slate-200/80 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 90 24" className="w-full h-full overflow-visible">
                    <path
                      d={createSparklinePath(sample.signal, 90, 24)}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <circle cx="33.8" cy="3" r="1.8" fill="#bc000a" />
                  </svg>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSample(sample.id);
                }}
                className="w-full min-h-[44px] rounded-xl bg-slate-100 active:bg-[#bc000a] text-slate-700 active:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">vital_signs</span>
                <span>Open Waveform Modal</span>
              </button>
            </div>
          ))}

          {filteredSamples.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-slate-400 text-3xl">filter_list_off</span>
              <p className="font-semibold text-sm text-slate-700">No samples match your filter criteria</p>
              <button
                onClick={() => {
                  setSelectedClassFilter('all');
                  setSelectedSplitFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* ECG SAMPLES TABLE / LIST (Desktop & Tablet: hidden md:block) */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Sample ID</th>
                  <th className="py-3 px-3">Record & Split</th>
                  <th className="py-3 px-3">AAMI Class</th>
                  <th className="py-3 px-3">Patient Context</th>
                  <th className="py-3 px-3">QRS / PR</th>
                  <th className="py-3 px-3">Waveform Sparkline (187 Samples)</th>
                  <th className="py-3 px-4 text-right">Waveform Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSamples.map((sample) => {
                  return (
                    <tr
                      key={sample.id}
                      id={`sample-row-${sample.id.toLowerCase()}`}
                      onClick={() => handleSelectSample(sample.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Sample ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 group-hover:text-[#bc000a] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#bc000a]" />
                          <span>{sample.id}</span>
                        </div>
                      </td>

                      {/* Record & Split */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 font-mono">
                          {sample.recordId}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {sample.split}
                        </span>
                      </td>

                      {/* AAMI Class Badge */}
                      <td className="py-3.5 px-3">
                        <AamiClassBadge code={sample.classCode} variant="both" size="xs" />
                      </td>

                      {/* Patient Context */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-800">
                          {sample.patientProfile.age}y {sample.patientProfile.gender} • {sample.patientProfile.heartRateBpm} bpm
                        </div>
                        <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[180px]" title={sample.patientProfile.clinicalDiagnosis}>
                          {sample.patientProfile.clinicalDiagnosis}
                        </span>
                      </td>

                      {/* QRS / PR */}
                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        <div>QRS: <strong className="text-slate-800">{sample.fiducials.qrsDurationMs}ms</strong></div>
                        <span className="text-slate-500 text-[10px]">
                          PR: {sample.fiducials.prIntervalMs ? `${sample.fiducials.prIntervalMs}ms` : 'None'}
                        </span>
                      </td>

                      {/* Waveform Sparkline */}
                      <td className="py-3.5 px-3">
                        <div className="w-[100px] h-[26px] bg-slate-50 rounded-lg p-0.5 border border-slate-200/80 group-hover:border-[#bc000a]/40 transition-colors flex items-center justify-center">
                          <svg viewBox="0 0 90 24" className="w-full h-full overflow-visible">
                            <path
                              d={createSparklinePath(sample.signal, 90, 24)}
                              fill="none"
                              stroke="#0f172a"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                            {/* R peak indicator dot */}
                            <circle cx="33.8" cy="3" r="1.8" fill="#bc000a" />
                          </svg>
                        </div>
                      </td>

                      {/* Waveform Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSample(sample.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-[#bc000a] text-slate-700 group-hover:text-white font-semibold text-xs transition-all shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">vital_signs</span>
                          <span>Open Waveform</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredSamples.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="space-y-1.5 max-w-sm mx-auto">
                        <span className="material-symbols-outlined text-slate-400 text-3xl">filter_list_off</span>
                        <p className="font-semibold text-sm text-slate-700">No samples match your filter criteria</p>
                        <p className="text-xs text-slate-500">Try selecting "All Classes" or clearing your search phrase.</p>
                        <button
                          onClick={() => {
                            setSelectedClassFilter('all');
                            setSelectedSplitFilter('all');
                            setSearchQuery('');
                          }}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* QUICK WORKSPACE NAVIGATION FOOTER */}
      <section id="dataset-workspace-nav" className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div
          onClick={onNavigateToAnalysis}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#bc000a] text-[18px]">vital_signs</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 group-hover:text-[#bc000a] transition-colors">
              ECG Arrhythmia Analysis
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Execute hybrid VQC inference on patient recordings with clinical severity triage.
          </p>
        </div>

        <div
          onClick={onNavigateToQuantumLab}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6d28d9] text-[18px]">memory</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 group-hover:text-[#6d28d9] transition-colors">
              Quantum Circuit Studio
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Map the 187 features through autoencoder compression to 10-qubit parameterized state space.
          </p>
        </div>

        <div
          onClick={onNavigateToBenchmarks}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0369a1] text-[18px]">query_stats</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 group-hover:text-[#0369a1] transition-colors">
              Cross-Model Benchmarks
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Inspect macro-F1, parameter efficiency, and confusion matrices against classical baselines.
          </p>
        </div>
      </section>

      {/* 6. ECG WAVEFORM MODAL (Triggered when sample is selected) */}
      <ECGWaveformModal
        sample={activeSample}
        onClose={() => setActiveSampleIndex(null)}
        onSelectNext={handleNextSample}
        onSelectPrev={handlePrevSample}
        hasNext={activeSampleIndex !== null && activeSampleIndex < filteredSamples.length - 1}
        hasPrev={activeSampleIndex !== null && activeSampleIndex > 0}
      />
    </div>
  );
};
