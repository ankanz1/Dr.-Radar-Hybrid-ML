import { supabase } from '../lib/supabase';
import type { AppointmentView } from './doctorDirectoryService';
import type { DoctorAppointmentView } from './doctorAvailabilityService';

/**
 * Patient chat data layer (Phase 4, Step 2).
 *
 * Appointment-scoped doctor <-> patient messaging on the public.messages table
 * created by migration 016. All access goes through the signed-in Supabase
 * session — RLS (messages_select_participant / messages_insert_participant)
 * authorizes every read and write:
 *   - SELECT is limited to appointments where the caller is the patient or
 *     the doctor (public.user_appointment_ids() SECURITY DEFINER helper).
 *   - INSERT requires sender_user_id = auth.uid() AND membership in the
 *     appointment — the database rejects impersonation and foreign
 *     appointment ids with 42501 regardless of what the client sends.
 * No service role, no custom backend, no new tables.
 */

export interface ChatMessage {
  id: string;
  appointmentId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

export interface SendMessageInput {
  appointmentId: string;
  body: string;
}

export interface ChatOperationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ChatSessionUser {
  id: string;
  email: string | null;
}

/** The signed-in user from the existing Supabase session (never client-chosen). */
export async function getChatSessionUser(): Promise<ChatOperationResult<ChatSessionUser>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { ok: false, error: `Could not read your session: ${error.message}` };
  }
  const user = data.session?.user;
  if (!user) {
    return { ok: false, error: 'You are signed out. Please sign in to use chat.' };
  }
  return { ok: true, data: { id: user.id, email: user.email ?? null } };
}

/**
 * Appointment conversations the signed-in patient can chat in. Reuses the
 * EXISTING patient appointment query (fetchMyAppointments — same RLS policy
 * appointments_select_own), so no new conversation table is invented. The
 * appointment is the only authorization scope for a conversation.
 */
export async function fetchChatAppointments(limit = 50): Promise<ChatOperationResult<AppointmentView[]>> {
  const { fetchMyAppointments, fetchDoctorNamesByIds } = await import('./doctorDirectoryService');
  const result = await fetchMyAppointments(limit);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  // Newest first so the most relevant conversations appear at the top.
  const appointments = [...(result.appointments ?? [])].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  // Under live RLS the appointment's doctors(users) embed resolves to NULL for
  // patients (patients cannot read doctors/users rows), so the name falls back
  // to the generic label. Resolve real doctor display names through the SAME
  // authorized migration-011 RPC the directory screen uses (public directory
  // columns only — no new query per conversation, no RLS bypass). Non-fatal:
  // if the RPC fails, the existing fallback label stays.
  try {
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
    const names = await fetchDoctorNamesByIds(doctorIds);
    for (const appointment of appointments) {
      const resolved = names[appointment.doctorId];
      if (resolved) {
        appointment.doctorName = resolved;
      }
    }
  } catch {
    // keep fallback labels
  }
  return { ok: true, data: appointments };
}

/** Existing messages for one appointment, oldest first (chat timeline order). */
export async function fetchChatMessages(
  appointmentId: string,
  limit = 200
): Promise<ChatOperationResult<ChatMessage[]>> {
  if (!appointmentId) {
    return { ok: false, error: 'No appointment selected.' };
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, appointment_id, sender_user_id, body, created_at')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load messages: ${error.message}` };
  }

  const messages: ChatMessage[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    appointmentId: row.appointment_id as string,
    senderUserId: row.sender_user_id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  }));
  return { ok: true, data: messages };
}

/**
 * Doctor-side conversation list: the doctor's OWN appointments (visibility via
 * the migration-007 SECURITY DEFINER helper doctor_own_appointment_ids() — the
 * identical authorization the doctor dashboard/patients screens use; RLS
 * appointments_select_own filters the rows anyway), enriched with the latest
 * message preview/timestamp per appointment from public.messages. Messages of
 * other doctors' appointments are invisible under RLS, so the preview can
 * never leak another doctor's conversation.
 */
export interface DoctorConversation {
  appointmentId: string;
  patientId: string;
  patientName: string;
  status: DoctorAppointmentView['status'];
  startTime: string;
  latestMessageBody: string | null;
  latestMessageAt: string | null;
}

export async function fetchDoctorConversations(limit = 100): Promise<ChatOperationResult<DoctorConversation[]>> {
  const { fetchMyDoctorAppointments } = await import('./doctorAvailabilityService');
  const apptsResult = await fetchMyDoctorAppointments(limit);
  if (!apptsResult.ok || !apptsResult.appointments) {
    return { ok: false, error: apptsResult.error ?? 'Could not load your appointments.' };
  }

  // One batched query for the last message of each of the doctor's own
  // appointments. PostgREST `in()` keeps it to a single round trip; RLS
  // (messages_select_participant) scopes every returned row to this doctor.
  const ids = apptsResult.appointments.map((a) => a.id);
  let latestByAppointment = new Map<string, ChatMessage>();
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, appointment_id, sender_user_id, body, created_at')
      .in('appointment_id', ids)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      return { ok: false, error: `Could not load conversation previews: ${error.message}` }
    }
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const appointmentId = row.appointment_id as string;
      if (!latestByAppointment.has(appointmentId)) {
        latestByAppointment.set(appointmentId, {
          id: row.id as string,
          appointmentId,
          senderUserId: row.sender_user_id as string,
          body: row.body as string,
          createdAt: row.created_at as string,
        });
      }
    }
  }

  const conversations: DoctorConversation[] = apptsResult.appointments.map((appointment) => {
    const latest = latestByAppointment.get(appointment.id);
    return {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      status: appointment.status,
      startTime: appointment.startTime,
      latestMessageBody: latest?.body ?? null,
      latestMessageAt: latest?.createdAt ?? null,
    };
  });

  // Most recently active conversation first.
  conversations.sort((a, b) => {
    const aTime = a.latestMessageAt ? new Date(a.latestMessageAt).getTime() : 0;
    const bTime = b.latestMessageAt ? new Date(b.latestMessageAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });
  return { ok: true, data: conversations };
}

/**
 * Send a message as the CURRENTLY AUTHENTICATED user. The sender id always
 * comes from supabase.auth — callers cannot pass (or spoof) another user.
 * The database re-validates sender + appointment membership via RLS.
 */
export async function sendChatMessage(input: SendMessageInput): Promise<ChatOperationResult<ChatMessage>> {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) {
    return { ok: false, error: 'Message cannot be empty.' };
  }
  if (body.length > 4000) {
    return { ok: false, error: 'Message is too long (max 4000 characters).' };
  }
  if (!input.appointmentId) {
    return { ok: false, error: 'No appointment selected.' };
  }

  const session = await getChatSessionUser();
  if (!session.ok || !session.data) {
    return { ok: false, error: session.error ?? 'You are signed out.' };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      appointment_id: input.appointmentId,
      sender_user_id: session.data.id,
      body,
    })
    .select('id, appointment_id, sender_user_id, body, created_at')
    .single();

  if (error) {
    return { ok: false, error: `Could not send your message: ${error.message}` };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      id: row.id as string,
      appointmentId: row.appointment_id as string,
      senderUserId: row.sender_user_id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
    },
  };
}
