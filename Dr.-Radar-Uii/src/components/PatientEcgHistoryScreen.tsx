import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../types';
import { fetchEcgHistory, EcgHistoryEntry } from '../services/ecgPersistence';
import {
  fetchPatientEcgUploads,
  createEcgUploadSignedUrl,
  StoredEcgUpload,
} from '../services/ecgUploadService';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';
import { AamiClassCode, getAamiClass } from '../data/aamiClassSystem';

interface PatientEcgHistoryScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; entries: EcgHistoryEntry[] };

type UploadsState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; uploads: StoredEcgUpload[] };

/** Human label for an upload_type value. */
function uploadTypeLabel(uploadType: string): string {
  switch (uploadType) {
    case 'ecg-csv':
      return 'ECG CSV';
    case 'ecg-txt':
      return 'ECG TXT';
    case 'ecg-pdf':
      return 'ECG PDF (stored only)';
    default:
      return uploadType;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format an ISO timestamp for the history list. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Small inline SVG for a stored 187-point signal — mirrors the analysis preview chart. */
const HistoryWaveform: React.FC<{ signal: number[]; className?: string }> = ({ signal, className = '' }) => {
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
    <svg
      viewBox="0 0 720 180"
      className={`w-full h-full ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Stored ECG waveform"
    >
      <path d="M 0 90 L 720 90" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none" />
      <path d={path} stroke="#bc000a" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/**
 * Patient ECG History: the authenticated patient's saved ECG analyses
 * (public.ecg_records + public.predictions + public.explanations), newest first.
 * Access is RLS-restricted to the patient's own rows — no other patient's
 * records can ever be listed here.
 */
export const PatientEcgHistoryScreen: React.FC<PatientEcgHistoryScreenProps> = ({ onNavigate }) => {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadsState>({ phase: 'idle' });
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadHistory = async (signal: { aborted: boolean }) => {
    setState({ phase: 'loading' });
    const result = await fetchEcgHistory();
    if (signal.aborted) return;

    if (!result.ok) {
      setState({ phase: 'error', message: result.error ?? 'Unknown error loading ECG history.' });
      return;
    }
    setState({ phase: 'ready', entries: result.entries ?? [] });
    setExpandedId(null);
  };

  useEffect(() => {
    const controller = { aborted: false };
    void loadHistory(controller);
    return () => {
      controller.aborted = true;
    };
  }, []);

  // Summary stats for the header
  const stats = useMemo(() => {
    if (state.phase !== 'ready') return null;
    const entries = state.entries;
    const abnormal = entries.filter((entry) => entry.prediction && entry.prediction.predictedClass !== 'N').length;
    const latest = entries[0]?.recordedAt;
    return { total: entries.length, abnormal, latest };
  }, [state]);

  const handleRetry = () => {
    void loadHistory({ aborted: false });
  };

  // Stored ORIGINAL files (Supabase Storage + ecg_uploads metadata)
  useEffect(() => {
    let cancelled = false;
    const loadUploads = async () => {
      setUploads({ phase: 'loading' });
      const result = await fetchPatientEcgUploads();
      if (cancelled) return;
      if (!result.ok) {
        setUploads({ phase: 'error', message: result.error ?? 'Could not load stored files.' });
        return;
      }
      setUploads({ phase: 'ready', uploads: result.uploads ?? [] });
    };
    void loadUploads();
    return () => {
      cancelled = true;
    };
  }, []);

  // Short-lived signed URL (300 s) — never a permanent/public URL.
  const handleDownload = async (upload: StoredEcgUpload) => {
    setLinkBusyId(upload.id);
    setLinkError(null);
    const result = await createEcgUploadSignedUrl(upload.id);
    setLinkBusyId(null);
    if (!result.ok || !result.url) {
      setLinkError(result.error ?? 'Could not create a download link.');
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ============ Header ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • ECG HISTORY
            </span>
            <span className="text-[11px] font-mono text-slate-500">Saved analyses</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            My ECG History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your previously analyzed heartbeats, saved from the ECG analysis workflow. Only you can see these records.
          </p>
        </div>

        {state.phase === 'ready' && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
              {stats?.total ?? 0} saved
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-1 rounded-lg border font-semibold ${
                (stats?.abnormal ?? 0) > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {stats?.abnormal ?? 0} non-normal
            </span>
          </div>
        )}
      </div>

      {/* ============ Loading ============ */}
      {state.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading your ECG history…
        </div>
      )}

      {/* ============ Error ============ */}
      {state.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-2" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            Could not load ECG history
          </div>
          <p className="font-mono">{state.message}</p>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ============ Empty state ============ */}
      {state.phase === 'ready' && state.entries.length === 0 && (
        <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">ecg_heart</span>
          </div>
          <p className="text-sm font-bold text-[#101c28]">No saved ECG analyses yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Run an analysis in the ECG workflow and it will be saved to your medical history automatically.
          </p>
          <button
            onClick={() => onNavigate('patient-ecg')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Analyze an ECG
          </button>
        </div>
      )}

      {/* ============ History list ============ */}
      {state.phase === 'ready' && state.entries.length > 0 && (
        <div className="space-y-3">
          {state.entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const prediction = entry.prediction;
            const classMeta = prediction ? getAamiClass(prediction.predictedClass) : null;
            return (
              <article
                key={entry.id}
                className={`bg-white rounded-2xl border transition-all ${
                  isExpanded ? 'border-[#bc000a]/40 shadow-md' : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                }`}
              >
                {/* Row summary (click to expand details) */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-4 flex items-center gap-3 cursor-pointer"
                >
                  {prediction ? (
                    <AamiClassBadge
                      code={prediction.predictedClass as AamiClassCode}
                      variant="compact"
                      size="md"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">help</span>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#101c28]">
                        {prediction ? classMeta?.name : 'No prediction stored'}
                      </span>
                      {prediction && (
                        <span className="text-[10px] font-mono text-slate-500">
                          {(prediction.confidence * 100).toFixed(1)}% confidence
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{formatTimestamp(entry.recordedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.sampleId ?? entry.id.slice(0, 8)}</span>
                      {entry.source && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[200px]">{entry.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[20px] text-slate-400 shrink-0">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Expanded stored-analysis details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                    {/* Stored waveform */}
                    {entry.signal && entry.signal.length > 1 && (
                      <div className="h-32 w-full bg-[#f8fbfe] rounded-xl border border-slate-200/90 p-2">
                        <HistoryWaveform signal={entry.signal} />
                      </div>
                    )}

                    {/* Prediction details */}
                    {prediction && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Predicted</p>
                          <p className="text-xs font-bold text-[#101c28]">
                            {classMeta?.abbreviation} · {classMeta?.name}
                          </p>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Confidence</p>
                          <p className="text-xs font-bold text-[#101c28] font-mono">
                            {(prediction.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Model</p>
                          <p className="text-xs font-bold text-[#101c28] font-mono">
                            {prediction.modelInfo?.model as string ?? 'PCA-8 Hybrid QML'}
                          </p>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Mode</p>
                          <p className="text-xs font-bold text-[#101c28] font-mono capitalize">{prediction.modelMode}</p>
                        </div>
                      </div>
                    )}

                    {/* Probability distribution */}
                    {prediction?.probabilities && Object.keys(prediction.probabilities).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#101c28]">
                          Stored probability distribution
                        </p>
                        {(['N', 'S', 'V', 'F', 'Q'] as AamiClassCode[]).map((code) => (
                          <AamiClassDistributionBar
                            key={code}
                            code={code}
                            probability={(prediction.probabilities[code] ?? 0) * 100}
                            isDominant={code === prediction.predictedClass}
                          />
                        ))}
                      </div>
                    )}

                    {/* Explanation details */}
                    {entry.explanation && (
                      <div className="pt-1 border-t border-slate-100 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-[#bc000a]">wb_incandescent</span>
                          Stored explanation (XAI)
                        </p>
                        <p className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-200/80 rounded-xl p-2">
                          {entry.explanation.method}
                        </p>
                        {Array.isArray(entry.explanation.ranked_features) &&
                          entry.explanation.ranked_features.length > 0 && (
                            <div className="space-y-1">
                              {(entry.explanation.ranked_features as Array<{
                                rank?: number;
                                pca_feature?: number;
                                importance?: number;
                                score_change?: number;
                              }>)
                                .slice(0, 3)
                                .map((feature, index) => (
                                  <div key={feature.rank ?? index} className="flex items-center justify-between text-xs text-slate-600">
                                    <span>
                                      #{feature.rank ?? index + 1}: PCA component {feature.pca_feature}
                                    </span>
                                    <span className="font-mono">
                                      importance {typeof feature.importance === 'number' ? feature.importance.toFixed(4) : '—'}
                                      {typeof feature.score_change === 'number'
                                        ? ` · Δscore ${feature.score_change >= 0 ? '+' : ''}${feature.score_change.toFixed(4)}`
                                        : ''}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Record metadata */}
                    <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span>record {entry.id.slice(0, 8)}…</span>
                      <span aria-hidden="true">·</span>
                      <span>lead {entry.lead}</span>
                      {entry.source && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{entry.source}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{entry.signal ? `${entry.signal.length} stored values` : 'no stored signal'}</span>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ============ Stored original files (Supabase Storage) ============ */}
      {state.phase === 'ready' && (
        <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-label="Stored ECG files">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-sm text-[#101c28]">Stored ECG files</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Original uploaded files (CSV/TXT/PDF), kept in private storage. Download links are temporary and work
                only for you.
              </p>
            </div>
            {uploads.phase === 'ready' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
                {uploads.uploads.length} file{uploads.uploads.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {uploads.phase === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              Loading stored files…
            </div>
          )}

          {uploads.phase === 'error' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-mono" role="alert">
              {uploads.message}
            </div>
          )}

          {uploads.phase === 'ready' && uploads.uploads.length === 0 && (
            <p className="text-xs text-slate-500">
              No original files stored yet — upload a CSV/TXT or PDF in the ECG workflow.
            </p>
          )}

          {uploads.phase === 'ready' && uploads.uploads.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {uploads.uploads.map((upload) => {
                // Analysis linkage is known through saved ecg_records.upload_id
                const analyzed = state.entries.some((entry) => entry.uploadId === upload.id);
                return (
                  <li key={upload.id} className="py-3 flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        {upload.uploadType === 'ecg-pdf' ? 'picture_as_pdf' : 'description'}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#101c28] truncate">{upload.fileName}</span>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        {uploadTypeLabel(upload.uploadType)} · {formatBytes(upload.sizeBytes)} ·{' '}
                        {formatTimestamp(upload.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${
                        upload.uploadType === 'ecg-pdf'
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : analyzed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {upload.uploadType === 'ecg-pdf' ? 'storage only' : analyzed ? 'analyzed' : 'not analyzed'}
                    </span>
                    <button
                      onClick={() => void handleDownload(upload)}
                      disabled={linkBusyId === upload.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shrink-0"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${linkBusyId === upload.id ? 'animate-spin' : ''}`}>
                        {linkBusyId === upload.id ? 'progress_activity' : 'download'}
                      </span>
                      View / Download
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {linkError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
              {linkError}
            </div>
          )}
        </section>
      )}

      {/* Back to analysis */}
      <div className="flex justify-start">
        <button
          onClick={() => onNavigate('patient-ecg')}
          className="text-xs font-bold text-[#bc000a] hover:text-[#a00008] flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to ECG analysis
        </button>
      </div>
    </div>
  );
};
