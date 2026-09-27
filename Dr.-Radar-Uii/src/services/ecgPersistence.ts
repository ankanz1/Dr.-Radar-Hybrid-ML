import { supabase } from '../lib/supabase';
import { ensurePatientProfileRow } from './accountProvisioning';
import type { ModelInfoResponse } from './ecgApi';

/**
 * ECG persistence layer (kept strictly separate from the analysis workflow).
 *
 * Target tables (existing schema, ecg-qml/db/supabase_schema.sql):
 *   public.ecg_records   (id, patient_id, ecg_values JSONB, lead, source, recorded_at)
 *   public.predictions   (id, ecg_record_id, predicted_class 0-4, predicted_class_name,
 *                         confidence, probabilities JSONB, model_mode, pca_features,
 *                         quantum_features, recorded_at)
 *   public.explanations  (id, prediction_id UNIQUE, method, ranked_features JSONB,
 *                         waveform_importance JSONB, xai_metadata JSONB, created_at)
 *
 * No columns are invented: all writes map 1:1 to the existing schema. Access goes
 * through the authenticated Supabase session (anon key) and therefore relies on
 * RLS policies — see ecg-qml/db/005_ecg_records_rls.sql. Service-role keys and
 * RLS bypasses are never used.
 */

const ECG_VALUES_REQUIRED = 187;

/** Where the raw signal is embedded inside ecg_records.ecg_values JSONB. */
const ECG_VALUES_REQUIRED_KEY = 'values';

export interface EcgPredictionSaveInput {
  predictedClassId: number;
  /** Single-letter AAMI class code (N/S/V/F/Q) stored in predictions.predicted_class_name */
  predictedClass: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface EcgExplanationSaveInput {
  /** XAI method name from the /analyze response (explanations.method) */
  method: string;
  /** Ranked PCA features from /analyze (explanations.ranked_features) */
  rankedFeatures: unknown[];
  /** Per-point waveform importance from /analyze (explanations.waveform_importance) */
  waveformImportance: number[];
}

export interface EcgRecordSaveInput {
  sampleId: string;
  /** Exactly 187 finite numeric ECG values (the same vector sent to POST /analyze) */
  signal: number[];
  lead: string;
  source: string;
  recordedAt: string;
  /** Optional FK to public.ecg_uploads (Phase 2A) when the analyzed beat came
   *  from a stored original file. Null for MIT-BIH sample analyses. */
  uploadId?: string | null;
  prediction: EcgPredictionSaveInput;
  /** Optional XAI payload; when present, a row is written to public.explanations */
  explanation?: EcgExplanationSaveInput | null;
  /** Optional model metadata from GET /model-info; stored in predictions.quantum_features */
  modelInfo?: {
    model: string;
    input_features: number;
    pca_components: number;
    qubits: number;
    vqc_layers: number;
  } | null;
  /** Optional top PCA features (legacy slot persisted in predictions.pca_features) */
  topPcaFeatures?: unknown[] | null;
}

export type PatientRecordResolution =
  | { status: 'signed-out' }
  | { status: 'no-patient-record' }
  | { status: 'error'; error: string }
  | { status: 'ready'; patientId: string };

export interface EcgRecordSaveResult {
  ok: boolean;
  ecgRecordId?: string;
  predictionId?: string | null;
  explanationId?: string | null;
  error?: string;
}

/**
 * Resolve the authenticated user's patient record (public.patients row).
 * Uses only the caller's own session — RLS on public.patients restricts the
 * query to user_id = auth.uid().
 */
export async function getAuthenticatedPatientRecord(): Promise<PatientRecordResolution> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return { status: 'error', error: sessionError.message };
  }

  const sessionUser = sessionData.session?.user;
  if (!sessionUser) {
    return { status: 'signed-out' };
  }

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (error) {
    return { status: 'error', error: error.message };
  }
  if (!data?.id) {
    // Missing patients row (stranded account): attempt the idempotent
    // database-backed repair once (migration 012), then re-read.
    await ensurePatientProfileRow();
    const retry = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', sessionUser.id)
      .maybeSingle();
    if (retry.error) return { status: 'error', error: retry.error.message };
    if (!retry.data?.id) return { status: 'no-patient-record' };
    return { status: 'ready', patientId: retry.data.id as string };
  }
  return { status: 'ready', patientId: data.id as string };
}

/**
 * Fetch the model metadata advertised by the backend (GET /model-info).
 * Returns null on any failure — model info is optional metadata, never required.
 */
export async function getModelInfoSafe(): Promise<ModelInfoResponse | null> {
  try {
    const { getModelInfo } = await import('./ecgApi');
    return await getModelInfo();
  } catch {
    return null;
  }
}

/**
 * Persist one analyzed ECG beat: the raw 187-value signal in ecg_records,
 * the model output in predictions (via ecg_record_id), and the XAI payload in
 * explanations (via prediction_id).
 */
export async function saveEcgAnalysis(input: EcgRecordSaveInput): Promise<EcgRecordSaveResult> {
  // Client-side validation mirroring the backend 187-value contract
  // (EcgRequest: min_length=187, max_length=187) and the predictions CHECK
  // constraint (predicted_class BETWEEN 0 AND 4).
  if (!Array.isArray(input.signal) || input.signal.length !== ECG_VALUES_REQUIRED) {
    return {
      ok: false,
      error: `Refusing to save: expected exactly ${ECG_VALUES_REQUIRED} ECG values, received ${
        Array.isArray(input.signal) ? input.signal.length : 'none'
      }.`,
    };
  }
  if (!input.signal.every((value) => Number.isFinite(value))) {
    return { ok: false, error: 'Refusing to save: ECG signal contains non-finite values.' };
  }
  if (
    !Number.isInteger(input.prediction.predictedClassId) ||
    input.prediction.predictedClassId < 0 ||
    input.prediction.predictedClassId > 4
  ) {
    return { ok: false, error: 'Refusing to save: predicted class must be an integer 0-4.' };
  }

  // 1. Determine the authenticated patient record (never bypasses RLS)
  const resolution = await getAuthenticatedPatientRecord();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'No active Supabase session — sign in as a patient to save ECG records.' };
  }
  if (resolution.status === 'no-patient-record') {
    return {
      ok: false,
      error: 'No patient profile row (public.patients) exists for this account, so the ECG cannot be saved.',
    };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve the authenticated patient record: ${resolution.error}` };
  }

  // 2. Insert the ECG record
  const { data: ecgRecord, error: ecgError } = await supabase
    .from('ecg_records')
    .insert({
      patient_id: resolution.patientId,
      ecg_values: {
        [ECG_VALUES_REQUIRED_KEY]: input.signal,
        sample_id: input.sampleId,
        feature_count: ECG_VALUES_REQUIRED,
      },
      lead: input.lead,
      source: input.source,
      recorded_at: input.recordedAt,
      upload_id: input.uploadId ?? null,
    })
    .select('id')
    .single();

  if (ecgError || !ecgRecord) {
    return { ok: false, error: `ecg_records insert failed: ${ecgError?.message ?? 'no row returned'}` };
  }

  // 3. Insert the linked prediction (uses the returned ecg_records.id FK)
  const { data: predictionRow, error: predictionError } = await supabase
    .from('predictions')
    .insert({
      ecg_record_id: ecgRecord.id,
      predicted_class: input.prediction.predictedClassId,
      predicted_class_name: input.prediction.predictedClass,
      confidence: input.prediction.confidence,
      probabilities: input.prediction.probabilities,
      model_mode: 'balanced',
      pca_features: input.topPcaFeatures ?? null,
      quantum_features: input.modelInfo
        ? {
            model: input.modelInfo.model,
            input_features: input.modelInfo.input_features,
            pca_components: input.modelInfo.pca_components,
            qubits: input.modelInfo.qubits,
            vqc_layers: input.modelInfo.vqc_layers,
          }
        : null,
      recorded_at: input.recordedAt,
    })
    .select('id')
    .single();

  if (predictionError || !predictionRow) {
    return {
      ok: false,
      error: `ECG record ${ecgRecord.id} was saved, but the predictions insert failed: ${
        predictionError?.message ?? 'no row returned'
      }`,
    };
  }

  // 4. Insert the linked explanation (uses the returned predictions.id FK)
  let explanationId: string | null = null;
  if (input.explanation) {
    const { data: explanationRow, error: explanationError } = await supabase
      .from('explanations')
      .insert({
        prediction_id: predictionRow.id,
        method: input.explanation.method,
        ranked_features: input.explanation.rankedFeatures,
        waveform_importance: input.explanation.waveformImportance,
        xai_metadata: {
          sample_id: input.sampleId,
          saved_at: input.recordedAt,
        },
      })
      .select('id')
      .single();

    if (explanationError || !explanationRow) {
      return {
        ok: false,
        ecgRecordId: ecgRecord.id,
        predictionId: predictionRow.id,
        error: `ECG record ${ecgRecord.id} and prediction ${predictionRow.id} were saved, but the explanations insert failed: ${
          explanationError?.message ?? 'no row returned'
        }`,
      };
    }
    explanationId = explanationRow.id;
  }

  return { ok: true, ecgRecordId: ecgRecord.id, predictionId: predictionRow.id, explanationId };
}

// =============================================================================
// Patient ECG history (read path)
// =============================================================================

export interface EcgHistoryExplanation {
  method: string;
  ranked_features: unknown;
  waveform_importance: unknown;
  xai_metadata: unknown;
}

export interface EcgHistoryEntry {
  id: string;
  recordedAt: string;
  sampleId: string | null;
  lead: string;
  source: string | null;
  /** FK to public.ecg_uploads when the analyzed beat came from a stored file. */
  uploadId: string | null;
  prediction: {
    predictedClassId: number;
    /** Single-letter AAMI code as stored in predictions.predicted_class_name (VARCHAR(1)) */
    predictedClass: string;
    confidence: number;
    probabilities: Record<string, number>;
    modelMode: string;
    modelInfo: Record<string, unknown> | null;
  } | null;
  explanation: EcgHistoryExplanation | null;
  signal: number[] | null;
}

interface EcgHistoryRow {
  id: string;
  recorded_at: string;
  ecg_values: { values?: unknown; sample_id?: unknown } | null;
  lead: string;
  source: string | null;
  upload_id: string | null;
  predictions: Array<{
    id: string;
    predicted_class: number;
    predicted_class_name: string;
    confidence: number;
    probabilities: unknown;
    model_mode: string;
    quantum_features: unknown;
    recorded_at: string;
    explanations: Array<{
      method: string;
      ranked_features: unknown;
      waveform_importance: unknown;
      xai_metadata: unknown;
    }>;
  }>;
}

export interface EcgHistoryResult {
  ok: boolean;
  entries?: EcgHistoryEntry[];
  error?: string;
}

/** Type guard for the embedded signal array inside ecg_values JSONB. */
function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

/**
 * Load the authenticated patient's saved ECG analyses (newest first).
 * Ownership is enforced by RLS; the query itself only follows the existing
 * FK chain ecg_records -> predictions -> explanations.
 */
export async function fetchEcgHistory(limit = 50): Promise<EcgHistoryResult> {
  const resolution = await getAuthenticatedPatientRecord();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your patient account to see your ECG history.' };
  }
  if (resolution.status === 'no-patient-record') {
    return { ok: false, error: 'No patient profile is linked to this account, so there is no ECG history to show.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve your patient record: ${resolution.error}` };
  }

  const { data, error } = await supabase
    .from('ecg_records')
    .select(
      `id,
       recorded_at,
       ecg_values,
       lead,
       source,
       upload_id,
       predictions (
         id,
         predicted_class,
         predicted_class_name,
         confidence,
         probabilities,
         model_mode,
         quantum_features,
         recorded_at,
         explanations (
           method,
           ranked_features,
           waveform_importance,
           xai_metadata
         )
       )`
    )
    .eq('patient_id', resolution.patientId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load ECG history: ${error.message}` };
  }

  const rows = (data ?? []) as unknown as EcgHistoryRow[];

  const entries: EcgHistoryEntry[] = rows.map((row) => {
    const valuesRaw = row.ecg_values?.values;
    const sampleIdRaw = row.ecg_values?.sample_id;
    const predictionRow = row.predictions?.[0] ?? null;
    const explanationRow = predictionRow?.explanations?.[0] ?? null;

    return {
      id: row.id,
      recordedAt: row.recorded_at,
      sampleId: typeof sampleIdRaw === 'string' ? sampleIdRaw : null,
      lead: row.lead,
      source: row.source,
      uploadId: row.upload_id ?? null,
      signal: isFiniteNumberArray(valuesRaw) ? valuesRaw : null,
      prediction: predictionRow
        ? {
            predictedClassId: predictionRow.predicted_class,
            predictedClass: String(predictionRow.predicted_class_name),
            confidence: predictionRow.confidence,
            probabilities:
              predictionRow.probabilities && typeof predictionRow.probabilities === 'object'
                ? (predictionRow.probabilities as Record<string, number>)
                : {},
            modelMode: predictionRow.model_mode,
            modelInfo:
              predictionRow.quantum_features && typeof predictionRow.quantum_features === 'object'
                ? (predictionRow.quantum_features as Record<string, unknown>)
                : null,
          }
        : null,
      explanation: explanationRow
        ? {
            method: explanationRow.method,
            ranked_features: explanationRow.ranked_features,
            waveform_importance: explanationRow.waveform_importance,
            xai_metadata: explanationRow.xai_metadata,
          }
        : null,
    };
  });

  return { ok: true, entries };
}
