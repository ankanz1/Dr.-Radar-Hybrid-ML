// Focused unit tests for the doctor-side chat service (Phase 4, Step 3).
// Same mocking pattern as chatService.test.ts (supabase client mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authGetSession = vi.fn();
const fromSelect = vi.fn();
const insertResult = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => authGetSession(...args) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => fromSelect(table),
          }),
        }),
        in: () => ({
          order: () => ({
            limit: () => fromSelect(table),
          }),
        }),
      }),
      insert: (payload: unknown) => ({
        select: () => ({
          single: () => insertResult(payload),
        }),
      }),
    }),
  },
}));

// The doctor conversations path lazily imports the availability service;
// mock it to return the doctor's own appointments (RLS-equivalent).
vi.mock('../services/doctorAvailabilityService', () => ({
  fetchMyDoctorAppointments: vi.fn().mockResolvedValue({
    ok: true,
    appointments: [
      {
        id: 'appt-doc-1',
        patientId: 'patient-1',
        patientName: 'Pat One',
        startTime: '2026-09-28T10:00:00Z',
        endTime: null,
        status: 'scheduled',
        consultationType: 'telehealth',
        reason: null,
      },
      {
        id: 'appt-doc-2',
        patientId: 'patient-2',
        patientName: 'Pat Two',
        startTime: '2026-09-20T10:00:00Z',
        endTime: null,
        status: 'completed',
        consultationType: 'in_person',
        reason: null,
      },
    ],
  }),
}));

import {
  fetchDoctorConversations,
  fetchChatMessages,
  sendChatMessage,
} from '../services/chatService';

const DOCTOR_ID = 'doctor-user-id';

beforeEach(() => {
  authGetSession.mockReset();
  fromSelect.mockReset();
  insertResult.mockReset();
  authGetSession.mockResolvedValue({
    data: { session: { user: { id: DOCTOR_ID, email: 'd@t.local' } } },
    error: null,
  });
});

describe('fetchDoctorConversations', () => {
  it('lists the doctor own appointments as conversations with patient info', async () => {
    fromSelect.mockResolvedValue({ data: [], error: null });
    const result = await fetchDoctorConversations();
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
    // No messages anywhere -> sorted by newest appointment first (Sep 28 > Sep 20).
    expect(result.data?.map((c) => c.patientName)).toEqual(['Pat One', 'Pat Two']);
    expect(result.data?.[0]?.status).toBe('scheduled'); // Pat One's appointment
  });

  it('attaches the latest message preview per appointment', async () => {
    fromSelect.mockResolvedValue({
      data: [
        { id: 'm1', appointment_id: 'appt-doc-1', sender_user_id: 'patient-user-id', body: 'Hello Doctor', created_at: '2026-09-28T09:00:00Z' },
        { id: 'm0', appointment_id: 'appt-doc-2', sender_user_id: DOCTOR_ID, body: 'older thread', created_at: '2026-09-21T09:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchDoctorConversations();
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.latestMessageBody).toBe('Hello Doctor');
    expect(result.data?.[0]?.latestMessageAt).toBe('2026-09-28T09:00:00Z');
  });

  it('keeps conversations with other doctors appointments out of the list', async () => {
    // fetchMyDoctorAppointments (RLS-equivalent) only returns own rows; assert
    // no foreign appointment id can appear in the result.
    fromSelect.mockResolvedValue({
      data: [
        { id: 'mx', appointment_id: 'appt-OTHER-DOCTOR', sender_user_id: 'x', body: 'secret', created_at: '2026-09-28T09:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchDoctorConversations();
    const ids = result.data?.map((c) => c.appointmentId) ?? [];
    expect(ids).not.toContain('appt-OTHER-DOCTOR');
    expect(ids.every((id) => id.startsWith('appt-doc-'))).toBe(true);
  });

  it('propagates appointment load errors', async () => {
    const { fetchMyDoctorAppointments } = await import('../services/doctorAvailabilityService');
    (fetchMyDoctorAppointments as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: 'appointments down',
    });
    const result = await fetchDoctorConversations();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('appointments down');
  });

  it('propagates message preview errors', async () => {
    fromSelect.mockResolvedValue({ data: null, error: { message: 'rls denied' } });
    const result = await fetchDoctorConversations();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('rls denied');
  });
});

describe('doctor message operations', () => {
  it('loads messages for the selected appointment oldest first', async () => {
    fromSelect.mockResolvedValue({
      data: [
        { id: 'm1', appointment_id: 'appt-doc-1', sender_user_id: 'patient-user-id', body: 'Hello Doctor', created_at: '2026-09-28T09:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchChatMessages('appt-doc-1');
    expect(result.ok).toBe(true);
    expect(result.data?.[0]?.body).toBe('Hello Doctor');
  });

  it('sends the doctor reply with sender_user_id from the authenticated session', async () => {
    insertResult.mockResolvedValue({
      data: { id: 'm2', appointment_id: 'appt-doc-1', sender_user_id: DOCTOR_ID, body: 'Hello, I received your message.', created_at: '2026-09-28T09:05:00Z' },
      error: null,
    });
    const result = await sendChatMessage({ appointmentId: 'appt-doc-1', body: '  Hello, I received your message.  ' });
    expect(result.ok).toBe(true);
    expect(insertResult).toHaveBeenCalledWith(expect.objectContaining({
      appointment_id: 'appt-doc-1',
      sender_user_id: DOCTOR_ID,
      body: 'Hello, I received your message.',
    }));
  });

  it('rejects blank doctor messages without any insert', async () => {
    const result = await sendChatMessage({ appointmentId: 'appt-doc-1', body: '   ' });
    expect(result.ok).toBe(false);
    expect(insertResult).not.toHaveBeenCalled();
  });

  it('fails closed when the doctor session is missing', async () => {
    authGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await sendChatMessage({ appointmentId: 'appt-doc-1', body: 'hi' });
    expect(result.ok).toBe(false);
    expect(insertResult).not.toHaveBeenCalled();
  });
});
