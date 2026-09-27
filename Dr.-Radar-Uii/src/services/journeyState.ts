import type { ScreenTab } from '../types';

/**
 * Patient journey state machine (requirement 13).
 *
 * The journey state is DERIVED FROM PERSISTED DATA (health_profiles row,
 * ecg_uploads rows, ecg_records rows) — never from React memory — so the UI
 * renders correctly after a refresh. localStorage holds only the "where was I"
 * resume pointer for in-progress flows.
 */

export type JourneyState =
  | 'assessment_not_started'
  | 'assessment_in_progress'
  | 'assessment_saved'
  | 'record_not_uploaded'
  | 'record_uploading'
  | 'record_saved'
  | 'analysis_ready'
  | 'analysis_running'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'result_saved'
  | 'doctor_connection_available'
  | 'doctor_connected';

/** Where the patient left the guided journey (localStorage resume pointer). */
const JOURNEY_RESUME_KEY = 'dr_radar_journey_resume_v1';

export interface JourneyResume {
  tab: ScreenTab;
  savedAt: string;
}

export function saveJourneyResume(tab: ScreenTab): void {
  try {
    localStorage.setItem(JOURNEY_RESUME_KEY, JSON.stringify({ tab, savedAt: new Date().toISOString() }));
  } catch {
    // non-fatal: resume pointer is a UX convenience only
  }
}

export function loadJourneyResume(): JourneyResume | null {
  try {
    const raw = localStorage.getItem(JOURNEY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JourneyResume;
    return parsed?.tab ? parsed : null;
  } catch {
    return null;
  }
}

export function clearJourneyResume(): void {
  try {
    localStorage.removeItem(JOURNEY_RESUME_KEY);
  } catch {
    // ignore
  }
}

/** True when a real saved assessment exists in public.health_profiles. */
export interface PersistedJourneyFacts {
  hasSavedAssessment: boolean;
  storedUploadCount: number;
  savedAnalysisCount: number;
}

/**
 * Human-facing step of the guided journey given the persisted facts.
 * This is a pure function so callers (home, upload screen) agree on state.
 */
export function currentJourneyStep(facts: PersistedJourneyFacts): JourneyState {
  if (!facts.hasSavedAssessment) return 'assessment_not_started';
  if (facts.savedAnalysisCount > 0) return 'result_saved';
  if (facts.storedUploadCount > 0) return 'record_saved';
  return 'record_not_uploaded';
}
