// Tests for the Chat buttons on the patient appointments screen cards.
// NOTE: the icon <span> contributes its icon name to the accessible name
// ("chat Chat"), so the tests target the deterministic per-appointment ids.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/doctorDirectoryService', () => ({
  fetchMyAppointments: vi.fn(),
}));
vi.mock('../services/journeyState', () => ({
  saveJourneyResume: vi.fn(),
  clearJourneyResume: vi.fn(),
}));

import { PatientJourneyAppointmentsScreen } from '../components/PatientJourneyAppointmentsScreen';
import { fetchMyAppointments } from '../services/doctorDirectoryService';

const APPOINTMENTS = [
  {
    id: 'appt-aaa',
    doctorId: 'doc-1',
    doctorName: 'Dr. Sarah Khan',
    doctorSpecialty: 'Cardiology',
    startTime: '2026-09-30T10:00:00Z',
    endTime: null,
    status: 'scheduled' as const,
    consultationType: 'telehealth' as const,
    reason: 'Review my ECG',
  },
  {
    id: 'appt-bbb',
    doctorId: 'doc-2',
    doctorName: 'Dr. Other',
    doctorSpecialty: 'Cardiology',
    startTime: '2026-09-01T09:00:00Z',
    endTime: null,
    status: 'completed' as const,
    consultationType: null,
    reason: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (fetchMyAppointments as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    appointments: APPOINTMENTS,
  });
});

const chatButtonOf = (container: HTMLElement, appointmentId: string) =>
  container.querySelector<HTMLButtonElement>(`#appointment-chat-${appointmentId}`);

describe('PatientJourneyAppointmentsScreen Chat buttons', () => {
  it('renders a Chat button for every appointment card (upcoming + past)', async () => {
    const { container } = render(
      <PatientJourneyAppointmentsScreen onNavigate={() => {}} onOpenChat={() => {}} />
    );
    await waitFor(() => {
      expect(chatButtonOf(container, 'appt-aaa')).toBeTruthy();
      expect(chatButtonOf(container, 'appt-bbb')).toBeTruthy();
    });
    expect(chatButtonOf(container, 'appt-aaa')!.textContent).toContain('Chat');
    expect(chatButtonOf(container, 'appt-bbb')!.textContent).toContain('Chat');
  });

  it('passes the FIRST appointment id when its Chat button is clicked', async () => {
    const onOpenChat = vi.fn();
    const { container } = render(
      <PatientJourneyAppointmentsScreen onNavigate={() => {}} onOpenChat={onOpenChat} />
    );
    await waitFor(() => {
      expect(chatButtonOf(container, 'appt-aaa')).toBeTruthy();
    });
    fireEvent.click(chatButtonOf(container, 'appt-aaa')!);
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpenChat).toHaveBeenCalledWith('appt-aaa');
  });

  it('passes the SECOND appointment id when its Chat button is clicked', async () => {
    const onOpenChat = vi.fn();
    const { container } = render(
      <PatientJourneyAppointmentsScreen onNavigate={() => {}} onOpenChat={onOpenChat} />
    );
    await waitFor(() => {
      expect(chatButtonOf(container, 'appt-bbb')).toBeTruthy();
    });
    fireEvent.click(chatButtonOf(container, 'appt-bbb')!); // past section row
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpenChat).toHaveBeenCalledWith('appt-bbb');
  });

  it('does not navigate by itself (navigation is App wiring, not the button)', async () => {
    const onNavigate = vi.fn();
    const onOpenChat = vi.fn();
    const { container } = render(
      <PatientJourneyAppointmentsScreen onNavigate={onNavigate} onOpenChat={onOpenChat} />
    );
    await waitFor(() => {
      expect(chatButtonOf(container, 'appt-aaa')).toBeTruthy();
    });
    fireEvent.click(chatButtonOf(container, 'appt-aaa')!);
    expect(onOpenChat).toHaveBeenCalledWith('appt-aaa');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('preserves the existing appointment card information', async () => {
    const { container } = render(
      <PatientJourneyAppointmentsScreen onNavigate={() => {}} onOpenChat={() => {}} />
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Dr. Sarah Khan');
      expect(container.textContent).toContain('Cardiology');
      expect(container.textContent).toContain('Review my ECG');
      expect(container.textContent).toContain('Scheduled');
      expect(container.textContent).toContain('telehealth');
      expect(container.textContent).toContain('Chat');
    });
  });
});
