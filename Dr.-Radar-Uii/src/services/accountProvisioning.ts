import { supabase } from '../lib/supabase';
import type { UserRole, UserAccountState } from '../types';

/**
 * Account provisioning against public.users / public.patients / public.doctors.
 *
 * Contract (RLS-compatible, identity-safe):
 * - Supabase Auth (auth.users) is the ONLY credential/identity system; the
 *   application identity is always auth.uid() from the live session.
 * - Every read and write targets exactly one row: the caller's own
 *   (public.users.id = auth.uid(), patients/doctors.user_id = auth.uid()).
 * - Rows are NEVER located by email and NEVER read/written via another user's
 *   id — no client-side reconciliation, merging, re-keying, or deletion.
 * - The real password never touches public.users.password_hash (sentinel only;
 *   Supabase Auth owns credentials).
 * - Every failure surfaces the actual Supabase error (code/message) in
 *   development; a safe message in production. No secrets are ever logged.
 */

const SENTINEL_PASSWORD_HASH = 'supabase-auth-managed';

export interface ProvisionResult {
  ok: boolean;
  message?: string;
}

export interface ProvisionProfile {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
  dob?: string;
  gender?: string;
  country?: string;
  language?: string;
  professionalRole?: string;
  specialization?: string;
  organization?: string;
}

// Lazy (function) so tests can stub import.meta.env.DEV per-case; in the real
// Vite build this is statically replaced and compiles to the same constant.
function isDev(): boolean {
  return import.meta.env.DEV;
}

type SupabaseError = { code?: string; message?: string; details?: unknown; hint?: unknown };

function logError(operation: string, err: SupabaseError | null, userId: string, role?: string): void {
  if (!isDev()) return;
  console.error(`[provisioning] ${operation} FAILED`, {
    operation,
    'supabase error code': err?.code ?? null,
    'supabase error message': err?.message ?? null,
    'authenticated user id': userId,
    'selected role': role ?? null,
  });
}

function logInfo(message: string, details?: Record<string, unknown>): void {
  if (isDev()) console.log(`[provisioning] ${message}`, details ?? '');
}

function dbRole(role?: UserRole): 'patient' | 'doctor' {
  return role === 'doctor' ? 'doctor' : 'patient';
}

function composedName(
  profile: ProvisionProfile,
  authUser: { id: string; email?: string | null }
): { firstName: string; lastName: string; displayName: string } {
  const firstName = (profile.firstName || '').trim();
  const lastName = (profile.lastName || '').trim();
  const displayName =
    (profile.displayName || '').trim() ||
    `${firstName} ${lastName}`.trim() ||
    authUser.email?.split('@')[0] ||
    'User';
  return { firstName, lastName, displayName };
}

/**
 * Resolve the live authenticated identity. Returns null (with no error thrown)
 * when there is no active session — callers decide what that means.
 */
async function requireAuthUser(): Promise<{
  id: string;
  email?: string | null;
} | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const authUser = session?.user;
  if (sessionError || !authUser) {
    if (sessionError) logError('supabase.auth.getSession', sessionError, 'n/a');
    return null;
  }
  return { id: authUser.id, email: authUser.email };
}

/** Human-safe fallback shown to end users when a DB write fails in production. */
const GENERIC_SAVE_ERROR = "We couldn't save your profile. Please check your connection and try again.";

/** Format a Supabase error for a ProvisionResult (dev detail vs prod-safe). */
function failure(err: SupabaseError | null, operation: string): ProvisionResult {
  if (isDev() && err?.message) {
    return { ok: false, message: `${operation} failed [${err.code ?? 'unknown'}]: ${err.message}` };
  }
  return { ok: false, message: GENERIC_SAVE_ERROR };
}

/**
 * Upsert the caller's own public.users row plus the role-specific profile row
 * with full onboarding data.
 *
 * - Requires an active Supabase Auth session; public.users.id is always
 *   session.user.id (never a client-chosen value).
 * - Writes are keyed on id / user_id = auth.uid(), so RLS's
 *   "own rows only" policies admit them; any other user's row is unreachable.
 * - Email comes from the auth session — never used as a lookup key.
 */
export async function provisionAccount(profile: ProvisionProfile): Promise<ProvisionResult> {
  const authUser = await requireAuthUser();
  if (!authUser) {
    return {
      ok: false,
      message: isDev()
        ? 'Not authenticated: no active Supabase session — sign in first'
        : 'Your session has expired. Please sign in again.',
    };
  }
  const role = dbRole(profile.role);
  logInfo('session verified', { userId: authUser.id, role });

  const { firstName, lastName, displayName } = composedName(profile, authUser);
  // users.avatar_url is VARCHAR(500) — uploaded picture data URLs exceed it
  const safeAvatarUrl = profile.avatarUrl && profile.avatarUrl.length <= 500 ? profile.avatarUrl : null;

  // Own-row upsert keyed on the authenticated id (RLS: id = auth.uid()).
  const { error: userError } = await supabase
    .from('users')
    .upsert(
      {
        id: authUser.id,
        email: authUser.email ?? profile.email,
        role,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        // NOT NULL column with no default in the legacy schema. Credentials are
        // managed exclusively by Supabase Auth (auth.users) — never a real password.
        password_hash: SENTINEL_PASSWORD_HASH,
        avatar_url: safeAvatarUrl,
        onboarding_completed: true,
        profile_completed: profile.profileCompleted ?? true,
      },
      { onConflict: 'id' }
    );

  if (userError) {
    logError('public.users upsert', userError, authUser.id, role);
    return failure(userError, 'public.users upsert');
  }
  logInfo('users upsert succeeded', { userId: authUser.id, role });

  // Exactly one role profile, keyed on the authenticated id (RLS: user_id = auth.uid()).
  const profileTable = role === 'patient' ? 'patients' : 'doctors';
  const profileRow: Record<string, unknown> = { user_id: authUser.id };
  if (role === 'patient') {
    if (profile.dob) profileRow.dob = profile.dob;
    if (profile.gender) profileRow.gender = profile.gender;
    if (profile.country) profileRow.country = profile.country;
    if (profile.language) profileRow.language = profile.language;
    if (safeAvatarUrl) profileRow.avatar_url = safeAvatarUrl;
  } else {
    // doctors.title and doctors.specialty are NOT NULL without defaults
    profileRow.title = (profile.professionalRole || '').trim() || 'Doctor';
    profileRow.specialty = (profile.specialization || '').trim() || 'General Practice';
    if (profile.organization) profileRow.hospital = profile.organization;
  }

  const { error: profileError } = await supabase
    .from(profileTable)
    .upsert(profileRow, { onConflict: 'user_id' });

  if (profileError) {
    logError(`public.${profileTable} upsert`, profileError, authUser.id, role);
    return failure(profileError, `public.${profileTable} upsert`);
  }
  logInfo(`${profileTable} upsert succeeded`, { userId: authUser.id, role });
  return { ok: true };
}

/**
 * Login/OAuth-return synchronization: ensure the caller's application rows
 * exist, creating only what is missing and NEVER modifying existing rows.
 *
 * - Requires an active session (auth.uid() is the sole identity).
 * - public.users row: insert-if-missing keyed on id = auth.uid().
 * - Role profile row: patients.user_id / doctors.user_id = auth.uid().
 * - No reconciliation RPC, no email lookups, no writes to other users' rows.
 */
export async function syncAccountProvisioning(
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  draft?: ProvisionProfile
): Promise<ProvisionResult> {
  const role = dbRole(draft?.role);

  const sessionUser = await requireAuthUser();
  if (!sessionUser) {
    logInfo('sync skipped: no active session', { userId: authUser.id });
    return { ok: false, message: 'No active session — sign in to provision your account profile.' };
  }

  // 1. public.users: insert-if-missing for the caller's own id. The select and
  // the insert are both scoped to auth.uid(), so no other row is ever touched.
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (selectError) {
    logError('public.users select (sync)', selectError, sessionUser.id, role);
    return failure(selectError, 'public.users select');
  }

  if (!existing) {
    const { firstName, lastName, displayName } = composedName(draft ?? {}, sessionUser);
    const { error: insertError } = await supabase.from('users').insert({
      id: sessionUser.id,
      email: sessionUser.email ?? draft?.email,
      role,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      // Credentials live in Supabase Auth only — sentinel here, never a password.
      password_hash: SENTINEL_PASSWORD_HASH,
      avatar_url: null,
      onboarding_completed: false,
      profile_completed: false,
    });
    if (insertError) {
      // Benign race (two tabs / StrictMode): another session inserted the same
      // auth.uid() row first — 23505 on the id PK means it already exists.
      if (insertError.code === '23505') {
        logInfo('users row already exists (concurrent insert)', { userId: sessionUser.id });
      } else {
        logError('public.users insert (sync)', insertError, sessionUser.id, role);
        return failure(insertError, 'public.users insert');
      }
    } else {
      logInfo('users row created (sync)', { userId: sessionUser.id, role });
    }
  }

  // 2. Patients self-heal (migration 012 RPC): idempotent own-row insert of
  // public.patients when missing. No-ops for doctor accounts.
  if (role === 'patient') {
    await ensurePatientProfileRow();
  }

  return { ok: true };
}

/**
 * Ensure the caller's own public.patients row exists (migration 012 RPC).
 *
 * Idempotent self-healing for accounts whose patients row was never created
 * (e.g. a historical provisioning failure after the users row landed). The RPC
 * inserts ONLY the caller's own row (user_id = auth.uid()) via ON CONFLICT DO
 * NOTHING, never touches doctor accounts, never modifies an existing patients
 * row, and requires no service role.
 *
 * Returns the patients.id when resolved/created, or null when there is no
 * session, no users row, or the account is not a patient (doctors untouched).
 */
export async function ensurePatientProfileRow(): Promise<string | null> {
  const authUser = await requireAuthUser();
  if (!authUser) return null;

  const { data, error } = await supabase.rpc('ensure_patient_profile');
  if (error) {
    logError('rpc ensure_patient_profile', error, authUser.id);
    return null;
  }
  logInfo('patients row ensured', { userId: authUser.id, patientId: data ?? null });
  return (data as string | null) ?? null;
}

/** Read the caller's own public.users row (RLS-safe; null when absent). */
export async function fetchOwnUsersRow(userId: string): Promise<{
  role?: UserRole;
  onboardingCompleted: boolean;
} | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    logError('public.users select (own row)', error, userId);
    return null;
  }
  if (!data) return null;
  return {
    role: data.role === 'doctor' ? 'doctor' : 'patient',
    onboardingCompleted: Boolean(data.onboarding_completed),
  };
}

/** Small helper for local draft persistence across OAuth redirects. */
export function readLocalDraft(): Partial<UserAccountState> {
  try {
    const raw = localStorage.getItem('dr_radar_account_v2');
    return raw ? (JSON.parse(raw) as Partial<UserAccountState>) : {};
  } catch {
    return {};
  }
}
