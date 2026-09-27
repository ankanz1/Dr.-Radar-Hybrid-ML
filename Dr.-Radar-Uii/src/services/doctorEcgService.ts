import { supabase } from '../lib/supabase';
import type { EcgHistoryEntry } from './ecgPersistence';

/**
 * Doctor dashboard data layer.
 *
 * Reads ONLY stored analysis data from Supabase (public.ecg_records ->
 * predictions -> explanations) for patients the doctor is authorized to see
 * through the appointments relationship. Authorization is enforced entirely by
 * RLS (ecg-qml/db/006_doctor_ecg_access_rls.sql): this module never trusts a
 * patient ID supplied by the UI as proof of access — it only ever queries by
 * the doctor's own resolved doctor row, and RLS filters the rows anyway.
 *
 * No QML inference happens here: doctors see the stored prediction exactly as
 * the patient's /analyze run saved it.
 */

export interface DoctorIdentity {
  doctorId: string;
  displayName: string;
}

export interface AuthorizedPatient {
  patientId: string;
  name: string;
  email: string | null;
  latestAnalysisAt: string | null;
  latestPrediction: {
    predictedClass: string;
    confidence: number;
  } | null;
}

export interface DoctorServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

type DoctorResolution =
  | { status: 'signed-out' }
  | { status: 'no-doctor-record' }
  | { status: 'error'; error: string }
  | { status: 'ready'; doctorId: string; displayName: string };

/**
 * Resolve the authenticated doctor: auth.uid() -> public.doctors.user_id.
 * The display name comes from the linked public.users row.
 */
export async function getAuthenticatedDoctor(): Promise<DoctorResolution> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return { status: 'error', error: sessionError.message };
  }
  const sessionUser = sessionData.session?.user;
  if (!sessionUser) {
    return { status: 'signed-out' };
  }

  const { data, error } = await supabase
    .from('doctors')
    .select('id, user_id, users(first_name, last_name, display_name)')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (error) {
    return { status: 'error', error: error.message };
  }
  if (!data?.id) {
    return { status: 'no-doctor-record' };
  }

  const usersRow = Array.isArray(data.users) ? data.users[0] : data.users;
  const displayName =
    usersRow?.display_name ||
    [usersRow?.first_name, usersRow?.last_name].filter(Boolean).join(' ') ||
    'Doctor';

  return { status: 'ready', doctorId: data.id as string, displayName };
}

/**
 * List patients authorized to this doctor via appointments, with each
 * patient's latest stored ECG analysis (newest first).
 *
 * The patient list itself is whatever RLS lets this doctor see on
 * public.patients (appointment-authorized rows only) — the UI never supplies
 * patient IDs as authorization.
 */
export async function fetchAuthorizedPatients(limit = 50): Promise<DoctorServiceResult<AuthorizedPatient[]>> {
  const resolution = await getAuthenticatedDoctor();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your doctor account to view patient records.' };
  }
  if (resolution.status === 'no-doctor-record') {
    return { ok: false, error: 'No doctor profile row (public.doctors) exists for this account.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve the authenticated doctor: ${resolution.error}` };
  }

  // Minimum identity fields only: name + email. RLS returns just the
  // appointment-authorized patient rows for this doctor.
  const { data: patientRows, error: patientError } = await supabase
    .from('patients')
    .select(
      `id,
       users ( first_name, last_name, email )`
    )
    .limit(limit);

  if (patientError) {
    return { ok: false, error: `Could not load authorized patients: ${patientError.message}` };
  }

  const patients = (patientRows ?? []).map((row) => {
    const usersRow = Array.isArray(row.users) ? row.users[0] : row.users;
    const name =
      [usersRow?.first_name, usersRow?.last_name].filter(Boolean).join(' ') || 'Unnamed patient';
    return {
      patientId: row.id as string,
      name,
      email: (usersRow?.email as string | undefined) ?? null,
      latestAnalysisAt: null as string | null,
      latestPrediction: null as AuthorizedPatient['latestPrediction'],
    };
  });

  if (patients.length === 0) {
    return { ok: true, data: [] };
  }

  // Latest stored ECG per authorized patient, in one query over ecg_records.
  const patientIds = patients.map((patient) => patient.patientId);
  const { data: recordRows, error: recordError } = await supabase
    .from('ecg_records')
    .select(
      `id,
       patient_id,
       recorded_at,
       predictions ( predicted_class, predicted_class_name, confidence )`
    )
    .in('patient_id', patientIds)
    .order('recorded_at', { ascending: false })
    .limit(limit * 10);

  if (recordError) {
    // Patient identity is still useful even if ECG reads fail; surface both.
    return {
      ok: true,
      data: patients,
      error: `Patient list loaded, but ECG summaries are unavailable: ${recordError.message}`,
    };
  }

  const seen = new Set<string>();
  for (const row of (recordRows ?? []) as Array<{
    patient_id: string;
    recorded_at: string;
    predictions: Array<{ predicted_class: number; predicted_class_name: string; confidence: number }>;
  }>) {
    if (seen.has(row.patient_id)) continue; // rows are newest-first
    seen.add(row.patient_id);
    const patient = patients.find((candidate) => candidate.patientId === row.patient_id);
    if (!patient) continue;
    const prediction = row.predictions?.[0] ?? null;
    patient.latestAnalysisAt = row.recorded_at;
    patient.latestPrediction = prediction
      ? { predictedClass: String(prediction.predicted_class_name), confidence: prediction.confidence }
      : null;
  }

  // Patients with records first, then by name.
  patients.sort((a, b) => {
    if (a.latestAnalysisAt && b.latestAnalysisAt) {
      return a.latestAnalysisAt < b.latestAnalysisAt ? 1 : -1;
    }
    if (a.latestAnalysisAt) return -1;
    if (b.latestAnalysisAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return { ok: true, data: patients };
}

/**
 * Fetch ONE patient's stored ECG analyses (newest first).
 *
 * Authorization: the query targets ecg_records of the given patient, but RLS
 * only returns rows whose patient has a scheduled/completed appointment with
 * the authenticated doctor. An unauthorized patient simply yields zero rows
 * (reported as an authorization error), never another doctor's data.
 */
export async function fetchPatientEcgHistory(
  patientId: string,
  limit = 20
): Promise<DoctorServiceResult<EcgHistoryEntry[]>> {
  const resolution = await getAuthenticatedDoctor();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your doctor account to view patient records.' };
  }
  if (resolution.status === 'no-doctor-record') {
    return { ok: false, error: 'No doctor profile row (public.doctors) exists for this account.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve the authenticated doctor: ${resolution.error}` };
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
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load the patient's ECG analyses: ${error.message}` };
  }

  // RLS filtered everything out => this doctor is not authorized for the
  // requested patient (or the patient has no stored analyses yet).
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error:
        'No stored ECG analyses are accessible for this patient — either none exist yet, or no scheduled/completed appointment authorizes your access.',
    };
  }

  // Normalize rows into the same shape the patient history screen uses,
  // so the dashboard reuses identical rendering logic for stored values.
  const entries: EcgHistoryEntry[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const ecgValues = (row.ecg_values ?? {}) as { values?: unknown; sample_id?: unknown };
    const predictions = (row.predictions ?? []) as Array<Record<string, unknown>>;
    const predictionRow = predictions[0] ?? null;
    const explanationRow = predictionRow
      ? ((predictionRow.explanations ?? []) as Array<Record<string, unknown>>)[0] ?? null
      : null;
    const values = ecgValues.values;

    return {
      id: row.id as string,
      recordedAt: row.recorded_at as string,
      sampleId: typeof ecgValues.sample_id === 'string' ? ecgValues.sample_id : null,
      lead: row.lead as string,
      source: (row.source as string | null) ?? null,
      uploadId: (row.upload_id as string | null) ?? null,
      signal: Array.isArray(values) && values.every((v) => typeof v === 'number') ? (values as number[]) : null,
      prediction: predictionRow
        ? {
            predictedClassId: predictionRow.predicted_class as number,
            predictedClass: String(predictionRow.predicted_class_name),
            confidence: predictionRow.confidence as number,
            probabilities:
              predictionRow.probabilities && typeof predictionRow.probabilities === 'object'
                ? (predictionRow.probabilities as Record<string, number>)
                : {},
            modelMode: String(predictionRow.model_mode ?? 'balanced'),
            modelInfo:
              predictionRow.quantum_features && typeof predictionRow.quantum_features === 'object'
                ? (predictionRow.quantum_features as Record<string, unknown>)
                : null,
          }
        : null,
      explanation: explanationRow
        ? {
            method: String(explanationRow.method ?? ''),
            ranked_features: explanationRow.ranked_features,
            waveform_importance: explanationRow.waveform_importance,
            xai_metadata: explanationRow.xai_metadata,
          }
        : null,
    };
  });

  return { ok: true, data: entries };
}
