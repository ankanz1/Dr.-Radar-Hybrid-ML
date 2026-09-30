/**
 * Shared appointment time formatting.
 *
 * Storage contract (migration 014, request_appointment): slot labels are
 * anchored as UTC wall clock — `(date || ' ' || slot)::timestamp AT TIME ZONE
 * 'UTC'` — so `start_time` round-trips to exactly the HH:MM label the doctor
 * published, independent of the session TimeZone.
 *
 * Therefore, DISPLAYING with the viewer's local timezone (new Date(iso) +
 * toLocaleString) re-renders the label in the viewer's offset and shows a
 * different time than the slot the patient selected. Every appointment surface
 * must use the UTC-anchored formatters below to preserve the exact selected
 * time.
 */

/** "Sep 30, 2026" style label from an ISO timestamp, anchored to UTC wall clock. */
export function formatAppointmentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "10:00" HH:MM label from an ISO timestamp, anchored to UTC (the stored slot label). */
export function formatAppointmentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Combined "Sep 30, 2026, 10:00" for compact surfaces (chat headers, lists). */
export function formatAppointmentWhen(iso: string): string {
  return `${formatAppointmentDate(iso)}, ${formatAppointmentTime(iso)}`;
}

/** "Sep 30" short day label for the booking flow (YYYY-MM-DD input, no drift). */
export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
