import type React from 'react';
import { useState, useMemo } from 'react';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';
import { AamiClassCode, getAamiClass } from '../data/aamiClassSystem';
import type { AnalyzeResponse } from '../services/ecgApi';

/**
 * Journey step 6 — Analysis Output (patient-friendly result).
 *
 * Renders ONLY what the real /analyze response contains:
 *   - predicted heartbeat class (N/S/V/F/Q) + confidence + probabilities
 *   - the real XAI payload (method, ranked PCA features, waveform importance)
 * Nothing is invented: every number comes from the backend response, and the
 * result is always framed as an automated heartbeat classification — never a
 * medical diagnosis.
 */

interface AnalysisResultViewProps {
  result: AnalyzeResponse;
  /** The exact 187-value signal that produced this result (for the waveform). */
  signal: number[];
  /** Where the analyzed beat came from, e.g. "uploaded file recording.csv, beat 1". */
  provenanceLabel: string;
  /** Auto-save status from the persistence layer. */
  saveState: 'not-saved' | 'saving' | 'saved' | 'failed' | 'unavailable';
  saveMessage: string | null;
  onConnectDoctor: () => void;
  onAnalyzeAnother: () => void;
}

/** Plain-language meaning per AAMI class (heartbeat category, not a diagnosis). */
const CLASS_MEANING: Record<AamiClassCode, string> = {
  N: 'This heartbeat looks like a normal beat pattern for your heart\'s natural rhythm.',
  S: 'This heartbeat started earlier than expected from the upper chambers of the heart. Occasional beats like this are common, but mention it to your doctor.',
  V: 'This heartbeat started early from the lower chambers of the heart. Occasional beats like this are common, but you should discuss this result with your doctor.',
  F: 'This heartbeat shows a mixed pattern between a normal beat and an early lower-chamber beat.',
  Q: 'The shape of this heartbeat could not be confidently placed into a standard category — it may be a paced beat or unclear signal.',
};

const PatientWaveform: React.FC<{ signal: number[] }> = ({ signal }) => {
  const path = useMemo(() => {
    const minimum = Math.min(...signal);
    const maximum = Math.max(...signal);
    const padding = (maximum - minimum || 1) * 0.08;
    const low = minimum - padding;
    const high = maximum + padding;
    return signal
      .map((value, index) => {
        const x = (index / (signal.length - 1)) * 720;
        const y = 180 - ((value - low) / (high - low)) * 180;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [signal]);

  return (
    <div className="h-44 w-full bg-[#f8fbfe] rounded-2xl border border-slate-200/90 relative overflow-hidden p-2">
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id="journey-result-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#bc000a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#journey-result-grid)" />
      </svg>
      <svg viewBox="0 0 720 180" className="relative z-10 w-full h-full" preserveAspectRatio="none" role="img" aria-label="Analyzed heartbeat waveform">
        <path d="M 0 90 L 720 90" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none" />
        <path d={path} stroke="#bc000a" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
};

export const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({
  result,
  signal,
  provenanceLabel,
  saveState,
  saveMessage,
  onConnectDoctor,
  onAnalyzeAnother,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);
  const prediction = result.prediction;
  const classMeta = getAamiClass(prediction.predicted_class);
  const confidencePct = prediction.confidence * 100;
  const topFeatures = (result.explanation.top_pca_features ?? []).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Headline result */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
          <h2 className="text-lg font-extrabold text-[#101c28] tracking-tight">Analysis completed</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <AamiClassBadge code={prediction.predicted_class as AamiClassCode} variant="compact" size="lg" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Detected heartbeat pattern</p>
            <p className="text-xl font-black text-[#101c28]">{classMeta.name}</p>
            <p className="text-[11px] text-slate-500 font-mono">{provenanceLabel}</p>
          </div>
          <div className="sm:ml-auto text-left sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Confidence</p>
            <p className="text-2xl font-black text-[#101c28]">{confidencePct.toFixed(1)}%</p>
          </div>
        </div>

        {/* What this means — plain language, tied to the actual class */}
        <div className="bg-[#f8fbfe] rounded-2xl p-4 border border-slate-200/80">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">What this means</p>
          <p className="text-sm text-slate-700 leading-relaxed">{CLASS_MEANING[prediction.predicted_class as AamiClassCode]}</p>
        </div>

        {/* Probability distribution */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#101c28]">Model certainty per category</p>
          {(['N', 'S', 'V', 'F', 'Q'] as AamiClassCode[]).map((code) => (
            <AamiClassDistributionBar
              key={code}
              code={code}
              probability={(prediction.probabilities[code] ?? 0) * 100}
              isDominant={code === prediction.predicted_class}
            />
          ))}
        </div>

        {/* Waveform */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#101c28]">Signal / waveform</p>
          <PatientWaveform signal={signal} />
          <p className="text-[10.5px] text-slate-500 font-mono">
            {signal.length}-point heartbeat used for classification
          </p>
        </div>

        {/* Required disclaimer */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
          <p>
            <strong>Important:</strong> this result is an automated heartbeat classification produced by a research
            model. It is not a medical diagnosis and does not detect overall heart health. Always consult a qualified
            healthcare professional.
          </p>
        </div>
      </div>

      {/* Save status (auto-saved — no navigation needed) */}
      <div
        className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2 ${
          saveState === 'saved'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : saveState === 'saving'
            ? 'bg-slate-50 border-slate-200 text-slate-600'
            : saveState === 'failed' || saveState === 'unavailable'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
        role="status"
      >
        <span className="material-symbols-outlined text-[18px] shrink-0">
          {saveState === 'saved' ? 'check_circle' : saveState === 'saving' ? 'progress_activity' : 'info'}
        </span>
        <span>
          <span className="font-bold">
            {saveState === 'saved' && 'Analysis saved to your health history. '}
            {saveState === 'saving' && 'Saving analysis… '}
            {(saveState === 'failed' || saveState === 'unavailable') && 'Analysis could not be saved. '}
            {saveState === 'not-saved' && 'Saving… '}
          </span>
          {saveMessage}
        </span>
      </div>

      {/* Expandable technical details (XAI + model info) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          aria-expanded={showTechnical}
          className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer"
        >
          <span className="text-xs font-bold text-[#101c28] flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#bc000a]">science</span>
            Analysis details (technical)
          </span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">
            {showTechnical ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {showTechnical && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Class ID</p>
                <p className="font-bold text-[#101c28] font-mono">{prediction.predicted_class_id}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Method</p>
                <p className="font-bold text-[#101c28] font-mono break-all">{result.explanation.method}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Model</p>
                <p className="font-bold text-[#101c28] font-mono">PCA-8 Hybrid QML</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Beat length</p>
                <p className="font-bold text-[#101c28] font-mono">{signal.length} values</p>
              </div>
            </div>

            {topFeatures.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#101c28]">
                  Top contributing features (XAI attribution)
                </p>
                {topFeatures.map((feature) => (
                  <div key={feature.rank} className="flex items-center justify-between text-slate-600">
                    <span>
                      #{feature.rank}: PCA component {feature.pca_feature}
                    </span>
                    <span className="font-mono">
                      importance {feature.importance.toFixed(4)} · Δscore {feature.score_change >= 0 ? '+' : ''}
                      {feature.score_change.toFixed(4)}
                    </span>
                  </div>
                ))}
                <p className="text-[10.5px] text-slate-500 italic">
                  XAI output describes where the model's internal representation was most sensitive — it is model
                  attribution, not clinical evidence.
                </p>
              </div>
            )}

            {result.explanation.waveform_importance?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#101c28]">Waveform importance</p>
                <div className="flex items-end gap-0.5 h-16 bg-slate-50 rounded-xl border border-slate-200/80 p-2">
                  {result.explanation.waveform_importance.map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-[#bc000a]/70 rounded-t"
                      style={{ height: `${Math.max(2, Math.min(100, value * 100))}%` }}
                      title={`point ${index + 1}: ${(value * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary next actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onConnectDoctor}
          className="flex-1 px-5 py-3.5 rounded-2xl bg-[#bc000a] text-white text-sm font-bold hover:bg-[#a00008] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">stethoscope</span>
          Connect With Doctor
        </button>
        <button
          onClick={onAnalyzeAnother}
          className="flex-1 px-5 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          Analyze Another Record
        </button>
      </div>
    </div>
  );
};
