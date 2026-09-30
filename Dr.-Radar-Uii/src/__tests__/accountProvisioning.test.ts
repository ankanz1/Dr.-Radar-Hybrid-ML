// Account provisioning tests — simple auth.uid()-based contract.
//
// Invariants under test:
// - an active Supabase Auth session is REQUIRED for every write
// - all writes are own-row only, keyed on id/user_id = auth.uid() (RLS-compatible)
// - no email-based lookup or reconciliation of any kind (no RPC, no .eq('email', ...))
// - profile rows (patients/doctors) are created keyed on the authenticated id
// - Supabase errors surface honestly in DEV and safely in production
// - no client-side deletion, merging, re-keying, or cross-user access
//
// Supabase client is mocked; no secrets.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: AUTH_ID, email: EMAIL } } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import {
  provisionAccount,
  syncAccountProvisioning,
  ensurePatientProfileRow,
} from '../services/accountProvisioning';
import { supabase } from '../lib/supabase';

const AUTH_ID = 'auth-uuid-1';
const EMAIL = 'patient@example.com';

const authUser = { id: AUTH_ID, email: EMAIL, user_metadata: {} };

/** Build a supabase-style chainable query mock. */
function chain(result: { data?: unknown; error?: unknown } = {}) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    insert: vi.fn<(payload: Record<string, unknown>) => Promise<{ data: null; error: unknown }>>(
      async () => ({ data: null, error: result.error ?? null })
    ),
    upsert: vi.fn<
      (payload: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ data: null; error: unknown }>
    >(async () => ({ data: null, error: result.error ?? null })),
  };
  return api;
}

/** Chain whose eq() captures its arguments, for asserting own-row scoping. */
function capturingChain(result: { data?: unknown; error?: unknown } = {}) {
  const api = chain(result);
  (api.eq as ReturnType<typeof vi.fn>).mockImplementation((column: string, value: unknown) => {
    (api as unknown as { filters: Array<[string, unknown]> }).filters.push([column, value]);
    return api;
  });
  (api as unknown as { filters: Array<[string, unknown]> }).filters = [];
  return api as ReturnType<typeof chain> & { filters: Array<[string, unknown]> };
}

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  // Default: selects return nothing (missing rows), writes succeed, RPC succeeds.
  fromMock.mockImplementation(() => chain());
  rpcMock.mockResolvedValue({ data: 'patient-row-1', error: null });
  (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { session: { user: authUser } },
  });
});

describe('provisionAccount — new patient', () => {
  it('creates users + patients rows keyed on auth.uid() with onboarding fields', async () => {
    const usersUpsert = chain();
    const patientsUpsert = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? usersUpsert : table === 'patients' ? patientsUpsert : chain()
    );

    const result = await provisionAccount({
      role: 'patient',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: EMAIL,
      dob: '1990-01-01',
      gender: 'Female',
      country: 'Portugal',
      language: 'English (US)',
      avatarUrl: 'https://example.com/a.png',
    });

    expect(result.ok).toBe(true);

    const [usersPayload, usersOptions] = usersUpsert.upsert.mock.calls[0];
    expect(usersPayload).toMatchObject({
      id: AUTH_ID, // the authenticated identity — never a client-chosen value
      email: EMAIL,
      role: 'patient',
      first_name: 'Ada',
      last_name: 'Lovelace',
      display_name: 'Ada Lovelace',
      onboarding_completed: true,
    });
    expect(usersOptions).toEqual({ onConflict: 'id' });

    const [patientsPayload, patientsOptions] = patientsUpsert.upsert.mock.calls[0];
    expect(patientsPayload).toMatchObject({
      user_id: AUTH_ID,
      dob: '1990-01-01',
      gender: 'Female',
      country: 'Portugal',
      language: 'English (US)',
    });
    expect(patientsOptions).toEqual({ onConflict: 'user_id' });
  });

  it('never stores a real password in public.users (sentinel only)', async () => {
    const usersUpsert = chain();
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersUpsert : chain()));

    await provisionAccount({ role: 'patient', firstName: 'Ada', password_hash: 'real-password' } as never);

    const [usersPayload] = usersUpsert.upsert.mock.calls[0];
    expect(usersPayload.password_hash).toBe('supabase-auth-managed');
  });

  it('trims oversized avatar data URLs to NULL (VARCHAR(500) column)', async () => {
    const usersUpsert = chain();
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersUpsert : chain()));

    await provisionAccount({ role: 'patient', avatarUrl: `data:image/png;base64,${'x'.repeat(600)}` });

    const [usersPayload] = usersUpsert.upsert.mock.calls[0];
    expect(usersPayload.avatar_url).toBeNull();
  });
});

describe('provisionAccount — new doctor', () => {
  it('creates users + doctors rows keyed on auth.uid() with NOT NULL defaults', async () => {
    const usersUpsert = chain();
    const doctorsUpsert = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? usersUpsert : table === 'doctors' ? doctorsUpsert : chain()
    );

    const result = await provisionAccount({
      role: 'doctor',
      firstName: 'Dot',
      lastName: 'One',
      professionalRole: 'Cardiologist',
      specialization: 'Electrophysiology',
      organization: 'Heart Institute',
    });

    expect(result.ok).toBe(true);

    const [usersPayload] = usersUpsert.upsert.mock.calls[0];
    expect(usersPayload).toMatchObject({ id: AUTH_ID, role: 'doctor' });

    const [doctorsPayload] = doctorsUpsert.upsert.mock.calls[0];
    expect(doctorsPayload).toMatchObject({
      user_id: AUTH_ID,
      title: 'Cardiologist',
      specialty: 'Electrophysiology',
      hospital: 'Heart Institute',
    });
    expect(doctorsUpsert.upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
  });

  it('falls back to schema-required defaults when doctor fields are empty', async () => {
    const doctorsUpsert = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'doctors' ? doctorsUpsert : chain()
    );

    await provisionAccount({ role: 'doctor', firstName: '', lastName: '' });

    const [doctorsPayload] = doctorsUpsert.upsert.mock.calls[0];
    expect(doctorsPayload.title).toBe('Doctor');
    expect(doctorsPayload.specialty).toBe('General Practice');
  });

  it('never touches the patients table for a doctor account', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'doctors' ? chain() : chain()
    );

    await provisionAccount({ role: 'doctor', firstName: 'Dot' });

    expect(fromMock.mock.calls.map(([t]) => t)).not.toContain('patients');
  });
});

describe('provisionAccount — existing user (own-row update)', () => {
  it('upserts onto the same auth.uid() row — no second user row, no email lookup', async () => {
    const usersUpsert = chain();
    const patientsUpsert = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? usersUpsert : table === 'patients' ? patientsUpsert : chain()
    );

    const result = await provisionAccount({ role: 'patient', firstName: 'Updated' });

    expect(result.ok).toBe(true);
    const [usersPayload] = usersUpsert.upsert.mock.calls[0];
    expect(usersPayload.id).toBe(AUTH_ID); // same application identity
    expect(usersUpsert.upsert).toHaveBeenCalledTimes(1);
  });

  it('reports the real Supabase error in DEV when the users upsert fails', async () => {
    // Force DEV explicitly: ambient NODE_ENV/import.meta.env must not decide
    // which branch of the error contract this test exercises.
    vi.stubEnv('DEV', true);
    const usersUpsert = chain({ error: { code: '23505', message: 'duplicate key value violates unique constraint "users_email_key"' } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersUpsert : chain()));
    try {
      const result = await provisionAccount({ role: 'patient', firstName: 'Ada' });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('23505');
      expect(result.message).toContain('users_email_key');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('shows a safe friendly error in production (no internal details)', async () => {
    vi.stubEnv('DEV', false as unknown as boolean);
    const usersUpsert = chain({ error: { code: 'XX000', message: 'internal detail: schema hash abc123' } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersUpsert : chain()));
    try {
      const result = await provisionAccount({ role: 'patient', firstName: 'Ada' });
      expect(result.ok).toBe(false);
      expect(result.message).not.toContain('XX000');
      expect(result.message).not.toContain('schema hash');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('stops before the profile-table write when the users upsert fails', async () => {
    const usersUpsert = chain({ error: { code: '42501', message: 'row-level security violation' } });
    const patientsUpsert = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? usersUpsert : table === 'patients' ? patientsUpsert : chain()
    );

    const result = await provisionAccount({ role: 'patient', firstName: 'Ada' });

    expect(result.ok).toBe(false);
    expect(patientsUpsert.upsert).not.toHaveBeenCalled();
  });
});

describe('provisionAccount — authenticated session required', () => {
  it('refuses to write anything without an active session', async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    const usersUpsert = chain();
    fromMock.mockImplementation(() => usersUpsert);

    const result = await provisionAccount({ role: 'patient', firstName: 'Sneaky' });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in|session/i);
    expect(usersUpsert.upsert).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('refuses to write when getSession itself errors', async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: null },
      error: { message: 'network down' },
    });
    fromMock.mockImplementation(() => chain());

    const result = await provisionAccount({ role: 'patient' });

    expect(result.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('syncAccountProvisioning — login/OAuth-return flow', () => {
  it('brand-new user: inserts public.users with id = auth.uid() and creates the patients row', async () => {
    const usersTable = capturingChain();
    // First eq-scoped select finds no row → insert path runs.
    usersTable.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    const result = await syncAccountProvisioning(authUser, { role: 'patient', firstName: 'New', lastName: 'User' });

    expect(result.ok).toBe(true);
    const [insertPayload] = usersTable.insert.mock.calls[0];
    expect(insertPayload).toMatchObject({
      id: AUTH_ID,
      email: EMAIL,
      role: 'patient',
      onboarding_completed: false,
    });
    expect(insertPayload.password_hash).toBe('supabase-auth-managed');
    expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile');
  });

  it('brand-new doctor: inserts public.users and never calls the patients RPC', async () => {
    const usersTable = capturingChain();
    usersTable.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    const result = await syncAccountProvisioning(authUser, { role: 'doctor' });

    expect(result.ok).toBe(true);
    expect(usersTable.insert.mock.calls[0][0]).toMatchObject({ id: AUTH_ID, role: 'doctor' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('existing patient: users row found → NO insert, NO profile-data overwrite, patients self-heal preserved', async () => {
    const usersTable = capturingChain({ data: { id: AUTH_ID } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    const result = await syncAccountProvisioning(authUser, { role: 'patient', firstName: 'Existing' });

    expect(result.ok).toBe(true);
    expect(usersTable.insert).not.toHaveBeenCalled(); // existing rows are never modified
    expect(usersTable.upsert).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile');
  });

  it('existing doctor: no table writes at all', async () => {
    const usersTable = capturingChain({ data: { id: AUTH_ID } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    const result = await syncAccountProvisioning(authUser, { role: 'doctor' });

    expect(result.ok).toBe(true);
    expect(usersTable.insert).not.toHaveBeenCalled();
    expect(usersTable.upsert).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('repeated login / StrictMode double-invocation stays idempotent (no unique-violation crash)', async () => {
    const usersTable = capturingChain({ data: null });
    // Insert reports a PK/email collision: the row already exists (concurrent
    // insert). Sync must treat 23505 as benign, not fail the login flow.
    usersTable.insert.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "users_pkey"' } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    const results = await Promise.all([
      syncAccountProvisioning(authUser, { role: 'patient' }),
      syncAccountProvisioning(authUser, { role: 'patient' }),
      syncAccountProvisioning(authUser, { role: 'patient' }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('skips everything without a session and never queries the DB', async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    fromMock.mockImplementation(() => chain());

    const result = await syncAccountProvisioning(authUser, { role: 'patient' });

    expect(result.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('surfaces select errors in DEV and stops before any write', async () => {
    // Force DEV explicitly (see the users-upsert DEV test above).
    vi.stubEnv('DEV', true);
    const usersTable = capturingChain({ error: { code: 'XX000', message: 'connection terminated unexpectedly' } });
    usersTable.maybeSingle.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'connection terminated unexpectedly' } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));
    try {
      const result = await syncAccountProvisioning(authUser, { role: 'patient' });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('XX000');
      expect(usersTable.insert).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('non-collision insert failures fail loudly (honest error, no swallowing)', async () => {
    // Force DEV explicitly (see the users-upsert DEV test above).
    vi.stubEnv('DEV', true);
    const usersTable = capturingChain({ data: null });
    usersTable.maybeSingle.mockResolvedValue({ data: null, error: null });
    usersTable.insert.mockResolvedValue({ data: null, error: { code: '23503', message: 'insert or update on table "users" violates foreign key constraint' } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));
    try {
      const result = await syncAccountProvisioning(authUser, { role: 'patient' });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('23503');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('RPC failure does not sign the user out or clear state (caller decides)', async () => {
    const usersTable = capturingChain({ data: { id: AUTH_ID } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));
    rpcMock.mockResolvedValue({ data: null, error: { code: '23503', message: 'fk violation' } });

    await syncAccountProvisioning(authUser, { role: 'patient' });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('ensurePatientProfileRow', () => {
  it('calls the migration 012 RPC with no client-chosen ids', async () => {
    rpcMock.mockResolvedValue({ data: 'patient-row-1', error: null });

    const id = await ensurePatientProfileRow();

    expect(id).toBe('patient-row-1');
    expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile');
    const calls = rpcMock.mock.calls.filter(([fn]) => fn === 'ensure_patient_profile');
    expect(calls.every(([, args]) => args === undefined)).toBe(true);
  });

  it('returns null without a session and never calls the RPC', async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });

    const id = await ensurePatientProfileRow();

    expect(id).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns null on RPC error instead of throwing', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

    const id = await ensurePatientProfileRow();

    expect(id).toBeNull();
  });
});

describe('security invariants — no email-based lookup or reconciliation', () => {
  let viteEnv: Record<string, string | undefined>;
  beforeAll(() => {
    viteEnv = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  });

  it('the client never locates or re-keys rows by email', async () => {
    const usersTable = capturingChain({ data: null });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));

    await provisionAccount({ role: 'patient', email: 'target@example.com' });
    await syncAccountProvisioning(authUser, { role: 'patient' });

    const allFilters = usersTable.filters;
    // Only own-row id filters are allowed; email is never a lookup key.
    expect(allFilters.every(([col]) => col === 'id')).toBe(true);

    // No identity-reconciliation RPC of any kind is invoked.
    const rpcNames = rpcMock.mock.calls.map(([fn]) => fn);
    expect(rpcNames.every((fn) => fn === 'ensure_patient_profile')).toBe(true);
  });

  it('no client-side delete or update of any row (create/read only, upsert on own id)', async () => {
    const usersTable = capturingChain({ data: { id: AUTH_ID } });
    const patientsTable = chain();
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? usersTable : table === 'patients' ? patientsTable : chain()
    );

    await provisionAccount({ role: 'patient', firstName: 'Ada' });
    await syncAccountProvisioning(authUser, { role: 'patient' });

    const usersApi = usersTable as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(usersApi.delete).toBeUndefined();
    // Any upsert targets only the caller's own id.
    for (const call of usersTable.upsert.mock.calls) {
      expect(call[0].id).toBe(AUTH_ID);
    }
  });

  it('no service-role key anywhere in the frontend env surface', () => {
    const serialized = Object.entries(viteEnv)
      .map(([k, v]) => `${k}=${v ?? ''}`)
      .join('\n');
    expect(serialized).not.toMatch(/SERVICE_ROLE|SUPABASE_SERVICE/i);
    expect(Object.keys(viteEnv).filter((k) => /SUPABASE.*KEY/i.test(k)).every((k) => /PUBLISHABLE|ANON/i.test(k))).toBe(true);
  });

  it('only the RLS-scoped application tables are touched', async () => {
    const usersTable = capturingChain({ data: { id: AUTH_ID } });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain()));
    rpcMock.mockResolvedValue({ data: 'patient-row-1', error: null });

    await provisionAccount({ role: 'patient' });
    await syncAccountProvisioning(authUser, { role: 'patient' });

    const tables = fromMock.mock.calls.map(([t]) => t);
    expect(tables.every((t) => ['users', 'patients', 'doctors'].includes(t as string))).toBe(true);
  });
});
