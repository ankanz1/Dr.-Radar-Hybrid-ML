// Focused unit tests for the patient chat service (Phase 4, Step 2).
// The Supabase client module is mocked, so no network or live project is used.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authGetSession = vi.fn();
const fromSelect = vi.fn();
const insertResult = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => authGetSession(...args) },
    from: (table: string) => ({
      // messages read path: select().eq().order().limit()
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => fromSelect(table),
          }),
        }),
      }),
      // messages insert path: insert().select().single()
      insert: (payload: unknown) => ({
        select: () => ({
          single: () => insertResult(payload),
        }),
      }),
    }),
  },
}));

import {
  getChatSessionUser,
  fetchChatAppointments,
  fetchChatMessages,
  sendChatMessage,
} from '../services/chatService';

const SESSION = { session: { user: { id: 'user-1', email: 'p@t.local' } } };

beforeEach(() => {
  authGetSession.mockReset();
  fromSelect.mockReset();
  insertResult.mockReset();
  insertResult.mockResolvedValue({ data: null, error: null });
  authGetSession.mockResolvedValue({ data: SESSION, error: null });
});

describe('getChatSessionUser', () => {
  it('returns the authenticated session user id', async () => {
    const result = await getChatSessionUser();
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('user-1');
  });

  it('fails closed when there is no session', async () => {
    authGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await getChatSessionUser();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/signed out/i);
  });

  it('surfaces session errors', async () => {
    authGetSession.mockResolvedValue({ data: { session: null }, error: { message: 'boom' } });
    const result = await getChatSessionUser();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
  });
});

describe('fetchChatAppointments', () => {
  it('loads the patient appointment conversations newest first', async () => {
    vi.doMock('../services/doctorDirectoryService', () => ({
      fetchMyAppointments: vi.fn().mockResolvedValue({
        ok: true,
        appointments: [
          { id: 'a-old', startTime: '2026-09-01T10:00:00Z' },
          { id: 'a-new', startTime: '2026-09-20T10:00:00Z' },
        ],
      }),
      fetchDoctorNamesByIds: vi.fn().mockResolvedValue({}),
    }));
    const { fetchChatAppointments: fresh } = await import('../services/chatService');
    const result = await fresh();
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.id).toBe('a-new');
    expect(result.data?.[1]?.id).toBe('a-old');
    vi.doUnmock('../services/doctorDirectoryService');
  });

  it('overlays the doctor display name resolved from the doctor directory data', async () => {
    vi.doMock('../services/doctorDirectoryService', () => ({
      fetchMyAppointments: vi.fn().mockResolvedValue({
        ok: true,
        appointments: [
          // Live RLS leaves the embed NULL -> generic fallback arrives here.
          { id: 'a-1', doctorId: 'doc-9', doctorName: 'Doctor', startTime: '2026-09-20T10:00:00Z' },
        ],
      }),
      fetchDoctorNamesByIds: vi.fn().mockResolvedValue({ 'doc-9': 'Dr. Sarah Khan' }),
    }));
    const { fetchChatAppointments: fresh } = await import('../services/chatService');
    const result = await fresh();
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.doctorName).toBe('Dr. Sarah Khan');
    vi.doUnmock('../services/doctorDirectoryService');
  });

  it('keeps the fallback label when the doctor name is unavailable', async () => {
    vi.doMock('../services/doctorDirectoryService', () => ({
      fetchMyAppointments: vi.fn().mockResolvedValue({
        ok: true,
        appointments: [
          { id: 'a-1', doctorId: 'doc-404', doctorName: 'Doctor', startTime: '2026-09-20T10:00:00Z' },
        ],
      }),
      fetchDoctorNamesByIds: vi.fn().mockResolvedValue({}), // not in the directory
    }));
    const { fetchChatAppointments: fresh } = await import('../services/chatService');
    const result = await fresh();
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.doctorName).toBe('Doctor');
    vi.doUnmock('../services/doctorDirectoryService');
  });

  it('keeps the fallback label when the directory RPC errors (non-fatal)', async () => {
    vi.doMock('../services/doctorDirectoryService', () => ({
      fetchMyAppointments: vi.fn().mockResolvedValue({
        ok: true,
        appointments: [
          { id: 'a-1', doctorId: 'doc-9', doctorName: 'Doctor', startTime: '2026-09-20T10:00:00Z' },
        ],
      }),
      fetchDoctorNamesByIds: vi.fn().mockRejectedValue(new Error('rpc down')),
    }));
    const { fetchChatAppointments: fresh } = await import('../services/chatService');
    const result = await fresh();
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.doctorName).toBe('Doctor');
    vi.doUnmock('../services/doctorDirectoryService');
  });

  it('propagates the appointments error', async () => {
    vi.doMock('../services/doctorDirectoryService', () => ({
      fetchMyAppointments: vi.fn().mockResolvedValue({ ok: false, error: 'nope' }),
      fetchDoctorNamesByIds: vi.fn().mockResolvedValue({}),
    }));
    const { fetchChatAppointments: fresh } = await import('../services/chatService');
    const result = await fresh();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('nope');
    vi.doUnmock('../services/doctorDirectoryService');
  });
});

describe('fetchChatMessages', () => {
  it('loads messages for the selected appointment ordered oldest first', async () => {
    fromSelect.mockResolvedValue({
      data: [
        { id: 'm1', appointment_id: 'a1', sender_user_id: 'user-1', body: 'hi', created_at: '2026-09-27T10:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchChatMessages('a1');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.body).toBe('hi');
  });

  it('fails without an appointment selected', async () => {
    const result = await fetchChatMessages('');
    expect(result.ok).toBe(false);
  });

  it('surfaces load errors', async () => {
    fromSelect.mockResolvedValue({ data: null, error: { message: 'rls denied' } });
    const result = await fetchChatMessages('a1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('rls denied');
  });
});

describe('sendChatMessage', () => {
  it('sends with sender_user_id taken from the authenticated session', async () => {
    insertResult.mockResolvedValue({
      data: { id: 'm9', appointment_id: 'a1', sender_user_id: 'user-1', body: 'hello', created_at: '2026-09-27T11:00:00Z' },
      error: null,
    });
    const result = await sendChatMessage({ appointmentId: 'a1', body: '  hello  ' });
    expect(result.ok).toBe(true);
    // Sender MUST be the session user, never a caller-supplied value.
    expect(insertResult).toHaveBeenCalledWith(expect.objectContaining({
      appointment_id: 'a1',
      sender_user_id: 'user-1',
      body: 'hello',
    }));
  });

  it('rejects blank and whitespace-only messages without any insert', async () => {
    const blank = await sendChatMessage({ appointmentId: 'a1', body: '   ' });
    expect(blank.ok).toBe(false);
    expect(blank.error).toMatch(/empty/i);
    expect(insertResult).not.toHaveBeenCalled();
  });

  it('rejects messages over 4000 characters', async () => {
    const result = await sendChatMessage({ appointmentId: 'a1', body: 'x'.repeat(4001) });
    expect(result.ok).toBe(false);
    expect(insertResult).not.toHaveBeenCalled();
  });

  it('fails closed when signed out', async () => {
    authGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await sendChatMessage({ appointmentId: 'a1', body: 'hi' });
    expect(result.ok).toBe(false);
    expect(insertResult).not.toHaveBeenCalled();
  });

  it('surfaces insert errors (e.g. RLS denial)', async () => {
    insertResult.mockResolvedValue({ data: null, error: { message: '42501 row-level security' } });
    const result = await sendChatMessage({ appointmentId: 'a1', body: 'hi' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('42501');
  });
});
