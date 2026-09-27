import { supabase } from '../lib/supabase';
import type { UserRole, UserAccountState } from '../types';

/**
 * Account provisioning against public.users / public.patients / public.doctors.
 *
 * Rules enforced here:
 * - every write requires a live authenticated session (RLS: id/user_id = auth.uid())
 * - public.users.id is always session.user.id (never a client-chosen value)
 * - the real password never touches public.users.password_hash (sentinel only —
 *   Supabase Auth owns credentials; the QML backend uses a separate database)
 * - login-time sync is "insert if missing": existing rows are never overwritten
 * - every failure surfaces the actual Supabase error (code/message/details/hint)
 *   in development; no tokens/passwords/secrets are ever logged
 */

const SENTINEL_PASSWORD_HASH = 'supabase-auth-managed';

export interface ProvisionResult {
  ok: boolean;
  message?: string;
}

interface ProvisionProfile {
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

const isDev = import.meta.env.DEV;

function logError(operation: string, err: { code?: string; message?: string; details?: unknown; hint?: unknown } | null, userId: string, role?: string): void {
  if (!isDev) return;
  console.error(`[provisioning] ${operation} FAILED`, {
    operation,
    'supabase error code': err?.code ?? null,
    'supabase error message': err?.message ?? null,
    'supabase error details': err?.details ?? null,
    'supabase error hint': err?.hint ?? null,
    'authenticated user id': userId,
    'selected role': role ?? null,
  });
}

function logInfo(message: string, details?: Record<string, unknown>): void {
  if (isDev) console.log(`[provisioning] ${message}`, details ?? '');
}

function dbRole(role?: UserRole): 'patient' | 'doctor' {
  return role === 'doctor' ? 'doctor' : 'patient';
}

function composedName(profile: ProvisionProfile, authUser: { id: string; email?: string | null }): {
  firstName: string;
  lastName: string;
  displayName: string;
} {
  const firstName = (profile.firstName || '').trim();
  const lastName = (profile.lastName || '').trim();
  const displayName =
    (profile.displayName || '').trim() ||
    `${firstName} ${lastName}`.trim() ||
    authUser.email?.split('@')[0] ||
    'User';
  return { firstName, lastName, displayName };
}

/** Upsert public.users + the role-specific profile row with full onboarding data. */
export async function provisionAccount(profile: ProvisionProfile): Promise<ProvisionResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const authUser = session?.user;

  if (sessionError || !authUser) {
    logError('supabase.auth.getSession', sessionError, 'n/a', profile.role);
    return {
      ok: false,
      message: isDev
        ? `Not authenticated: ${sessionError?.message ?? 'no active Supabase session — sign in first'}`
        : 'Your session has expired. Please sign in again.',
    };
  }
  const role = dbRole(profile.role);
  logInfo('session verified', { userId: authUser.id, email: authUser.email, role });

  const { firstName, lastName, displayName } = composedName(profile, authUser);
  // users.avatar_url is VARCHAR(500) — uploaded picture data URLs exceed it
  const safeAvatarUrl = profile.avatarUrl && profile.avatarUrl.length <= 500 ? profile.avatarUrl : null;

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
    return {
      ok: false,
      message: isDev
        ? `public.users upsert failed [${userError.code ?? 'unknown'}]: ${userError.message}`
        : "We couldn't save your profile. Please check your connection and try again.",
    };
  }
  logInfo('users upsert succeeded', { userId: authUser.id, role });

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

  // Guarantee the role profile row exists BEFORE the data upsert (migration 012
  // RPC): the users upsert above already flipped onboarding_completed, so a
  // failing patients upsert must never leave a stranded account without a
  // patients row again. Idempotent; the upsert below still writes the data.
  const ensuredId = await ensurePatientProfileRow();
  if (role === 'patient' && !ensuredId) {
    logInfo('patients row could not be ensured pre-upsert', { userId: authUser.id });
  }

  const { error: profileError } = await supabase
    .from(profileTable)
    .upsert(profileRow, { onConflict: 'user_id' });

  if (profileError) {
    logError(`public.${profileTable} upsert`, profileError, authUser.id, role);
    return {
      ok: false,
      message: isDev
        ? `public.${profileTable} upsert failed [${profileError.code ?? 'unknown'}]: ${profileError.message}`
        : "We couldn't save your profile. Please check your connection and try again.",
    };
  }
  logInfo(`${profileTable} upsert succeeded`, { userId: authUser.id, role });
  return { ok: true };
}

/**
 * Login/OAuth-return synchronization: provision the application rows only if
 * they do not exist yet. Existing rows are NEVER modified here (the onboarding
 * completion upsert is the only place profile data is written).
 */
export async function syncAccountProvisioning(
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  draft?: ProvisionProfile
): Promise<ProvisionResult> {
  const role = dbRole(draft?.role);

  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id, onboarding_completed')
    .eq('id', authUser.id)
    .maybeSingle();

  if (selectError) {
    logError('public.users select (sync)', selectError, authUser.id, role);
    return {
      ok: false,
      message: isDev
        ? `public.users select failed [${selectError.code ?? 'unknown'}]: ${selectError.message}`
        : 'Could not verify your account profile.',
    };
  }

  if (existing) {
    logInfo('users row already present — sync skipped (no data overwritten)', {
      userId: authUser.id,
      onboardingCompleted: existing.onboarding_completed,
    });
    // Self-heal PATIENT accounts whose patients row is missing (stranded by a
    // historical provisioning failure — migration 012 RPC). Runs regardless of
    // onboarding state: incomplete accounts must get their patients row too.
    // The RPC is idempotent (ON CONFLICT DO NOTHING), re-validates role
    // server-side (doctors are never written), and never modifies existing rows.
    if (role === 'patient') {
      await ensurePatientProfileRow();
    }
    return { ok: true };
  }

  // Row missing: insert the minimal application row from trusted auth identity.
  // Names prefer onboarding-draft values, then OAuth user_metadata, then email.
  const meta = authUser.user_metadata ?? {};
  const metaFirst = typeof meta.first_name === 'string' ? meta.first_name : typeof meta.given_name === 'string' ? (meta.given_name as string) : '';
  const metaLast = typeof meta.last_name === 'string' ? meta.last_name : typeof meta.family_name === 'string' ? (meta.family_name as string) : '';
  const firstName = (draft?.firstName || metaFirst || '').trim();
  const lastName = (draft?.lastName || metaLast || '').trim();
  const displayName =
    (draft?.displayName || '').trim() ||
    `${firstName} ${lastName}`.trim() ||
    authUser.email?.split('@')[0] ||
    'User';

  const { error: insertError } = await supabase.from('users').upsert(
    {
      id: authUser.id,
      email: authUser.email,
      role,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      password_hash: SENTINEL_PASSWORD_HASH,
      onboarding_completed: false,
      profile_completed: false,
    },
    { onConflict: 'id' }
  );

  if (insertError) {
    logError('public.users insert (sync)', insertError, authUser.id, role);
    return {
      ok: false,
      message: isDev
        ? `public.users provision failed [${insertError.code ?? 'unknown'}]: ${insertError.message}`
        : 'Could not create your account profile.',
    };
  }
  logInfo('users row provisioned (insert-if-missing)', { userId: authUser.id, role });
  return { ok: true };
}

/**
 * Ensure the caller's public.patients row exists (migration 012 RPC).
 *
 * Database-backed, idempotent self-healing for accounts whose patients row was
 * never created (provisioning upsert failure after the users row landed).
 * The RPC inserts ONLY the caller's own row (user_id = auth.uid()) via
 * ON CONFLICT DO NOTHING, never touches doctor accounts, never modifies an
 * existing patients row, and requires no service role.
 *
 * Returns the patients.id when resolved/created, or null when there is no
 * session, no users row, or the account is not a patient (doctors untouched).
 */
export async function ensurePatientProfileRow(): Promise<string | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) return null;

  const { data, error } = await supabase.rpc('ensure_patient_profile');
  if (error) {
    logError('rpc ensure_patient_profile', error, session.user.id);
    return null;
  }
  logInfo('patients row ensured', { userId: session.user.id, patientId: data ?? null });
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
