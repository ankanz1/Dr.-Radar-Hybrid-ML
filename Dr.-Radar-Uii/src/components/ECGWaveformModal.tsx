import { useState, useRef, useMemo, PointerEvent } from 'react';
import { ECGDatasetSample } from '../data/ecgDatasetData';
import { AamiClassBadge } from './AamiClassBadge';

interface ECGWaveformModalProps {
  sample: ECGDatasetSample | null;
  onClose: () => void;
  onSelectNext?: () => void;
  onSelectPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export const ECGWaveformModal = ({
  sample,
  onClose,
  onSelectNext,
  onSelectPrev,
  hasNext = false,
  hasPrev = false,
}: ECGWaveformModalProps) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(70); // default on R-peak
  const [showFiducials, setShowFiducials] = useState<boolean>(true);
  const [showRawFeatures, setShowRawFeatures] = useState<boolean>(false);
  const [gridTheme, setGridTheme] = useState<'clinical-pink' | 'precision-slate'>('clinical-pink');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!sample) return null;

  // 187 points, SVG dimensions
  const svgWidth = 740;
  const svgHeight = 260;
  const paddingX = 36;
  const paddingY = 28;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  // Signal stats
  const minVal = Math.min(...sample.signal);
  const maxVal = Math.max(...sample.signal);
  const meanVal = sample.signal.reduce((a, b) => a + b, 0) / sample.signal.length;
  const variance = sample.signal.reduce((a, b) => a + Math.pow(b - meanVal, 2), 0) / sample.signal.length;

  // Generate SVG path coordinates
  const points = useMemo(() => {
    return sample.signal.map((val, idx) => {
      const x = paddingX + (idx / 186) * plotWidth;
      // Invert Y because SVG 0 is top
      const y = paddingY + (1 - val) * plotHeight;
      return { x, y, val, idx };
    });
  }, [sample.signal, paddingX, paddingY, plotWidth, plotHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`, '');
  }, [points]);

  // Handle pointer scrub
  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const currentSvgX = clickX * scaleX;

    const clampedX = Math.max(paddingX, Math.min(paddingX + plotWidth, currentSvgX));
    const ratio = (clampedX - paddingX) / plotWidth;
    const sampleIdx = Math.round(ratio * 186);
    setHoverIndex(sampleIdx);
  };

  const handleCopyFeatureVector = () => {
    navigator.clipboard.writeText(JSON.stringify(sample.signal));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Active hover point calculations
  const activePt = hoverIndex !== null ? points[hoverIndex] : points[70];
  const timeOffsetMs = activePt ? Math.round((activePt.idx - 70) * 8.0) : 0; // 125 Hz = 8ms per step

  return (
    <div
      id="ecg-waveform-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="ecg-waveform-modal-dialog"
        className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[94vh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#bc000a]/10 border border-[#bc000a]/20 text-[#bc000a] flex items-center justify-center font-mono font-bold text-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">vital_signs</span>
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-mono">
                  {sample.id}
                </h3>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-mono font-semibold bg-slate-200 text-slate-700">
                  {sample.recordId}
                </span>
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  {sample.split}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <span>187-Pt ECG</span>
                <span>•</span>
                <span>Sample #{sample.sampleIndex}</span>
                <span>•</span>
                <span>125 Hz</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <AamiClassBadge code={sample.classCode} variant="both" size="sm" />

            {/* Prev / Next navigation */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button
                onClick={onSelectPrev}
                disabled={!hasPrev}
                className="w-10 h-10 sm:w-8 sm:h-8 min-h-[40px] flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-colors cursor-pointer"
                title="Previous sample"
                aria-label="Previous sample"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div className="w-[1px] h-5 bg-slate-200" />
              <button
                onClick={onSelectNext}
                disabled={!hasNext}
                className="w-10 h-10 sm:w-8 sm:h-8 min-h-[40px] flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-colors cursor-pointer"
                title="Next sample"
                aria-label="Next sample"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal (Esc)"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Waveform Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ECG Grid:
              </span>
              <button
                onClick={() => setGridTheme('clinical-pink')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  gridTheme === 'clinical-pink'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Clinical Pink (0.04s)
              </button>
              <button
                onClick={() => setGridTheme('precision-slate')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  gridTheme === 'precision-slate'
                    ? 'bg-slate-200 text-slate-900 border border-slate-400 font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Dark Precision
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFiducials}
                  onChange={(e) => setShowFiducials(e.target.checked)}
                  className="rounded text-[#bc000a] focus:ring-[#bc000a] w-3.5 h-3.5"
                />
                <span className="font-medium text-slate-700">Fiducial Landmarks (P-Q-R-S-T)</span>
              </label>

              <button
                onClick={() => setShowRawFeatures(!showRawFeatures)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">code</span>
                <span>{showRawFeatures ? 'Hide Tensor' : '187 Features'}</span>
              </button>
            </div>
          </div>

          {/* PRIMARY SVG ECG WAVEFORM CANVAS */}
          <div
            id="ecg-canvas-container"
            className={`relative rounded-2xl border overflow-hidden select-none transition-colors ${
              gridTheme === 'clinical-pink'
                ? 'bg-[#fff7f7] border-rose-200/90 shadow-inner'
                : 'bg-[#0f172a] border-slate-700 shadow-inner'
            }`}
          >
            {/* Realtime Inspector Overlay HUD */}
            <div className="absolute top-2.5 left-3 z-10 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <div
                className={`px-2 py-0.5 rounded-md backdrop-blur-md border ${
                  gridTheme === 'clinical-pink'
                    ? 'bg-white/90 border-rose-200 text-rose-950 font-semibold'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 font-semibold'
                }`}
              >
                Sample Index: <span className="font-bold text-[#bc000a]">{activePt?.idx ?? 70}</span> / 186
              </div>

              <div
                className={`px-2 py-0.5 rounded-md backdrop-blur-md border ${
                  gridTheme === 'clinical-pink'
                    ? 'bg-white/90 border-rose-200 text-rose-950 font-semibold'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 font-semibold'
                }`}
              >
                Time: <span className="font-bold">{timeOffsetMs > 0 ? `+${timeOffsetMs}` : timeOffsetMs} ms</span> (rel. R-peak)
              </div>

              <div
                className={`px-2 py-0.5 rounded-md backdrop-blur-md border ${
                  gridTheme === 'clinical-pink'
                    ? 'bg-white/90 border-rose-200 text-rose-950 font-semibold'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 font-semibold'
                }`}
              >
                Amplitude: <span className="font-bold text-emerald-700">{activePt ? activePt.val.toFixed(4) : '0.0000'}</span>
              </div>
            </div>

            {/* Scale badge */}
            <div className="absolute top-2.5 right-3 z-10 text-[10px] font-mono text-slate-500 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              125 Hz | 25mm/s : 10mm/mV standard
            </div>

            {/* SVG Waveform Rendering */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto cursor-crosshair block"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(70)}
            >
              <defs>
                {/* 1mm Small Grid Pattern (0.04 sec / 0.1 mV) */}
                <pattern
                  id={gridTheme === 'clinical-pink' ? 'ecg-small-grid-pink' : 'ecg-small-grid-dark'}
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 10 0 L 0 0 0 10"
                    fill="none"
                    stroke={gridTheme === 'clinical-pink' ? '#fecdd3' : '#1e293b'}
                    strokeWidth="0.5"
                    strokeOpacity={gridTheme === 'clinical-pink' ? '0.7' : '0.6'}
                  />
                </pattern>

                {/* 5mm Large Grid Pattern (0.20 sec / 0.5 mV) */}
                <pattern
                  id={gridTheme === 'clinical-pink' ? 'ecg-large-grid-pink' : 'ecg-large-grid-dark'}
                  width="50"
                  height="50"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    width="50"
                    height="50"
                    fill={`url(#${gridTheme === 'clinical-pink' ? 'ecg-small-grid-pink' : 'ecg-small-grid-dark'})`}
                  />
                  <path
                    d="M 50 0 L 0 0 0 50"
                    fill="none"
                    stroke={gridTheme === 'clinical-pink' ? '#fda4af' : '#334155'}
                    strokeWidth="1.2"
                    strokeOpacity={gridTheme === 'clinical-pink' ? '0.9' : '0.8'}
                  />
                </pattern>
              </defs>

              {/* Grid Background */}
              <rect
                x="0"
                y="0"
                width={svgWidth}
                height={svgHeight}
                fill={`url(#${gridTheme === 'clinical-pink' ? 'ecg-large-grid-pink' : 'ecg-large-grid-dark'})`}
              />

              {/* Isoelectric Baseline (0.0 mV reference) */}
              <line
                x1={paddingX}
                y1={paddingY + plotHeight}
                x2={paddingX + plotWidth}
                y2={paddingY + plotHeight}
                stroke={gridTheme === 'clinical-pink' ? '#f43f5e' : '#475569'}
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.5"
              />

              {/* Fiducial Regions & Vertical Highlights */}
              {showFiducials && (
                <>
                  {/* R-Peak Local Maximum Line (sample index 70) */}
                  <line
                    x1={points[70]?.x ?? 0}
                    y1={paddingY}
                    x2={points[70]?.x ?? 0}
                    y2={paddingY + plotHeight}
                    stroke="#bc000a"
                    strokeWidth="1.5"
                    strokeDasharray="2 3"
                    strokeOpacity="0.8"
                  />
                  <text
                    x={(points[70]?.x ?? 0) + 4}
                    y={paddingY + 12}
                    fill="#bc000a"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    R-Peak (t=0ms)
                  </text>

                  {/* P-wave indicator if present */}
                  {sample.fiducials.pPeak && points[sample.fiducials.pPeak] && (
                    <circle
                      cx={points[sample.fiducials.pPeak].x}
                      cy={points[sample.fiducials.pPeak].y}
                      r="4"
                      fill="#047857"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Q-point indicator */}
                  {points[sample.fiducials.qPoint] && (
                    <circle
                      cx={points[sample.fiducials.qPoint].x}
                      cy={points[sample.fiducials.qPoint].y}
                      r="3.5"
                      fill="#b45309"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* R-peak circle */}
                  {points[sample.fiducials.rPeak] && (
                    <circle
                      cx={points[sample.fiducials.rPeak].x}
                      cy={points[sample.fiducials.rPeak].y}
                      r="5"
                      fill="#bc000a"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}

                  {/* S-point indicator */}
                  {points[sample.fiducials.sPoint] && (
                    <circle
                      cx={points[sample.fiducials.sPoint].x}
                      cy={points[sample.fiducials.sPoint].y}
                      r="3.5"
                      fill="#6d28d9"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* T-wave peak indicator */}
                  {points[sample.fiducials.tPeak] && (
                    <circle
                      cx={points[sample.fiducials.tPeak].x}
                      cy={points[sample.fiducials.tPeak].y}
                      r="4"
                      fill="#0369a1"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}
                </>
              )}

              {/* Primary ECG Waveform Curve */}
              <path
                d={pathD}
                fill="none"
                stroke={gridTheme === 'clinical-pink' ? '#111827' : '#38bdf8'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Scrubbing Cursor Crosshair */}
              {activePt && (
                <g>
                  {/* Vertical cursor line */}
                  <line
                    x1={activePt.x}
                    y1={paddingY}
                    x2={activePt.x}
                    y2={paddingY + plotHeight}
                    stroke="#bc000a"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  {/* Horizontal cursor line */}
                  <line
                    x1={paddingX}
                    y1={activePt.y}
                    x2={paddingX + plotWidth}
                    y2={activePt.y}
                    stroke="#bc000a"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    strokeOpacity="0.6"
                  />
                  {/* Highlighted active circle */}
                  <circle
                    cx={activePt.x}
                    cy={activePt.y}
                    r="5"
                    fill="#bc000a"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Time Axis Legend */}
            <div className="px-4 py-1.5 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[10px] font-mono text-slate-500">
              <span>Sample 0 (-560 ms)</span>
              <span>Sample 40 (P-Wave)</span>
              <span className="font-bold text-[#bc000a]">Sample 70 (0 ms | R-Peak)</span>
              <span>Sample 120 (T-Wave)</span>
              <span>Sample 186 (+928 ms)</span>
            </div>
          </div>

          {/* CLINICAL FIDUCIAL METRICS & PARAMETERS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                QRS Complex Duration
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-bold text-base text-slate-900">
                  {sample.fiducials.qrsDurationMs} ms
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    sample.fiducials.qrsDurationMs > 120
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {sample.fiducials.qrsDurationMs > 120 ? 'Wide / Ectopic' : 'Normal Narrow'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                PR Interval
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-bold text-base text-slate-900">
                  {sample.fiducials.prIntervalMs ? `${sample.fiducials.prIntervalMs} ms` : 'N/A (Dissociated)'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                QT Interval
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-bold text-base text-slate-900">
                  {sample.fiducials.qtIntervalMs} ms
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (QTc ~ {Math.round(sample.fiducials.qtIntervalMs / Math.sqrt(60 / sample.patientProfile.heartRateBpm))}ms)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Signal-to-Noise Ratio (SNR)
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-bold text-base text-slate-900">
                  {sample.noiseLevelSnrDb} dB
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  High Fidelity
                </span>
              </div>
            </div>
          </div>

          {/* CLINICAL MORPHOLOGY & PATIENT CONTEXT */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a]">clinical_notes</span>
                Physiological & Morphological Interpretation
              </h4>
              <span className="text-xs font-mono text-slate-500">
                Patient: {sample.patientProfile.age} yo {sample.patientProfile.gender === 'M' ? 'Male' : 'Female'} • HR {sample.patientProfile.heartRateBpm} bpm
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {sample.morphologyNotes}
            </p>
            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <span>Diagnosis: <strong className="text-slate-800">{sample.patientProfile.clinicalDiagnosis}</strong></span>
              <span>Lead Configuration: <strong className="text-slate-800">{sample.patientProfile.lead}</strong></span>
            </div>
          </div>

          {/* 187-FEATURE NUMERICAL TENSOR INSPECTOR */}
          {showRawFeatures && (
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 space-y-3 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Feature Vector [1 × 187 Float32]
                  </span>
                  <span className="text-xs text-slate-300">
                    Min: {minVal.toFixed(4)} • Max: {maxVal.toFixed(4)} • Mean: {meanVal.toFixed(4)} • Var: {variance.toFixed(4)}
                  </span>
                </div>
                <button
                  onClick={handleCopyFeatureVector}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copySuccess ? 'check' : 'content_copy'}
                  </span>
                  <span>{copySuccess ? 'Copied Array' : 'Copy 187 Floats'}</span>
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto pr-1 text-[11px] font-mono leading-relaxed bg-black/40 p-3 rounded-xl border border-slate-800/80 text-emerald-400 select-all">
                [{sample.signal.map((v, i) => `${i > 0 && i % 10 === 0 ? '\n ' : ''}${v.toFixed(4)}`).join(', ')}]
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-mono">ECG Heartbeat Categorization Dataset • AAMI EC57 Schema</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
