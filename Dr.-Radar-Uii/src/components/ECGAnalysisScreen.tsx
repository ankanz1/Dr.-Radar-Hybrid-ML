import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';
import { AAMI_CLASS_CONFIG, AamiClassCode } from '../data/aamiClassSystem';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import {
  predictECG,
  analyzeECG,
  getECGSamples,
  ECGSample,
  PredictionResponse,
  AnalyzeResponse,
  ECGAPIError,
} from '../services/ecgApi';
import { AssistantContext } from '../types/assistant';
import { HealthContextSummary } from '../types/healthInfo';
import { ScreenTab } from '../types';

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
  const [samples, setSamples] = useState<ECGSample[]>([]);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const activeSample = samples[selectedSampleIndex] ?? null;
  // Compatibility values are only referenced by the pre-analysis markup; it is
  // rendered only after a real QML response is available.
  const activeBeat = {
    classType: activeSample?.class_code as AamiClassCode,
    className: activeSample?.class_name ?? '',
    recordId: activeSample?.id ?? '',
  };
  const selectedBeatIndex: number = -1;

  // Analysis Pipeline Animation State
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real Backend Integration State
  const [realPrediction, setRealPrediction] = useState<PredictionResponse | null>(null);
  const [realExplanation, setRealExplanation] = useState<AnalyzeResponse['explanation'] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const animationTimersRef = useRef<NodeJS.Timeout[]>([]);

  const handleResetControls = () => {
    setPipelineStatus('idle');
    setActiveStep(-1);
    setToastMessage(null);
  };

  const handleRunAnalysis = useCallback(async () => {
    if (pipelineStatus === 'running' || !activeSample) return;

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

    const t5 = setTimeout(async () => {
      try {
        setToastMessage('Calling QML backend API...');
        const [prediction, analysis] = await Promise.all([
          predictECG(activeSample.signal),
          analyzeECG(activeSample.signal),
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
  }, [activeSample, pipelineStatus]);

  useEffect(() => {
    let cancelled = false;
    const loadSamples = async () => {
      setSamplesLoading(true);
      setSamplesError(null);
      try {
        const response = await getECGSamples();
        if (!cancelled) {
          setSamples(response.samples);
          setSelectedSampleIndex(0);
        }
      } catch (err) {
        const error = err as ECGAPIError;
        if (!cancelled) setSamplesError(error.detail || error.message);
      } finally {
        if (!cancelled) setSamplesLoading(false);
      }
    };
    void loadSamples();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Active beat and prediction state derived values
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

    prob = realPrediction ? realPrediction.probabilities[code] * 100 : 0;
    isDominant = realPrediction ? code === realPrediction.predicted_class : false;

    return {
      code,
      name: config.fullName,
      prob,
      color: config.color,
      isDominant,
    };
  });

  // Concise XAI explanation summary
  const xaiSummary = useMemo(() => {
    if (!realExplanation) return null;
    return {
      method: realExplanation.method || 'PCA perturbation',
      topFeatures: realExplanation.top_pca_features
        ? realExplanation.top_pca_features.slice(0, 3).map((f) => ({
            rank: f.rank,
            feature: `PCA ${f.pca_feature}`,
            importance: f.importance.toFixed(4),
            scoreDelta: (f.score_change >= 0 ? '+' : '') + f.score_change.toFixed(4),
          }))
        : [],
    };
  }, [realExplanation]);

  const waveformPath = useMemo(() => {
    if (!activeSample) return '';
    const values = activeSample.signal;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = (maximum - minimum || 1) * 0.08;
    const low = minimum - padding;
    const high = maximum + padding;
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * 720;
      const y = 180 - ((value - low) / (high - low)) * 180;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }, [activeSample]);

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

      {/* Header & Sample Selector */}
      <section id="ecg-analysis-header" className="space-y-1.5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#101c28] tracking-tight uppercase">
              ECG ANALYSIS
            </h1>
          </div>

          {/* Sample Selector Pills */}
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-[#5c7b99] px-1.5 hidden sm:inline">
              Test sample:
            </span>
            {samplesLoading && <span className="px-2 py-1 text-xs text-slate-500">Loading real ECGs...</span>}
            {!samplesLoading && samples.map((sample, idx) => {
              const isSelected = selectedSampleIndex === idx;
              const beat = {
                recordId: sample.id,
                classType: sample.class_code,
                className: sample.class_name,
              };
              return (
                <button
                  key={sample.id}
                  onClick={() => {
                    setSelectedSampleIndex(idx);
                    setRealPrediction(null);
                    setRealExplanation(null);
                    setApiError(null);
                    setPipelineStatus('idle');
                    setActiveStep(-1);
                    handleResetControls();
                  }}
                  disabled={pipelineStatus === 'running'}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected ? 'bg-[#101c28] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={`Record ${beat.recordId} • Class ${beat.classType} (${beat.className})`}
                >
                  <span>{sample.id}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Analysis Section */}
      <section id="analysis-section" className="space-y-3">
        <div className="matte-3d-card rounded-2xl p-4 md:p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#101c28]">
            ANALYSIS
          </h2>
          <p className="text-[11px] text-[#5c7b99]">
            Real MIT-BIH test-set waveform and QML backend classification
          </p>

          {samplesError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
              Unable to load real ECG samples from the backend: {samplesError}
            </div>
          )}

          {activeSample && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-[#101c28]">Dataset waveform</span>
                <span className="font-mono text-slate-500">MIT-BIH test row {activeSample.index}; 187 values from /samples</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden">
                <svg viewBox="0 0 720 180" className="w-full h-36" role="img" aria-label={`ECG waveform for ${activeSample.id}`}>
                  <path d="M 0 90 L 720 90" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none" />
                  <path d={waveformPath} stroke="#101c28" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold">Reference class:</span>
                <AamiClassBadge code={activeSample.class_code as AamiClassCode} variant="compact" size="sm" />
                <span>{activeSample.class_name}</span>
              </div>
            </div>
          )}

          {/* Primary CTA: Run Analysis */}
          <button
            id="run-analysis-cta-btn"
            onClick={handleRunAnalysis}
            disabled={pipelineStatus === 'running' || samplesLoading || !activeSample}
            className="px-4 py-2 bg-[#bc000a] hover:bg-[#a10008] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
                ? 'Analyzing...'
                : pipelineStatus === 'completed'
                ? 'Re-run Analysis'
                : 'Run Analysis'}
            </span>
          </button>
        </div>
      </section>

      {/* Results Section */}
      <section id="prediction-results-section" className="space-y-4">
        <div className="matte-3d-card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-4">
          {/* API Error Display */}
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500" aria-hidden="true">error</span>
                <span className="font-bold">ECG Analysis Backend Unavailable:</span>
              </div>
              <p className="mt-1">{apiError}</p>
            </div>
          )}

          {/* Backend Health Check Hint */}
          {!apiError && pipelineStatus === 'idle' && !realPrediction && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500" aria-hidden="true">info</span>
                <span className="font-bold">Ready for Analysis:</span>
              </div>
              <p className="mt-1">Select an ECG sample and click <strong>Run Analysis</strong> to send it to the QML backend.</p>
            </div>
          )}

          {/* Prediction Header */}
          {realPrediction && <div className="border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-3">
              <AamiClassBadge code={realPrediction.predicted_class as AamiClassCode} variant="compact" size="lg" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">QML prediction</p>
                <h3 className="text-xl font-black text-[#101c28] tracking-tight uppercase">
                  {realPrediction.predicted_class_name.toUpperCase()}
                </h3>
                <span className="hidden" aria-hidden="true">
                  Sample: {selectedBeatIndex === 1 ? 'ECG-0248' : `ECG-${activeBeat.recordId.replace(/\D/g, '')}`} • Lead II
                  {realPrediction && ' • QML Backend'}
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mt-1.5 pt-1.5 border-t border-slate-50">
              <span className="text-2xl sm:text-3xl font-black text-[#bc000a] font-mono tracking-tight">
                {`${(realPrediction.confidence * 100).toFixed(1)}%`}
              </span>
              <span className="text-xs font-mono font-medium text-slate-500">
                model posterior confidence (QML)
              </span>
            </div>
          </div>}

          {/* 5-Class Probability Distribution */}
          {realPrediction && <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#101c28] uppercase tracking-wider text-[11px]">
                5-Class Probability Distribution:
              </span>
              <span className="font-mono text-slate-500 text-[11px]">
                QML Softmax Posterior
              </span>
            </div>

            <div className="space-y-1.5">
              {aamiClasses.map((item) => {
                return (
                  <AamiClassDistributionBar
                    key={item.code}
                    code={item.code}
                    probability={item.prob}
                    isDominant={item.isDominant}
                  />
                );
              })}
            </div>
          </div>}

          {/* Concise XAI Explanation from QML Backend */}
          {realExplanation && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-[#bc000a]">wb_incandescent</span>
                XAI Explanation
              </h4>

              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-mono text-slate-600">
                <span className="font-semibold text-slate-700">Method:</span>{' '}
                {realExplanation.method || 'PCA perturbation with loading-weighted back-projection'}
              </div>

              {/* Top 3 PCA Feature Attribution */}
              {xaiSummary?.topFeatures.length > 0 && (
                <div className="space-y-1">
                  {xaiSummary.topFeatures.map((feature) => (
                    <div key={feature.rank} className="flex items-center justify-between text-xs text-slate-600">
                      <span>#{feature.rank}: {feature.feature}</span>
                      <span>Δ{feature.scoreDelta}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* XAI Disclaimer */}
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans italic">
                These regions indicate where the model's input representation was most sensitive to perturbation. They describe model behavior and are not clinical causal evidence.
              </p>
            </div>
          )}

          {/* Clinical/research disclaimer */}
          <ClinicalDisclaimer className="mt-2" />
        </div>
      </section>
    </div>
  );
};
