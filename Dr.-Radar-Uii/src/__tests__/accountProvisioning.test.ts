// Login-time provisioning tests (syncAccountProvisioning).
// Covers: existing-row skip (no overwrite), new-user insert-if-missing,
// 23505 same-id concurrent race self-heal, 23505 foreign-email conflict honest
// failure, and the patients RPC wiring. Supabase client is mocked; no secrets.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u-1' } } } })) },
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { syncAccountProvisioning, ensurePatientProfileRow } from '../services/accountProvisioning';

const authUser = { id: 'u-1', email: 'patient@example.com', user_metadata: {} };

/** Build a supabase-style chainable query mock. */
function chain(result: { data?: unknown; error?: unknown }) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    upsert: vi.fn(async (..._args: unknown[]) => ({ data: null, error: result.error ?? null })),
  };
  return api;
}

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 'patient-row-1', error: null });
});

describe('syncAccountProvisioning — existing user', () => {
  it('skips the write entirely when the users row exists (no overwrite)', async () => {
    const selectBuilder = chain({ data: { id: 'u-1', onboarding_completed: true } });
    fromMock.mockImplementation(() => selectBuilder);

    const result = await syncAccountProvisioning(authUser, { role: 'patient' });

    expect(result.ok).toBe(true);
    expect(selectBuilder.upsert).not.toHaveBeenCalled();
    // patients self-heal ran for patients (012 behavior preserved)
    expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile');
  });

  it('does not call ensure_patient_profile for doctors', async () => {
    const selectBuilder = chain({ data: { id: 'u-1', onboarding_completed: true } });
    fromMock.mockImplementation(() => selectBuilder);

    await syncAccountProvisioning({ ...authUser }, { role: 'doctor' });

    expect(selectBuilder.upsert).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('syncAccountProvisioning — new user', () => {
  it('inserts the minimal row from trusted auth identity when missing', async () => {
    const selectBuilder = chain({ data: null });
    const insertBuilder = chain({ data: null });
    fromMock.mockImplementation((table: string) => (table === 'users' ? selectBuilder : insertBuilder));

    const result = await syncAccountProvisioning(authUser, {
      role: 'patient', firstName: 'Ada', lastName: 'Lovelace',
    });

    expect(result.ok).toBe(true);
    expect(selectBuilder.upsert).toHaveBeenCalledTimes(1);
    const [payload] = selectBuilder.upsert.mock.calls[0];
    expect(payload).toMatchObject({
      id: 'u-1',
      email: 'patient@example.com',
      role: 'patient',
      onboarding_completed: false,
      profile_completed: false,
    });
  });
});

describe('syncAccountProvisioning — 23505 (unique violation) classification', () => {
  const conflict = { code: '23505', message: 'duplicate key value violates unique constraint "users_email_key"' };

  it('treats a concurrent same-id race as success (row now exists, never overwritten)', async () => {
    // First select (pre-check): missing. Insert: 23505. Race re-select: row exists.
    const missing = chain({ data: null });
    const insertFail = chain({ error: conflict });
    const raced = chain({ data: { id: 'u-1', onboarding_completed: false } });
    let usersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table !== 'users') return chain({ data: null });
      usersCalls += 1;
      return usersCalls === 1 ? missing : usersCalls === 2 ? insertFail : raced;
    });

    const result = await syncAccountProvisioning(authUser, { role: 'patient' });

    expect(result.ok).toBe(true);
    expect(raced.upsert).not.toHaveBeenCalled(); // row was NOT overwritten
    expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile');
  });

  it('fails honestly when the email belongs to a DIFFERENT users row (no bypass, no swallow)', async () => {
    const missing = chain({ data: null });
    const insertFail = chain({ error: conflict });
    const stillMissing = chain({ data: null }); // foreign row is invisible under RLS
    let usersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table !== 'users') return chain({ data: null });
      usersCalls += 1;
      return usersCalls === 1 ? missing : usersCalls === 2 ? insertFail : stillMissing;
    });

    const result = await syncAccountProvisioning(authUser, { role: 'patient' });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/23505|users_email_key|provision failed/i);
    expect(stillMissing.upsert).not.toHaveBeenCalled();
  });

  it('propagates non-23505 insert errors unchanged', async () => {
    // Pre-check select: missing. Insert attempt: 42501 (RLS denial) → must
    // surface as-is, no 23505-style classification, no retry.
    const missing = chain({ data: null });
    const insertFail = chain({ error: { code: '42501', message: 'new row violates row-level security policy' } });
    let usersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table !== 'users') return chain({ data: null });
      usersCalls += 1;
      return usersCalls === 1 ? missing : insertFail;
    });

    const result = await syncAccountProvisioning(authUser, { role: 'patient' });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('42501');
    expect(usersCalls).toBe(2); // pre-check select + failed insert, no race re-select
  });
});

describe('ensurePatientProfileRow', () => {
  it('returns the RPC result and stays a no-op without a session', async () => {
    const { supabase } = await import('../lib/supabase');
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: null },
    });
    expect(await ensurePatientProfileRow()).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
