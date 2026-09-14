import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { BENCHMARK_ECG_BEATS, ECGBeatSample } from '../data/ecgQuantumData';
import { BottleneckAuditSection } from './BottleneckAuditSection';
import {
  AamiClassBadge,
  AamiClassDistributionBar,
  AamiClassSystemLegend,
} from './AamiClassBadge';
import { AAMI_CLASS_CONFIG, AamiClassCode } from '../data/aamiClassSystem';
import { ClinicalDisclaimer, PrototypeResultBadge } from './ClinicalDisclaimer';
import { AssistantContext } from '../types/assistant';
import { TreatmentRecommendationCard } from './recommendations/TreatmentRecommendationCard';
import { HealthContextIndicator } from './health-info/HealthContextIndicator';
import { HealthContextSummary } from '../types/healthInfo';
import { ScreenTab } from '../types';
import { predictECG, analyzeECG, PredictionResponse, AnalyzeResponse, ECGAPIError } from '../services/ecgApi';

interface XAIFeature {
  pca_feature: number;
  rank: number;
  importance: number;
  score_change: number;
  baseline_score: number;
  perturbed_score: number;
  pca_value: number;
  perturbation_value: number;
}

interface ECGAnalysisScreenProps {
  onNavigateToQuantumLab?: () => void;
  onNavigateToExplainability?: () => void;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  onBookAppointment?: () => void;
  healthSummary?: HealthContextSummary;
  onNavigate?: (tab: ScreenTab) => void;
}

export const ECGAnalysisScreen = ({
  onNavigateToQuantumLab,
  onNavigateToExplainability,
  onOpenAssistant,
  onBookAppointment,
  healthSummary,
  onNavigate,
}: ECGAnalysisScreenProps) => {
  // Sample Selection (Default: ECG-0248 which is Beat #208 V-Class)
  const [selectedBeatIndex, setSelectedBeatIndex] = useState<number>(1);
  const activeBeat: ECGBeatSample = BENCHMARK_ECG_BEATS[selectedBeatIndex] || BENCHMARK_ECG_BEATS[1];

  // Interactive Waveform Controls
  const [zoom, setZoom] = useState<number>(1.0); // 1.0x to 3.0x
  const [amplitude, setAmplitude] = useState<number>(1.0); // 0.5x to 2.5x
  const [sampleOffset, setSampleOffset] = useState<number>(0); // pan offset 0 to 186
  const [hoveredSample, setHoveredSample] = useState<number | null>(null);
  const [showFiducials, setShowFiducials] = useState<boolean>(true);
  const [showSaliency, setShowSaliency] = useState<boolean>(true); // Explainability highlighted region overlay
  const [gridIntensity, setGridIntensity] = useState<'standard' | 'high'>('standard');

  // Analysis Pipeline Animation State
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real Backend Integration State
  const [realPrediction, setRealPrediction] = useState<PredictionResponse | null>(null);
  const [realExplanation, setRealExplanation] = useState<AnalyzeResponse['explanation'] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [useRealBackend, setUseRealBackend] = useState<boolean>(false);

  const animationTimersRef = useRef<NodeJS.Timeout[]>([]);
  const svgContainerRef = useRef<SVGSVGElement | null>(null);

  const handleResetControls = () => {
    setZoom(1.0);
    setAmplitude(1.0);
    setSampleOffset(0);
    setHoveredSample(null);
    setShowFiducials(true);
    setShowSaliency(true);
  };

  const handleRunAnalysis = useCallback(async () => {
    if (pipelineStatus === 'running') return;

    animationTimersRef.current.forEach(clearTimeout);
    animationTimersRef.current = [];

    setPipelineStatus('running');
    setActiveStep(0);
    setApiError(null);
    setToastMessage('Pipeline initiated: Ingesting 187-D ECG beat vector...');

    const t1 = setTimeout(() => {
      setActiveStep(1);
      setToastMessage('Encoder active: Compressing 187-D signal into 8-D PCA vector...');
    }, 500);

    const t2 = setTimeout(() => {
      setActiveStep(2);
      setToastMessage('Quantum circuit executing: 8-qubit 4-layer VQC...');
    }, 1100);

    const t3 = setTimeout(() => {
      setActiveStep(3);
      setToastMessage('Classical classification head: Softmax 5-class posterior readout...');
    }, 1800);

    const t4 = setTimeout(() => {
      setActiveStep(4);
      setToastMessage('Explanation generated: PCA perturbation with loading-weighted back-projection...');
    }, 2400);

    if (useRealBackend) {
      const t5 = setTimeout(async () => {
        try {
          setToastMessage('Calling QML backend API...');
          const [prediction, analysis] = await Promise.all([
            predictECG(activeBeat.signal),
            analyzeECG(activeBeat.signal),
          ]);
          setRealPrediction(prediction);
          setRealExplanation(analysis.explanation);
          setPipelineStatus('completed');
          setToastMessage(
            `QML Backend: ${prediction.predicted_class_name} at ${(prediction.confidence * 100).toFixed(1)}% confidence`
          );
          setTimeout(() => setToastMessage(null), 5000);
        } catch (err) {
          const error = err as ECGAPIError;
          setApiError(error.detail || error.message);
          setPipelineStatus('idle');
          setActiveStep(-1);
          setToastMessage(`Backend error: ${error.detail || error.message}`);
          setTimeout(() => setToastMessage(null), 5000);
        }
      }, 2900);
      animationTimersRef.current = [t1, t2, t3, t4, t5];
    } else {
      const t5 = setTimeout(() => {
        setPipelineStatus('completed');
        setToastMessage(
          `Decision-Support Output: ${
            activeBeat.classType === 'V'
              ? 'Ventricular ectopic (V)'
              : activeBeat.className
          } model classification at ${(
            activeBeat.probabilities[activeBeat.classType] * 100
          ).toFixed(1)}% confidence (Sample Result).`
        );
        setTimeout(() => setToastMessage(null), 3500);
      }, 2900);
      animationTimersRef.current = [t1, t2, t3, t4, t5];
    }
  }, [activeBeat, pipelineStatus, useRealBackend]);

  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Scientific SVG Coordinate Geometry
  const baseWidth = 860;
  const baseHeight = 310;
  const marginL = 62; // space for labeled voltage axis
  const marginR = 24;
  const marginT = 24;
  const marginB = 54; // space for labeled time/sample axis

  const plotWidth = baseWidth - marginL - marginR;
  const plotHeight = baseHeight - marginT - marginB;

  // ViewBox window based on zoom & sampleOffset
  const visibleSamples = Math.round(187 / zoom);
  const maxOffset = Math.max(0, 187 - visibleSamples);
  const clampedOffset = Math.min(Math.max(0, sampleOffset), maxOffset);

  // Calibrated Clinical Voltage Range in Millivolts (mV)
  const minV = -0.6;
  const maxV = 1.6;
  const voltageRange = maxV - minV;

  const getSvgPoint = (sampleIdx: number, rawVal: number) => {
    const amplifiedVal = rawVal * amplitude;
    const normalizedX = (sampleIdx - clampedOffset) / (visibleSamples - 1);
    const x = marginL + normalizedX * plotWidth;

    const normY = (amplifiedVal - minV) / voltageRange;
    const y = marginT + plotHeight - normY * plotHeight;

    return { x, y };
  };

  // Isoelectric (0.0 mV) baseline Y position
  const baselineY = getSvgPoint(0, 0).y;

  // Primary Waveform SVG Path
  const svgPathD = useMemo(() => {
    return activeBeat.signal
      .map((v, i) => {
        const { x, y } = getSvgPoint(i, v);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [activeBeat.signal, amplitude, clampedOffset, visibleSamples, plotWidth, plotHeight]);

  // Saliency Polygon Path (for Explainability Highlighted Overlay)
  const saliencyAreaPath = useMemo(() => {
    if (!showSaliency || !activeBeat.saliency) return '';
    const points: string[] = [];

    // Top edge along the waveform
    for (let i = 0; i < 187; i++) {
      const { x, y } = getSvgPoint(i, activeBeat.signal[i]);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    // Bottom edge along baseline
    for (let i = 186; i >= 0; i--) {
      const { x } = getSvgPoint(i, 0);
      points.push(`L ${x.toFixed(2)} ${baselineY.toFixed(2)}`);
    }

    return points.join(' ') + ' Z';
  }, [showSaliency, activeBeat.signal, activeBeat.saliency, amplitude, clampedOffset, visibleSamples, baselineY]);

  // Major Voltage Ticks: [-0.5, 0.0, +0.5, +1.0, +1.5 mV]
  const voltageTicks = [-0.5, 0.0, 0.5, 1.0, 1.5];

  // Minor Voltage Grid: every 0.1 mV
  const minorVoltageSteps: number[] = [];
  for (let v = -0.5; v <= 1.5; v += 0.1) {
    minorVoltageSteps.push(+(v.toFixed(1)));
  }

  // Major Horizontal Time/Sample Ticks
  // Standard clinical ECG: 1 sample = 8ms (at 125Hz). R-peak is at sample index 70.
  const timeTicks = useMemo(() => {
    const ticks: { sampleIdx: number; timeMs: number; labelTime: string; labelSample: string }[] = [];
    // Select step based on zoom
    const step = zoom >= 2.0 ? 10 : zoom >= 1.5 ? 15 : 20;

    for (let i = 0; i < 187; i += step) {
      if (i >= clampedOffset - 2 && i <= clampedOffset + visibleSamples + 2) {
        const timeMs = (i - 70) * 8;
        ticks.push({
          sampleIdx: i,
          timeMs,
          labelTime: `${timeMs > 0 ? '+' : ''}${timeMs} ms`,
          labelSample: `i=${i}`,
        });
      }
    }
    return ticks;
  }, [zoom, clampedOffset, visibleSamples]);

  // Minor Time Grid: every 5 samples (40 ms = 1 small clinical ECG box)
  const minorTimeSamples = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 187; i += 5) {
      if (i >= clampedOffset && i <= clampedOffset + visibleSamples) {
        arr.push(i);
      }
    }
    return arr;
  }, [clampedOffset, visibleSamples]);

  // Saliency High-Attribution Region Definition for Explainability
  // Aberrant wide QRS complex for V-class is centered around samples 50 to 105
  const salientRegion = useMemo(() => {
    if (activeBeat.classType === 'V') {
      return {
        startSample: 52,
        endSample: 104,
        label: 'Primary Saliency: Aberrant Wide QRS Complex',
        attribution: '0.89',
        qrsDuration: `${activeBeat.fiducials.qrsDurationMs} ms (Prolonged > 120ms)`,
      };
    } else if (activeBeat.classType === 'S') {
      return {
        startSample: 35,
        endSample: 65,
        label: 'Primary Saliency: Premature Abnormal P-Wave',
        attribution: '0.84',
        qrsDuration: '92 ms (Narrow QRS)',
      };
    } else {
      return {
        startSample: 60,
        endSample: 88,
        label: 'Dominant Depolarization Vector',
        attribution: '0.78',
        qrsDuration: `${activeBeat.fiducials.qrsDurationMs} ms`,
      };
    }
  }, [activeBeat]);

  // Morphological Segment Resolver for Hovered Sample
  const getMorphologySegmentName = (sampleIdx: number) => {
    const { pPeak, qPoint, rPeak, sPoint, tPeak } = activeBeat.fiducials;
    if (sampleIdx < qPoint - 8) {
      return Math.abs(sampleIdx - pPeak) <= 6 ? 'P-Wave Peak (Atrial Depolarization)' : 'Isoelectric / PR-Interval';
    } else if (sampleIdx >= qPoint - 8 && sampleIdx <= sPoint + 8) {
      if (sampleIdx === rPeak) return "R-Peak Maximum (Primary Ventricular Activation)";
      if (sampleIdx < rPeak) return "Q-R Upslope (Ventricular Depolarization)";
      return "R-S Downslope (Aberrant Ventricular Recovery)";
    } else if (sampleIdx <= tPeak + 12) {
      return Math.abs(sampleIdx - tPeak) <= 6 ? 'T-Wave Peak (Discordant Repolarization)' : 'ST-Segment Transition';
    } else {
      return 'Post-Ventricular TP Baseline';
    }
  };

  // 5 AAMI Class descriptions & probabilities from centralized visual system
  const aamiClasses: Array<{
    code: AamiClassCode;
    name: string;
    prob: number;
    color: string;
    isDominant: boolean;
  }> = (['N', 'S', 'V', 'F', 'Q'] as AamiClassCode[]).map((code) => {
    const config = AAMI_CLASS_CONFIG[code];
    let prob: number;
    let isDominant: boolean;

    if (realPrediction) {
      prob = realPrediction.probabilities[code] * 100;
      isDominant = code === realPrediction.predicted_class;
    } else {
      prob = activeBeat.probabilities[code] * 100;
      isDominant = activeBeat.classType === code;
    }

    return {
      code,
      name: config.fullName,
      prob,
      color: config.color,
      isDominant,
    };
  });

  return (
    <div
      id="ecg-analysis-workspace"
      className="space-y-6 pb-24 w-full select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="ecg-analysis-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 max-w-md text-center"
        >
          <span className="material-symbols-outlined text-[18px] text-[#72fe88] shrink-0">
            check_circle
          </span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Header & Subheading */}
      <section id="ecg-analysis-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
                DR. RADAR
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                EXPERIMENT #EXP-024
              </span>
              <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Lead II • 125 Hz
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#101c28] tracking-tight uppercase">
              ECG ANALYSIS
            </h1>
            <p className="text-sm md:text-base font-bold text-[#bc000a] mt-0.5 flex items-center gap-2">
              <span>Cardiovascular Arrhythmia</span>
              <span className="text-xs font-normal text-[#5c7b99] hidden sm:inline">
                • Automated VQC Morphological Inference
              </span>
            </p>
          </div>

          {/* Sample Selector Pills */}
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-[#5c7b99] px-1.5 hidden sm:inline">
              Sample:
            </span>
            {BENCHMARK_ECG_BEATS.map((beat, idx) => {
              const isSelected = selectedBeatIndex === idx;
              return (
                <button
                  key={beat.id}
                  onClick={() => {
                    setSelectedBeatIndex(idx);
                    setPipelineStatus('idle');
                    setActiveStep(-1);
                    handleResetControls();
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#101c28] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={`Record ${beat.recordId} • Class ${beat.classType} (${beat.className})`}
                >
                  <AamiClassBadge code={beat.classType} variant="compact" size="xs" />
                  <span>{idx === 1 ? 'ECG-0248' : beat.recordId}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Relevant Health Context Indicator (Section 9) */}
      {healthSummary && (
        <HealthContextIndicator
          summary={healthSummary}
          variant="analysis-banner"
          onViewHealthInfo={() => onNavigate?.('health-info')}
          onAddRecords={() => onNavigate?.('medical-records')}
        />
      )}

      {/* Top Section: ECG SAMPLE Card */}
      <section id="ecg-sample-section">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                description
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                ECG SAMPLE
              </h2>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  pipelineStatus === 'running'
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-[#059669]'
                }`}
              />
              <span className="font-semibold text-slate-700">
                Status:{' '}
                {pipelineStatus === 'running'
                  ? 'Analyzing...'
                  : pipelineStatus === 'completed'
                  ? 'Analysis Complete'
                  : 'Ready'}
              </span>
            </div>
          </div>

          {/* 4 Metadata Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Sample ID
              </span>
              <span className="text-sm font-bold text-[#101c28] font-mono mt-0.5 block">
                {selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Lead II Window</span>
            </div>

            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Source
              </span>
              <span className="text-sm font-bold text-[#101c28] mt-0.5 block truncate" title="MIT-BIH / ECG Heartbeat Dataset">
                MIT-BIH / ECG Heartbeat Dataset
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Record {activeBeat.recordId}</span>
            </div>

            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Length
              </span>
              <span className="text-sm font-bold text-[#101c28] font-mono mt-0.5 block">
                187 samples
              </span>
              <span className="text-[10px] text-slate-500 font-mono">125 Hz (8ms / sample)</span>
            </div>

            <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-[#5c7b99] uppercase tracking-wider font-semibold block">
                Status
              </span>
              <span className="text-sm font-bold text-[#059669] mt-0.5 block flex items-center gap-1 font-mono">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                {pipelineStatus === 'running'
                  ? 'Processing'
                  : pipelineStatus === 'completed'
                  ? 'Completed'
                  : 'Ready'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">AAMI Standard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Biomedical Workstation Grid: Left = Expansive Waveform + Stepper; Right = Live Prediction & Action Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Waveform Canvas & Controls & Analysis Pipeline */}
        <div className="lg:col-span-8 space-y-5">
          {/* Central Visual Element: Scientific & Clinical ECG Waveform Visualization */}
          <section id="central-waveform-display" className="space-y-3">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-3">
          {/* Waveform Canvas Header & Scientific Toolbar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                  ECG WAVEFORM
                </span>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                  Lead II • Record {activeBeat.recordId}
                </span>
                <span className="text-[10px] font-mono bg-[#ffe8e8] text-[#bc000a] font-bold px-2 py-0.5 rounded border border-[#bc000a]/20">
                  QRS: {activeBeat.fiducials.qrsDurationMs} ms
                </span>
              </div>
              <p className="text-[11px] text-[#5c7b99] mt-0.5">
                R-peak referenced single-beat window (125 Hz / 8.0 ms per point) • Standard 10 mm/mV & 25 mm/s calibration
              </p>
            </div>

            {/* Scientific Toolbar: Zoom, Reset, Amplitude, Explainability Saliency Overlay */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Capability */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200" title="Waveform Horizontal Zoom">
                <button
                  id="zoom-out-btn"
                  onClick={() => setZoom((prev) => Math.max(1.0, +(prev - 0.25).toFixed(2)))}
                  disabled={zoom <= 1.0}
                  className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-[#bc000a] disabled:opacity-30 cursor-pointer"
                  title="Zoom Out (Expand time window)"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                </button>
                <span className="text-[11px] font-mono font-bold text-[#101c28] px-2 min-w-11 text-center">
                  {zoom.toFixed(2)}x
                </span>
                <button
                  id="zoom-in-btn"
                  onClick={() => setZoom((prev) => Math.min(3.0, +(prev + 0.25).toFixed(2)))}
                  disabled={zoom >= 3.0}
                  className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-[#bc000a] disabled:opacity-30 cursor-pointer"
                  title="Zoom In (Inspect QRS morphology)"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                </button>
              </div>

              {/* Amplitude (Gain) Controls */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200" title="Voltage Amplitude Gain">
                <button
                  id="amplitude-dec-btn"
                  onClick={() => setAmplitude((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)))}
                  disabled={amplitude <= 0.5}
                  className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-[#bc000a] disabled:opacity-30 cursor-pointer"
                  title="Decrease Amplitude Gain"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span className="text-[11px] font-mono font-bold text-[#101c28] px-1.5 min-w-16 text-center">
                  {amplitude.toFixed(2)}x mV
                </span>
                <button
                  id="amplitude-inc-btn"
                  onClick={() => setAmplitude((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)))}
                  disabled={amplitude >= 2.5}
                  className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-[#bc000a] disabled:opacity-30 cursor-pointer"
                  title="Increase Amplitude Gain"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>

              {/* Explainability Highlighted Region Overlay Toggle */}
              <button
                id="toggle-saliency-btn"
                onClick={() => setShowSaliency(!showSaliency)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showSaliency
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle explainability saliency and model attribution overlay"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-600">
                  wb_incandescent
                </span>
                <span className="hidden sm:inline">Saliency Overlay</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    showSaliency ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                />
              </button>

              {/* Fiducials Landmark Toggle */}
              <button
                id="toggle-fiducials-btn"
                onClick={() => setShowFiducials(!showFiducials)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  showFiducials
                    ? 'bg-[#ffe8e8] border-[#bc000a]/30 text-[#bc000a]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle P, QRS, T fiducial points"
              >
                <span className="material-symbols-outlined text-[15px]">scatter_plot</span>
                <span className="hidden sm:inline">Fiducials</span>
              </button>

              {/* Grid Contrast Toggle */}
              <button
                id="toggle-grid-intensity-btn"
                onClick={() => setGridIntensity(gridIntensity === 'standard' ? 'high' : 'standard')}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  gridIntensity === 'high'
                    ? 'bg-sky-50 border-sky-300 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle Grid Contrast (Standard / High Contrast)"
              >
                <span className="material-symbols-outlined text-[15px]">grid_4x4</span>
                <span className="hidden md:inline">Grid</span>
              </button>

              {/* Reset Control */}
              <button
                id="reset-waveform-btn"
                onClick={handleResetControls}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700 hover:text-[#bc000a] hover:border-[#bc000a]/30 flex items-center gap-1 transition-all cursor-pointer"
                title="Reset Zoom, Amplitude, and Pan to default"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Scientific ECG Display Viewport */}
          <div className="relative w-full rounded-xl bg-[#09111b] border border-slate-700/60 overflow-hidden shadow-inner flex flex-col">
            {/* Top Clinical Telemetry Bar */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#060c14]/90 border-b border-slate-800 text-[11px] font-mono text-slate-300">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff4d5a]" />
                  LEAD II
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-emerald-400 font-semibold">
                  Standard 25 mm/s • 10 mm/mV
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-sky-300">
                  fs = 125 Hz (Ts = 8.0 ms)
                </span>
                {showSaliency && (
                  <>
                    <span className="text-slate-400">|</span>
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Saliency Overlay: Active (Attribution: {salientRegion.attribution})
                    </span>
                  </>
                )}
              </div>

              {/* Live Sample Index & Hover Metric */}
              <div className="flex items-center gap-2">
                {hoveredSample !== null ? (
                  <span className="text-white font-bold bg-[#142333] px-2.5 py-0.5 rounded border border-cyan-500/40 text-[11px]">
                    Sample #{hoveredSample} • V: {(activeBeat.signal[hoveredSample] * amplitude).toFixed(3)} mV • t: {(hoveredSample - 70) * 8 > 0 ? '+' : ''}{(hoveredSample - 70) * 8} ms
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">
                    Index: {clampedOffset}..{clampedOffset + visibleSamples - 1} / 186
                  </span>
                )}
              </div>
            </div>

            {/* Main Responsive SVG Canvas */}
            <div className="relative w-full h-72 sm:h-80 md:h-[360px] lg:h-[400px] xl:h-[440px]">
              <svg
                ref={svgContainerRef}
                className="w-full h-full cursor-crosshair select-none"
                viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredSample(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const ratioX = (mouseX / rect.width);
                  // Convert mouseX to plot area ratio
                  const svgX = ratioX * baseWidth;
                  const plotRatio = Math.max(0, Math.min(1, (svgX - marginL) / plotWidth));
                  const sampleIdx = Math.round(clampedOffset + plotRatio * (visibleSamples - 1));
                  if (sampleIdx >= 0 && sampleIdx < 187) {
                    setHoveredSample(sampleIdx);
                  }
                }}
              >
                <defs>
                  {/* Subtle Minor Clinical ECG Grid (1mm equivalent) */}
                  <pattern
                    id="subtle-ecg-minor-grid"
                    width={gridIntensity === 'high' ? '12' : '16'}
                    height={gridIntensity === 'high' ? '12' : '16'}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={gridIntensity === 'high' ? 'M 12 0 L 0 0 0 12' : 'M 16 0 L 0 0 0 16'}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.45"
                      strokeOpacity={gridIntensity === 'high' ? '0.16' : '0.08'}
                    />
                  </pattern>

                  {/* Saliency Gradient for Explainability Overlay */}
                  <linearGradient id="saliencyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                    <stop offset="50%" stopColor="#ef4444" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                  </linearGradient>

                  {/* Clip path for plot area */}
                  <clipPath id="ecgPlotClip">
                    <rect x={marginL} y={marginT} width={plotWidth} height={plotHeight} />
                  </clipPath>
                </defs>

                {/* 1. Subtle Background Grid Pattern */}
                <rect
                  x={marginL}
                  y={marginT}
                  width={plotWidth}
                  height={plotHeight}
                  fill="url(#subtle-ecg-minor-grid)"
                />

                {/* 2. Minor Voltage Horizontal Grid Lines (every 0.1 mV) */}
                <g opacity={gridIntensity === 'high' ? '0.22' : '0.12'}>
                  {minorVoltageSteps.map((v) => {
                    const normY = (v * amplitude - minV) / voltageRange;
                    const y = marginT + plotHeight - normY * plotHeight;
                    if (y < marginT || y > marginT + plotHeight) return null;
                    return (
                      <line
                        key={`min-v-${v}`}
                        x1={marginL}
                        y1={y}
                        x2={marginL + plotWidth}
                        y2={y}
                        stroke="#38bdf8"
                        strokeWidth="0.6"
                      />
                    );
                  })}
                </g>

                {/* 3. Minor Time Vertical Grid Lines (every 5 samples = 40 ms) */}
                <g opacity={gridIntensity === 'high' ? '0.22' : '0.12'}>
                  {minorTimeSamples.map((i) => {
                    const { x } = getSvgPoint(i, 0);
                    if (x < marginL || x > marginL + plotWidth) return null;
                    return (
                      <line
                        key={`min-t-${i}`}
                        x1={x}
                        y1={marginT}
                        x2={x}
                        y2={marginT + plotHeight}
                        stroke="#38bdf8"
                        strokeWidth="0.6"
                      />
                    );
                  })}
                </g>

                {/* 4. Major Voltage Horizontal Grid Lines & Labeled Amplitude Axis */}
                <g>
                  {voltageTicks.map((v) => {
                    const normY = (v * amplitude - minV) / voltageRange;
                    const y = marginT + plotHeight - normY * plotHeight;
                    if (y < marginT - 2 || y > marginT + plotHeight + 2) return null;
                    const isBaseline = Math.abs(v) < 0.001;

                    return (
                      <g key={`maj-v-${v}`}>
                        {/* Major Horizontal Grid Line */}
                        <line
                          x1={marginL}
                          y1={y}
                          x2={marginL + plotWidth}
                          y2={y}
                          stroke={isBaseline ? '#38bdf8' : '#38bdf8'}
                          strokeWidth={isBaseline ? '1.4' : '0.9'}
                          strokeOpacity={isBaseline ? '0.6' : '0.24'}
                          strokeDasharray={isBaseline ? undefined : '2 2'}
                        />
                        {/* Y-Axis Tick Line */}
                        <line
                          x1={marginL - 6}
                          y1={y}
                          x2={marginL}
                          y2={y}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        {/* Y-Axis Numeric Amplitude Label */}
                        <text
                          x={marginL - 9}
                          y={y + 3.5}
                          textAnchor="end"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight={isBaseline ? 'bold' : '500'}
                          fill={isBaseline ? '#38bdf8' : '#94a3b8'}
                        >
                          {v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Vertical Axis Title (Voltage in mV) */}
                <text
                  x={14}
                  y={marginT + plotHeight / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 14 ${marginT + plotHeight / 2})`}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#94a3b8"
                  letterSpacing="0.06em"
                >
                  VOLTAGE (mV)
                </text>

                {/* Standard 1 mV / 200 ms Clinical Calibration Pulse Reference */}
                <g transform={`translate(${marginL + 12}, ${marginT + 12})`} opacity="0.85">
                  <path
                    d="M 0 32 L 8 32 L 8 8 L 22 8 L 22 32 L 30 32"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <text x="34" y="16" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    1.0 mV
                  </text>
                  <text x="34" y="27" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                    0.2 s (cal)
                  </text>
                </g>

                {/* 5. Major Horizontal Time / Sample Grid Lines & Labeled Axis */}
                <g>
                  {timeTicks.map((t) => {
                    const { x } = getSvgPoint(t.sampleIdx, 0);
                    if (x < marginL - 1 || x > marginL + plotWidth + 1) return null;
                    const isRPeakCenter = t.sampleIdx === 70;

                    return (
                      <g key={`maj-t-${t.sampleIdx}`}>
                        {/* Major Vertical Grid Line */}
                        <line
                          x1={x}
                          y1={marginT}
                          x2={x}
                          y2={marginT + plotHeight}
                          stroke={isRPeakCenter ? '#bc000a' : '#38bdf8'}
                          strokeWidth={isRPeakCenter ? '1.4' : '0.8'}
                          strokeOpacity={isRPeakCenter ? '0.45' : '0.22'}
                          strokeDasharray={isRPeakCenter ? undefined : '2 2'}
                        />
                        {/* X-Axis Tick Line */}
                        <line
                          x1={x}
                          y1={marginT + plotHeight}
                          x2={x}
                          y2={marginT + plotHeight + 6}
                          stroke={isRPeakCenter ? '#bc000a' : '#94a3b8'}
                          strokeWidth="1.2"
                        />
                        {/* Time in ms Label */}
                        <text
                          x={x}
                          y={marginT + plotHeight + 17}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight={isRPeakCenter ? 'bold' : '500'}
                          fill={isRPeakCenter ? '#fca5a5' : '#cbd5e1'}
                        >
                          {t.labelTime}
                        </text>
                        {/* Sample Index Label */}
                        <text
                          x={x}
                          y={marginT + plotHeight + 28}
                          textAnchor="middle"
                          fontSize="8"
                          fontFamily="monospace"
                          fill="#64748b"
                        >
                          {t.labelSample}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Horizontal Axis Title */}
                <text
                  x={marginL + plotWidth / 2}
                  y={marginT + plotHeight + 42}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#94a3b8"
                  letterSpacing="0.05em"
                >
                  TIME RELATIVE TO R-PEAK (ms) & SAMPLE INDEX [i ∈ 0..186 @ 125 Hz]
                </text>

                {/* Left & Bottom Axis Border Frame */}
                <line
                  x1={marginL}
                  y1={marginT}
                  x2={marginL}
                  y2={marginT + plotHeight}
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <line
                  x1={marginL}
                  y1={marginT + plotHeight}
                  x2={marginL + plotWidth}
                  y2={marginT + plotHeight}
                  stroke="#475569"
                  strokeWidth="1.5"
                />

                {/* 6. Explainability Highlighted Region Overlay */}
                {showSaliency && (
                  <g clipPath="url(#ecgPlotClip)">
                    {/* Saliency shaded area under curve */}
                    <path
                      d={saliencyAreaPath}
                      fill="url(#saliencyAreaGradient)"
                      pointerEvents="none"
                    />

                    {/* Saliency Bracket over the salient region */}
                    {salientRegion.startSample >= clampedOffset - 10 &&
                      salientRegion.endSample <= clampedOffset + visibleSamples + 10 && (
                        <g>
                          {(() => {
                            const pStart = getSvgPoint(salientRegion.startSample, 0);
                            const pEnd = getSvgPoint(salientRegion.endSample, 0);
                            const boxX = Math.max(marginL, pStart.x);
                            const boxW = Math.min(marginL + plotWidth - boxX, pEnd.x - boxX);

                            return (
                              <g>
                                {/* Highlight zone background band */}
                                <rect
                                  x={boxX}
                                  y={marginT}
                                  width={boxW}
                                  height={plotHeight}
                                  fill="#f59e0b"
                                  fillOpacity="0.07"
                                  stroke="#f59e0b"
                                  strokeWidth="1"
                                  strokeDasharray="4 4"
                                  strokeOpacity="0.4"
                                />
                                {/* Top boundary banner */}
                                <rect
                                  x={boxX}
                                  y={marginT + 4}
                                  width={boxW}
                                  height={18}
                                  fill="#1e1808"
                                  rx="4"
                                  stroke="#f59e0b"
                                  strokeWidth="0.8"
                                  strokeOpacity="0.7"
                                />
                                <text
                                  x={boxX + boxW / 2}
                                  y={marginT + 16}
                                  textAnchor="middle"
                                  fill="#fbbf24"
                                  fontSize="8.5"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                >
                                  ⚡ SALIENT ZONE: {salientRegion.label} (Attribution: {salientRegion.attribution})
                                </text>
                              </g>
                            );
                          })()}
                        </g>
                      )}
                  </g>
                )}

                {/* 7. Clean, High-Contrast ECG Waveform Trace */}
                <g clipPath="url(#ecgPlotClip)">
                  <path
                    d={svgPathD}
                    fill="none"
                    stroke="#ff4d5a"
                    strokeWidth={zoom >= 2.0 ? '2.8' : '2.3'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* 8. Fiducial Markers (P, Q, R, S, T) */}
                {showFiducials && (
                  <g clipPath="url(#ecgPlotClip)">
                    {/* R-Peak Marker */}
                    {activeBeat.fiducials.rPeak >= clampedOffset &&
                      activeBeat.fiducials.rPeak < clampedOffset + visibleSamples && (
                        <g>
                          <circle
                            cx={getSvgPoint(activeBeat.fiducials.rPeak, activeBeat.signal[activeBeat.fiducials.rPeak]).x}
                            cy={getSvgPoint(activeBeat.fiducials.rPeak, activeBeat.signal[activeBeat.fiducials.rPeak]).y}
                            r="4.5"
                            fill="#ffffff"
                            stroke="#bc000a"
                            strokeWidth="2.5"
                          />
                          <text
                            x={getSvgPoint(activeBeat.fiducials.rPeak, activeBeat.signal[activeBeat.fiducials.rPeak]).x}
                            y={getSvgPoint(activeBeat.fiducials.rPeak, activeBeat.signal[activeBeat.fiducials.rPeak]).y - 9}
                            fontSize="10.5"
                            fontWeight="bold"
                            fill="#fca5a5"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            R (Peak)
                          </text>
                        </g>
                      )}

                    {/* T-Peak Marker */}
                    {activeBeat.fiducials.tPeak >= clampedOffset &&
                      activeBeat.fiducials.tPeak < clampedOffset + visibleSamples && (
                        <g>
                          <circle
                            cx={getSvgPoint(activeBeat.fiducials.tPeak, activeBeat.signal[activeBeat.fiducials.tPeak]).x}
                            cy={getSvgPoint(activeBeat.fiducials.tPeak, activeBeat.signal[activeBeat.fiducials.tPeak]).y}
                            r="3.5"
                            fill="#38bdf8"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text
                            x={getSvgPoint(activeBeat.fiducials.tPeak, activeBeat.signal[activeBeat.fiducials.tPeak]).x}
                            y={getSvgPoint(activeBeat.fiducials.tPeak, activeBeat.signal[activeBeat.fiducials.tPeak]).y + 14}
                            fontSize="9.5"
                            fontWeight="bold"
                            fill="#7dd3fc"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            T (Repol)
                          </text>
                        </g>
                      )}

                    {/* P-Peak Marker */}
                    {activeBeat.fiducials.pPeak >= clampedOffset &&
                      activeBeat.fiducials.pPeak < clampedOffset + visibleSamples && (
                        <g>
                          <circle
                            cx={getSvgPoint(activeBeat.fiducials.pPeak, activeBeat.signal[activeBeat.fiducials.pPeak]).x}
                            cy={getSvgPoint(activeBeat.fiducials.pPeak, activeBeat.signal[activeBeat.fiducials.pPeak]).y}
                            r="3.5"
                            fill="#34d399"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text
                            x={getSvgPoint(activeBeat.fiducials.pPeak, activeBeat.signal[activeBeat.fiducials.pPeak]).x}
                            y={getSvgPoint(activeBeat.fiducials.pPeak, activeBeat.signal[activeBeat.fiducials.pPeak]).y - 8}
                            fontSize="9.5"
                            fontWeight="bold"
                            fill="#a7f3d0"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            P
                          </text>
                        </g>
                      )}
                  </g>
                )}

                {/* 9. Interactive Hover Crosshair & Reticle Inspection */}
                {hoveredSample !== null &&
                  hoveredSample >= clampedOffset &&
                  hoveredSample < clampedOffset + visibleSamples && (
                    <g clipPath="url(#ecgPlotClip)">
                      {/* Vertical Hairline */}
                      <line
                        x1={getSvgPoint(hoveredSample, 0).x}
                        y1={marginT}
                        x2={getSvgPoint(hoveredSample, 0).x}
                        y2={marginT + plotHeight}
                        stroke="#f8fafc"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                        opacity="0.8"
                      />
                      {/* Horizontal Hairline through sample voltage */}
                      <line
                        x1={marginL}
                        y1={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).y}
                        x2={marginL + plotWidth}
                        y2={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).y}
                        stroke="#f8fafc"
                        strokeDasharray="2 2"
                        strokeWidth="0.75"
                        opacity="0.4"
                      />
                      {/* Target Ring */}
                      <circle
                        cx={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).x}
                        cy={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).y}
                        r="6"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      {/* Solid Center Dot */}
                      <circle
                        cx={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).x}
                        cy={getSvgPoint(hoveredSample, activeBeat.signal[hoveredSample]).y}
                        r="3.5"
                        fill="#ff4d5a"
                      />
                    </g>
                  )}
              </svg>
            </div>

            {/* Bottom Scientific HUD: Detailed Morphology & Saliency Inspection */}
            <div className="relative z-20 px-3 py-2 bg-[#060c14]/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-3 flex-wrap">
                {hoveredSample !== null ? (
                  <>
                    <div className="flex items-center gap-1.5 text-white">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="font-bold">Segment:</span>
                      <span className="text-cyan-300">{getMorphologySegmentName(hoveredSample)}</span>
                    </div>
                    <span className="text-slate-500">|</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-slate-400">Model Saliency:</span>
                      <span
                        className={`font-bold ${
                          (activeBeat.saliency[hoveredSample] || 0) > 0.6
                            ? 'text-amber-400'
                            : (activeBeat.saliency[hoveredSample] || 0) > 0.3
                            ? 'text-sky-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {(activeBeat.saliency[hoveredSample] || 0).toFixed(3)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="material-symbols-outlined text-[15px] text-sky-400">
                      touch_app
                    </span>
                    <span>Move cursor across waveform to inspect local voltage, time delta, and quantum saliency.</span>
                  </div>
                )}
              </div>

              {/* Saliency Heat Scale Legend */}
              {showSaliency && (
                <div className="flex items-center gap-2 text-[10.5px]">
                  <span className="text-slate-400">Saliency:</span>
                  <div className="w-20 h-2 rounded-full bg-gradient-to-r from-slate-600 via-amber-500 to-red-500" />
                  <span className="text-slate-300">Low → High</span>
                </div>
              )}
            </div>
          </div>

          {/* Time/Sample Horizontal Window Slider & Minimap */}
          <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#101c28] uppercase font-mono">
                  Sample Viewport:
                </span>
                <span className="font-mono text-slate-600 text-[11px]">
                  Showing {visibleSamples} of 187 samples (Indices: {clampedOffset} — {clampedOffset + visibleSamples - 1})
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#bc000a] font-bold">
                Span: {(visibleSamples * 8).toFixed(0)} ms ({(visibleSamples * 8 / 1000).toFixed(2)}s)
              </span>
            </div>

            {/* Time Window Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                i=0
              </span>
              <input
                id="sample-window-slider"
                type="range"
                min={0}
                max={maxOffset}
                value={clampedOffset}
                onChange={(e) => setSampleOffset(parseInt(e.target.value, 10))}
                disabled={maxOffset === 0}
                className="w-full accent-[#bc000a] h-2 bg-slate-200 rounded-lg cursor-pointer disabled:opacity-40"
              />
              <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                i=186
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Pipeline & Primary CTA */}
      <section id="analysis-pipeline-section" className="space-y-3">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
                ANALYSIS PIPELINE
              </h2>
              <p className="text-[11px] text-[#5c7b99]">
                Sequential hybrid quantum-classical state machine
              </p>
            </div>

            {/* Primary CTA: Run Analysis */}
            <button
              id="run-analysis-cta-btn"
              onClick={handleRunAnalysis}
              disabled={pipelineStatus === 'running'}
              className="px-5 py-2.5 bg-[#bc000a] hover:bg-[#a10008] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[17px] ${
                  pipelineStatus === 'running' ? 'animate-spin' : ''
                }`}
              >
                {pipelineStatus === 'running' ? 'progress_activity' : 'play_arrow'}
              </span>
              <span>
                {pipelineStatus === 'running'
                  ? 'Analyzing Pipeline...'
                  : pipelineStatus === 'completed'
                  ? 'Re-run Analysis'
                  : 'Run Analysis'}
              </span>
            </button>
          </div>

          {/* Direct Flow Banner from User Layout: ENCODER → QUANTUM → CLASSIFIER */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-inner">
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono font-bold">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>ENCODER</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>QUANTUM</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>CLASSIFIER</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <span className="text-slate-500">Pipeline:</span>
              <span className="text-slate-200 font-semibold">187-D Vector → StandardScaler → PCA(8) → MinMaxScaler → 8-Qubit VQC (4L) → Linear 8→5 → Softmax</span>
            </div>
          </div>

          {/* Sequential Pipeline Stepper */}
          <div className="grid grid-cols-1 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {/* Step 1: DATA / ECG Loaded */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                pipelineStatus === 'running' && activeStep === 0
                  ? 'bg-[#ffe8e8] border-[#bc000a] shadow-xs'
                  : 'bg-[#f8fbfe] border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">DATA</span>
                <span className="text-xs font-bold text-[#059669]">✓</span>
              </div>
              <div className="text-xs font-bold text-[#101c28]">ECG loaded</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">187 dimensions</div>
            </div>

            {/* Step 2: ENCODER / Feature Compression */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                pipelineStatus === 'running' && activeStep === 1
                  ? 'bg-[#ffe8e8] border-[#bc000a] shadow-xs'
                  : 'bg-[#f8fbfe] border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">ENCODER</span>
                <span
                  className={`text-xs font-bold ${
                    activeStep >= 1 || pipelineStatus === 'completed'
                      ? 'text-[#059669]'
                      : 'text-slate-400'
                  }`}
                >
                  ✓
                </span>
              </div>
              <div className="text-xs font-bold text-[#101c28]">
                {pipelineStatus === 'running' ? 'Feature encoding' : 'Feature compression'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">StandardScaler → PCA(8) → MinMaxScaler</div>
            </div>

            {/* Step 3: QUANTUM / VQC Ready / Execution */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                pipelineStatus === 'running' && activeStep === 2
                  ? 'bg-[#ffe8e8] border-[#bc000a] shadow-xs ring-1 ring-[#bc000a]/20'
                  : 'bg-[#f8fbfe] border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">QUANTUM</span>
                {pipelineStatus === 'completed' || activeStep > 2 ? (
                  <span className="text-xs font-bold text-[#059669]">✓</span>
                ) : pipelineStatus === 'running' && activeStep === 2 ? (
                  <span className="w-2 h-2 rounded-full bg-[#bc000a] animate-ping" />
                ) : (
                  <span className="text-xs font-bold text-[#bc000a]">●</span>
                )}
              </div>
              <div className="text-xs font-bold text-[#101c28]">
                {pipelineStatus === 'running' && activeStep === 2
                  ? 'Quantum circuit execution'
                  : pipelineStatus === 'completed'
                  ? 'Quantum circuit executed'
                  : 'VQC ready'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">8-Qubit VQC (4L) — RY/RX/RZ + CNOT</div>
            </div>

            {/* Step 4: PREDICTION / Classification */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                pipelineStatus === 'running' && activeStep === 3
                  ? 'bg-[#ffe8e8] border-[#bc000a] shadow-xs'
                  : 'bg-[#f8fbfe] border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">PREDICTION</span>
                {pipelineStatus === 'completed' || activeStep >= 3 ? (
                  <span className="text-xs font-bold text-[#059669]">✓</span>
                ) : (
                  <span className="text-xs font-bold text-slate-400">○</span>
                )}
              </div>
              <div className="text-xs font-bold text-[#101c28]">
                {pipelineStatus === 'idle' ? 'Waiting' : 'Classification'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Softmax 5-Class</div>
            </div>

            {/* Step 5: EXPLANATION */}
            <div
              className={`p-3 rounded-xl border transition-all hidden md:block ${
                pipelineStatus === 'running' && activeStep === 4
                  ? 'bg-[#ffe8e8] border-[#bc000a] shadow-xs'
                  : 'bg-[#f8fbfe] border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">EXPLANATION</span>
                {pipelineStatus === 'completed' ? (
                  <span className="text-xs font-bold text-[#059669]">✓</span>
                ) : (
                  <span className="text-xs font-bold text-slate-400">○</span>
                )}
              </div>
              <div className="text-xs font-bold text-[#101c28]">Waveform Saliency</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Integrated Gradients</div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
      {/* Results Section (Waveform remains continuously visible above/beside) */}
      <section id="prediction-results-section" className="space-y-4">
        <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          {/* Real Backend Toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500">
                Prediction
              </span>
              <PrototypeResultBadge type={useRealBackend && realPrediction ? 'verified' : 'sample'} size="xs" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRealBackend}
                onChange={(e) => setUseRealBackend(e.target.checked)}
                className="w-4 h-4 accent-[#bc000a] border-slate-300 rounded"
              />
              <span className="text-xs font-mono text-slate-600">Use QML Backend</span>
            </label>
          </div>

          {/* API Error Display */}
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500" aria-hidden="true">error</span>
                <span className="font-bold">ECG Analysis Backend Unavailable:</span>
              </div>
              <p className="mt-1">{apiError}</p>
              <p className="text-[10px] text-red-600 mt-1">
                Ensure the QML backend is running at <code className="font-mono bg-red-100 px-1 rounded">{import.meta.env.VITE_ECG_API_URL || 'http://127.0.0.1:8000'}</code>
              </p>
            </div>
          )}

          {/* Backend Health Check Hint */}
          {useRealBackend && !apiError && pipelineStatus === 'idle' && !realPrediction && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500" aria-hidden="true">info</span>
                <span className="font-bold">Ready for Analysis:</span>
              </div>
              <p className="mt-1">Select an ECG sample and click <strong>Run Analysis</strong> to send it to the QML backend.</p>
            </div>
          )}

          {/* Prediction Header */}
          <div className="border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-3">
              {realPrediction ? (
                <AamiClassBadge code={realPrediction.predicted_class as AamiClassCode} variant="compact" size="lg" />
              ) : (
                <AamiClassBadge code={activeBeat.classType} variant="compact" size="lg" />
              )}
              <div>
                <h3 className="text-xl font-black text-[#101c28] tracking-tight uppercase">
                  {realPrediction
                    ? realPrediction.predicted_class_name.toUpperCase()
                    : activeBeat.classType === 'V'
                    ? 'VENTRICULAR ECTOPIC'
                    : activeBeat.className.toUpperCase()}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Sample: {selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`} • Lead II
                  {realPrediction && ' • QML Backend'}
                </span>
                {/* Predicted heartbeat class label with human-readable description */}
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  Predicted heartbeat class: {realPrediction
                    ? realPrediction.predicted_class_name
                    : activeBeat.classType === 'V'
                    ? 'Ventricular ectopic heartbeat'
                    : activeBeat.classType === 'S'
                    ? 'Supraventricular ectopic heartbeat'
                    : activeBeat.classType === 'F'
                    ? 'Fusion heartbeat'
                    : activeBeat.classType === 'Q'
                    ? 'Unknown/other heartbeat'
                    : 'Normal heartbeat'}
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-2.5 mt-2.5 pt-2 border-t border-slate-50">
              <span className="text-3xl sm:text-4xl font-black text-[#bc000a] font-mono tracking-tight">
                {realPrediction
                  ? `${(realPrediction.confidence * 100).toFixed(1)}%`
                  : selectedBeatIndex === 1
                  ? '94.2%'
                  : `${(activeBeat.probabilities[activeBeat.classType] * 100).toFixed(1)}%`}
              </span>
              <span className="text-xs font-mono font-medium text-slate-500">
                {realPrediction ? 'model posterior confidence (QML)' : 'model posterior confidence'}
              </span>
            </div>
          </div>

          {/* 5-Class Probability Distribution */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#101c28] uppercase tracking-wider text-[11px]">
                5-Class Probability Distribution:
              </span>
              <span className="font-mono text-slate-500 text-[11px]">
                {realPrediction ? 'QML Softmax Posterior' : 'AAMI EC57 Posterior Readout'}
              </span>
            </div>

            <div className="space-y-2.5">
              {aamiClasses.map((item) => {
                let displayProb: number;
                let isPredicted: boolean;

                if (realPrediction) {
                  displayProb = realPrediction.probabilities[item.code] * 100;
                  isPredicted = item.code === realPrediction.predicted_class;
                } else {
                  displayProb =
                    selectedBeatIndex === 1
                      ? item.code === 'N'
                        ? 3.1
                        : item.code === 'S'
                        ? 1.4
                        : item.code === 'V'
                        ? 94.2
                        : item.code === 'F'
                        ? 0.7
                        : 0.6
                      : item.prob;
                  isPredicted = item.code === activeBeat.classType;
                }

                return (
                  <AamiClassDistributionBar
                    key={item.code}
                    code={item.code}
                    probability={displayProb}
                    isDominant={isPredicted}
                    isPredictionTarget={isPredicted}
                  />
                );
              })}
            </div>

            {/* Standardized AAMI Visual System Legend */}
            <div className="pt-2">
              <AamiClassSystemLegend />
            </div>

            {/* XAI Explanation from QML Backend */}
            {realExplanation && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-[#bc000a]">wb_incandescent</span>
                    XAI Explanation
                  </h4>
                  <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    QML Backend
                  </span>
                </div>

                {/* Explanation Method */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-mono text-slate-600">
                  <span className="font-semibold text-slate-700">Method:</span>{' '}
                  {realExplanation.method || 'PCA perturbation with loading-weighted back-projection'}
                </div>

                {/* Top PCA Features */}
                {realExplanation.top_pca_features && realExplanation.top_pca_features.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#101c28] uppercase tracking-wider text-slate-700">
                      Top PCA Features by Importance
                    </div>
                    <div className="space-y-1.5">
                      {realExplanation.top_pca_features.map((feature) => (
                        <div
                          key={feature.pca_feature}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold">#{feature.rank}</span>
                            <span className="text-[#101c28]">PCA Feature {feature.pca_feature}</span>
                            <span className="text-slate-500">(value: {feature.pca_value.toFixed(3)})</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <span>Importance: {feature.importance.toFixed(4)}</span>
                            <span>Score Δ: {feature.score_change >= 0 ? '+' : ''}{feature.score_change.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waveform Importance Visualization */}
                {realExplanation.waveform_importance && realExplanation.waveform_importance.length === 187 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#101c28] uppercase tracking-wider text-slate-700">
                      Waveform Importance (187 samples)
                    </div>
                    <div className="h-24 bg-[#09111b] rounded-xl border border-slate-700/60 relative overflow-hidden">
                      <svg className="w-full h-full" viewBox="0 0 860 96" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="xaiImportanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
                          </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="860" height="96" fill="url(#xaiImportanceGradient)" />
                        <polyline
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          points={realExplanation.waveform_importance
                            .map((imp, i) => `${(i / 186) * 860},${96 - imp * 96}`)
                            .join(' ')}
                        />
                      </svg>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Model importance by PCA-loading-weighted back-projection (not medically causal)
                    </p>
                  </div>
                )}

                {/* XAI Disclaimer */}
                <p className="text-[10.5px] text-slate-500 leading-normal font-sans italic">
                  These regions indicate where the model's input representation was most sensitive to perturbation. 
                  They describe model behavior and are not clinical causal evidence.
                </p>
              </div>
            )}
            {/* End XAI Explanation */}

            {/* Subtle Clinical Decision-Support Disclaimer */}
            <ClinicalDisclaimer className="mt-3" />
          </div>

          {/* Prominent CTAs: [ Ask Dr. Radar ] & [ View Explanation → ] */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            {onOpenAssistant && (
              <button
                id="ask-dr-radar-ecg-prediction-btn"
                onClick={() => {
                  const prediction = realPrediction || {
                    predicted_class: activeBeat.classType,
                    predicted_class_name: activeBeat.classType === 'V' ? 'Ventricral ectopic heartbeat' : activeBeat.className,
                    confidence: activeBeat.probabilities[activeBeat.classType],
                    probabilities: activeBeat.probabilities,
                  };
                  const ecgContext: AssistantContext = {
                    type: 'ecg',
                    title: `ECG Analysis (${prediction.predicted_class === 'V' ? 'Ventricular Ectopic' : prediction.predicted_class_name})`,
                    subtitle: `Record ${activeBeat.recordId} • Sample ${selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`} • Lead II`,
                    sampleId: selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`,
                    prediction: prediction.predicted_class === 'V' ? 'Ventricular Ectopic Beat (PVC)' : prediction.predicted_class_name,
                    confidence: `${(prediction.confidence * 100).toFixed(1)}%`,
                    heartRate: 74,
                    aamiClass: prediction.predicted_class,
                    intervals: {
                      prMs: activeBeat.fiducials?.prIntervalMs || 156,
                      qrsMs: activeBeat.fiducials?.qrsDurationMs || (activeBeat.classType === 'V' ? 128 : 88),
                      qtMs: activeBeat.fiducials?.qtIntervalMs || 392,
                    },
                    findings: `${realPrediction ? 'QML Backend (8-qubit 4-layer VQC)' : 'Sample Result (10-qubit VQC)'} classified as ${prediction.predicted_class_name} (${prediction.predicted_class}) at ${(prediction.confidence * 100).toFixed(1)}% confidence.`,
                  };
                  onOpenAssistant(
                    ecgContext,
                    `What does this ${prediction.predicted_class_name} (${prediction.predicted_class}) result mean for my health?`
                  );
                }}
                className="w-full py-2.5 px-4 bg-[#ffe8e8] hover:bg-[#ffdcdc] text-[#bc000a] border border-[#bc000a]/30 rounded-xl text-xs sm:text-sm font-bold shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                <span>Ask Dr. Radar</span>
              </button>
            )}

            {onNavigateToExplainability && (
              <button
                id="view-explanation-btn"
                onClick={onNavigateToExplainability}
                className="w-full py-2.5 px-4 bg-[#101c28] hover:bg-[#bc000a] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-98"
              >
                <span>View Explanation</span>
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
            )}
            <p className="text-[11px] text-center text-[#5c7b99]">
              Back-projected waveform saliency maps & integrated gradient attributions ready
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>

      {/* Patient Treatment & Care Recommendations */}
      <section id="ecg-treatment-recommendations" className="pt-2">
        <TreatmentRecommendationCard
          clinicalInput={{
            modality: 'ecg',
            resultCode: realPrediction?.predicted_class || activeBeat.classType,
            findingTitle: realPrediction
              ? realPrediction.predicted_class_name
              : activeBeat.classType === 'V'
              ? 'Ventricular Ectopic Beat (PVC)'
              : activeBeat.classType === 'S'
              ? 'Supraventricular Ectopic Beat (PAC)'
              : activeBeat.className,
            classificationLabel: realPrediction
              ? `${realPrediction.predicted_class_name} (Class ${realPrediction.predicted_class})`
              : `${activeBeat.className} (Class ${activeBeat.classType})`,
            confidence: realPrediction
              ? `${(realPrediction.confidence * 100).toFixed(1)}%`
              : selectedBeatIndex === 1
              ? '94.2%'
              : `${(activeBeat.probabilities[activeBeat.classType] * 100).toFixed(1)}%`,
            patientContext: {
              patientName: 'Ashton Miller',
              age: 48,
              gender: 'Male',
              previousResult: 'Normal Sinus Rhythm',
              bpm: 74,
            },
          }}
          onOpenAssistant={onOpenAssistant}
          onBookAppointment={onBookAppointment}
          sourceContextTitle={`Sample ${selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`} • Lead II${realPrediction ? ' • QML Backend' : ''}`}
        />
      </section>

      {/* Information Bottleneck / Bottleneck Audit Section */}
      <BottleneckAuditSection activeBeat={activeBeat} />

      {/* Auxiliary Quantum Circuit Shortcut */}
      {onNavigateToQuantumLab && (
        <section id="quantum-circuit-shortcut" className="pt-1">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#0284c7]">memory</span>
              <span className="text-slate-700 font-medium">
                Want to examine the 10-qubit circuit ansatz & statevector amplitudes?
              </span>
            </div>
            <button
              onClick={onNavigateToQuantumLab}
              className="text-[#0284c7] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Quantum Lab
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
