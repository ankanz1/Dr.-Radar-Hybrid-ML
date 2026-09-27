import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../types';
import {
  getAuthenticatedDoctor,
  fetchAuthorizedPatients,
  fetchPatientEcgHistory,
  DoctorIdentity,
  AuthorizedPatient,
} from '../services/doctorEcgService';
import { EcgHistoryEntry } from '../services/ecgPersistence';
import {
  fetchPatientEcgUploadsForDoctor,
  createEcgUploadSignedUrl,
  StoredEcgUpload,
} from '../services/ecgUploadService';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';
import { AamiClassCode, getAamiClass } from '../data/aamiClassSystem';

interface DoctorPatientEcgDashboardProps {
  onNavigate: (tab: ScreenTab) => void;
  /** Patient to auto-select once the authorized list loads (from the dashboard). */
  initialPatientId?: string | null;
}

type DashboardPhase =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; doctor: DoctorIdentity; patients: AuthorizedPatient[]; warning?: string };

type DetailPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; entries: EcgHistoryEntry[] };

type DoctorUploadsPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; uploads: StoredEcgUpload[] };

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

/** Stored-signal SVG — identical charting approach to the patient history screen. */
const StoredWaveform: React.FC<{ signal: number[] }> = ({ signal }) => {
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
    <svg viewBox="0 0 720 180" className="w-full h-full" preserveAspectRatio="none" role="img" aria-label="Stored ECG waveform">
      <path d="M 0 90 L 720 90" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none" />
      <path d={path} stroke="#bc000a" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/**
 * Doctor-facing patient ECG dashboard (minimum viable demo).
 * All data comes from stored Supabase rows; access is enforced by RLS
 * (appointment relationship), never by UI-supplied patient IDs.
 * No QML inference runs here — doctors read stored predictions only.
 */
export const DoctorPatientEcgDashboard: React.FC<DoctorPatientEcgDashboardProps> = ({ onNavigate, initialPatientId }) => {
  const [dashboard, setDashboard] = useState<DashboardPhase>({ phase: 'loading' });
  const [selectedPatient, setSelectedPatient] = useState<AuthorizedPatient | null>(null);
  const [detail, setDetail] = useState<DetailPhase>({ phase: 'idle' });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<DoctorUploadsPhase>({ phase: 'idle' });
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Load doctor identity + authorized patient list on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDashboard({ phase: 'loading' });
      const doctorResult = await getAuthenticatedDoctor();
      if (cancelled) return;

      if (doctorResult.status === 'signed-out' || doctorResult.status === 'no-doctor-record') {
        setDashboard({
          phase: 'error',
          message:
            doctorResult.status === 'signed-out'
              ? 'Sign in with your doctor account to view patient records.'
              : 'No doctor profile (public.doctors) is linked to this account.',
        });
        return;
      }
      if (doctorResult.status === 'error') {
        setDashboard({ phase: 'error', message: doctorResult.error });
        return;
      }

      const patientsResult = await fetchAuthorizedPatients();
      if (cancelled) return;
      if (!patientsResult.ok || !patientsResult.data) {
        setDashboard({ phase: 'error', message: patientsResult.error ?? 'Could not load patients.' });
        return;
      }

      setDashboard({
        phase: 'ready',
        doctor: { doctorId: doctorResult.doctorId, displayName: doctorResult.displayName },
        patients: patientsResult.data,
        warning: patientsResult.error,
      });

      // Deep-link: auto-select the requested patient (RLS still governs what
      // the detail queries return — an unauthorized id simply yields nothing).
      const preselected = initialPatientId
        ? patientsResult.data.find((p) => p.patientId === initialPatientId)
        : undefined;
      if (preselected) {
        void handleSelectPatient(preselected);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPatient = async (patient: AuthorizedPatient) => {
    setSelectedPatient(patient);
    setExpandedRecordId(null);
    setDetail({ phase: 'loading' });
    setUploads({ phase: 'loading' });
    setLinkError(null);

    const result = await fetchPatientEcgHistory(patient.patientId);
    if (result.ok && result.data) {
      setDetail({ phase: 'ready', entries: result.data });
    } else {
      setDetail({ phase: 'error', message: result.error ?? 'Could not load stored analyses.' });
    }

    // Stored ORIGINAL files (RLS returns only appointment-authorized rows).
    // An empty list is normal (patient has not uploaded anything).
    const uploadsResult = await fetchPatientEcgUploadsForDoctor(patient.patientId);
    if (uploadsResult.ok) {
      setUploads({ phase: 'ready', uploads: uploadsResult.uploads ?? [] });
    } else {
      setUploads({ phase: 'error', message: uploadsResult.error ?? 'Could not load stored files.' });
    }
  };

  // Short-lived signed URL — RLS enforces authorization; a failed request
  // simply surfaces an error and never a permanent URL.
  const handleDoctorDownload = async (upload: StoredEcgUpload) => {
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
      {/* ============ 1. Header ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • DOCTOR DASHBOARD
            </span>
            <span className="text-[11px] font-mono text-slate-500">Stored patient ECG analyses</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            {dashboard.phase === 'ready' ? dashboard.doctor.displayName : 'Doctor Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Patients authorized via scheduled or completed appointments. Read-only access to stored analyses.
          </p>
        </div>
        {dashboard.phase === 'ready' && (
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold shrink-0">
            doctor {dashboard.doctor.doctorId.slice(0, 8)}…
          </span>
        )}
      </div>

      {/* ============ Loading ============ */}
      {dashboard.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Resolving your doctor profile and authorized patients…
        </div>
      )}

      {/* ============ Error (no doctor record / signed out / query failure) ============ */}
      {dashboard.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-1" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Doctor dashboard unavailable
          </div>
          <p className="font-mono">{dashboard.message}</p>
        </div>
      )}

      {/* ============ 2. Patient list ============ */}
      {dashboard.phase === 'ready' && (
        <>
          {dashboard.warning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs" role="status">
              {dashboard.warning}
            </div>
          )}

          {dashboard.patients.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">group_off</span>
              </div>
              <p className="text-sm font-bold text-[#101c28]">No authorized patient records yet.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Patients appear here only when a scheduled or completed appointment links them to your doctor profile.
              </p>
            </div>
          ) : (
            <section className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden" aria-label="Authorized patients">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#101c28]">Authorized Patients</h2>
                <span className="text-[10px] font-mono text-slate-400">
                  {dashboard.patients.length} patient{dashboard.patients.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {dashboard.patients.map((patient) => {
                  const isSelected = selectedPatient?.patientId === patient.patientId;
                  return (
                    <li key={patient.patientId}>
                      <button
                        onClick={() => void handleSelectPatient(patient)}
                        aria-expanded={isSelected}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#ffe8e8]/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[20px]">person</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#101c28] truncate">{patient.name}</span>
                          <span className="block text-[11px] text-slate-500 truncate">
                            {patient.email ?? 'no email visible'}
                            {patient.latestAnalysisAt
                              ? ` · last analysis ${formatTimestamp(patient.latestAnalysisAt)}`
                              : ' · no stored analyses yet'}
                          </span>
                        </span>
                        {patient.latestPrediction && (
                          <AamiClassBadge
                            code={patient.latestPrediction.predictedClass as AamiClassCode}
                            variant="compact"
                            size="sm"
                          />
                        )}
                        <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0">
                          {isSelected ? 'expand_less' : 'chevron_right'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ============ 3. Selected patient's stored ECG analyses ============ */}
          {selectedPatient && (
            <section className="space-y-3" aria-label="Patient ECG analyses">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#101c28]">
                  Stored ECG analyses — {selectedPatient.name}
                </h2>
                <span className="text-[10px] font-mono text-slate-400">read from database, no new inference</span>
              </div>

              {detail.phase === 'loading' && (
                <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Loading stored analyses…
                </div>
              )}

              {detail.phase === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs" role="alert">
                  <span className="font-bold">No accessible records.</span>{' '}
                  <span className="font-mono">{detail.message}</span>
                </div>
              )}

              {detail.phase === 'ready' && detail.entries.length === 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-xs">
                  This patient has no stored ECG analyses yet.
                </div>
              )}

              {detail.phase === 'ready' &&
                detail.entries.map((entry) => {
                  const isExpanded = expandedRecordId === entry.id;
                  const prediction = entry.prediction;
                  const classMeta = prediction ? getAamiClass(prediction.predictedClass) : null;
                  return (
                    <article
                      key={entry.id}
                      className={`bg-white rounded-2xl border transition-all ${
                        isExpanded ? 'border-[#bc000a]/40 shadow-md' : 'border-slate-200/90 shadow-2xs'
                      }`}
                    >
                      <button
                        onClick={() => setExpandedRecordId(isExpanded ? null : entry.id)}
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
                            {prediction ? classMeta?.name : 'No prediction stored'}
                          </span>
                          <span className="block text-[11px] text-slate-500 font-mono">
                            {formatTimestamp(entry.recordedAt)}
                            {entry.sampleId ? ` · ${entry.sampleId}` : ''}
                            {prediction ? ` · ${(prediction.confidence * 100).toFixed(1)}%` : ''}
                          </span>
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-slate-400 shrink-0">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                          {/* Stored waveform */}
                          {entry.signal && entry.signal.length > 1 && (
                            <div className="h-36 w-full bg-[#f8fbfe] rounded-xl border border-slate-200/90 p-2">
                              <StoredWaveform signal={entry.signal} />
                            </div>
                          )}

                          {/* Prediction summary */}
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
                                  {(prediction.modelInfo?.model as string) ?? 'PCA-8 Hybrid QML'}
                                </p>
                              </div>
                              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Mode</p>
                                <p className="text-xs font-bold text-[#101c28] font-mono capitalize">{prediction.modelMode}</p>
                              </div>
                            </div>
                          )}

                          {/* Five-class probabilities (stored) */}
                          {prediction?.probabilities && Object.keys(prediction.probabilities).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#101c28]">
                                Stored five-class probability distribution
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

                          {/* Stored XAI explanation */}
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
                                            importance{' '}
                                            {typeof feature.importance === 'number' ? feature.importance.toFixed(4) : '—'}
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
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
            </section>
          )}

          {/* ============ 4. Selected patient's stored ORIGINAL files ============ */}
          {selectedPatient && (
            <section className="space-y-3" aria-label="Patient stored files">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#101c28]">
                  Stored original files — {selectedPatient.name}
                </h2>
                <span className="text-[10px] font-mono text-slate-400">read-only · appointment-authorized</span>
              </div>

              {uploads.phase === 'loading' && (
                <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Loading stored files…
                </div>
              )}

              {uploads.phase === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs" role="alert">
                  <span className="font-bold">Stored files unavailable.</span>{' '}
                  <span className="font-mono">{uploads.message}</span>
                </div>
              )}

              {uploads.phase === 'ready' && uploads.uploads.length === 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-xs">
                  This patient has no stored original files yet.
                </div>
              )}

              {uploads.phase === 'ready' && uploads.uploads.length > 0 && (
                <ul className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
                  {uploads.uploads.map((upload) => {
                    const analyzed = detail.phase === 'ready' && detail.entries.some((e) => e.uploadId === upload.id);
                    const latestForFile =
                      detail.phase === 'ready'
                        ? detail.entries.find((e) => e.uploadId === upload.id && e.prediction)
                        : undefined;
                    return (
                      <li key={upload.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
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
                            {latestForFile?.prediction
                              ? ` · last result ${latestForFile.prediction.predictedClass} (${(
                                  latestForFile.prediction.confidence * 100
                                ).toFixed(1)}%)`
                              : analyzed
                              ? ' · analyzed'
                              : ''}
                          </span>
                        </span>
                        <button
                          onClick={() => void handleDoctorDownload(upload)}
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
        </>
      )}

      {/* Back to the clinical overview */}
      <div className="flex justify-start">
        <button
          onClick={() => onNavigate('doctor-dashboard')}
          className="text-xs font-bold text-[#bc000a] hover:text-[#a00008] flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to clinical dashboard
        </button>
      </div>
    </div>
  );
};
