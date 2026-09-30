import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenTab } from '../types';
import type { AppointmentView } from '../services/doctorDirectoryService';
import { saveJourneyResume, clearJourneyResume } from '../services/journeyState';
import {
  fetchChatAppointments,
  fetchChatMessages,
  sendChatMessage,
  getChatSessionUser,
  ChatMessage,
} from '../services/chatService';
import { formatAppointmentWhen } from '../lib/appointmentTime';

/**
 * Patient Chat (Phase 4, Step 2) — appointment-scoped messaging.
 *
 * Left: the signed-in patient's appointment conversations (reuse of the
 * EXISTING patient appointment query — the appointment is the authorization
 * scope; no separate conversation table exists). Right: the message timeline
 * for the selected appointment with a composer.
 *
 * Every read/write goes through chatService -> Supabase with the signed-in
 * session; the sender id is always the authenticated user (never chosen by
 * the UI) and RLS authorizes both directions. Realtime is intentionally out
 * of scope (Step 4); the timeline refreshes on open/send and via Refresh.
 */

interface AppointmentChatScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  /** Optional deep-link: appointment to pre-select when opened from a card Chat button. */
  initialAppointmentId?: string | null;
}

type ConversationsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; appointments: AppointmentView[] };

type MessagesState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; messages: ChatMessage[] };

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = new Date().toDateString() === date.toDateString();
  return date.toLocaleString(undefined, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<AppointmentView['status'], string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

export const AppointmentChatScreen: React.FC<AppointmentChatScreenProps> = ({ onNavigate, initialAppointmentId }) => {
  const [conversations, setConversations] = useState<ConversationsState>({ phase: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagesState>({ phase: 'idle' });
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveJourneyResume('journey-messages');
    return () => clearJourneyResume();
  }, []);

  // Sender identity comes from the authenticated session only.
  useEffect(() => {
    let cancelled = false;
    void getChatSessionUser().then((result) => {
      if (!cancelled && result.ok && result.data) setMyUserId(result.data.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadConversations = useCallback(async () => {
    setConversations({ phase: 'loading' });
    const result = await fetchChatAppointments();
    if (result.ok && result.data) {
      setConversations({ phase: 'ready', appointments: result.data });
      setSelectedId((current) => {
        // Deep-link from an appointment card's Chat button wins; otherwise
        // keep any current selection, else default to the first conversation.
        if (initialAppointmentId && result.data!.some((a) => a.id === initialAppointmentId)) {
          return initialAppointmentId;
        }
        return current ?? result.data![0]?.id ?? null;
      });
    } else {
      setConversations({ phase: 'error', message: result.error ?? 'Unknown error' });
    }
  }, [initialAppointmentId]);

  const loadMessages = useCallback(async (appointmentId: string) => {
    setMessages({ phase: 'loading' });
    const result = await fetchChatMessages(appointmentId);
    if (result.ok && result.data) {
      setMessages({ phase: 'ready', messages: result.data });
    } else {
      setMessages({ phase: 'error', message: result.error ?? 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages({ phase: 'idle' });
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // Deep-link fallback: if the requested appointment is not in the loaded
  // list (transient RLS/load glitch), clear the deep-link so the normal
  // default selection (most recent conversation) applies.
  useEffect(() => {
    if (!initialAppointmentId || conversations.phase !== 'ready') return;
    const exists = conversations.appointments.some((a) => a.id === initialAppointmentId);
    if (!exists && selectedId === initialAppointmentId) {
      setSelectedId(conversations.appointments[0]?.id ?? null);
    }
  }, [initialAppointmentId, conversations, selectedId]);

  // Keep the newest message in view after each load/send.
  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const selected = conversations.phase === 'ready'
    ? conversations.appointments.find((a) => a.id === selectedId) ?? null
    : null;

  const canSend = Boolean(selectedId) && draft.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!selectedId) return;
    const body = draft.trim();
    if (!body || sending) return; // never send blank/whitespace-only messages
    setSendError(null);
    setSending(true);
    const result = await sendChatMessage({ appointmentId: selectedId, body });
    if (result.ok && result.data) {
      setDraft('');
      setMessages((prev) =>
        prev.phase === 'ready'
          ? { phase: 'ready', messages: [...prev.messages, result.data!] }
          : prev
      );
    } else {
      setSendError(result.error ?? 'Could not send your message.');
    }
    setSending(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Messages</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Chat with your doctor about a specific appointment. Every conversation stays private between you and your care team.
        </p>
      </div>

      {/* Conversations loading */}
      {conversations.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading your conversations…
        </div>
      )}

      {/* Conversations error */}
      {conversations.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-2" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            Could not load your conversations
          </div>
          <p className="font-mono">{conversations.message}</p>
          <button
            onClick={() => void loadConversations()}
            className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty: no appointment conversations at all */}
      {conversations.phase === 'ready' && conversations.appointments.length === 0 && (
        <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">chat</span>
          </div>
          <p className="text-sm font-bold text-[#101c28]">No appointment conversations yet.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Book an appointment with a doctor to start chatting about your care.
          </p>
          <button
            onClick={() => onNavigate('journey-doctors')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">stethoscope</span>
            Connect With Doctor
          </button>
        </div>
      )}

      {/* Two-pane chat */}
      {conversations.phase === 'ready' && conversations.appointments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
          {/* Conversation list */}
          <section aria-label="Conversations" className="space-y-2">
            {conversations.appointments.map((appointment) => {
              const isActive = appointment.id === selectedId;
              return (
                <button
                  key={appointment.id}
                  id={`chat-conversation-${appointment.id}`}
                  onClick={() => setSelectedId(appointment.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#ffe8e8] border-[#bc000a]/30 shadow-2xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-[#bc000a]' : 'text-[#101c28]'}`}>
                      {appointment.doctorName}
                    </p>
                    <span className="text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                      {STATUS_LABEL[appointment.status]}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 truncate">
                    {appointment.doctorSpecialty ?? 'Consultation'} • {formatAppointmentWhen(appointment.startTime)}
                  </p>
                </button>
              );
            })}
          </section>

          {/* Timeline + composer */}
          <section aria-label="Chat" className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col min-h-[420px]">
            {selected && (
              <div className="px-4 py-3 border-b border-slate-100 bg-[#f8fbfe]">
                <p className="text-xs font-bold text-[#101c28]">{selected.doctorName}</p>
                <p className="text-[10.5px] text-slate-500">
                  Appointment Chat • {selected.doctorSpecialty ?? 'Consultation'} • {formatAppointmentWhen(selected.startTime)}
                </p>
              </div>
            )}

            {/* Messages loading */}
            {messages.phase === 'loading' && (
              <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-500 p-8">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Loading messages…
              </div>
            )}

            {/* Messages error */}
            {messages.phase === 'error' && (
              <div className="flex-1 p-6 text-center space-y-2" role="alert">
                <p className="text-xs font-bold text-red-700">Could not load messages</p>
                <p className="text-[11px] text-slate-500 font-mono">{messages.message}</p>
                {selectedId && (
                  <button
                    onClick={() => void loadMessages(selectedId)}
                    className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Empty thread */}
            {messages.phase === 'ready' && messages.messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">forum</span>
                </div>
                <p className="text-xs font-bold text-[#101c28]">No messages yet.</p>
                <p className="text-[11px] text-slate-500">Start the conversation with your doctor.</p>
              </div>
            )}

            {/* Timeline */}
            {messages.phase === 'ready' && messages.messages.length > 0 && (
              <div ref={timelineRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[46vh]">
                {messages.messages.map((message) => {
                  const isMine = myUserId !== null && message.senderUserId === myUserId;
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                          isMine
                            ? 'bg-[#bc000a] text-white rounded-br-md'
                            : 'bg-slate-100 text-[#101c28] rounded-bl-md'
                        }`}
                      >
                        <p className="text-[9px] font-mono uppercase tracking-wide opacity-70 mb-0.5">
                          {isMine ? 'You' : (selected?.doctorName ?? 'Doctor')}
                        </p>
                        {message.body}
                        <p className="text-[9px] opacity-60 mt-1 text-right">{formatMessageTime(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Composer */}
            {selected && (
              <div className="border-t border-slate-100 p-3 space-y-1.5">
                {sendError && (
                  <p className="text-[11px] text-red-700 font-mono" role="alert">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    id="chat-message-input"
                    aria-label={`Message ${selected.doctorName}`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selected.doctorName}…`}
                    rows={2}
                    maxLength={4000}
                    className="flex-1 resize-none px-3 py-2 rounded-2xl border border-slate-200 text-xs text-[#101c28] placeholder:text-slate-400 focus:outline-none focus:border-[#bc000a]/50 focus:ring-1 focus:ring-[#bc000a]/20"
                  />
                  <button
                    id="chat-send-button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    aria-label="Send message"
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      canSend
                        ? 'bg-[#bc000a] text-white hover:bg-[#a00008] cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {sending ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">send</span>
                    )}
                    Send
                  </button>
                </div>
                <p className="text-[9.5px] text-slate-400">
                  Messages are part of your appointment record with {selected.doctorName}.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
