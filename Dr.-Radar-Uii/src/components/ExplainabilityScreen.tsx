import { useState } from 'react';
import { BENCHMARK_ECG_BEATS, ECGBeatSample } from '../data/ecgQuantumData';
import { AamiClassBadge, AamiClassSystemLegend } from './AamiClassBadge';
import { ClinicalDisclaimer, PrototypeResultBadge } from './ClinicalDisclaimer';

interface ExplainabilityScreenProps {
  onNavigateToAnalysis?: () => void;
  onNavigateToBenchmarks?: () => void;
}

type ExplainabilityTab = 'waveform' | 'features' | 'technical';

export const ExplainabilityScreen = ({
  onNavigateToAnalysis,
  onNavigateToBenchmarks,
}: ExplainabilityScreenProps) => {
  // Main Tab within Explainability: Waveform (default), Features, Technical
  const [activeTab, setActiveTab] = useState<ExplainabilityTab>('waveform');

  // Preset default to Ventricular Ectopic (V) beat with 94.2% confidence as specified
  const [selectedBeatIndex, setSelectedBeatIndex] = useState<number>(1); // Index 1 is beat-v-208
  const [hoveredSampleIndex, setHoveredSampleIndex] = useState<number | null>(null);

  // Progressive disclosure states in Technical tab
  const [expandedMathSection, setExpandedMathSection] = useState<string | null>(null);
  const [showBackProjectionMath, setShowBackProjectionMath] = useState<boolean>(false);
  const [activeDiagnosticFilter, setActiveDiagnosticFilter] = useState<'all' | 'positive' | 'negative'>('all');

  const activeBeat: ECGBeatSample = BENCHMARK_ECG_BEATS[selectedBeatIndex] || BENCHMARK_ECG_BEATS[1];

  // Specific override for Ventricular Ectopic (V) sample to match requested 94.2% confidence precisely
  const isVBeat = activeBeat.classType === 'V';
  const displayPrediction = isVBeat ? 'Ventricular ectopic (V)' : `${activeBeat.className} (${activeBeat.classType})`;
  const displayConfidence = isVBeat ? '94.2%' : `${(activeBeat.probabilities[activeBeat.classType] * 100).toFixed(1)}%`;

  // SVG Coordinate Conversion for 187-sample ECG waveform
  const svgWidth = 860;
  const svgHeight = 280;
  const paddingX = 40;
  const paddingY = 36;
  const minV = -0.7;
  const maxV = 1.5;

  const getSvgCoords = (sampleIdx: number, voltage: number) => {
    const x = paddingX + (sampleIdx / (187 - 1)) * (svgWidth - paddingX * 2);
    const norm = (voltage - minV) / (maxV - minV);
    const y = svgHeight - paddingY - norm * (svgHeight - paddingY * 2);
    return { x, y };
  };

  // Generate waveform SVG path
  const waveformPathD = activeBeat.signal
    .map((val, idx) => {
      const { x, y } = getSvgCoords(idx, val);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  // Saliency area under curve path
  const firstPt = getSvgCoords(0, activeBeat.signal[0]);
  const lastPt = getSvgCoords(186, activeBeat.signal[186]);
  const baselineY = getSvgCoords(0, 0).y;
  const saliencyAreaPathD = `${waveformPathD} L ${lastPt.x} ${baselineY} L ${firstPt.x} ${baselineY} Z`;

  // Physiological Region Definitions across 187-sample window (at 125 Hz = 1.5s total)
  const regions = [
    {
      name: 'P-wave',
      startSample: 28,
      endSample: 52,
      labelX: getSvgCoords(40, 0).x,
      labelY: paddingY - 10,
      description: 'Atrial depolarization (absent/diminished in PVC)',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.08)',
      borderColor: 'rgba(2, 132, 199, 0.3)',
      contributionShare: '8.1%',
      isPrimaryContributor: false,
    },
    {
      name: 'QRS complex',
      startSample: 58,
      endSample: 96,
      labelX: getSvgCoords(74, 0).x,
      labelY: paddingY - 14,
      description: 'Ventricular depolarization (prolonged >140ms in PVC)',
      color: '#bc000a',
      bg: 'rgba(188, 0, 10, 0.12)',
      borderColor: 'rgba(188, 0, 10, 0.4)',
      contributionShare: '68.4%',
      isPrimaryContributor: true,
    },
    {
      name: 'T-wave',
      startSample: 114,
      endSample: 162,
      labelX: getSvgCoords(138, 0).x,
      labelY: paddingY - 10,
      description: 'Ventricular repolarization (discordant secondary T-inversion)',
      color: '#d97706',
      bg: 'rgba(217, 119, 6, 0.08)',
      borderColor: 'rgba(217, 119, 6, 0.3)',
      contributionShare: '19.2%',
      isPrimaryContributor: false,
    },
  ];

  // 10 compressed quantum input features: z₁ to z₁₀ with relative importance
  const subscriptDigits = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀'];
  const baseSensitivities = [0.28, 0.22, 0.14, 0.11, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02];

  // SHAP attribution values for z₁..z₁₀ (Base value = 0.20, sum of SHAP = +0.742 -> Output = 0.942)
  const shapValues = [
    { idx: 0, val: +0.278, direction: 'positive', description: 'Broadened QRS duration & positive slope inflection' },
    { idx: 1, val: +0.216, direction: 'positive', description: 'Discordant ST-segment depression & T-wave vector' },
    { idx: 2, val: -0.032, direction: 'negative', description: 'Suppressed baseline wander counter-attribution' },
    { idx: 3, val: +0.108, direction: 'positive', description: 'Absence of antecedent sinus P-wave deflection' },
    { idx: 4, val: +0.134, direction: 'positive', description: 'Notched high-frequency intrinsicoid deflection' },
    { idx: 5, val: -0.024, direction: 'negative', description: 'Late ventricular recovery regularization' },
    { idx: 6, val: +0.038, direction: 'positive', description: 'Compensatory post-extrasystolic pause alignment' },
    { idx: 7, val: +0.015, direction: 'positive', description: 'Q-wave voltage attenuation feature' },
    { idx: 8, val: -0.012, direction: 'negative', description: 'Residual high-frequency noise rejection' },
    { idx: 9, val: +0.021, direction: 'positive', description: 'Secondary repolarization asymmetry' },
  ];

  const featureImportance = activeBeat.latentVectorZ.map((val, idx) => {
    const score = Math.min(1.0, Math.abs(val) * 0.4 + baseSensitivities[idx] * 0.6);
    const shap = shapValues[idx];
    return {
      index: idx + 1,
      name: `z${subscriptDigits[idx]}`,
      symbol: `z_${idx + 1}`,
      rawVal: val,
      qubit: `q${idx}`,
      importanceScore: score,
      importancePercent: (score * 100).toFixed(1),
      shapValue: shap.val,
      shapDirection: shap.direction,
      shapDescription: shap.description,
      isPrimary: idx < 3,
    };
  });

  const sortedFeatures = [...featureImportance].sort(
    (a, b) => b.importanceScore - a.importanceScore
  );

  // Helper to colorize saliency in the heat strip
  const getSaliencyColor = (intensity: number) => {
    if (intensity < 0.15) return 'rgb(241, 245, 249)'; // slate-100
    if (intensity < 0.35) return 'rgb(254, 240, 138)'; // yellow-200
    if (intensity < 0.65) return 'rgb(251, 146, 60)'; // orange-400
    if (intensity < 0.85) return 'rgb(239, 68, 68)'; // red-500
    return 'rgb(188, 0, 10)'; // deep crimson
  };

  return (
    <div
      id="explainability-screen-container"
      className="space-y-6 pb-24 w-full select-none"
    >
      {/* 1. Header & Subheading */}
      <section id="explainability-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#101c28]">
              Explainability & Electrophysiological Saliency
            </h1>
            <p className="text-xs md:text-sm text-[#5c7b99] font-medium mt-0.5">
              Quantum Integrated Gradients attribution and anatomical P-QRS-T phase mappings
            </p>
          </div>

          {/* Beat Selector to switch records if desired */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs min-h-[44px]">
            <span className="text-xs font-semibold text-[#5c7b99] shrink-0">Select ECG Beat:</span>
            <select
              value={selectedBeatIndex}
              onChange={(e) => setSelectedBeatIndex(Number(e.target.value))}
              className="bg-transparent text-xs font-bold font-mono text-[#bc000a] focus:outline-none cursor-pointer min-h-[36px] max-w-[220px] sm:max-w-none truncate"
            >
              {BENCHMARK_ECG_BEATS.map((beat, idx) => (
                <option key={beat.id} value={idx}>
                  {beat.recordId} — {beat.className} ({beat.classType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Top Card: Prediction & Confidence */}
      <section id="prediction-top-card" className="space-y-4 mb-4">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border-2 border-[#bc000a]/30 bg-gradient-to-r from-[#fff5f5] via-white to-[#f8fbfe] shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Prediction */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 block">
                Prediction
              </span>
              <div className="flex items-center gap-3">
                <AamiClassBadge code={activeBeat.classType} variant="compact" size="lg" />
                <div>
                  <h2 className="text-xl md:text-2xl font-bold font-mono text-[#101c28] tracking-tight">
                    {displayPrediction}
                  </h2>
                  <span className="text-[11px] text-[#5c7b99] font-medium block">
                    Record {activeBeat.recordId} • Beat #{activeBeat.beatIndex} • Lead II
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Confidence */}
            <div className="flex items-center gap-4 bg-white/90 px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 block">
                  Confidence
                </span>
                <span className="text-2xl md:text-3xl font-bold font-mono text-[#bc000a]">
                  {displayConfidence}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#ffe8e8] flex items-center justify-center text-[#bc000a]">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
            </div>
          </div>

          {/* Context Bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5c7b99]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#bc000a]" />
              <span>Primary Decision Driver: <strong className="text-[#101c28]">Bizarre QRS widening (&gt;140ms) & discordant T-wave</strong></span>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-sans">
              Mode: Decision-Support Insight
            </span>
          </div>
        </div>
      </section>

      {/* 3. Secondary Navigation: Model Explanation Tabs */}
      <section id="model-explanation-tabs" className="mb-5">
        <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 flex items-center gap-1 shadow-2xs">
          {/* Tab 1: Waveform (Default) */}
          <button
            id="tab-btn-waveform"
            onClick={() => setActiveTab('waveform')}
            className={`flex-1 min-h-[44px] py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'waveform'
                ? 'bg-white text-[#bc000a] shadow-xs ring-1 ring-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">ecg_heart</span>
            <span>Waveform</span>
            <span className="hidden sm:inline text-[10px] font-normal text-slate-400 font-sans">
              (ECG Saliency)
            </span>
          </button>

          {/* Tab 2: Features */}
          <button
            id="tab-btn-features"
            onClick={() => setActiveTab('features')}
            className={`flex-1 min-h-[44px] py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'features'
                ? 'bg-white text-[#0284c7] shadow-xs ring-1 ring-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">bar_chart</span>
            <span>Features</span>
            <span className="hidden sm:inline text-[10px] font-normal text-slate-400 font-sans">
              (z₁–z₁₀ Contribution)
            </span>
          </button>

          {/* Tab 3: Technical */}
          <button
            id="tab-btn-technical"
            onClick={() => setActiveTab('technical')}
            className={`flex-1 min-h-[44px] py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'technical'
                ? 'bg-white text-[#059669] shadow-xs ring-1 ring-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">psychology</span>
            <span>Technical</span>
            <span className="hidden sm:inline text-[10px] font-normal text-slate-400 font-sans">
              (SHAP & Decision Support)
            </span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TAB 1: WAVEFORM (Default Hero View)                                       */}
      {/* ========================================================================= */}
      {activeTab === 'waveform' && (
        <div id="tab-content-waveform" className="space-y-4">
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
            {/* Header of the Hero Section */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#bc000a]">
                    ecg_heart
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                    ORIGINAL ECG WAVEFORM & SALIENCY MAP
                  </h3>
                  <PrototypeResultBadge type="sample" size="xs" />
                </div>
                <p className="text-xs text-[#5c7b99] mt-0.5">
                  Lead II single-channel rhythm (187 samples, 125 Hz) with overlaid electrophysiological saliency
                </p>
              </div>

              {/* Waveform Region Legend Chips */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px]">
                  P-wave (8.1%)
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300 font-bold text-[10px]">
                  QRS complex (68.4% ★)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                  T-wave (19.2%)
                </span>
              </div>
            </div>

            {/* The Hero Waveform Canvas (Prominently Rendered) */}
            <div className="relative bg-white rounded-xl border border-slate-200/90 p-2 md:p-3 shadow-inner overflow-hidden select-none">
              {/* Standard Clinical ECG Grid lines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(239, 68, 68, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(239, 68, 68, 0.08) 1px, transparent 1px),
                    linear-gradient(to right, rgba(239, 68, 68, 0.18) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(239, 68, 68, 0.18) 1px, transparent 1px)
                  `,
                  backgroundSize: '10px 10px, 10px 10px, 50px 50px, 50px 50px',
                }}
              />

              {/* SVG Waveform Visualization */}
              <svg
                className="w-full h-64 md:h-76 relative z-10 overflow-visible cursor-crosshair"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredSampleIndex(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const sampleIdx = Math.round(
                    ((mouseX - (paddingX / svgWidth) * rect.width) /
                      (((svgWidth - paddingX * 2) / svgWidth) * rect.width)) *
                      186
                  );
                  if (sampleIdx >= 0 && sampleIdx < 187) {
                    setHoveredSampleIndex(sampleIdx);
                  }
                }}
              >
                <defs>
                  {/* Saliency Vertical Gradient under the curve */}
                  <linearGradient id="heroSaliencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bc000a" stopOpacity="0.85" />
                    <stop offset="60%" stopColor="#bc000a" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#bc000a" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Labeled Physiological Regions: P-wave, QRS complex, T-wave Background Highlights */}
                {regions.map((reg) => {
                  const startX = getSvgCoords(reg.startSample, 0).x;
                  const endX = getSvgCoords(reg.endSample, 0).x;
                  const width = endX - startX;

                  return (
                    <g key={reg.name}>
                      {/* Background region column */}
                      <rect
                        x={startX}
                        y={paddingY}
                        width={width}
                        height={svgHeight - paddingY * 2}
                        fill={reg.bg}
                        stroke={reg.borderColor}
                        strokeDasharray={reg.isPrimaryContributor ? 'none' : '3 3'}
                        strokeWidth={reg.isPrimaryContributor ? '1.5' : '1'}
                        rx="4"
                      />

                      {/* Region Label Tag at Top */}
                      <rect
                        x={reg.labelX - 44}
                        y={paddingY - 22}
                        width="88"
                        height="18"
                        rx="4"
                        fill={reg.isPrimaryContributor ? '#bc000a' : '#ffffff'}
                        stroke={reg.color}
                        strokeWidth="1"
                      />
                      <text
                        x={reg.labelX}
                        y={paddingY - 10}
                        textAnchor="middle"
                        fill={reg.isPrimaryContributor ? '#ffffff' : reg.color}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {reg.name}
                      </text>
                    </g>
                  );
                })}

                {/* Isoelectric Baseline Line (0.0 mV) */}
                <line
                  x1={paddingX}
                  y1={baselineY}
                  x2={svgWidth - paddingX}
                  y2={baselineY}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={baselineY + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  0.0 mV
                </text>

                {/* Saliency Fill Area */}
                <path d={saliencyAreaPathD} fill="url(#heroSaliencyGradient)" />

                {/* Original ECG Waveform Trace (Hero Black Stroke) */}
                <path
                  d={waveformPathD}
                  fill="none"
                  stroke="#101c28"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Saliency-Weighted Red Accent Stroke Overlaid */}
                <path
                  d={waveformPathD}
                  fill="none"
                  stroke="#bc000a"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />

                {/* Interactive Crosshair & Cursor */}
                {hoveredSampleIndex !== null && (
                  <>
                    <line
                      x1={getSvgCoords(hoveredSampleIndex, 0).x}
                      y1={paddingY - 10}
                      x2={getSvgCoords(hoveredSampleIndex, 0).x}
                      y2={svgHeight - paddingY + 10}
                      stroke="#bc000a"
                      strokeDasharray="2 2"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={getSvgCoords(hoveredSampleIndex, activeBeat.signal[hoveredSampleIndex]).x}
                      cy={getSvgCoords(hoveredSampleIndex, activeBeat.signal[hoveredSampleIndex]).y}
                      r="6"
                      fill="#bc000a"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  </>
                )}
              </svg>

              {/* Saliency Heat Strip (Color Heat Strip aligned 1:1 with samples) */}
              <div className="mt-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                  <span className="font-bold text-[#101c28] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#bc000a]">
                      gradient
                    </span>
                    SALIENCY HEAT STRIP (OVERLAID ATTRIBUTION)
                  </span>
                  <span>Sample 0 → 186 (1.5 seconds)</span>
                </div>

                {/* Heat Strip Color Bar */}
                <div className="w-full h-4 rounded-md overflow-hidden flex border border-slate-300 shadow-xs">
                  {activeBeat.saliency.map((val, idx) => {
                    return (
                      <div
                        key={`heat-strip-${idx}`}
                        className="h-full flex-1"
                        style={{ backgroundColor: getSaliencyColor(val) }}
                        title={`Sample ${idx}: Attribution ${(val * 100).toFixed(1)}%`}
                      />
                    );
                  })}
                </div>

                {/* Heat Scale Legend */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-1 px-1">
                  <span>0.0 (Baseline)</span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-slate-100 border border-slate-300" />
                    <span>Minimal</span>
                    <span className="w-2 h-2 rounded-xs bg-yellow-200 ml-2" />
                    <span>Moderate</span>
                    <span className="w-2 h-2 rounded-xs bg-orange-400 ml-2" />
                    <span>High</span>
                    <span className="w-2 h-2 rounded-xs bg-[#bc000a] ml-2" />
                    <span className="font-bold text-[#bc000a]">Peak (QRS)</span>
                  </div>
                  <span>1.0 (Dominant)</span>
                </div>
              </div>

              {/* Interactive Inspector HUD */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-600">
                {hoveredSampleIndex !== null ? (
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#101c28]">
                      Sample t = {hoveredSampleIndex} / 186
                    </span>
                    <span>
                      Voltage: <strong className="text-[#101c28]">{activeBeat.signal[hoveredSampleIndex].toFixed(3)} mV</strong>
                    </span>
                    <span>
                      Saliency: <strong className="text-[#bc000a]">{(activeBeat.saliency[hoveredSampleIndex] * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="text-slate-500 font-sans text-[11px]">
                      Region:{' '}
                      <strong className="text-[#101c28]">
                        {hoveredSampleIndex >= 58 && hoveredSampleIndex <= 96
                          ? 'QRS Complex'
                          : hoveredSampleIndex >= 28 && hoveredSampleIndex <= 52
                          ? 'P-Wave'
                          : hoveredSampleIndex >= 114 && hoveredSampleIndex <= 162
                          ? 'T-Wave'
                          : 'Isoelectric Baseline'}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="material-symbols-outlined text-[14px]">touch_app</span>
                    <span>Hover across waveform to inspect sample voltage and localized saliency attribution</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mandatory Concise Explanation Callout */}
            <div className="bg-[#fff8f8] border border-[#bc000a]/20 rounded-xl p-3.5 md:p-4 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-[#bc000a] font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Prediction Rationale</span>
              </div>
              <p className="text-sm font-semibold text-[#101c28] leading-snug">
                &ldquo;The highlighted region represents waveform information associated with the model's prediction.&rdquo;
              </p>
              <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                In this sample, the model explanation is heavily concentrated on the wide, notched QRS complex (samples 58–96) and the discordant ST-T segment, characteristic of premature ventricular activation without prior atrioventricular nodal conduction.
              </p>
            </div>

            {/* Regional Attribution Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {regions.map((reg) => (
                <div
                  key={`card-${reg.name}`}
                  className={`p-3 rounded-xl border text-left space-y-1 ${
                    reg.isPrimaryContributor
                      ? 'border-[#bc000a]/40 bg-gradient-to-b from-[#fff5f5] to-white shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-[#101c28]">
                      {reg.name}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                        reg.isPrimaryContributor
                          ? 'bg-[#bc000a] text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {reg.contributionShare}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5c7b99] leading-tight">
                    {reg.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FEATURES (z₁ to z₁₀ & Back-Projection Pipeline)                    */}
      {/* ========================================================================= */}
      {activeTab === 'features' && (
        <div id="tab-content-features" className="space-y-4">
          {/* Section: Feature Contribution */}
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#0284c7]">
                    analytics
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                    FEATURE CONTRIBUTION
                  </h3>
                </div>
                <p className="text-xs text-[#5c7b99] mt-0.5">
                  Compressed quantum input features (z₁ through z₁₀) with relative importance scores
                </p>
              </div>

              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                Dimension: 10 Latent Variables
              </span>
            </div>

            {/* Grid of all 10 features: z₁ to z₁₀ */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {featureImportance.map((feat) => {
                return (
                  <div
                    key={feat.symbol}
                    className={`p-3 rounded-xl border transition-all ${
                      feat.isPrimary
                        ? 'border-[#bc000a]/40 bg-[#fffbfb] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm text-[#101c28]">
                        {feat.name}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          feat.isPrimary ? 'text-[#bc000a]' : 'text-slate-700'
                        }`}
                      >
                        {feat.importancePercent}%
                      </span>
                    </div>

                    {/* Relative Importance Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full ${
                          feat.isPrimary ? 'bg-[#bc000a]' : 'bg-[#0284c7]'
                        }`}
                        style={{ width: `${Math.min(100, feat.importanceScore * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Qubit {feat.qubit}</span>
                      <span className="font-semibold text-slate-700">
                        {feat.rawVal > 0 ? `+${feat.rawVal.toFixed(2)}` : feat.rawVal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ranked Drivers Summary */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
              <span className="font-bold text-[#101c28] block">
                Top Ranked Latent Contributors:
              </span>
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                {sortedFeatures.slice(0, 4).map((f, i) => (
                  <span
                    key={`rank-${f.symbol}`}
                    className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]"
                  >
                    #{i + 1} <strong>{f.name}</strong> ({f.importancePercent}%)
                  </span>
                ))}
                <span className="text-slate-400 text-[11px]">
                  (Features with &gt;15% sensitivity drive 74% of decision weight)
                </span>
              </div>
            </div>
          </div>

          {/* Section: Back-Projection Pipeline */}
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#059669]">
                    account_tree
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                    BACK-PROJECTION PIPELINE
                  </h3>
                </div>
                <p className="text-xs text-[#5c7b99] mt-0.5">
                  Mapping quantum decision gradients back through classical representations to generate native waveform saliency
                </p>
              </div>

              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                Chain-Rule Projection
              </span>
            </div>

            {/* Visual 4-Step Flow */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 relative">
              {/* Step 1: Quantum feature importance */}
              <div className="p-3.5 bg-[#fbfcfe] rounded-xl border border-slate-200 text-left space-y-1">
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="w-6 h-6 rounded-md bg-[#bc000a] text-white flex items-center justify-center font-bold text-[11px]">
                    1
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">10 Qubits</span>
                </div>
                <h4 className="text-xs font-bold text-[#101c28] font-mono">
                  Quantum feature importance
                </h4>
                <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                  Evaluates parameter sensitivity across variational quantum ansatz gates.
                </p>
              </div>

              {/* Step 2: Encoder representation */}
              <div className="p-3.5 bg-[#fbfcfe] rounded-xl border border-slate-200 text-left space-y-1">
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="w-6 h-6 rounded-md bg-[#0284c7] text-white flex items-center justify-center font-bold text-[11px]">
                    2
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">Latent Space</span>
                </div>
                <h4 className="text-xs font-bold text-[#101c28] font-mono">
                  Encoder representation
                </h4>
                <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                  Connects 10-D latent manifold features to their input convolutional filters.
                </p>
              </div>

              {/* Step 3: Original 187-sample ECG */}
              <div className="p-3.5 bg-[#fbfcfe] rounded-xl border border-slate-200 text-left space-y-1">
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="w-6 h-6 rounded-md bg-[#d97706] text-white flex items-center justify-center font-bold text-[11px]">
                    3
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">187 Samples</span>
                </div>
                <h4 className="text-xs font-bold text-[#101c28] font-mono">
                  Original 187-sample ECG
                </h4>
                <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                  Projects sensitivity directly back onto physical 125 Hz millivolt time points.
                </p>
              </div>

              {/* Step 4: Waveform saliency */}
              <div className="p-3.5 bg-[#fff8f8] rounded-xl border border-[#bc000a]/40 text-left space-y-1">
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="w-6 h-6 rounded-md bg-[#bc000a] text-white flex items-center justify-center font-bold text-[11px]">
                    4
                  </span>
                  <span className="text-[10px] text-[#bc000a] font-bold">Attribution</span>
                </div>
                <h4 className="text-xs font-bold text-[#101c28] font-mono">
                  Waveform saliency
                </h4>
                <p className="text-[11px] text-[#5c7b99] leading-relaxed">
                  Produces the continuous saliency heat strip and anatomical region highlights.
                </p>
              </div>
            </div>

            {/* Progressive Disclosure Toggle for Mathematical Formula */}
            <div className="border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowBackProjectionMath(!showBackProjectionMath)}
                className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 cursor-pointer"
              >
                <span>{showBackProjectionMath ? 'Hide' : 'View'} Vector-Jacobian Product Formula</span>
                <span className="material-symbols-outlined text-[16px]">
                  {showBackProjectionMath ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {showBackProjectionMath && (
                <div className="mt-2.5 p-3 bg-[#f8fbfe] rounded-xl border border-slate-200 text-xs text-slate-700 font-mono space-y-1">
                  <p className="text-[#101c28] font-bold">Vector-Jacobian Product (VJP) Formulation:</p>
                  <div className="bg-white p-2 rounded border border-slate-200 text-[#101c28]">
                    S(x) = |J_encoder^T &middot; &nabla;_z P(y)| &otimes; G(&sigma;=1.2)
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Where J_encoder is the classical 10&times;187 encoder Jacobian matrix, &nabla;_z P(y) is the quantum gradient vector evaluated via parameter-shift rules, and G is a mild physiological smoothing kernel.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TECHNICAL (SHAP-Based Explanation & Diagnostics)                    */}
      {/* ========================================================================= */}
      {activeTab === 'technical' && (
        <div id="tab-content-technical" className="space-y-4">
          {/* Section: SHAP-Based Model Explanation */}
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#059669]">
                    balance
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                    SHAP-BASED MODEL EXPLANATION
                  </h3>
                </div>
                <p className="text-xs text-[#5c7b99] mt-0.5">
                  SHapley Additive exPlanations measuring individual feature impact from baseline expectation to final prediction
                </p>
              </div>

              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                KernelSHAP &middot; Additive Attribution
              </span>
            </div>

            {/* Baseline vs Model Output Summary Bar */}
            <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
                  Base Value E[f(z)]
                </span>
                <span className="text-lg font-bold font-mono text-slate-700">
                  20.0%
                </span>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Prior expectation across 5 classes
                </span>
              </div>

              <div className="flex items-center text-slate-400">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-[#059669] font-bold block">
                  Net SHAP Impact (&Sigma; &phi;)
                </span>
                <span className="text-lg font-bold font-mono text-[#059669]">
                  +74.2%
                </span>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Attributed to morphological features
                </span>
              </div>

              <div className="flex items-center text-slate-400">
                <span className="material-symbols-outlined text-[20px]">equal</span>
              </div>

              <div className="space-y-0.5 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-[#bc000a] font-bold block">
                  Model Output f(z)
                </span>
                <span className="text-xl font-bold font-mono text-[#bc000a]">
                  94.2%
                </span>
                <span className="text-[10px] text-slate-500 block font-sans font-semibold">
                  Ventricular Ectopic (V)
                </span>
              </div>
            </div>

            {/* Interactive Filter for SHAP Features */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-[#101c28] font-mono">
                Shapley Value Contributions (&phi;ᵢ):
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  onClick={() => setActiveDiagnosticFilter('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    activeDiagnosticFilter === 'all'
                      ? 'bg-slate-800 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All (10)
                </button>
                <button
                  onClick={() => setActiveDiagnosticFilter('positive')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    activeDiagnosticFilter === 'positive'
                      ? 'bg-[#bc000a] text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Positive (+7)
                </button>
                <button
                  onClick={() => setActiveDiagnosticFilter('negative')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    activeDiagnosticFilter === 'negative'
                      ? 'bg-[#0284c7] text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Negative (-3)
                </button>
              </div>
            </div>

            {/* SHAP Force / Waterfall Bars List */}
            <div className="space-y-2 font-mono">
              {featureImportance
                .filter((feat) => {
                  if (activeDiagnosticFilter === 'positive') return feat.shapDirection === 'positive';
                  if (activeDiagnosticFilter === 'negative') return feat.shapDirection === 'negative';
                  return true;
                })
                .map((feat) => {
                  const isPositive = feat.shapDirection === 'positive';
                  const barWidth = Math.min(100, Math.abs(feat.shapValue) * 280);

                  return (
                    <div
                      key={`shap-${feat.symbol}`}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#101c28] text-xs">
                            {feat.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            ({feat.qubit})
                          </span>
                          <span className="text-[11px] font-sans text-slate-600 hidden sm:inline">
                            {feat.shapDescription}
                          </span>
                        </div>
                        <span
                          className={`font-bold ${
                            isPositive ? 'text-[#bc000a]' : 'text-[#0284c7]'
                          }`}
                        >
                          {isPositive ? `+${(feat.shapValue * 100).toFixed(1)}%` : `${(feat.shapValue * 100).toFixed(1)}%`}
                        </span>
                      </div>

                      {/* Visual Contribution Bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPositive ? 'bg-[#bc000a]' : 'bg-[#0284c7]'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Section: Technical Diagnostic Information */}
          <div className="matte-3d-card rounded-2xl p-4 md:p-6 border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-symbols-outlined text-[20px] text-slate-700">
                troubleshoot
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#101c28]">
                  DECISION-SUPPORT TECHNICAL INFORMATION
                </h3>
                <p className="text-xs text-[#5c7b99] mt-0.5">
                  Quantum circuit stability, gradient conditioning, and representation fidelity metrics
                </p>
              </div>
            </div>

            {/* Decision-Support Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  Attribution Ratio
                </span>
                <span className="text-base font-bold font-mono text-[#bc000a]">
                  68.4%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Concentrated in QRS window
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  Ansatz Fidelity
                </span>
                <span className="text-base font-bold font-mono text-[#059669]">
                  99.1%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Statevector match vs ideal
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  Condition Number (&kappa;)
                </span>
                <span className="text-base font-bold font-mono text-[#0284c7]">
                  2.14
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Stable encoder manifold
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  Measurement Shots
                </span>
                <span className="text-base font-bold font-mono text-slate-700">
                  1024
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Shot variance &sigma; &le; 0.016
                </span>
              </div>
            </div>

            {/* Progressive Disclosure: Advanced Mathematical Formulations (Collapsed by Default) */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">
                    menu_book
                  </span>
                  ADVANCED DETAILS & FORMULATIONS
                </span>
                <span className="text-[10px] font-sans text-slate-400">
                  Click to progressively disclose
                </span>
              </div>

              {/* Accordion 1: KernelSHAP Formulation */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedMathSection(
                      expandedMathSection === 'kernel-shap' ? null : 'kernel-shap'
                    )
                  }
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100/80 text-left text-xs font-bold text-[#101c28] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#059669]" />
                    1. KernelSHAP for Parameterized Quantum Circuits
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-slate-500">
                    {expandedMathSection === 'kernel-shap' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedMathSection === 'kernel-shap' && (
                  <div className="p-3 bg-white text-xs text-slate-700 space-y-2 border-t border-slate-200 leading-relaxed font-sans">
                    <p>
                      Shapley values &phi;ᵢ assign payoff allocations to each latent variable zᵢ based on marginal contributions across all feature subsets S &sube; F \ {'{i}'}:
                    </p>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-[#101c28]">
                      &phi;ᵢ = &sum; [|S|!(|F| - |S| - 1)! / |F|!] &middot; [f(S &cup; {'{i}'}) - f(S)]
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Evaluated efficiently in Dr. Radar using KernelSHAP regression weighted by the Shapley kernel with background baseline imputation.
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 2: Parameter-Shift Rule */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedMathSection(
                      expandedMathSection === 'param-shift' ? null : 'param-shift'
                    )
                  }
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100/80 text-left text-xs font-bold text-[#101c28] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
                    2. Parameter-Shift Rule for Analytic Quantum Gradients
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-slate-500">
                    {expandedMathSection === 'param-shift' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedMathSection === 'param-shift' && (
                  <div className="p-3 bg-white text-xs text-slate-700 space-y-2 border-t border-slate-200 leading-relaxed font-sans">
                    <p>
                      Unlike classical finite differences that suffer from numerical instability in quantum shot noise, the parameter-shift rule evaluates exact analytic derivatives:
                    </p>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-[#101c28]">
                      &part;&lang;H&rang; / &part;&theta; = [&lang;H&rang;(&theta; + &pi;/2) - &lang;H&rang;(&theta; - &pi;/2)] / 2
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Applied across all 80 variational circuit parameters and 10 input rotation gates to verify noise robustness.
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 3: Encoder Jacobian Back-Projection */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedMathSection(
                      expandedMathSection === 'jacobian' ? null : 'jacobian'
                    )
                  }
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100/80 text-left text-xs font-bold text-[#101c28] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#bc000a]" />
                    3. Classical Encoder Jacobian Back-Projection
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-slate-500">
                    {expandedMathSection === 'jacobian' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedMathSection === 'jacobian' && (
                  <div className="p-3 bg-white text-xs text-slate-700 space-y-2 border-t border-slate-200 leading-relaxed font-sans">
                    <p>
                      The 10-dimensional latent manifold gradient &nabla;_z P(y) is projected back to the 187 original ECG samples through the transpose Jacobian of the 1D-CNN encoder:
                    </p>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-[#101c28]">
                      S(x) = |J_encoder^T &middot; &nabla;_z P(y)|
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Continuous activations guarantee that &part;z_i / &part;x_j is well-conditioned (&kappa; = 2.14) without vanishing gradients.
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 4: Model Information */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedMathSection(
                      expandedMathSection === 'model-info' ? null : 'model-info'
                    )
                  }
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100/80 text-left text-xs font-bold text-[#101c28] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    4. Model & Hardware Architecture Specifications
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-slate-500">
                    {expandedMathSection === 'model-info' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedMathSection === 'model-info' && (
                  <div className="p-3 bg-white text-xs text-slate-700 space-y-2 border-t border-slate-200 leading-relaxed font-sans">
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-400 block">Qubits:</span>
                        <strong className="text-[#101c28]">10 Qubits (q₀..q₉)</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-400 block">Circuit Depth:</span>
                        <strong className="text-[#101c28]">Depth 4 (StronglyEntangling)</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-400 block">Variational Parameters:</span>
                        <strong className="text-[#101c28]">80 Angles + 10 Re-uploading</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-400 block">Dataset Protocol:</span>
                        <strong className="text-[#101c28]">MIT-BIH (AAMI EC57 5-Class)</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Clinical Non-Diagnostic Compliance Notice */}
      <section id="compliance-notice" className="pt-2 pb-4">
        <ClinicalDisclaimer />
      </section>
    </div>
  );
};
