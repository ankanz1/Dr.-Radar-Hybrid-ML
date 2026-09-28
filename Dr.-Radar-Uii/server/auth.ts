/**
 * Supabase authentication verification for the Dr. Radar server (server-side only).
 *
 * Verifies a Supabase Auth access token WITHOUT any new database schema, RLS
 * change, or service-role key: Supabase's public auth endpoint
 * `GET {SUPABASE_URL}/auth/v1/user` validates the JWT when called with the
 * project's publishable (anon) key and returns the user for valid tokens.
 * Role resolution reads the caller's OWN public.users row (RLS users_read_own
 * allows reading it with the caller's own token), so the server never trusts a
 * client-asserted role and never needs the service role.
 *
 * Server-only: reads SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from process.env
 * (falls back to the VITE_-prefixed values used by the frontend).
 */

export interface VerifiedUser {
  id: string;
  email: string | null;
  role: 'patient' | 'doctor' | 'researcher' | null;
  roleSource: 'database' | 'token-metadata' | 'unknown';
}

export type VerificationResult =
  | { status: 'ok'; user: VerifiedUser }
  | { status: 'unconfigured' }
  | { status: 'rejected' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Bearer <jwt>" -> "<jwt>"; null when missing/malformed (never thrown). */
export function extractBearerToken(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const token = match[1];
  // A Supabase access token is a compact JWS: three dot-separated segments.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(token)) return null;
  return token;
}

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

interface AuthUserPayload {
  id?: string;
  email?: string;
  role?: string;
  user_metadata?: { role?: string };
  app_metadata?: { role?: string };
}

/**
 * Verify the token against Supabase Auth and resolve the caller's identity.
 * Role precedence: the caller's OWN public.users row (authoritative, RLS
 * users_read_own) -> token metadata -> unknown. Never from the request body.
 */
export async function verifySupabaseToken(token: string): Promise<VerificationResult> {
  const config = supabaseConfig();
  if (!config) return { status: 'unconfigured' };

  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.anonKey,
      },
    });
  } catch {
    return { status: 'rejected' };
  }
  if (!response.ok) return { status: 'rejected' };

  let payload: AuthUserPayload;
  try {
    payload = (await response.json()) as AuthUserPayload;
  } catch {
    return { status: 'rejected' };
  }
  const id = payload?.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return { status: 'rejected' };

  // Authoritative role: the caller's own public.users row (read with the
  // caller's token — RLS users_read_own permits exactly this).
  let role: VerifiedUser['role'] = null;
  let roleSource: VerifiedUser['roleSource'] = 'unknown';
  try {
    const usersRes = await fetch(
      `${config.url}/rest/v1/users?id=eq.${id}&select=role`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: config.anonKey,
        },
      }
    );
    if (usersRes.ok) {
      const rows = (await usersRes.json()) as Array<{ role?: string }>;
      const dbRole = rows?.[0]?.role;
      if (dbRole === 'patient' || dbRole === 'doctor' || dbRole === 'researcher') {
        role = dbRole;
        roleSource = 'database';
      }
    }
  } catch {
    // non-fatal: fall through to token metadata
  }
  if (!role) {
    const metaRole = payload?.user_metadata?.role ?? payload?.app_metadata?.role;
    if (metaRole === 'patient' || metaRole === 'doctor' || metaRole === 'researcher') {
      role = metaRole;
      roleSource = 'token-metadata';
    }
  }

  return {
    status: 'ok',
    user: { id, email: payload?.email ?? null, role, roleSource },
  };
}
