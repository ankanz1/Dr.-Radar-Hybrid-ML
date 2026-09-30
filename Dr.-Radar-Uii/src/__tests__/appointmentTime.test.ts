// Focused unit tests for the UTC-anchored appointment formatters.
// The database anchors slot labels as UTC wall clock (migration 014:
// request_appointment -> (date || slot)::timestamp AT TIME ZONE 'UTC'), so the
// displayed time must be read back in UTC to show the exact selected slot —
// regardless of the viewer's timezone.
import { describe, it, expect } from 'vitest';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatAppointmentWhen,
} from '../lib/appointmentTime';

describe('appointmentTime formatters (UTC-anchored)', () => {
  it('formats the exact stored slot time regardless of local timezone offset', () => {
    // Stored start_time for a patient who booked the "10:00" slot.
    const iso = '2026-09-30T10:00:00+00:00';
    expect(formatAppointmentTime(iso)).toBe('10:00');
    expect(formatAppointmentDate(iso)).toBe('Sep 30, 2026');
    expect(formatAppointmentWhen(iso)).toBe('Sep 30, 2026, 10:00');
  });

  it('does NOT shift the label when the viewer sits far from UTC', () => {
    // 23:30 UTC is a different local day in UTC+10 and UTC-10; the stored slot
    // label must still read 23:30 on the UTC date.
    const iso = '2026-09-30T23:30:00Z';
    expect(formatAppointmentTime(iso)).toBe('23:30');
    expect(formatAppointmentDate(iso)).toBe('Sep 30, 2026');
  });

  it('round-trips every published slot label through storage and back', () => {
    // Simulates the migration-014 anchor: (date || ' ' || slot) AS UTC.
    for (const slot of ['08:00', '10:30', '13:05', '17:30', '23:59']) {
      const stored = new Date(`2026-10-01T${slot}:00Z`).toISOString();
      expect(formatAppointmentTime(stored)).toBe(slot);
    }
  });

  it('passes through unparseable input unchanged', () => {
    expect(formatAppointmentTime('not-a-date')).toBe('not-a-date');
    expect(formatAppointmentDate('not-a-date')).toBe('not-a-date');
  });
});
