import { supabase } from '../lib/supabase';

/**
 * Doctor availability + doctor-side appointment data layer.
 *
 * All reads/writes go through the authenticated session and the EXISTING
 * schema — no new tables, no policy changes:
 *   - The doctor's own public.doctors row is readable under RLS
 *     (doctors_read_own, migration 008: user_id = auth.uid()).
 *   - Publishing slots uses the migration-014 SECURITY DEFINER RPC
 *     publish_doctor_slots(), which validates every HH:MM label, validates the
 *     availability date (never in the past) and writes ONLY the caller's own
 *     doctors row (never a client-supplied id) — slots + availability_date.
 *   - Doctor appointment lists reuse the migration-007 SECURITY DEFINER
 *     helper doctor_own_appointment_ids() — the same authorization the doctor
 *     dashboard/patients screens use.
 * No service role, no RLS bypass, no fake data.
 */

export interface DoctorAvailability {
  doctorId: string;
  slots: string[];
  /** YYYY-MM-DD the published slot labels apply to (null = legacy/undated). */
  availabilityDate: string | null;
  isAvailableToday: boolean;
  nextAvailable: string | null;
}

export interface AvailabilityResult {
  ok: boolean;
  availability?: DoctorAvailability;
  error?: string;
}

/** The signed-in doctor's own availability (RLS: doctors_read_own, 008). */
export async function fetchMyAvailability(): Promise<AvailabilityResult> {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, slots, availability_date, is_available_today, next_available')
    .limit(1);

  if (error) {
    return { ok: false, error: `Could not load your availability: ${error.message}` };
  }
  const row = (data ?? [])[0];
  if (!row) {
    return { ok: false, error: 'No doctor profile (public.doctors) is linked to this account.' };
  }

  return {
    ok: true,
    availability: {
      doctorId: row.id as string,
      slots: Array.isArray(row.slots) ? (row.slots as string[]) : [],
      availabilityDate: (row.availability_date as string) ?? null,
      isAvailableToday: Boolean(row.is_available_today),
      nextAvailable: (row.next_available as string) ?? null,
    },
  };
}

/**
 * Publish (replace) the doctor's own slot list for a given day through the
 * migration-014 RPC. Labels must be 24-hour HH:MM strings and onDate must be
 * today or later; the database validates, dedupes and stores both the labels
 * (doctors.slots) and the day (doctors.availability_date).
 */
export async function publishMySlots(
  slots: string[],
  onDate: string,
  isAvailableToday?: boolean
): Promise<AvailabilityResult> {
  const { data, error } = await supabase.rpc('publish_doctor_slots', {
    p_slots: slots,
    p_on_date: onDate,
    ...(isAvailableToday === undefined ? {} : { p_is_available_today: isAvailableToday }),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // The RPC returns the stored (validated/deduped) list — trust it over input.
  const stored = Array.isArray(data) ? (data as string[]) : [];
  const readback = await fetchMyAvailability();
  if (!readback.ok || !readback.availability) {
    // Publishing succeeded but read-back failed; still report success with the
    // values the database confirmed for this call.
    return {
      ok: true,
      availability: {
        doctorId: '',
        slots: stored,
        availabilityDate: stored.length > 0 ? onDate : null,
        isAvailableToday: stored.length > 0,
        nextAvailable: null,
      },
    };
  }
  return readback;
}

export interface DoctorAppointmentView {
  id: string;
  patientId: string;
  patientName: string;
  startTime: string;
  endTime: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  consultationType: 'in_person' | 'telehealth' | 'follow_up' | null;
  reason: string | null;
}

export interface DoctorAppointmentsResult {
  ok: boolean;
  appointments?: DoctorAppointmentView[];
  error?: string;
}

/**
 * All appointment rows involving this doctor, joined to patient identity via
 * users. Row visibility uses doctor_own_appointment_ids() (migration 007) —
 * the identical helper behind appointments_select_own, so authorization is
 * unchanged. Doctor identity is resolved by the helper from auth.uid().
 */
export async function fetchMyDoctorAppointments(limit = 100): Promise<DoctorAppointmentsResult> {
  const { data: idRows, error: idError } = await supabase.rpc('doctor_own_appointment_ids');
  if (idError) {
    return { ok: false, error: `Could not resolve your appointments: ${idError.message}` };
  }
  const ids = ((idRows ?? []) as Array<{ id?: string } | string>)
    .map((row) => (typeof row === 'string' ? row : row?.id))
    .filter((id): id is string => typeof id === 'string')
    .slice(0, limit);

  if (ids.length === 0) {
    return { ok: true, appointments: [] };
  }

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `id,
       patient_id,
       start_time,
       end_time,
       status,
       consultation_type,
       reason,
       patients (
         users ( first_name, last_name, display_name )
       )`
    )
    .in('id', ids)
    .order('start_time', { ascending: true });

  if (error) {
    return { ok: false, error: `Could not load your appointments: ${error.message}` };
  }

  const appointments: DoctorAppointmentView[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const patientsRow = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    const usersRow =
      patientsRow && Array.isArray(patientsRow.users)
        ? patientsRow.users[0]
        : (patientsRow as { users?: { display_name?: string; first_name?: string; last_name?: string } } | undefined)?.users;
    const patientName =
      usersRow?.display_name ||
      [usersRow?.first_name, usersRow?.last_name].filter(Boolean).join(' ') ||
      'Patient';
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      patientName,
      startTime: row.start_time as string,
      endTime: (row.end_time as string) ?? null,
      status: row.status as DoctorAppointmentView['status'],
      consultationType: (row.consultation_type as DoctorAppointmentView['consultationType']) ?? null,
      reason: (row.reason as string) ?? null,
    };
  });

  return { ok: true, appointments };
}
