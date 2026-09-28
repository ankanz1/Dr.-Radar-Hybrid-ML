// Step 2 tests: assistant authentication + honest failure + no demo identity.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authGetSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => authGetSession(...args) },
  },
}));

import { askAssistantChat, detectUrgentSymptoms } from '../services/clinicalAssistantEngine';
import type { AssistantMessage } from '../types/assistant';

const HISTORY: AssistantMessage[] = [];

beforeEach(() => {
  authGetSession.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated assistant requests', () => {
  it('sends the Supabase access token as Authorization: Bearer', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'sb-token-abc' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'answer' }),
    });

    await askAssistantChat({ message: 'hello', history: HISTORY });

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/assistant/chat');
    expect(init.headers.Authorization).toBe('Bearer sb-token-abc');
  });

  it('never sends a client-chosen userId in the request body', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'answer' }),
    });

    await askAssistantChat({
      message: 'hi',
      history: HISTORY,
      // even if a caller attempts to smuggle extra fields, the body is built by the engine
      ...( { fakeUserId: 'USR-999' } as object),
    });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('sender_user_id');
    expect(body.fakeUserId).toBeUndefined();
    // Only the advisory fields the engine deliberately sends (role/context are
    // omitted by JSON when undefined) — never an identity field.
    expect(Object.keys(body).every((k) => ['message', 'role', 'context', 'history'].includes(k))).toBe(true);
    expect(Object.keys(body)).toContain('message');
  });

  it('contains no hardcoded demo identity (Ashton/PT-9042/ECG-0248)', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'answer' }),
    });

    await askAssistantChat({ message: 'hi', history: HISTORY });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const raw = init.body as string;
    expect(raw).not.toContain('Ashton');
    expect(raw).not.toContain('PT-9042');
    expect(raw).not.toContain('ECG-0248');
  });

  it('treats the role as advisory only (body role is not trusted identity)', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'answer' }),
    });

    await askAssistantChat({ message: 'hi', role: 'doctor', history: HISTORY });
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    // role may be sent as advisory metadata; the server resolves the real one
    expect(body.role).toBe('doctor');
  });
});

describe('unauthenticated / failing requests', () => {
  it('does NOT call the API and reports sign-in required when there is no session', async () => {
    authGetSession.mockResolvedValue({ data: { session: null } });

    await expect(askAssistantChat({ message: 'hi', history: HISTORY })).rejects.toMatchObject({
      code: 'signed-out',
      message: expect.stringMatching(/sign in/i),
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does NOT call the API when the session lacks an access token', async () => {
    authGetSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });

    await expect(askAssistantChat({ message: 'hi', history: HISTORY })).rejects.toMatchObject({
      code: 'signed-out',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns the honest unavailable message when the server rejects (401)', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'expired' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 401 });

    await expect(askAssistantChat({ message: 'hi', history: HISTORY })).rejects.toMatchObject({
      code: 'signed-out',
      message: expect.stringMatching(/sign in/i),
    });
  });

  it('returns the honest unavailable message when Gemini/server fails (500)', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

    await expect(askAssistantChat({ message: 'hi', history: HISTORY })).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Dr. Radar Assistant is temporarily unavailable. Please try again.',
    });
  });

  it('returns the honest unavailable message on network failure', async () => {
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(askAssistantChat({ message: 'hi', history: HISTORY })).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('never fabricates medical data in any failure mode', async () => {
    authGetSession.mockResolvedValue({ data: { session: null } });
    await expect(askAssistantChat({ message: 'what is my ECG finding?', history: HISTORY })).rejects.toThrow(
      /sign in/i
    );
    // The old canned engine fabricated confidence values; assert nothing like that exists.
    authGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u-1' }, access_token: 'tok' } },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });
    await expect(askAssistantChat({ message: 'what is my ECG finding?', history: HISTORY })).rejects.toThrow(
      'Dr. Radar Assistant is temporarily unavailable. Please try again.'
    );
  });
});

describe('preserved emergency triage', () => {
  it('still returns the emergency response without any network call or session', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
    const result = await askAssistantChat({
      message: 'I have crushing chest pain right now',
      history: HISTORY,
    });
    expect(result.structured?.isUrgent).toBe(true);
    expect(result.text).toContain('emergency');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(detectUrgentSymptoms('severe shortness of breath')).toBe(true);
  });
});
