import type React from 'react';
import { useState, useEffect } from 'react';
import { ScreenTab } from '../types';
import {
  fetchPatientEcgUploads,
  createEcgUploadSignedUrl,
  StoredEcgUpload,
} from '../services/ecgUploadService';
import { fetchEcgHistory, EcgHistoryEntry } from '../services/ecgPersistence';
import { AamiClassBadge } from './AamiClassBadge';
import { AamiClassCode } from '../data/aamiClassSystem';
import { saveJourneyResume, clearJourneyResume } from '../services/journeyState';

/**
 * Journey — Records.
 *
 * Reuses the EXISTING data layer untouched:
 *   - fetchPatientEcgUploads: stored ORIGINAL files (Supabase Storage +
 *     public.ecg_uploads metadata, RLS patient-scoped)
 *   - fetchEcgHistory: saved analyses (ecg_records -> predictions ->
 *     explanations, RLS patient-scoped)
 */

interface PatientJourneyRecordsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

type UploadsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; uploads: StoredEcgUpload[] };

type HistoryState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; entries: EcgHistoryEntry[] };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

function uploadTypeLabel(uploadType: string): string {
  switch (uploadType) {
    case 'ecg-csv':
      return 'ECG CSV';
    case 'ecg-txt':
      return 'ECG TXT';
    case 'ecg-pdf':
      return 'ECG PDF (stored)';
    default:
      return uploadType;
  }
}

export const PatientJourneyRecordsScreen: React.FC<PatientJourneyRecordsScreenProps> = ({ onNavigate }) => {
  const [uploads, setUploads] = useState<UploadsState>({ phase: 'loading' });
  const [history, setHistory] = useState<HistoryState>({ phase: 'loading' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    saveJourneyResume('journey-records');
    return () => clearJourneyResume();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uploadsResult = await fetchPatientEcgUploads();
      if (cancelled) return;
      if (uploadsResult.ok) {
        setUploads({ phase: 'ready', uploads: uploadsResult.uploads ?? [] });
      } else {
        setUploads({ phase: 'error', message: uploadsResult.error ?? 'Could not load stored files.' });
      }

      const historyResult = await fetchEcgHistory();
      if (cancelled) return;
      if (historyResult.ok) {
        setHistory({ phase: 'ready', entries: historyResult.entries ?? [] });
      } else {
        setHistory({ phase: 'error', message: historyResult.error ?? 'Could not load saved analyses.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Records</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Your uploaded health records and saved analysis results. Only you can see these.
        </p>
      </div>

      {/* ============ Saved analyses ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Saved analyses</h2>
          <button
            onClick={() => onNavigate('journey-upload')}
            className="text-xs font-bold text-[#bc000a] hover:underline cursor-pointer"
          >
            + Analyze a record
          </button>
        </div>

        {history.phase === 'loading' && (
          <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            Loading saved analyses…
          </div>
        )}

        {history.phase === 'error' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-mono" role="alert">
            {history.message}
          </div>
        )}

        {history.phase === 'ready' && history.entries.length === 0 && (
          <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No saved analyses yet — upload a record to get your first result.
          </div>
        )}

        {history.phase === 'ready' && history.entries.length > 0 && (
          <div className="space-y-2.5">
            {history.entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const prediction = entry.prediction;
              return (
                <article
                  key={entry.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    isExpanded ? 'border-[#bc000a]/40 shadow-md' : 'border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    aria-expanded={isExpanded}
                    className="w-full text-left p-4 flex items-center gap-3 cursor-pointer"
                  >
                    {prediction ? (
                      <AamiClassBadge code={prediction.predictedClass as AamiClassCode} variant="compact" size="md" />
                    ) : (
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">?</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#101c28]">
                        {prediction ? `${prediction.predictedClass} — heartbeat classification` : 'Record (no result)'}
                      </span>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        {formatTimestamp(entry.recordedAt)}
                        {prediction ? ` · ${(prediction.confidence * 100).toFixed(1)}% confidence` : ''}
                        {entry.source ? ` · ${entry.source}` : ''}
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-slate-400 shrink-0">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 text-xs">
                      {prediction && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Class</p>
                            <p className="font-bold text-[#101c28]">{prediction.predictedClass}</p>
                          </div>
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Confidence</p>
                            <p className="font-bold text-[#101c28] font-mono">{(prediction.confidence * 100).toFixed(1)}%</p>
                          </div>
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Model</p>
                            <p className="font-bold text-[#101c28] font-mono">
                              {(prediction.modelInfo?.model as string) ?? 'PCA-8 Hybrid QML'}
                            </p>
                          </div>
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Mode</p>
                            <p className="font-bold text-[#101c28] font-mono capitalize">{prediction.modelMode}</p>
                          </div>
                        </div>
                      )}
                      {entry.explanation && (
                        <p className="text-[10.5px] text-slate-500">
                          Explanation method stored: <span className="font-mono">{entry.explanation.method}</span> — full
                          XAI attribution is kept with the result.
                        </p>
                      )}
                      <p className="text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2">
                        Automated heartbeat classification — not a medical diagnosis.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ============ Stored original files ============ */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-sm text-[#101c28]">Uploaded files</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Original files kept in private storage. Download links are temporary and work only for you.
            </p>
          </div>
          {uploads.phase === 'ready' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold shrink-0">
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
          <p className="text-xs text-slate-500">No uploaded files yet.</p>
        )}

        {uploads.phase === 'ready' && uploads.uploads.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {uploads.uploads.map((upload) => {
              const analyzed = history.phase === 'ready' && history.entries.some((entry) => entry.uploadId === upload.id);
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
                      analyzed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {analyzed ? 'analyzed' : 'stored'}
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
    </div>
  );
};
