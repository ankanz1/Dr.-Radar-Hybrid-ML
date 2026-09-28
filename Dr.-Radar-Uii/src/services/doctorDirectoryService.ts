import { supabase } from '../lib/supabase';

/**
 * Doctor discovery + appointment booking data layer (patient-first journey,
 * step 8 "Connect With Doctor").
 *
 * Reads the EXISTING public.doctors / public.users / public.appointments
 * tables. No fake doctors, no fake availability: every row comes from the
 * database, so an empty result means the deployment has no doctors registered.
 *
 * Authorization model (UNCHANGED RLS):
 * - Reading the doctor directory uses the SQL RPC list_doctor_directory()
 *   (migration 011, extended by 014) which exposes ONLY public directory
 *   columns — including availability_date and booked_slots, so patients see
 *   only open slots for the day they are booking. Listing doctors is
 *   equivalent to a clinic's public website — no health data.
 * - Booking uses request_appointment() (migration 011, hardened by 014), a
 *   SECURITY DEFINER function that validates slot/doctor/date — including
 *   slot exclusivity, so the same doctor/date/time cannot be booked twice —
 *   and inserts into public.appointments through the caller's OWN patient row.
 *   RLS on appointments stays enabled; the patient can afterwards read only
 *   their own appointment rows (appointments_select_own from migration 007).
 * - No patient may read another patient's data; no RLS policy is weakened.
 */

export interface DoctorDirectoryEntry {
  doctorId: string;
  name: string;
  title: string;
  specialty: string;
  hospital: string | null;
  about: string | null;
  rating: number;
  experienceYears: number;
  isAvailableToday: boolean;
  nextAvailable: string | null;
  slots: string[];
  /** YYYY-MM-DD the published slots apply to (null = legacy/undated, any day). */
  availabilityDate: string | null;
  /** HH:MM labels already taken on that day by a scheduled appointment (migration 014). */
  bookedSlots: string[];
  avatarUrl: string | null;
}

export interface DoctorDirectoryResult {
  ok: boolean;
  doctors?: DoctorDirectoryEntry[];
  error?: string;
}

/** Load the doctor directory via the migration-011 RPC (public columns only). */
export async function fetchDoctorDirectory(): Promise<DoctorDirectoryResult> {
  const { data, error } = await supabase.rpc('list_doctor_directory');
  if (error) {
    return { ok: false, error: `Could not load the doctor directory: ${error.message}` };
  }

  const doctors: DoctorDirectoryEntry[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    doctorId: row.doctor_id as string,
    name: String(row.display_name ?? 'Doctor'),
    title: String(row.title ?? ''),
    specialty: String(row.specialty ?? ''),
    hospital: (row.hospital as string) ?? null,
    about: (row.about as string) ?? null,
    rating: Number(row.rating ?? 0),
    experienceYears: Number(row.experience_years ?? 0),
    isAvailableToday: Boolean(row.is_available_today),
    nextAvailable: (row.next_available as string) ?? null,
    slots: Array.isArray(row.slots) ? (row.slots as string[]) : [],
    availabilityDate: (row.availability_date as string) ?? null,
    bookedSlots: Array.isArray(row.booked_slots) ? (row.booked_slots as string[]) : [],
    avatarUrl: (row.avatar_url as string) ?? null,
  }));

  return { ok: true, doctors };
}

/**
 * Resolve doctor display names for the given doctor ids through the SAME
 * authorized migration-011 RPC the directory screen uses (public directory
 * columns only — no health data, no RLS bypass). Used by the patient chat to
 * label conversations, because under RLS the patient cannot read the raw
 * doctors/users rows the appointment embed points at.
 */
export async function fetchDoctorNamesByIds(
  doctorIds: string[]
): Promise<Record<string, string>> {
  if (doctorIds.length === 0) return {};
  const { data, error } = await supabase.rpc('list_doctor_directory');
  if (error || !data) {
    // Non-fatal: callers keep their generic fallback label.
    return {};
  }
  const wanted = new Set(doctorIds);
  const names: Record<string, string> = {};
  for (const row of data as Array<Record<string, unknown>>) {
    const id = row.doctor_id as string;
    if (wanted.has(id)) {
      names[id] = String(row.display_name ?? '').trim();
    }
  }
  return names;
}

export interface AppointmentView {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string | null;
  startTime: string;
  endTime: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  consultationType: 'in_person' | 'telehealth' | 'follow_up' | null;
  reason: string | null;
}

export interface MyAppointmentsResult {
  ok: boolean;
  appointments?: AppointmentView[];
  error?: string;
}

/** The signed-in patient's own appointments (RLS: appointments_select_own). */
export async function fetchMyAppointments(limit = 50): Promise<MyAppointmentsResult> {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      `id,
       patient_id,
       doctor_id,
       start_time,
       end_time,
       status,
       consultation_type,
       reason,
       doctors (
         id,
         specialty,
         users ( display_name, first_name, last_name )
       )`
    )
    .order('start_time', { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load your appointments: ${error.message}` };
  }

  const appointments: AppointmentView[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const doctorsRow = Array.isArray(row.doctors) ? row.doctors[0] : row.doctors;
    const usersRow =
      doctorsRow && Array.isArray(doctorsRow.users) ? doctorsRow.users[0] : (doctorsRow as { users?: { display_name?: string; first_name?: string; last_name?: string } })?.users;
    const doctorName =
      usersRow?.display_name ||
      [usersRow?.first_name, usersRow?.last_name].filter(Boolean).join(' ') ||
      'Doctor';
    return {
      id: row.id as string,
      doctorId: row.doctor_id as string,
      doctorName,
      doctorSpecialty: ((doctorsRow as { specialty?: string })?.specialty as string) ?? null,
      startTime: row.start_time as string,
      endTime: (row.end_time as string) ?? null,
      status: row.status as AppointmentView['status'],
      consultationType: (row.consultation_type as AppointmentView['consultationType']) ?? null,
      reason: (row.reason as string) ?? null,
    };
  });

  return { ok: true, appointments };
}

export interface BookAppointmentResult {
  ok: boolean;
  appointmentId?: string;
  error?: string;
}

/**
 * Book an appointment through the migration-011 SECURITY DEFINER function
 * (hardened by migration 014). The slot must be one of the doctor's stored
 * slots for that day, must not already be booked, and the patient row is the
 * caller's own. Any RLS/validation failure surfaces the real database error.
 */
export async function requestAppointment(input: {
  doctorId: string;
  slot: string;
  consultationType: 'in_person' | 'telehealth' | 'follow_up';
  reason?: string;
  onDate: string; // YYYY-MM-DD
}): Promise<BookAppointmentResult> {
  const { data, error } = await supabase.rpc('request_appointment', {
    p_doctor_id: input.doctorId,
    p_slot: input.slot,
    p_consultation_type: input.consultationType,
    p_reason: input.reason?.trim() ? input.reason.trim().slice(0, 500) : null,
    p_on_date: input.onDate,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const appointmentId = typeof data === 'string' ? data : ((data as { id?: string })?.id ?? null);
  if (!appointmentId) {
    return { ok: false, error: 'The appointment request was not confirmed by the server.' };
  }
  return { ok: true, appointmentId };
}
