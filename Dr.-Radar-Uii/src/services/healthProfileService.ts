import { supabase } from '../lib/supabase';
import { ensurePatientProfileRow } from './accountProvisioning';
import type { PatientHealthProfile } from '../types/healthInfo';

/**
 * Health assessment persistence (Phase: patient-first journey, step 2).
 *
 * Writes the existing 8-section PatientHealthProfile into the EXISTING
 * public.health_profiles table (schema: ecg-qml/db/supabase_schema.sql,
 * RLS: ecg-qml/db/004_health_profiles_rls.sql). One row per patient
 * (health_profiles.patient_id UNIQUE), so every save is an upsert on
 * patient_id — no duplicate rows are ever created.
 *
 * Access is through the caller's own authenticated session; RLS restricts
 * reads/writes to patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()).
 * If the caller's patients row is missing (stranded account), resolvePatientRow
 * first attempts the idempotent ensure_patient_profile() repair (migration 012).
 */

export type HealthProfileResolution =
  | { status: 'signed-out' }
  | { status: 'no-patient-record' }
  | { status: 'error'; error: string }
  | { status: 'ready'; patientId: string };

/** Resolve the caller's own patient row (same helper used by the ECG layer). */
export async function resolvePatientRow(): Promise<HealthProfileResolution> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { status: 'error', error: sessionError.message };
  let sessionUser = sessionData.session?.user;
  if (!sessionUser) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { status: 'error', error: userError.message };
    sessionUser = userData?.user;
    if (!sessionUser) return { status: 'signed-out' };
  }

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (error) return { status: 'error', error: error.message };
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

export interface HealthProfileSaveResult {
  ok: boolean;
  error?: string;
}

/** Column mapping: profile section -> existing health_profiles JSONB column. */
function profileToRow(patientId: string, profile: PatientHealthProfile): Record<string, unknown> {
  return {
    patient_id: patientId,
    primary_goal: profile.primaryGoal ?? null,
    goal_description: profile.goalDescription ?? null,
    symptoms: profile.symptoms ?? {},
    conditions: profile.conditions ?? {},
    medications: profile.medications ?? {},
    allergies: profile.allergies ?? {},
    procedures: profile.procedures ?? {},
    family_history: profile.familyHistory ?? {},
    lifestyle: profile.lifestyle ?? {},
    previous_tests: profile.previousTests ?? {},
    completion_percentage: Math.max(0, Math.min(100, Math.round(profile.completionPercentage ?? 0))),
    last_updated: new Date().toISOString(),
  };
}

/**
 * Upsert the assessment into public.health_profiles (one row per patient).
 * Duplicate-safe: upsert on the unique patient_id column.
 */
export async function saveHealthAssessment(profile: PatientHealthProfile): Promise<HealthProfileSaveResult> {
  const resolution = await resolvePatientRow();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your patient account to save your health assessment.' };
  }
  if (resolution.status === 'no-patient-record') {
    return { ok: false, error: 'No patient profile is linked to this account, so the assessment cannot be saved.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve your patient record: ${resolution.error}` };
  }

  const { error } = await supabase
    .from('health_profiles')
    .upsert(profileToRow(resolution.patientId, profile), { onConflict: 'patient_id' });

  if (error) {
    return { ok: false, error: `Could not save your assessment: ${error.message}` };
  }
  return { ok: true };
}

/** Shape of a raw health_profiles row (subset actually consumed). */
export interface StoredHealthAssessment {
  primaryGoal: string | null;
  goalDescription: string | null;
  symptoms: unknown;
  conditions: unknown;
  medications: unknown;
  allergies: unknown;
  procedures: unknown;
  familyHistory: unknown;
  lifestyle: unknown;
  previousTests: unknown;
  completionPercentage: number;
  lastUpdated: string | null;
}

export type HealthProfileLoadResult =
  | { ok: true; assessment: StoredHealthAssessment | null } // null = never saved
  | { ok: false; error: string };

/** Load the caller's saved assessment (null when the patient never saved one). */
export async function loadHealthAssessment(): Promise<HealthProfileLoadResult> {
  const resolution = await resolvePatientRow();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your patient account to see your health assessment.' };
  }
  if (resolution.status === 'no-patient-record') {
    return { ok: false, error: 'No patient profile is linked to this account.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve your patient record: ${resolution.error}` };
  }

  const { data, error } = await supabase
    .from('health_profiles')
    .select(
      'primary_goal, goal_description, symptoms, conditions, medications, allergies, procedures, family_history, lifestyle, previous_tests, completion_percentage, last_updated'
    )
    .eq('patient_id', resolution.patientId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Could not load your assessment: ${error.message}` };
  }
  if (!data) return { ok: true, assessment: null };

  return {
    ok: true,
    assessment: {
      primaryGoal: (data.primary_goal as string) ?? null,
      goalDescription: (data.goal_description as string) ?? null,
      symptoms: data.symptoms ?? null,
      conditions: data.conditions ?? null,
      medications: data.medications ?? null,
      allergies: data.allergies ?? null,
      procedures: data.procedures ?? null,
      familyHistory: data.family_history ?? null,
      lifestyle: data.lifestyle ?? null,
      previousTests: data.previous_tests ?? null,
      completionPercentage: Number(data.completion_percentage ?? 0),
      lastUpdated: (data.last_updated as string) ?? null,
    },
  };
}
