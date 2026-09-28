import {
  AssistantMessage,
  AssistantContext,
  AssistantStructuredContent,
} from '../types/assistant';
import { supabase } from '../lib/supabase';

// Detect emergency or acute critical symptoms (unchanged safety triage)
const URGENT_SYMPTOM_KEYWORDS = [
  'chest pain',
  'crushing chest',
  'pressure in chest',
  'radiating to left arm',
  'radiating to jaw',
  'cannot breathe',
  'severe shortness of breath',
  'struggling to breathe',
  'fainted',
  'passed out',
  'blacked out',
  'loss of consciousness',
  'sudden weakness',
  'face drooping',
  'slurred speech',
  'cannot speak',
  'coughing blood',
  'severe allergic',
  'throat closing',
  'anaphylaxis',
];

export function detectUrgentSymptoms(text: string): boolean {
  const lower = text.toLowerCase();
  return URGENT_SYMPTOM_KEYWORDS.some((kw) => lower.includes(kw));
}

export const EMERGENCY_DISCLAIMER_TEXT =
  'IMPORTANT: If you or someone around you is experiencing severe chest pain, extreme difficulty breathing, sudden weakness, speech loss, or fainting, please seek emergency medical services (such as calling 911 or local emergency services) or go to the nearest emergency department immediately. Dr. Radar AI is an informational assistant, not an emergency medical provider.';

const ASSISTANT_UNAVAILABLE_TEXT =
  'Dr. Radar Assistant is temporarily unavailable. Please try again.';

const SIGN_IN_TEXT = 'Please sign in to use Dr. Radar Assistant.';

export interface AssistantChatError extends Error {
  code: 'signed-out' | 'unavailable';
}

/**
 * Ask Dr. Radar chat entry point.
 *
 * Identity (Step 2): the caller's identity comes ONLY from the current
 * Supabase session. The access token is sent as `Authorization: Bearer ...`
 * so the server can verify the user server-side; the client never sends a
 * userId, and no hardcoded/demo identity exists anywhere in this path.
 *
 * Failure policy (Step 2): there is NO fabricated local fallback. If the
 * request cannot be completed, the caller receives an honest generic error —
 * never invented ECG values, diagnoses, names, or clinical findings.
 * The emergency-keyword triage above is preserved and always wins.
 */
export async function askAssistantChat({
  message,
  role,
  context,
  history,
}: {
  message: string;
  /** Client UI role is advisory only — the server resolves the authoritative role. */
  role?: 'patient' | 'doctor' | 'researcher';
  context?: AssistantContext;
  history: AssistantMessage[];
}): Promise<{
  text: string;
  structured?: AssistantStructuredContent;
}> {
  // Check for immediate life-threatening emergency symptoms first (unchanged)
  if (detectUrgentSymptoms(message)) {
    return {
      text:
        '⚠️ **POTENTIAL MEDICAL EMERGENCY DETECTED**\n\n' +
        'Based on the symptoms you described, this may represent an acute medical situation that requires immediate physical evaluation. Please do not wait for an online response.\n\n' +
        '**Recommended Immediate Action:**\n' +
        '• Call emergency services (e.g., 911 or your regional emergency line) or have someone take you to the nearest Emergency Room right away.\n' +
        '• Rest in a seated or comfortable position while waiting for help.\n' +
        '• If alone, keep your front door unlocked and notify a nearby neighbor or family member.\n\n' +
        'Dr. Radar AI is a decision-support and educational tool, not an emergency care provider. Please prioritize professional emergency attention.',
      structured: {
        isUrgent: true,
        emergencyNotice:
          'Symptoms described warrant immediate clinical or emergency evaluation. Do not delay seeking urgent care.',
        whatItMeans:
          'You described symptoms that could indicate an acute cardiovascular or respiratory event.',
        whyItMatters:
          'Time-sensitive medical conditions require immediate clinical diagnostic equipment and physical evaluation.',
        whatDrRadarFound: context?.prediction
          ? `Current recorded telemetry: ${context.prediction} (${context.confidence || 'Recorded'} confidence).`
          : 'No emergency triage replacement can be made via automated software.',
        whatToDiscussWithDoctor: [
          'Immediate emergency department evaluation',
          'Full 12-lead diagnostic ECG and cardiac enzymes (Troponin)',
          'Physical examination and continuous vital sign telemetry',
        ],
      },
    };
  }

  // Identity from the CURRENT authenticated Supabase session only.
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;
  if (!sessionUser || !sessionData.session?.access_token) {
    const error = new Error(SIGN_IN_TEXT) as AssistantChatError;
    error.code = 'signed-out';
    throw error;
  }

  try {
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        message,
        // Advisory UI role only; the server resolves the authoritative role
        // from the verified Supabase identity. No userId is ever sent.
        role,
        context,
        history: history.slice(-6).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        })),
      }),
    });

    if (response.status === 401) {
      const error = new Error(SIGN_IN_TEXT) as AssistantChatError;
      error.code = 'signed-out';
      throw error;
    }

    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        return {
          text: data.text,
          structured: data.structured,
        };
      }
    }

    // Any other failure (5xx, network, Gemini down) is an honest error.
    const error = new Error(ASSISTANT_UNAVAILABLE_TEXT) as AssistantChatError;
    error.code = 'unavailable';
    throw error;
  } catch (err) {
    // Re-throw our typed errors untouched; wrap unexpected failures (network
    // down, DNS, aborts) as the same honest unavailable message.
    if ((err as AssistantChatError).code) throw err;
    const error = new Error(ASSISTANT_UNAVAILABLE_TEXT) as AssistantChatError;
    error.code = 'unavailable';
    throw error;
  }
}
