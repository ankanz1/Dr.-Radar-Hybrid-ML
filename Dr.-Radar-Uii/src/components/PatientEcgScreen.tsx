import type React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ScreenTab } from '../types';
import {
  getECGSamples,
  analyzeECG,
  checkHealth,
  uploadEcgFile,
  ECGSample,
  AnalyzeResponse,
  EcgUploadResponse,
  ECGAPIError,
} from '../services/ecgApi';
import {
  saveEcgAnalysis,
  getAuthenticatedPatientRecord,
  getModelInfoSafe,
  EcgRecordSaveResult,
} from '../services/ecgPersistence';
import {
  storeEcgFile,
  StoredEcgUpload,
} from '../services/ecgUploadService';
import { AamiClassBadge, AamiClassDistributionBar } from './AamiClassBadge';
import { AamiClassCode } from '../data/aamiClassSystem';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';

interface PatientEcgScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

type ApiStatus = 'checking' | 'online' | 'offline';

type AnalysisPhase =
  | 'idle'
  | 'analyzing'
  | 'succeeded'
  | 'invalid-input'
  | 'analysis-error';

type AcquisitionSource = 'sample' | 'upload';

type UploadPhase = 'idle' | 'ready' | 'error' | 'stored-only';

type StorageStatus = 'idle' | 'storing' | 'stored' | 'failed';

const REQUIRED_SIGNAL_LENGTH = 187;

const ALLOWED_UPLOAD_EXTENSIONS = ['.csv', '.txt'];

const PDF_EXTENSION = '.pdf';

/** Supabase Storage bucket cap (ecg-uploads: 25 MB, enforced server-side too). */
const MAX_STORAGE_BYTES = 25 * 1024 * 1024;

const ANALYSIS_LABEL = 'ECG heartbeat classification';

const CLINICAL_DISCLAIMER =
  'This tool provides an automated heartbeat classification and is not a substitute for evaluation by a qualified healthcare professional.';

/** Patient-facing ECG workflow: acquisition → signal preview → analysis → results. */
export const PatientEcgScreen: React.FC<PatientEcgScreenProps> = ({ onNavigate }) => {
  // --- Acquisition: real MIT-BIH test-set samples from GET /samples ---
  const [samples, setSamples] = useState<ECGSample[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);

  // --- Backend availability (GET /health) ---
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  // --- Analysis state machine (POST /analyze) ---
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);

  // --- Persistence (public.ecg_records + public.predictions via Supabase) ---
  const [saveState, setSaveState] = useState<'not-saved' | 'saving' | 'saved' | 'failed' | 'unavailable'>(
    'not-saved'
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const activeSample = useMemo(
    () => samples.find((sample) => sample.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  // --- Upload acquisition (POST /ecg/upload): CSV/TXT -> 187-value beats ---
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource>('sample');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<EcgUploadResponse | null>(null);
  const [selectedBeatIndex, setSelectedBeatIndex] = useState<number | null>(null);
  const [storedUpload, setStoredUpload] = useState<StoredEcgUpload | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('idle');
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [analyzeUploadBusy, setAnalyzeUploadBusy] = useState(false);
  const isDataFileRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // The beat (from an upload) that will be analyzed.
  const activeBeat = useMemo<{ index: number; signal: number[] } | null>(() => {
    if (acquisitionSource !== 'upload' || !uploadData || selectedBeatIndex === null) return null;
    const beat = uploadData.beats[selectedBeatIndex];
    return Array.isArray(beat) ? { index: selectedBeatIndex, signal: beat } : null;
  }, [acquisitionSource, uploadData, selectedBeatIndex]);

  // The exact 187-value vector sent to POST /analyze — sample or uploaded beat.
  const activeSignal = useMemo<number[] | null>(() => {
    if (acquisitionSource === 'upload') return activeBeat?.signal ?? null;
    return activeSample?.signal ?? null;
  }, [acquisitionSource, activeBeat, activeSample]);

  // ---------------------------------------------------------------------------
  // Backend health check + sample acquisition (both real endpoints)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setApiStatus('checking');
      try {
        const health = await checkHealth();
        if (cancelled) return;
        setApiStatus(health.model_loaded ? 'online' : 'offline');
      } catch {
        if (!cancelled) setApiStatus('offline');
      }

      try {
        const response = await getECGSamples();
        if (cancelled) return;
        setSamples(response.samples);
        if (response.samples.length > 0) {
          setSelectedSampleId(response.samples[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err as ECGAPIError;
          setSamplesError(error.detail || error.message);
        }
      } finally {
        if (!cancelled) setSamplesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Signal validation: the model expects EXACTLY 187 finite numeric values
  // ---------------------------------------------------------------------------
  const signalValidation = useMemo(() => {
    if (!activeSignal) {
      return {
        valid: false,
        reason:
          acquisitionSource === 'upload'
            ? 'Upload a CSV/TXT ECG file and select one generated beat.'
            : 'No ECG sample selected.',
      };
    }
    const signal = activeSignal;
    if (!Array.isArray(signal) || signal.length !== REQUIRED_SIGNAL_LENGTH) {
      return {
        valid: false,
        reason: `The backend returned ${signal?.length ?? 0} values for this sample; the model requires exactly ${REQUIRED_SIGNAL_LENGTH}.`,
      };
    }
    if (!signal.every((value) => Number.isFinite(value))) {
      return { valid: false, reason: 'The selected ECG sample contains non-numeric values.' };
    }
    return { valid: true, reason: null };
  }, [activeSignal, acquisitionSource]);

  // ---------------------------------------------------------------------------
  // Analysis: POST /analyze with the exact 187-value vector (no fake results)
  // ---------------------------------------------------------------------------
  const handleAnalyze = useCallback(async () => {
    if (!activeSignal || analysisPhase === 'analyzing' || !signalValidation.valid) return;

    setAnalysisPhase('analyzing');
    setAnalysisError(null);
    setAnalysisResult(null);
    setSaveState('not-saved');
    setSaveMessage(null);

    try {
      const result = await analyzeECG(activeSignal);
      setAnalysisResult(result);
      setAnalysisPhase('succeeded');
    } catch (err) {
      const error = err as ECGAPIError;
      setAnalysisError(error.detail || error.message);
      setAnalysisPhase('analysis-error');
    }
  }, [activeSignal, analysisPhase, signalValidation.valid]);

  // Auto-save once per successful analysis (RLS-safe, own patient row only)
  useEffect(() => {
    if (analysisPhase !== 'succeeded' || !analysisResult || !activeSignal) return;

    const isUpload = acquisitionSource === 'upload' && activeBeat !== null && uploadData !== null;
    let cancelled = false;

    const persist = async () => {
      setSaveState('saving');
      const resolution = await getAuthenticatedPatientRecord();
      if (cancelled) return;

      if (resolution.status === 'signed-out' || resolution.status === 'no-patient-record') {
        setSaveState('unavailable');
        setSaveMessage(
          resolution.status === 'signed-out'
            ? 'Sign in with your patient account to keep this ECG in your medical history.'
            : 'No patient profile is linked to this account, so this ECG was not saved.'
        );
        return;
      }

      // Model metadata is optional context for the history view; failure is not fatal.
      const modelInfo = await getModelInfoSafe();
      if (cancelled) return;

      const result: EcgRecordSaveResult = await saveEcgAnalysis({
        sampleId:
          isUpload && uploadData
            ? `${uploadData.upload_id}-beat-${activeBeat?.index ?? 0}`
            : activeSample?.id ?? 'unknown',
        signal: activeSignal,
        lead: 'Lead II',
        source:
          isUpload && uploadData
            ? `upload:${uploadData.filename}`.slice(0, 100) // ecg_records.source is VARCHAR(100)
            : `mitbih-test:${activeSample?.id ?? 'unknown'}`,
        uploadId: storedUpload?.id ?? null,
        recordedAt: new Date().toISOString(),
        prediction: {
          predictedClassId: analysisResult.prediction.predicted_class_id,
          predictedClass: analysisResult.prediction.predicted_class,
          confidence: analysisResult.prediction.confidence,
          probabilities: analysisResult.prediction.probabilities,
        },
        explanation: {
          method: analysisResult.explanation.method,
          rankedFeatures: analysisResult.explanation.top_pca_features ?? [],
          waveformImportance: analysisResult.explanation.waveform_importance ?? [],
        },
        topPcaFeatures: analysisResult.explanation.top_pca_features ?? null,
        modelInfo,
      });
      if (cancelled) return;

      if (result.ok) {
        setSaveState('saved');
        setSaveMessage('Analysis saved to your medical history.');
      } else {
        const saveError = result.error;
        setSaveState('failed');
        setSaveMessage(saveError);
      }
    };

    void persist();
    return () => {
      cancelled = true;
    };
  }, [analysisPhase, analysisResult, activeSignal, acquisitionSource, activeBeat, uploadData, activeSample, storedUpload]);

  const resetAnalysis = () => {
    setAnalysisPhase('idle');
    setAnalysisError(null);
    setAnalysisResult(null);
    setSaveState('not-saved');
    setSaveMessage(null);
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    resetAnalysis();
  };

  const handleSelectBeat = (beatIndex: number) => {
    setSelectedBeatIndex(beatIndex);
    resetAnalysis();
  };

  const handleSwitchSource = (source: AcquisitionSource) => {
    if (source === acquisitionSource) return;
    setAcquisitionSource(source);
    resetAnalysis();
  };  // ---------------------------------------------------------------------------
  // File selection (Part 5): stage ONLY. Nothing is stored or analyzed until
  // the explicit [ Analyze ECG ] button is clicked. Every new selection resets
  // ALL state — old prediction, old upload, old storage result, old errors —
  // so a previous MIT-BIH sample, test-0, cached signal or stale prediction can
  // never leak into the analysis of the newly selected file.
  // ---------------------------------------------------------------------------
  const resetUploadState = () => {
    resetAnalysis();
    setUploadData(null);
    setSelectedBeatIndex(null);
    setStoredUpload(null);
    setStorageStatus('idle');
    setStorageMessage(null);
    setUploadError(null);
    setUploadPhase('idle');
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ''; // allow re-selecting the same file later (staged copy kept in state)
    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isPdf = extension === PDF_EXTENSION;
    isDataFileRef.current = ALLOWED_UPLOAD_EXTENSIONS.includes(extension);
    const isDataFile = isDataFileRef.current;

    if (!isPdf && !isDataFile) {
      setStagedFile(null);
      isDataFileRef.current = false;
      resetUploadState();
      setUploadPhase('error');
      setUploadError(
        `"${file.name}" is not supported. Choose a .csv or .txt ECG file to analyze, or a .pdf to store for your records.`
      );
      return;
    }
    if (file.size > MAX_STORAGE_BYTES) {
      setStagedFile(null);
      isDataFileRef.current = false;
      resetUploadState();
      setUploadPhase('error');
      setUploadError(`"${file.name}" is larger than the 25 MB storage limit.`);
      return;
    }

    // Valid selection: stage the file; wipe every previous result/error.
    setStagedFile(file);
    resetUploadState();
  };

  // ---------------------------------------------------------------------------
  // THE explicit [ Analyze ECG ] button (Part 5/6). Analyzes ONLY the currently
  // selected staged file — never a previous sample, cached signal, or synthetic
  // fallback. PDFs are stored only (no /ecg/upload, no /analyze, no QML).
  // ---------------------------------------------------------------------------
  const handleAnalyzeEcg = async () => {
    const file = stagedFile;
    if (!file || analyzeUploadBusy) return;

    // Fresh run: clear all previous analysis/upload state first.
    resetUploadState();
    setAnalyzeUploadBusy(true);

    // --- Step 1: store the ORIGINAL file (Storage + ecg_uploads metadata) ---
    setStorageStatus('storing');
    const storageResult = await storeEcgFile(file);

    // --- PDF (Part 6): storage only, NEVER analyzed ---
    if (!isDataFileRef.current) {
      if (storageResult.ok && storageResult.stored) {
        setStoredUpload(storageResult.stored);
        setStorageStatus('stored');
        setUploadPhase('stored-only');
        setStorageMessage('PDF stored successfully. ECG waveform analysis from PDF is not currently supported.');
      } else {
        setStorageStatus('failed');
        setUploadPhase('error');
        setUploadError(`The PDF could not be saved to your medical record storage: ${storageResult.error}`);
      }
      return;
    }

    // --- CSV/TXT (Part 7): storage failure is loud but does NOT block analysis ---
    if (storageResult.ok && storageResult.stored) {
      setStoredUpload(storageResult.stored);
      setStorageStatus('stored');
    } else {
      setStorageStatus('failed');
      setStorageMessage(
        `The original file was NOT saved to storage: ${storageResult.error} You can still analyze the signal below, but the file itself will not be kept.`
      );
    }

    // --- Step 2: parse + segment via POST /ecg/upload (CSV/TXT only) ---
    let parsed: EcgUploadResponse | null = null;
    try {
      const response = await uploadEcgFile(file);
      parsed = response;
      setUploadData(response);
      setSelectedBeatIndex(response.beats.length > 0 ? 0 : null);
      setUploadPhase('ready');
    } catch (err) {
      const error = err as ECGAPIError;
      setUploadPhase('error');
      setUploadError(
        storageResult.ok
          ? `The file is stored, but it could not be parsed for analysis: ${error.detail || error.message}`
          : `The file could not be parsed for analysis: ${error.detail || error.message}`
      );
      setAnalyzeUploadBusy(false);
      return;
    }

    // --- Step 3: analyze the SELECTED beat of THIS file (default: beat 1) ---
    // The exact 187-value window from the uploaded signal is sent to /analyze;
    // no sample, cached signal or synthetic data is involved. With multiple
    // beats the grid below lets the user re-select and re-run on another beat.
    if (parsed && parsed.beats.length > 0) {
      const firstBeat = parsed.beats[0];
      if (Array.isArray(firstBeat) && firstBeat.length === REQUIRED_SIGNAL_LENGTH) {
        setAnalysisPhase('analyzing');
        setAnalysisError(null);
        setAnalysisResult(null);
        setSaveState('not-saved');
        setSaveMessage(null);
        try {
          const result = await analyzeECG(firstBeat);
          setAnalysisResult(result);
          setAnalysisPhase('succeeded');
        } catch (err) {
          const error = err as ECGAPIError;
          setAnalysisError(error.detail || error.message);
          setAnalysisPhase('analysis-error');
        }
      }
    }
    setAnalyzeUploadBusy(false);
  };

  // ---------------------------------------------------------------------------
  // Waveform path from the exact 187-point signal (SVG polyline, same
  // charting approach as ECGAnalysisScreen: plain inline SVG, no chart lib)
  // ---------------------------------------------------------------------------
  const waveformPath = useMemo(() => {
    if (!activeSignal) return '';
    const values = activeSignal;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = (maximum - minimum || 1) * 0.08;
    const low = minimum - padding;
    const high = maximum + padding;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 720;
        const y = 180 - ((value - low) / (high - low)) * 180;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [activeSignal]);

  const isBusy = analysisPhase === 'analyzing';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ============ Header ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • ECG WORKFLOW
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {ANALYSIS_LABEL}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            My ECG Analysis
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Analyze a real MIT-BIH test heartbeat or upload your own ECG recording (CSV/TXT), preview the 187-point
            signal, and classify it with the QML backend.
          </p>
        </div>

        {/* Backend availability pill */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
            apiStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : apiStatus === 'checking'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
          role="status"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              apiStatus === 'online'
                ? 'bg-emerald-500'
                : apiStatus === 'checking'
                ? 'bg-slate-400'
                : 'bg-red-500'
            } ${apiStatus === 'online' ? 'animate-pulse' : ''}`}
          />
          {apiStatus === 'online'
            ? 'QML backend connected'
            : apiStatus === 'checking'
            ? 'Checking backend…'
            : 'QML backend unavailable'}
        </div>
      </div>

      {/* ============ API unavailable state ============ */}
      {apiStatus === 'offline' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-1" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            ECG backend unavailable
          </div>
          <p>
            The analysis service at <span className="font-mono">http://127.0.0.1:8000</span> could not be reached. Start
            it with <span className="font-mono">python -m uvicorn api:app --port 8000</span> from the{' '}
            <span className="font-mono">ecg-qml</span> folder, then reload this page. No analysis is possible until the
            backend is running.
          </p>
        </div>
      )}

      {/* ============ Section 1: ECG Acquisition ============ */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-label="ECG Acquisition">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#bc000a] to-[#920008] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">ecg_heart</span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#101c28]">1 · ECG Acquisition</h2>
              <p className="text-xs text-slate-500">
                Pick a real MIT-BIH test beat (<span className="font-mono">GET /samples</span>) or upload an ECG
                recording — no synthetic data.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
            187 values per beat
          </span>
        </div>

        {/* Acquisition source: distinct, explicitly labeled options */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="ECG acquisition source">
          <button
            role="tab"
            aria-selected={acquisitionSource === 'sample'}
            onClick={() => handleSwitchSource('sample')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              acquisitionSource === 'sample'
                ? 'bg-[#101c28] text-white border-[#101c28]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            MIT-BIH Test Sample
          </button>
          <button
            role="tab"
            aria-selected={acquisitionSource === 'upload'}
            onClick={() => handleSwitchSource('upload')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              acquisitionSource === 'upload'
                ? 'bg-[#101c28] text-white border-[#101c28]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Upload ECG CSV/TXT
          </button>
        </div>

        {acquisitionSource === 'sample' && (
          <>
            {samplesLoading && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Loading real ECG samples from the backend…
              </div>
            )}

            {samplesError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
                Could not load ECG samples: {samplesError}
              </div>
            )}

            {!samplesLoading && !samplesError && samples.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs" role="alert">
                The backend returned no ECG samples.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {samples.map((sample) => {
                const isSelected = sample.id === selectedSampleId;
                return (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample.id)}
                    disabled={isBusy}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                      isSelected
                        ? 'border-[#bc000a]/50 bg-[#ffe8e8]/60 ring-2 ring-[#bc000a]/20'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                    title={`MIT-BIH test row ${sample.index} — ${sample.class_name}`}
                  >
                    <span className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold font-mono text-[#101c28]">{sample.id}</span>
                      <AamiClassBadge code={sample.class_code as AamiClassCode} variant="compact" size="xs" />
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">{sample.class_name}</span>
                  </button>
                );
              })}
            </div>

            {activeSample && (
              <p className="text-[11px] text-slate-500 font-mono">
                Selected: {activeSample.id} · dataset row {activeSample.index} · reference class{' '}
                {activeSample.class_code} ({activeSample.class_name})
              </p>
            )}
          </>
        )}

        {acquisitionSource === 'upload' && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <label
                htmlFor="patient-ecg-upload-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Upload ECG CSV/TXT — a file with numeric ECG samples (comma- or whitespace-separated; one column or
                many). The original file is stored in your record and the signal is split into deterministic 187-value
                segments for the model. A PDF is stored for your records only — it is never analyzed.
              </label>
              <input
                ref={fileInputRef}
                id="patient-ecg-upload-input"
                type="file"
                accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
                onChange={handleFileSelected}
                disabled={analyzeUploadBusy || isBusy}
                className="block w-full text-xs text-slate-600 border border-slate-300 rounded-xl cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-[#bc000a]/30 file:mr-3 file:px-4 file:py-2 file:rounded-l-xl file:border-0 file:bg-[#101c28] file:text-white file:text-xs file:font-bold file:cursor-pointer disabled:opacity-60"
              />

              {/* Staged file summary (Part 7): filename / size / type / storage status */}
              {stagedFile ? (
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs">
                  <span className="material-symbols-outlined text-[18px] text-slate-500">
                    {stagedFile.name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                  </span>
                  <span className="font-bold text-[#101c28] break-all">{stagedFile.name}</span>
                  <span className="font-mono text-slate-500">
                    {(stagedFile.size / 1024).toFixed(1)} KB
                  </span>
                  <span className="font-mono text-slate-400">
                    {stagedFile.type || 'unknown type'}
                  </span>
                  <span
                    className={`ml-auto font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      storageStatus === 'stored'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : storageStatus === 'failed'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    {storageStatus === 'stored'
                      ? 'Stored ✓'
                      : storageStatus === 'failed'
                      ? 'Not stored'
                      : 'Ready — not yet stored'}
                  </span>
 </div>
              ) : (
                <p className="text-[11px] text-slate-400 font-mono">No file selected yet.</p>
              )}

              {/* THE explicit Analyze button — directly under the upload placeholder (Part 5) */}
              <button
                onClick={() => void handleAnalyzeEcg()}
                disabled={!stagedFile || analyzeUploadBusy || isBusy || apiStatus === 'offline'}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  !stagedFile || analyzeUploadBusy || isBusy || apiStatus === 'offline'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-[#bc000a] text-white hover:bg-[#a00008] shadow-sm cursor-pointer'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${analyzeUploadBusy ? 'animate-spin' : ''}`}>
                  {analyzeUploadBusy ? 'progress_activity' : 'cloud_upload'}
                </span>
                {analyzeUploadBusy
                  ? 'Uploading & analyzing…'
                  : stagedFile
                  ? stagedFile.name.toLowerCase().endsWith('.pdf')
                    ? 'Analyze ECG (stores PDF only)'
                    : 'Analyze ECG'
                  : 'Analyze ECG'}
              </button>

              <p className="text-[10.5px] text-slate-500">
                Clicking Analyze ECG uploads and stores the selected file first, then analyzes{' '}
                <strong>only that file</strong> — never a previous sample or cached signal. CSV/TXT runs the full QML
                classification; a PDF is archived without analysis (PDF waveform analysis is not supported yet).
              </p>
            </div>

            {/* Original-file storage status (Supabase Storage + ecg_uploads) */}
            {storageStatus === 'storing' && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Storing the original file in your private medical record storage…
              </div>
            )}

            {storageStatus === 'stored' && storedUpload && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">save</span>
                <span className="font-bold text-[#101c28]">Original file stored:</span>
                <span className="font-mono break-all">{storedUpload.fileName}</span>
                <span className="font-mono text-slate-500">
                  ({storedUpload.uploadType}, {(storedUpload.sizeBytes / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            {/* Storage failure: loud warning — file NOT saved, no false claims */}
            {storageStatus === 'failed' && storageMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1" role="alert">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-[18px]">cloud_off</span>
                  Original file not saved
                </div>
                <p>{storageMessage}</p>
              </div>
            )}

            {uploadPhase === 'stored-only' && storageMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1" role="status">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  {storageMessage}
                </div>
                <p>
                  Storage and analysis are separate: the PDF is safely archived, but no QML classification is run on it.
                  Upload a CSV/TXT file to run ECG heartbeat classification.
                </p>
              </div>
            )}

            {analyzeUploadBusy && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Uploading & analyzing…
              </div>
            )}

            {uploadPhase === 'error' && uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-1" role="alert">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  Upload failed
                </div>
                <p className="font-mono break-words">{uploadError}</p>
                <p className="text-red-600/90 font-sans">
                  No classification was performed and nothing was saved. The MIT-BIH samples are{' '}
                  <strong>not</strong> used as a substitute for a failed upload — fix the file or pick a different one.
                </p>
              </div>
            )}

            {uploadData && uploadPhase === 'ready' && (
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  <span className="font-bold text-[#101c28] break-all">{uploadData.filename}</span>
                  <span className="font-mono text-slate-500">
                    {uploadData.sample_count} samples · {uploadData.beats.length} × 187-value beat(s) generated ·
                    format {uploadData.metadata.format} ({uploadData.metadata.delimiter}-separated)
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500">{uploadData.metadata.segmentation_note}</p>
                <p className="text-xs text-slate-600 font-semibold">Select one generated beat to analyze:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-h-44 overflow-y-auto pr-1">
                  {uploadData.beats.map((beat, index) => {
                    const isSelected = index === selectedBeatIndex;
                    return (
                      <button
                        key={`${uploadData.upload_id}-beat-${index}`}
                        onClick={() => handleSelectBeat(index)}
                        disabled={isBusy || analyzeUploadBusy}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                          isSelected
                            ? 'border-[#bc000a]/50 bg-[#ffe8e8]/60 ring-2 ring-[#bc000a]/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                        title={`Contiguous 187-value window ${index + 1} of ${uploadData.beats.length}`}
                      >
                        <span className="text-xs font-bold font-mono text-[#101c28] block">Beat {index + 1}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight font-mono">
                          187 values · {beat.length}/187
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ============ Section 2: ECG Signal Preview ============ */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-label="ECG Signal Preview">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#101c28] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">monitor_heart</span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#101c28]">2 · ECG Signal Preview</h2>
              <p className="text-xs text-slate-500">The exact 187-point waveform sent to the model.</p>
            </div>
          </div>
          {activeSignal && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              {activeSignal.length}/187 values loaded
            </span>
          )}
        </div>

        {activeSignal ? (
          <div className="space-y-2">
            <div className="h-52 w-full bg-[#f8fbfe] rounded-2xl border border-slate-200/90 relative overflow-hidden p-2">
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <pattern id="patient-ecg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#bc000a" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#patient-ecg-grid)" />
              </svg>
              <svg
                viewBox="0 0 720 180"
                className="relative z-10 w-full h-full"
                preserveAspectRatio="none"
                role="img"
                aria-label={`ECG waveform preview${
                  acquisitionSource === 'upload' && uploadData
                    ? ` for uploaded beat ${(activeBeat?.index ?? 0) + 1} of ${uploadData.beats.length} (${uploadData.filename})`
                    : ''
                }`}
              >
                <path d="M 0 90 L 720 90" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none" />
                <path d={waveformPath} stroke="#bc000a" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            {acquisitionSource === 'upload' && uploadData && activeBeat ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold">
                  Uploaded beat {activeBeat.index + 1} of {uploadData.beats.length}:
                </span>
                <span className="font-mono break-all">{uploadData.filename}</span>
                <span className="text-slate-500">— the exact window sent to the model</span>
              </div>
            ) : (
              activeSample && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">Reference class (dataset label):</span>
                  <AamiClassBadge code={activeSample.class_code as AamiClassCode} variant="compact" size="sm" />
                  <span>{activeSample.class_name}</span>
                </div>
              )
            )}
            {!signalValidation.valid && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs" role="alert">
                {signalValidation.reason}
              </div>
            )}
          </div>
        ) : (
          <div className="h-52 flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 text-center px-6">
            {acquisitionSource === 'upload'
              ? (analyzeUploadBusy
                  ? 'Uploading & analyzing…'
                  : uploadPhase === 'error'
                  ? 'Upload failed — resolve the error above before analyzing.'
                  : uploadPhase === 'stored-only'
                  ? 'File stored for your records. No analysis is run on PDF files.'
                  : stagedFile
                  ? 'File selected. Click Analyze ECG above to store it and generate beats.'
                  : 'Select a CSV/TXT ECG file above, then click Analyze ECG to store and analyze it.')
              : (samplesLoading
                  ? 'Loading waveform…'
                  : 'Select an ECG sample above to preview its signal.')}
          </div>
        )}
      </section>

      {/* ============ Section 3: Analysis ============ */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-label="Analysis">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#101c28] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">psychology</span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#101c28]">3 · Analysis</h2>
              <p className="text-xs text-slate-500">
                Sends the selected 187-value beat — from the MIT-BIH sample or your uploaded file — to{' '}
                <span className="font-mono">POST /analyze</span> (PCA-8 Hybrid QML).
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
            {ANALYSIS_LABEL}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={isBusy || !activeSignal || !signalValidation.valid || apiStatus === 'offline'}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
              isBusy || !activeSignal || !signalValidation.valid || apiStatus === 'offline'
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#bc000a] text-white hover:bg-[#a00008] shadow-sm cursor-pointer'
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${isBusy ? 'animate-spin' : ''}`}>
              {isBusy ? 'progress_activity' : 'play_arrow'}
            </span>
            {isBusy ? 'Analyzing…' : analysisPhase === 'succeeded' ? 'Re-run Analysis' : 'Analyze ECG'}
          </button>

          {isBusy && (
            <span className="text-xs text-slate-500">
              Contacting the QML backend — no results are shown until the server responds.
            </span>
          )}
        </div>

        {analysisPhase === 'analysis-error' && analysisError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-mono" role="alert">
            <span className="font-bold">Analysis failed:</span> {analysisError}
          </div>
        )}
      </section>

      {/* ============ Section 4: Results ============ */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4" aria-label="Results">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#101c28] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">lab_profile</span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#101c28]">4 · Results</h2>
              <p className="text-xs text-slate-500">
                {ANALYSIS_LABEL} — research prototype output from the QML backend.
              </p>
            </div>
          </div>
          {analysisResult && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
              model: PCA-8 Hybrid QML
            </span>
          )}
        </div>

        {/* Idle prompt */}
        {analysisPhase === 'idle' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">info</span>
            Run an analysis to see the heartbeat classification results here.
          </div>
        )}

        {/* Success: prediction + probabilities + XAI + persistence */}
        {analysisPhase === 'succeeded' && analysisResult && (
          <div className="space-y-5">
            {/* Predicted class */}
            <div className="flex flex-wrap items-center gap-4">
              <AamiClassBadge
                code={analysisResult.prediction.predicted_class as AamiClassCode}
                variant="compact"
                size="lg"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {ANALYSIS_LABEL}
                </p>
                <h3 className="text-xl font-black text-[#101c28] tracking-tight uppercase">
                  {analysisResult.prediction.predicted_class_name}
                </h3>
                <p className="text-[11px] font-mono text-slate-500">
                  class id {analysisResult.prediction.predicted_class_id} · confidence{' '}
                  {(analysisResult.prediction.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* 5-class probability distribution */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#101c28]">
                5-class probability distribution
              </p>
              {(['N', 'S', 'V', 'F', 'Q'] as AamiClassCode[]).map((code) => (
                <AamiClassDistributionBar
                  key={code}
                  code={code}
                  probability={(analysisResult.prediction.probabilities[code] ?? 0) * 100}
                  isDominant={code === analysisResult.prediction.predicted_class}
                />
              ))}
            </div>

            {/* XAI explanation */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#101c28] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#bc000a]">wb_incandescent</span>
                Explainability (XAI)
              </p>
              <p className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-200/80 rounded-xl p-2">
                {analysisResult.explanation.method}
              </p>
              {analysisResult.explanation.top_pca_features?.length > 0 && (
                <div className="space-y-1">
                  {analysisResult.explanation.top_pca_features.slice(0, 3).map((feature) => (
                    <div key={feature.rank} className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        #{feature.rank}: PCA component {feature.pca_feature}
                      </span>
                      <span className="font-mono">
                        importance {feature.importance.toFixed(4)} · Δscore{' '}
                        {feature.score_change >= 0 ? '+' : ''}
                        {feature.score_change.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10.5px] text-slate-500 italic">
                XAI output describes where the model's internal representation was most sensitive — it is model
                attribution, not clinical evidence.
              </p>
            </div>

            {/* Persistence status */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                saveState === 'saved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : saveState === 'saving'
                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : saveState === 'failed'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
              role="status"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                {saveState === 'saved'
                  ? 'check_circle'
                  : saveState === 'saving'
                  ? 'progress_activity'
                  : saveState === 'failed'
                  ? 'error'
                  : 'info'}
              </span>
              <div>
                <span className="font-bold">
                  {saveState === 'saved'
                    ? 'Saved to your medical record.'
                    : saveState === 'saving'
                    ? 'Saving to your medical record…'
                    : saveState === 'failed'
                    ? 'Could not save this ECG.'
                    : 'Not saved to your medical record.'}
                </span>{' '}
                {saveMessage}
              </div>
            </div>

            {/* Required clinical disclaimer */}
            <div className="p-3 bg-[#f8fbfe] border border-slate-200/80 rounded-xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0 mt-0.5">shield</span>
              <p>
                <strong className="font-semibold text-slate-700 mr-1">{ANALYSIS_LABEL}:</strong>
                {CLINICAL_DISCLAIMER}
              </p>
            </div>
          </div>
        )}

        <ClinicalDisclaimer className="mt-1" />
      </section>      {/* Quick links: ECG history (shown after a successful save) & archived reports */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {saveState === 'saved' && (
          <button
            onClick={() => onNavigate('patient-ecg-history')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            View ECG History
          </button>
        )}
        <button
          onClick={() => onNavigate('patient-results')}
          className="text-xs font-bold text-[#bc000a] hover:text-[#a00008] flex items-center gap-1.5 cursor-pointer ml-auto"
        >
          View diagnostic reports & trends
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
