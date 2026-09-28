// Component tests for the patient chat screen (Phase 4, Step 2).
// chatService is mocked; jsdom + @testing-library/react render the real screen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const chatService = vi.hoisted(() => ({
  getChatSessionUser: vi.fn(),
  fetchChatAppointments: vi.fn(),
  fetchChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock('../services/chatService', () => chatService);
vi.mock('../services/journeyState', () => ({
  saveJourneyResume: vi.fn(),
  clearJourneyResume: vi.fn(),
}));

import { AppointmentChatScreen } from '../components/AppointmentChatScreen';

const APPOINTMENTS = [
  {
    id: 'appt-1',
    doctorId: 'doc-1',
    doctorName: 'Dr. One',
    doctorSpecialty: 'Cardiology',
    startTime: '2026-09-28T10:00:00Z',
    endTime: null,
    status: 'scheduled' as const,
    consultationType: 'telehealth' as const,
    reason: null,
  },
  {
    id: 'appt-2',
    doctorId: 'doc-2',
    doctorName: 'Dr. Two',
    doctorSpecialty: 'Cardiology',
    startTime: '2026-09-20T09:00:00Z',
    endTime: null,
    status: 'completed' as const,
    consultationType: 'follow_up' as const,
    reason: null,
  },
];

const MY_ID = 'patient-user-id';

beforeEach(() => {
  vi.clearAllMocks();
  chatService.getChatSessionUser.mockResolvedValue({
    ok: true,
    data: { id: MY_ID, email: 'p@t.local' },
  });
});

describe('AppointmentChatScreen', () => {
  it('shows the no-conversations empty state when the patient has no appointments', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/No appointment conversations yet/i)).toBeInTheDocument();
    });
  });

  it('shows the conversations error state with retry', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: false, error: 'network down' });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load your conversations/i)).toBeInTheDocument();
      expect(screen.getByText('network down')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows the messages empty state for an appointment with no messages', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Start the conversation with your doctor/i)).toBeInTheDocument();
    });
  });

  it('shows the messages error state', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: false, error: 'rls denied' });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load messages/i)).toBeInTheDocument();
      expect(screen.getByText('rls denied')).toBeInTheDocument();
    });
  });

  it('displays the doctor name in the conversation list and chat header', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({
      ok: true,
      data: [{ ...APPOINTMENTS[0], doctorName: 'Dr. Sarah Khan' }],
    });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      // Doctor name comes from the appointment/doctor data via the service —
      // shown in the conversation list AND the chat header ("Appointment Chat").
      expect(screen.getAllByText('Dr. Sarah Khan').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Appointment Chat/i)).toBeInTheDocument();
    });
  });

  it('opens the exact appointment conversation when given initialAppointmentId (card deep-link)', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} initialAppointmentId="appt-2" />);
    await waitFor(() => {
      // The deep-linked conversation's header shows the SECOND appointment's doctor
      // ('Dr. Two' appears in the list and in the chat header).
      expect(screen.getAllByText('Dr. Two').length).toBeGreaterThanOrEqual(2);
      // And the message query was issued for THAT appointment only.
      expect(chatService.fetchChatMessages).toHaveBeenCalledWith('appt-2');
    });
  });

  it('falls back to the most recent conversation when the deep-linked appointment is unavailable', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} initialAppointmentId="appt-missing" />);
    await waitFor(() => {
      expect(chatService.fetchChatMessages).not.toHaveBeenCalledWith('appt-missing');
      expect(chatService.fetchChatMessages).toHaveBeenCalledWith('appt-1');
    });
  });

  it('falls back to the generic label when the doctor name is unavailable', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({
      ok: true,
      data: [{ ...APPOINTMENTS[0], doctorName: 'Doctor', doctorSpecialty: null }],
    });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByText('Doctor').length).toBeGreaterThan(0);
      expect(screen.getByText(/Appointment Chat • Consultation/i)).toBeInTheDocument();
      expect(screen.queryByText(/Dr\. Sarah Khan/)).not.toBeInTheDocument();
    });
  });

  it('renders messages and distinguishes patient vs doctor senders with timestamps', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({
      ok: true,
      data: [
        { id: 'm1', appointmentId: 'appt-1', senderUserId: MY_ID, body: 'Hello doctor', createdAt: '2026-09-28T09:00:00Z' },
        { id: 'm2', appointmentId: 'appt-1', senderUserId: 'doctor-user-id', body: 'Hello patient', createdAt: '2026-09-28T09:05:00Z' },
      ],
    });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Hello doctor')).toBeInTheDocument();
      expect(screen.getByText('Hello patient')).toBeInTheDocument();
    });
    // Own messages are labeled You; the doctor's bubbles carry the doctor name
    // (which also appears in the conversation list + chat header).
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getAllByText('Dr. One').length).toBeGreaterThan(1);
  });

  it('sends a typed message and clears the composer on success', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    chatService.sendChatMessage.mockResolvedValue({
      ok: true,
      data: { id: 'm3', appointmentId: 'appt-1', senderUserId: MY_ID, body: 'Hi doc', createdAt: '2026-09-28T10:00:00Z' },
    });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Message Dr\. One/i);
    fireEvent.change(input, { target: { value: 'Hi doc' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(chatService.sendChatMessage).toHaveBeenCalledWith({
        appointmentId: 'appt-1',
        body: 'Hi doc',
      });
      expect(screen.getByText('Hi doc')).toBeInTheDocument();
    });
  });

  it('rejects blank messages: send stays disabled and no service call is made', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Message Dr\. One/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Message Dr\. One/i);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(chatService.sendChatMessage).not.toHaveBeenCalled();
  });

  it('surfaces send failures without clearing the draft', async () => {
    chatService.fetchChatAppointments.mockResolvedValue({ ok: true, data: APPOINTMENTS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    chatService.sendChatMessage.mockResolvedValue({ ok: false, error: '42501 denied' });
    render(<AppointmentChatScreen onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Message Dr\. One/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Message Dr\. One/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText('42501 denied')).toBeInTheDocument();
    });
    expect((input as HTMLTextAreaElement).value).toBe('Hello');
  });
});
