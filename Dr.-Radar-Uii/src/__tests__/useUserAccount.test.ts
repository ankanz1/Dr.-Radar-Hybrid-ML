// useUserAccount regression tests for the login-bounce (409 limbo) and
// ghost-dashboard bugs.
//
// Bug 1 (login bounce): login-time provisioning failing (e.g. 23505
// users_email_key) must NOT sign the user out — Supabase Auth is the source of
// truth — and DB-derived onboarding state must still apply when the row is
// readable.
//
// Bug 2 (ghost dashboard): the persist effect seeds localStorage with
// DEFAULT_USER (onboardingCompleted: true, email: '') on mount, so any
// pre-auth "signed-out" decision that trusted that stored blob made fresh
// visitors land on a phantom dashboard. Two guards are under test here:
// the sessionLoaded gate (no routing decisions before getSession() resolves)
// and the no-real-email ghost guard (no email → always onboarding).
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Captures the onAuthStateChange callback so tests can fire auth events
// (SIGNED_IN on OAuth return) exactly like the real Supabase client does.
const authState = vi.hoisted(() => ({
  handler: undefined as undefined | ((event: string, session: { user: { id: string; email: string } | null }) => void),
}));

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb: (event: string, session: { user: { id: string; email: string } | null }) => void) => {
        authState.handler = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { useUserAccount } from '../hooks/useUserAccount';
import { supabase } from '../lib/supabase';

/** Supabase-style chainable query builder mock. */
function chain(result: { data?: unknown; error?: unknown }) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    upsert: vi.fn(async () => ({ data: null, error: result.error ?? null })),
  };
  return api;
}

const getSessionMock = () => supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  localStorage.removeItem('dr_radar_onboarding_step_v2');
  fromMock.mockReset();
  rpcMock.mockReset();
  // Default RPC behavior: ensure_patient_profile (migration 012 patients
  // self-heal) resolves with a patient id. There is no identity-reconciliation
  // RPC anymore — sync locates rows only via auth.uid().
  rpcMock.mockImplementation(() => Promise.resolve({ data: 'patient-row-1', error: null }));
  getSessionMock().mockReset();
  getSessionMock().mockResolvedValue({ data: { session: null } });
  (supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as unknown as MockInstance).mockRestore();
});

describe('useUserAccount — ghost-dashboard guard', () => {
  it('a signed-out visitor with a ghost stored account (no email) always sees onboarding', async () => {
    // What the persist effect seeds on mount: DEFAULT_USER with
    // onboardingCompleted: true and NO email identity.
    localStorage.setItem(
      'dr_radar_account_v2',
      JSON.stringify({
        userId: 'USR-00000',
        email: '',
        role: 'patient',
        onboardingCompleted: true,
        profileCompleted: true,
      })
    );

    const { result } = renderHook(() => useUserAccount());

    // Initial state trusts the stored blob (onboardingCompleted: true → false);
    // once the session resolves signed-out, the ghost guard must flip it back.
    // Pre-fix it stayed false → phantom dashboard for fresh visitors.
    await waitFor(() => expect(result.current.isOnboardingActive).toBe(true));
  });

  it('never decides routing before the initial getSession() resolves (sessionLoaded gate)', async () => {
    let resolveSession!: (v: { data: { session: { user: { id: string; email: string } | null } } }) => void;
    getSessionMock().mockImplementation(
      () => new Promise((resolve) => { resolveSession = resolve; })
    );

    // No stored account at all: DEFAULT_USER is seeded to localStorage by the
    // persist effect on mount. The pre-auth effect must ignore it.
    const { result } = renderHook(() => useUserAccount());

    // While the session is unknown, no pre-auth decision has flipped onboarding
    // off even though localStorage now claims onboardingCompleted: true.
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isOnboardingActive).toBe(true);
    expect(JSON.parse(localStorage.getItem('dr_radar_account_v2')!).onboardingCompleted).toBe(true);

    // Session resolves signed-out → ghost guard keeps onboarding active.
    await act(async () => { resolveSession({ data: { session: null } }); });
    expect(result.current.isOnboardingActive).toBe(true);
  });

  it('a signed-out visitor with a real stored completed account keeps the dashboard', async () => {
    localStorage.setItem(
      'dr_radar_account_v2',
      JSON.stringify({
        userId: 'USR-12345',
        email: 'real.user@example.com',
        role: 'patient',
        onboardingCompleted: true,
        profileCompleted: true,
      })
    );
    let resolveSession!: (v: { data: { session: null } }) => void;
    getSessionMock().mockImplementation(
      () => new Promise((resolve) => { resolveSession = resolve; })
    );

    const { result } = renderHook(() => useUserAccount());
    expect(result.current.isOnboardingActive).toBe(false);

    // Resolve signed-out: the guard runs, sees a REAL account identity (email
    // present, onboardingCompleted) and must NOT clobber the dashboard state.
    await act(async () => {
      resolveSession({ data: { session: null } });
      await Promise.resolve();
    });
    expect(result.current.isOnboardingActive).toBe(false);
  });
});

describe('useUserAccount — login-time provisioning', () => {
  const sessionUser = { id: 'u-1', email: 'patient@example.com' };

  function mockOwnRow(row: { role?: string; onboarding_completed?: boolean } | null) {
    // users table select (sync pre-check AND fetchOwnUsersRow) returns the
    // given row; every other table gets a fresh chain (only needed if sync
    // actually inserts).
    fromMock.mockImplementation((table: string) =>
      table === 'users' ? chain({ data: row }) : chain({ data: null })
    );
  }

  function signedInSession() {
    getSessionMock().mockResolvedValue({
      data: { session: { user: sessionUser } },
    });
  }

  it('stays authenticated when provisioning fails (no sign-out, no session wipe)', async () => {
    signedInSession();
    // The login-time sync itself fails (e.g. DB outage while reading/writing
    // public.users) — sync surfaces the failure honestly; the session must
    // stand. The failing mock must be durable (not mockResolvedValueOnce): the
    // hook's post-sync effect calls fetchOwnUsersRow after this test
    // completes, and a reset mock returning undefined would raise an unhandled
    // rejection there.
    const usersTable = chain({ data: null });
    (usersTable.maybeSingle as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'connection terminated unexpectedly' } })
      .mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation((table: string) => (table === 'users' ? usersTable : chain({ data: null })));

    const { result } = renderHook(() => useUserAccount());

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[account] login-time provisioning failed:',
        expect.stringContaining('public.users select failed')
      )
    );

    // Supabase Auth is the source of truth: the failure is surfaced but the
    // session STANDS — no forced sign-out, no state wipe.
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.supabaseSession?.user?.id).toBe('u-1');
    // And the visitor is never parked on a phantom dashboard either.
    expect(result.current.isOnboardingActive).toBe(true);
  });

  it('applies DB-derived onboarding state when the users row is readable', async () => {
    signedInSession();
    // sync pre-check finds the row → insert-if-missing skips the write;
    // fetchOwnUsersRow reports onboarding already completed.
    mockOwnRow({ role: 'doctor', onboarding_completed: true });

    const { result } = renderHook(() => useUserAccount());

    await waitFor(() => expect(result.current.isOnboardingActive).toBe(false));
    expect(result.current.user.onboardingCompleted).toBe(true);
    expect(result.current.user.role).toBe('doctor');
    expect(result.current.currentStep).toBe('completed');
  });

  it('resumes onboarding when the DB says onboarding is incomplete (DB wins over localStorage)', async () => {
    signedInSession();
    // localStorage lies (DEFAULT_USER leak claims completed); DB is authoritative.
    localStorage.setItem(
      'dr_radar_account_v2',
      JSON.stringify({ userId: 'USR-00000', email: '', onboardingCompleted: true })
    );
    // A stale 'completed' step has no render branch in OnboardingFlow.
    localStorage.setItem('dr_radar_onboarding_step_v2', 'completed');
    mockOwnRow({ role: 'patient', onboarding_completed: false });

    const { result } = renderHook(() => useUserAccount());

    await waitFor(() => expect(result.current.isOnboardingActive).toBe(true));
    expect(result.current.user.onboardingCompleted).toBe(false);
    expect(result.current.currentStep).toBe('role-selection');
  });

  it('syncs exactly once per session (INITIAL_SESSION + SIGNED_IN deduped by user id)', async () => {
    signedInSession();
    mockOwnRow({ role: 'patient', onboarding_completed: true });

    const { result } = renderHook(() => useUserAccount());

    // The ensure_patient_profile RPC fires from inside the login-time sync —
    // a reliable "sync ran" marker. (user.onboardingCompleted is
    // DEFAULT-true, so waiting on it would race the async effect and pass
    // before sync runs.)
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('ensure_patient_profile'));

    const countUserQueries = () => fromMock.mock.calls.filter(([t]) => t === 'users').length;
    const initialCount = countUserQueries();
    expect(initialCount).toBeGreaterThan(0);

    // OAuth redirect landing: the client fires SIGNED_IN with the same user on
    // top of INITIAL_SESSION — syncHandledRef must dedupe (one sync per id).
    await act(async () => {
      authState.handler?.('SIGNED_IN', { user: sessionUser });
      await Promise.resolve();
    });

    expect(countUserQueries()).toBe(initialCount);
    expect(result.current.user.onboardingCompleted).toBe(true);
  });
});
