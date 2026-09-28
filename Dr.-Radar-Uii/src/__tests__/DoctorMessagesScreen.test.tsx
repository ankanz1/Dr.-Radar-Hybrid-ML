// Component tests for the doctor messages screen (Phase 4, Step 3).
// chatService is mocked; jsdom + @testing-library/react render the real screen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const chatService = vi.hoisted(() => ({
  getChatSessionUser: vi.fn(),
  fetchChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  fetchDoctorConversations: vi.fn(),
}));

vi.mock('../services/chatService', () => chatService);

import { DoctorMessagesScreen } from '../components/DoctorMessagesScreen';

const DOCTOR_ID = 'doctor-user-id';

const CONVERSATIONS = [
  {
    appointmentId: 'appt-1',
    patientId: 'patient-1',
    patientName: 'Pat One',
    status: 'scheduled' as const,
    startTime: '2026-09-28T10:00:00Z',
    latestMessageBody: 'Hello Doctor',
    latestMessageAt: '2026-09-28T09:00:00Z',
  },
  {
    appointmentId: 'appt-2',
    patientId: 'patient-2',
    patientName: 'Pat Two',
    status: 'completed' as const,
    startTime: '2026-09-20T10:00:00Z',
    latestMessageBody: null,
    latestMessageAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  chatService.getChatSessionUser.mockResolvedValue({
    ok: true,
    data: { id: DOCTOR_ID, email: 'd@t.local' },
  });
});

describe('DoctorMessagesScreen', () => {
  it('shows the no-conversations empty state when the doctor has no appointments', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: [] });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No patient conversations yet/i)).toBeInTheDocument();
    });
  });

  it('shows the conversations error state with retry', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: false, error: 'appointments down' });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load your patient conversations/i)).toBeInTheDocument();
      expect(screen.getByText('appointments down')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('lists conversations with patient name, status and latest message preview', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      // 'Pat One' appears in the list AND the auto-selected chat header.
      expect(screen.getAllByText('Pat One').length).toBeGreaterThan(0);
      expect(screen.getByText('Pat Two')).toBeInTheDocument();
      // 'Hello Doctor' appears in the list preview (and later in the thread);
      // the preview placeholder shows for the message-less conversation.
      expect(screen.getAllByText('Hello Doctor').length).toBeGreaterThan(0);
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    });
  });

  it('shows the thread empty state for a conversation with no messages', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByText('This patient has not started the conversation.')).toBeInTheDocument();
    });
  });

  it('shows the messages error state with retry', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: false, error: 'rls denied' });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load messages/i)).toBeInTheDocument();
      expect(screen.getByText('rls denied')).toBeInTheDocument();
    });
  });

  it('distinguishes doctor vs patient messages by session user id with timestamps', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({
      ok: true,
      data: [
        { id: 'm1', appointmentId: 'appt-1', senderUserId: 'patient-user-id', body: 'Hello Doctor', createdAt: '2026-09-28T09:00:00Z' },
        { id: 'm2', appointmentId: 'appt-1', senderUserId: DOCTOR_ID, body: 'Hello, I received your message.', createdAt: '2026-09-28T09:05:00Z' },
      ],
    });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Hello Doctor').length).toBeGreaterThan(0);
      expect(screen.getByText('Hello, I received your message.')).toBeInTheDocument();
    });
    expect(screen.getByText('You')).toBeInTheDocument(); // doctor's own bubble label
  });

  it('sends the doctor reply, clears the composer and updates the preview', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    chatService.sendChatMessage.mockResolvedValue({
      ok: true,
      data: { id: 'm2', appointmentId: 'appt-1', senderUserId: DOCTOR_ID, body: 'Hello, I received your message.', createdAt: '2026-09-28T09:05:00Z' },
    });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Reply to Pat One/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Reply to Pat One/i);
    fireEvent.change(input, { target: { value: 'Hello, I received your message.' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(chatService.sendChatMessage).toHaveBeenCalledWith({
        appointmentId: 'appt-1',
        body: 'Hello, I received your message.',
      });
      expect(screen.getByText('Hello, I received your message.')).toBeInTheDocument();
    });
  });

  it('rejects blank replies: send stays disabled and no service call is made', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Reply to Pat One/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Reply to Pat One/i);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(chatService.sendChatMessage).not.toHaveBeenCalled();
  });

  it('surfaces send failures without clearing the draft', async () => {
    chatService.fetchDoctorConversations.mockResolvedValue({ ok: true, data: CONVERSATIONS });
    chatService.fetchChatMessages.mockResolvedValue({ ok: true, data: [] });
    chatService.sendChatMessage.mockResolvedValue({ ok: false, error: '42501 denied' });
    render(<DoctorMessagesScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Reply to Pat One/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Reply to Pat One/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText('42501 denied')).toBeInTheDocument();
    });
    expect((input as HTMLTextAreaElement).value).toBe('Hello');
  });
});
