// Focused tests for the appointment data flow: booking retention and the
// patient appointment list data layer.
//
// Retention contract (PROBLEM 1): whatever doctor/slot/date the patient picked
// in the booking modal must be exactly what request_appointment sends to the
// database and what fetchMyAppointments reads back — no re-derivation from the
// clock, no generic slot, no doctor swap.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcResults: Record<string, (...args: unknown[]) => unknown> = {};
const appointmentsSelect = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args?: unknown) => rpcResults[fn]?.(args),
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: () => appointmentsSelect(table),
        }),
      }),
    }),
  },
}));

import {
  requestAppointment,
  fetchMyAppointments,
} from '../services/doctorDirectoryService';

beforeEach(() => {
  appointmentsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  rpcResults['request_appointment'] = vi.fn().mockResolvedValue({
    data: 'appt-1',
    error: null,
  });
  delete rpcResults['list_doctor_directory'];
});

describe('booking retention: selected doctor/date/time reach the database unchanged', () => {
  it('sends the selected doctor id to request_appointment', async () => {
    const rpc = rpcResults['request_appointment'] as ReturnType<typeof vi.fn>;
    const result = await requestAppointment({
      doctorId: 'doc-777',
      slot: '14:30',
      consultationType: 'telehealth',
      reason: 'ECG review',
      onDate: '2026-10-02',
    });
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        p_doctor_id: 'doc-777',
      })
    );
  });

  it('sends the exact selected slot (never a default or derived time)', async () => {
    const rpc = rpcResults['request_appointment'] as ReturnType<typeof vi.fn>;
    await requestAppointment({
      doctorId: 'doc-777',
      slot: '09:30',
      consultationType: 'in_person',
      onDate: '2026-10-02',
    });
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        p_slot: '09:30',
      })
    );
  });

  it('sends the exact selected date (never today/tomorrow re-derived)', async () => {
    const rpc = rpcResults['request_appointment'] as ReturnType<typeof vi.fn>;
    await requestAppointment({
      doctorId: 'doc-777',
      slot: '09:30',
      consultationType: 'telehealth',
      onDate: '2026-11-18',
    });
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        p_on_date: '2026-11-18',
      })
    );
  });

  it('surfaces database validation errors instead of swallowing them', async () => {
    rpcResults['request_appointment'] = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'That time slot has already been booked.' },
    });
    const result = await requestAppointment({
      doctorId: 'doc-777',
      slot: '09:30',
      consultationType: 'telehealth',
      onDate: '2026-10-02',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already been booked');
  });
});

describe('fetchMyAppointments: the stored appointment is returned with its doctor', () => {
  it('returns the stored doctor name, specialty, exact start_time and status', async () => {
    appointmentsSelect.mockResolvedValue({
      data: [
        {
          id: 'appt-1',
          patient_id: 'pat-1',
          doctor_id: 'doc-9',
          start_time: '2026-10-02T09:30:00+00:00',
          end_time: '2026-10-02T10:00:00+00:00',
          status: 'scheduled',
          consultation_type: 'telehealth',
          reason: 'ECG review',
          doctors: {
            id: 'doc-9',
            specialty: 'Cardiology',
            users: [{ display_name: 'Dr. Sarah Khan', first_name: null, last_name: null }],
          },
        },
      ],
      error: null,
    });
    const result = await fetchMyAppointments();
    expect(result.ok).toBe(true);
    const [appointment] = result.appointments!;
    expect(appointment.doctorId).toBe('doc-9');
    expect(appointment.doctorName).toBe('Dr. Sarah Khan');
    expect(appointment.doctorSpecialty).toBe('Cardiology');
    expect(appointment.startTime).toBe('2026-10-02T09:30:00+00:00');
    expect(appointment.status).toBe('scheduled');
  });

  it('keeps distinct doctors on distinct appointments (no doctor mix-up)', async () => {
    appointmentsSelect.mockResolvedValue({
      data: [
        {
          id: 'a1',
          doctor_id: 'doc-1',
          start_time: '2026-10-02T09:00:00Z',
          end_time: null,
          status: 'scheduled',
          consultation_type: null,
          reason: null,
          doctors: { id: 'doc-1', specialty: 'Cardiology', users: [{ display_name: 'Dr. One' }] },
        },
        {
          id: 'a2',
          doctor_id: 'doc-2',
          start_time: '2026-10-03T15:00:00Z',
          end_time: null,
          status: 'scheduled',
          consultation_type: null,
          reason: null,
          doctors: { id: 'doc-2', specialty: 'Neurology', users: [{ display_name: 'Dr. Two' }] },
        },
      ],
      error: null,
    });
    const result = await fetchMyAppointments();
    expect(result.appointments!.find((a) => a.id === 'a1')!.doctorName).toBe('Dr. One');
    expect(result.appointments!.find((a) => a.id === 'a2')!.doctorName).toBe('Dr. Two');
  });

  it('falls back to first+last name when display_name is absent', async () => {
    appointmentsSelect.mockResolvedValue({
      data: [
        {
          id: 'a1',
          doctor_id: 'doc-5',
          start_time: '2026-10-02T08:00:00Z',
          end_time: null,
          status: 'completed',
          consultation_type: null,
          reason: null,
          doctors: {
            id: 'doc-5',
            specialty: null,
            users: [{ display_name: null, first_name: 'Sarah', last_name: 'Khan' }],
          },
        },
      ],
      error: null,
    });
    const result = await fetchMyAppointments();
    expect(result.appointments![0].doctorName).toBe('Sarah Khan');
  });

  it('resolves the real doctor name via the directory when the embed is NULL under live RLS', async () => {
    // Under live RLS, patients cannot read doctors/users rows: PostgREST
    // resolves the embed to NULL and the name falls back to 'Doctor'. The
    // data layer must recover the REAL name through the authorized directory
    // RPC instead of shipping the generic label to the UI.
    rpcResults['list_doctor_directory'] = vi.fn().mockResolvedValue({
      data: [
        {
          doctor_id: 'doc-9',
          display_name: 'Dr. Sarah Khan',
          specialty: 'Cardiology',
        },
      ],
      error: null,
    });
    appointmentsSelect.mockResolvedValue({
      data: [
        {
          id: 'a1',
          doctor_id: 'doc-9',
          start_time: '2026-10-02T09:30:00Z',
          end_time: null,
          status: 'scheduled',
          consultation_type: null,
          reason: null,
          doctors: null,
        },
      ],
      error: null,
    });
    const result = await fetchMyAppointments();
    expect(result.ok).toBe(true);
    expect(result.appointments![0].doctorName).toBe('Dr. Sarah Khan');
    expect(result.appointments![0].doctorSpecialty).toBe('Cardiology');
  });

  it('keeps the appointments listed when the directory RPC fails (non-fatal)', async () => {
    rpcResults['list_doctor_directory'] = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rpc down' },
    });
    appointmentsSelect.mockResolvedValue({
      data: [
        {
          id: 'a1',
          doctor_id: 'doc-9',
          start_time: '2026-10-02T09:30:00Z',
          end_time: null,
          status: 'scheduled',
          consultation_type: null,
          reason: null,
          doctors: null,
        },
      ],
      error: null,
    });
    const result = await fetchMyAppointments();
    expect(result.ok).toBe(true);
    expect(result.appointments).toHaveLength(1);
  });

  it('propagates the appointments query error', async () => {
    appointmentsSelect.mockResolvedValue({
      data: null,
      error: { message: 'rls denied' },
    });
    const result = await fetchMyAppointments();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('rls denied');
  });
});
