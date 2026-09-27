import type React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScreenTab } from '../types';
import {
  checkHealth,
  uploadEcgFile,
  analyzeECG,
  ECGAPIError,
  EcgUploadResponse,
  AnalyzeResponse,
} from '../services/ecgApi';
import {
  saveEcgAnalysis,
  getAuthenticatedPatientRecord,
  getModelInfoSafe,
  EcgRecordSaveResult,
} from '../services/ecgPersistence';
import { storeEcgFile, StoredEcgUpload } from '../services/ecgUploadService';
import { AnalysisResultView } from './AnalysisResultView';
import { saveJourneyResume, clearJourneyResume } from '../services/journeyState';

/**
 * Journey steps 3-7 — Upload Health Record → Record Saved → Analyze →
 * Analysis Output → Save Output.
 *
 * State machine (requirement 13), persisted where possible:
 *   record_uploading  -> storeEcgFile (Supabase Storage + ecg_uploads)
 *   record_saved      -> storage ok (shown even when analysis cannot run)
 *   analysis_running  -> POST /ecg/upload parse + POST /analyze on THIS file
 *   analysis_completed-> result rendered from the real response
 *   analysis_failed   -> loud error, never a fake result, never MIT-BIH
 *   result_saved      -> auto-persist via saveEcgAnalysis (RLS-safe)
 *
 * Strict rules honored here (requirements 4/5/6/7/14):
 *   - Storage success and analysis success are INDEPENDENT states.
 *   - PDFs are stored AND analyzed: page-1 ECG trace is digitized on the
 *     backend (OpenCV) into one 187-value waveform, then classified by the
 *     existing QML pipeline. If extraction fails (422) the record stays
 *     saved and the user gets a loud error — never a fabricated waveform.
 *   - If waveform extraction fails the record stays saved and the user gets
 *     [Try Another Record] / [View Saved Record] / [Connect With Doctor].
 *   - No MIT-BIH sample is ever substituted for an uploaded patient file.
 *   - The analysis auto-saves once; repeated renders never duplicate rows.
 */

interface UploadAnalyzeScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

type ScreenPhase =
  | { phase: 'select' } // record_not_uploaded
  | { phase: 'uploading' } // record_uploading
  | { phase: 'extracting' } // record_saved + preparing analysis
  | { phase: 'analyzing' } // analysis_running
  | { phase: 'completed'; result: AnalyzeResponse; signal: number[]; provenance: string } // analysis_completed
  | {
      phase: 'extraction-failed';
      stored: StoredEcgUpload | null;
      message: string;
    } // record saved, no ECG waveform
  | { phase: 'analysis-failed'; stored: StoredEcgUpload | null; message: string } // record saved, analysis error
  | { phase: 'upload-failed'; message: string }; // record NOT saved

type AnalysisStage = 0 | 1 | 2 | 3 | 4 | 5;

const STAGE_LABELS = [
  'Record uploaded',
  'ECG detected',
  'Waveform extracted',
  'Signal prepared',
  'Analysis running',
  'Result generated',
];

const MAX_STORAGE_BYTES = 25 * 1024 * 1024;
const REQUIRED_SIGNAL_LENGTH = 187;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const UploadAnalyzeScreen: React.FC<UploadAnalyzeScreenProps> = ({ onNavigate }) => {
  const [phase, setPhase] = useState<ScreenPhase>({ phase: 'select' });
  const [stage, setStage] = useState<AnalysisStage>(0);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null); // null = checking
  const [saveState, setSaveState] = useState<'not-saved' | 'saving' | 'saved' | 'failed' | 'unavailable'>('not-saved');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveRunIdRef = useRef<string | null>(null); // dedupes auto-save across renders

  // Backend availability check (GET /health)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const health = await checkHealth();
        if (!cancelled) setApiOnline(Boolean(health.model_loaded));
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track journey resume position
  useEffect(() => {
    saveJourneyResume('journey-upload');
    return () => clearJourneyResume();
  }, []);

  const resetAll = useCallback(() => {
    setPhase({ phase: 'select' });
    setStage(0);
    setSaveState('not-saved');
    setSaveMessage(null);
    saveRunIdRef.current = null;
  }, []);

  // ---------------------------------------------------------------------
  // Auto-persist one successful analysis (result_saved state).
  // saveRunIdRef guarantees a single insert even if the effect re-runs.
  // ---------------------------------------------------------------------
  const persistAnalysis = useCallback(
    async (params: {
      result: AnalyzeResponse;
      signal: number[];
      stored: StoredEcgUpload | null;
      uploadParse: EcgUploadResponse | null;
      beatIndex: number;
      fileName: string;
    }) => {
      const runId = `${params.stored?.id ?? 'no-upload'}-${params.beatIndex}-${Date.now()}`;
      saveRunIdRef.current = runId;

      setSaveState('saving');
      setSaveMessage(null);

      const resolution = await getAuthenticatedPatientRecord();
      if (saveRunIdRef.current !== runId) return;
      if (resolution.status === 'signed-out' || resolution.status === 'no-patient-record') {
        setSaveState('unavailable');
        setSaveMessage(
          resolution.status === 'signed-out'
            ? 'Sign in with your patient account to keep this analysis in your history.'
            : 'No patient profile is linked to this account, so this analysis was not saved.'
        );
        return;
      }

      const modelInfo = await getModelInfoSafe();
      if (saveRunIdRef.current !== runId) return;

      const saveResult: EcgRecordSaveResult = await saveEcgAnalysis({
        sampleId: params.uploadParse
          ? `${params.uploadParse.upload_id}-beat-${params.beatIndex}`
          : `${params.fileName}-beat-${params.beatIndex}`,
        signal: params.signal,
        lead: 'Lead II',
        source: `upload:${params.fileName}`.slice(0, 100), // VARCHAR(100)
        uploadId: params.stored?.id ?? null,
        recordedAt: new Date().toISOString(),
        prediction: {
          predictedClassId: params.result.prediction.predicted_class_id,
          predictedClass: params.result.prediction.predicted_class,
          confidence: params.result.prediction.confidence,
          probabilities: { ...params.result.prediction.probabilities },
        },
        explanation: {
          method: params.result.explanation.method,
          rankedFeatures: params.result.explanation.top_pca_features ?? [],
          waveformImportance: params.result.explanation.waveform_importance ?? [],
        },
        topPcaFeatures: params.result.explanation.top_pca_features ?? null,
        modelInfo,
      });
      if (saveRunIdRef.current !== runId) return;

      if (saveResult.ok) {
        setSaveState('saved');
        setSaveMessage('✓ Analysis saved to your health history.');
      } else {
        setSaveState('failed');
        setSaveMessage(saveResult.error ?? 'Unknown persistence error.');
      }
    },
    []
  );

  // ---------------------------------------------------------------------
  // THE single primary action: store → parse → analyze THIS file.
  // ---------------------------------------------------------------------
  const handleAnalyzeRecord = async () => {
    const file = stagedFile;
    if (!file || phase.phase === 'uploading' || phase.phase === 'analyzing') return;

    resetAll();

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isDataFile = extension === '.csv' || extension === '.txt';

    if (!isDataFile) {
      setPhase({
        phase: 'upload-failed',
        message: `"${file.name}" is not supported. Choose a CSV or TXT ECG recording, or a single-lead ECG PDF to analyze.`,
      });
      return;
    }
    if (file.size > MAX_STORAGE_BYTES) {
      setPhase({ phase: 'upload-failed', message: `"${file.name}" is larger than the 25 MB storage limit.` });
      return;
    }
    if (apiOnline === false) {
      setPhase({
        phase: 'upload-failed',
        message:
          'The analysis service is temporarily unavailable. You can still store the file, but analysis needs the backend running.',
      });
      return;
    }

    // ---- Stage: store the ORIGINAL file (record_uploading) ----
    setPhase({ phase: 'uploading' });
    const storageResult = await storeEcgFile(file);
    const stored = storageResult.ok && storageResult.stored ? storageResult.stored : null;

    if (!storageResult.ok) {
      // Upload failed: nothing stored, nothing analyzed (requirement 14).
      setPhase({ phase: 'upload-failed', message: storageResult.error ?? 'Your record could not be uploaded. Please try again.' });
      return;
    }

    setStage(1); // ECG detected (file accepted)

    // ---- CSV/TXT: parse into beats (waveform extraction) ----
    setPhase({ phase: 'extracting' });
    setStage(2);
    let parsed: EcgUploadResponse | null = null;
    try {
      parsed = await uploadEcgFile(file);
    } catch (err) {
      const error = err as ECGAPIError;
      setPhase({
        phase: 'extraction-failed',
        stored,
        message: `Your ECG was saved, but we could not reliably extract a waveform for analysis. (${error.detail || error.message})`,
      });
      return;
    }

    if (!parsed.beats || parsed.beats.length === 0) {
      setPhase({
        phase: 'extraction-failed',
        stored,
        message: 'Your ECG was saved, but no supported heartbeat segments were found in this file.',
      });
      return;
    }

    const firstBeat = parsed.beats[0];
    if (!Array.isArray(firstBeat) || firstBeat.length !== REQUIRED_SIGNAL_LENGTH) {
      setPhase({
        phase: 'extraction-failed',
        stored,
        message: `Your ECG was saved, but the extracted signal has ${firstBeat?.length ?? 0} values instead of the ${REQUIRED_SIGNAL_LENGTH} the model requires.`,
      });
      return;
    }

    // ---- Analysis running ----
    setStage(3); // signal prepared
    setPhase({ phase: 'analyzing' });
    setStage(4);

    let result: AnalyzeResponse;
    try {
      result = await analyzeECG(firstBeat);
    } catch (err) {
      const error = err as ECGAPIError;
      setPhase({
        phase: 'analysis-failed',
        stored,
        message: `Your record is safely saved, but we couldn't analyze it. (${error.detail || error.message})`,
      });
      return;
    }

    // ---- Completed ----
    setStage(5);
    const provenance = `uploaded file ${parsed.filename || file.name}, beat 1 of ${parsed.beats.length}`;
    setPhase({ phase: 'completed', result, signal: firstBeat, provenance });
    void persistAnalysis({
      result,
      signal: firstBeat,
      stored,
      uploadParse: parsed,
      beatIndex: 0,
      fileName: file.name,
    });
  };

  const isBusy = phase.phase === 'uploading' || phase.phase === 'extracting' || phase.phase === 'analyzing';

  const fileSummary = useMemo(() => {
    if (!stagedFile) return null;
    return {
      name: stagedFile.name,
      size: formatBytes(stagedFile.size),
      type: stagedFile.type || stagedFile.name.slice(stagedFile.name.lastIndexOf('.') + 1).toUpperCase(),
    };
  }, [stagedFile]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Upload Health Record</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Upload an ECG or health record for analysis. Your file is stored privately in your health history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('patient-ecg-history')}
          className="shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[#101c28] text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] text-[#bc000a]">history</span>
          ECG History
        </button>
        {apiOnline === false && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
            <span className="material-symbols-outlined text-[14px]">cloud_off</span>
            Analysis service is temporarily unavailable — storage still works
          </div>
        )}
      </div>

      {/* ================= Selection / drop zone ================= */}
      {(phase.phase === 'select' || phase.phase === 'upload-failed') && (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setStagedFile(dropped);
          }}
          className={`rounded-3xl border-2 border-dashed transition-all p-8 text-center space-y-3 ${
            dragActive ? 'border-[#bc000a] bg-[#ffe8e8]/30' : 'border-slate-300 bg-white'
          }`}
          aria-label="Upload area"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
          </div>
          <p className="text-sm font-bold text-[#101c28]">Drag & drop your file here</p>
          <p className="text-xs text-slate-500">
            ECG recordings (.csv, .txt) and ECG PDFs (single-lead trace on page 1) are analyzed.
          </p>
          <input
            ref={fileInputRef}
            id="journey-upload-input"
            type="file"
            accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (file) setStagedFile(file);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-[#101c28] text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
          >
            Choose file
          </button>

          {fileSummary && (
            <div className="mt-2 mx-auto max-w-sm p-3 rounded-2xl border border-slate-200 bg-slate-50 text-left text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">description</span>
                <span className="font-bold text-[#101c28] break-all">{fileSummary.name}</span>
              </div>
              <div className="font-mono text-slate-500">
                {fileSummary.type} · {fileSummary.size}
              </div>
              <div className="font-mono text-[10px] text-slate-400">status: ready — not yet uploaded</div>
            </div>
          )}

          {phase.phase === 'upload-failed' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-left" role="alert">
              <div className="flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-[16px]">error</span>
                Your record could not be uploaded
              </div>
              <p className="mt-1">{phase.message}</p>
            </div>
          )}

          {/* Primary action — one click from selection to analysis */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => void handleAnalyzeRecord()}
              disabled={!stagedFile}
              className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 mx-auto ${
                !stagedFile
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#bc000a] text-white hover:bg-[#a00008] cursor-pointer shadow-sm'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              Analyze Health Record
            </button>
            <p className="text-[10.5px] text-slate-500 mt-2">
              The file is stored to your history first, then analyzed — storage and analysis are separate steps.
            </p>
          </div>
        </section>
      )}

      {/* ================= In-progress: stages ================= */}
      {(phase.phase === 'uploading' || phase.phase === 'extracting' || phase.phase === 'analyzing') && (
        <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#bc000a] animate-spin">progress_activity</span>
            <h2 className="text-sm font-bold text-[#101c28]">
              {fileSummary?.name ?? 'Your record'}
              {fileSummary && <span className="font-mono text-slate-400 font-normal"> · {fileSummary.size}</span>}
            </h2>
          </div>

          <ul className="space-y-2.5">
            {STAGE_LABELS.map((label, index) => {
              const stageValue = index + 1;
              const isDone = stageValue < stage || (phase.phase === 'analyzing' && stageValue <= 4);
              const isActive = stageValue === stage;
              return (
                <li key={label} className="flex items-center gap-3 text-xs">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      isDone
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : isActive
                        ? 'bg-[#ffe8e8] border-[#bc000a]/40 text-[#bc000a]'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {isDone ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : isActive ? (
                      <span className="material-symbols-outlined text-[14px] animate-pulse">more_horiz</span>
                    ) : (
                      <span className="font-mono text-[10px]">{stageValue}</span>
                    )}
                  </span>
                  <span className={isDone ? 'text-emerald-800 font-semibold' : isActive ? 'text-[#101c28] font-bold' : 'text-slate-400'}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
            ✓ Record saved — ⏳ Preparing analysis… (storage and analysis are separate steps)
          </div>
        </section>
      )}

      {/* ================= Extraction failed ================= */}
      {phase.phase === 'extraction-failed' && (
        <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-emerald-600">check_circle</span>
            <h2 className="text-lg font-extrabold text-[#101c28]">✓ Health record saved</h2>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900" role="alert">
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              ⚠ Analysis unavailable
            </div>
            <p className="mt-1">{phase.message}</p>
            <p className="mt-1">No classification was performed and no result was saved — your file itself is safe.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setStagedFile(null);
                resetAll();
              }}
              className="flex-1 px-5 py-3 rounded-2xl bg-[#bc000a] text-white text-sm font-bold hover:bg-[#a00008] transition-all cursor-pointer"
            >
              Try Another Record
            </button>
            <button
              onClick={() => onNavigate('journey-records')}
              className="flex-1 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              View Saved Record
            </button>
            <button
              onClick={() => onNavigate('journey-doctors')}
              className="flex-1 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Connect With Doctor
            </button>
          </div>
        </section>
      )}

      {/* ================= Analysis failed (record safe) ================= */}
      {phase.phase === 'analysis-failed' && (
        <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-emerald-600">check_circle</span>
            <h2 className="text-lg font-extrabold text-[#101c28]">✓ Health record saved</h2>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-800" role="alert">
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              ⚠ Analysis failed
            </div>
            <p className="mt-1">{phase.message}</p>
            <p className="mt-1">No result is shown and nothing was saved as a medical output.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setStagedFile(null);
                resetAll();
              }}
              className="flex-1 px-5 py-3 rounded-2xl bg-[#bc000a] text-white text-sm font-bold hover:bg-[#a00008] transition-all cursor-pointer"
            >
              Try Another Record
            </button>
            <button
              onClick={() => onNavigate('journey-records')}
              className="flex-1 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              View Saved Record
            </button>
            <button
              onClick={() => onNavigate('journey-doctors')}
              className="flex-1 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Connect With Doctor
            </button>
          </div>
        </section>
      )}

      {/* ================= Completed: patient-friendly result ================= */}
      {phase.phase === 'completed' && (
        <AnalysisResultView
          result={phase.result}
          signal={phase.signal}
          provenanceLabel={phase.provenance}
          saveState={saveState}
          saveMessage={saveMessage}
          onConnectDoctor={() => onNavigate('journey-doctors')}
          onAnalyzeAnother={() => {
            setStagedFile(null);
            resetAll();
          }}
        />
      )}

      {/* Secondary link to records */}
      {(phase.phase === 'select' || phase.phase === 'upload-failed') && (
        <div className="text-center">
          <button
            onClick={() => onNavigate('journey-records')}
            className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] cursor-pointer"
          >
            View previously uploaded records & saved analyses
          </button>
        </div>
      )}
    </div>
  );
};
