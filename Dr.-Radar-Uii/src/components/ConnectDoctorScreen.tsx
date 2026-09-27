import type React from 'react';
import { useState, useEffect } from 'react';
import { ScreenTab } from '../types';
import {
  fetchDoctorDirectory,
  requestAppointment,
  DoctorDirectoryEntry,
} from '../services/doctorDirectoryService';
import { saveJourneyResume, clearJourneyResume } from '../services/journeyState';

/**
 * Journey step 8 — Connect With Doctor.
 *
 * Uses ONLY real database doctors via the directory RPC (migration 011;
 * availability_date + booked_slots added by migration 014 — public directory
 * columns, no health data). Booking goes through request_appointment() — a
 * validated SECURITY DEFINER function writing to the EXISTING appointments
 * table, which rejects wrong-day and already-booked slots; RLS untouched.
 * No fake doctors, no invented availability: an empty list means the
 * deployment has no registered doctors (or none have published slots).
 */

interface ConnectDoctorScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

type DirectoryState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; doctors: DoctorDirectoryEntry[] };

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "Sat, Sep 27" label for a YYYY-MM-DD date (date-only, no timezone drift). */
function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The patient flow books TOMORROW. A doctor's published slots apply to the day
 * they chose when publishing (doctors.availability_date, migration 014);
 * legacy rows without a day are valid for any day.
 */
function isBookableOn(doctor: DoctorDirectoryEntry, date: string): boolean {
  return !doctor.availabilityDate || doctor.availabilityDate === date;
}

/** Slots published for this day and not yet taken (migration 014 booked_slots). */
function openSlotsOf(doctor: DoctorDirectoryEntry, date: string): string[] {
  if (!isBookableOn(doctor, date)) return [];
  const booked = new Set(doctor.bookedSlots ?? []);
  return doctor.slots.filter((slot) => !booked.has(slot));
}

export const ConnectDoctorScreen: React.FC<ConnectDoctorScreenProps> = ({ onNavigate, onShowToast }) => {
  const [state, setState] = useState<DirectoryState>({ phase: 'loading' });
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDirectoryEntry | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [consultationType, setConsultationType] = useState<'in_person' | 'telehealth' | 'follow_up'>('telehealth');
  const [reason, setReason] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Booking always targets tomorrow — the same day doctors publish for.
  const bookingDate = tomorrowDate();

  useEffect(() => {
    saveJourneyResume('journey-doctors');
    return () => clearJourneyResume();
  }, []);

  const loadDirectory = async () => {
    setState({ phase: 'loading' });
    const result = await fetchDoctorDirectory();
    if (result.ok) {
      setState({ phase: 'ready', doctors: result.doctors });
    } else {
      setState({ phase: 'error', message: result.error });
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, []);

  const filtered = state.phase === 'ready'
    ? state.doctors.filter((doc) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          doc.name.toLowerCase().includes(q) ||
          doc.specialty.toLowerCase().includes(q) ||
          (doc.hospital ?? '').toLowerCase().includes(q)
        );
      })
    : [];

  const handleBookingOpen = (doctor: DoctorDirectoryEntry) => {
    const open = openSlotsOf(doctor, bookingDate);
    setBookingDoctor(doctor);
    setSelectedSlot(open[0] ?? '');
    setBookingError(null);
  };

  const handleBookingConfirm = async () => {
    if (!bookingDoctor || !selectedSlot) return;
    setBookingBusy(true);
    setBookingError(null);

    const result = await requestAppointment({
      doctorId: bookingDoctor.doctorId,
      slot: selectedSlot,
      consultationType,
      reason,
      onDate: bookingDate,
    });

    setBookingBusy(false);
    if (!result.ok) {
      setBookingError(result.error);
      return;
    }

    setBookingDoctor(null);
    setReason('');
    onShowToast(`Appointment requested with ${bookingDoctor.name}`, 'success');
    onNavigate('journey-appointments');
  };

  const initialsOf = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Connect With Doctor</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Choose a registered doctor to review your health records with you. Booking an appointment authorizes them to
          see your shared health data.
        </p>
      </div>

      {/* Loading */}
      {state.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading doctors…
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-2" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            Could not load the doctor directory
          </div>
          <p className="font-mono">{state.message}</p>
          <button
            onClick={() => void loadDirectory()}
            className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty (real state: no registered doctors) */}
      {state.phase === 'ready' && state.doctors.length === 0 && (
        <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">person_search</span>
          </div>
          <p className="text-sm font-bold text-[#101c28]">No doctors are registered yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your healthcare organization has not added doctor profiles to Dr. Radar. Once a doctor registers, they will
            appear here.
          </p>
        </div>
      )}

      {/* Search */}
      {state.phase === 'ready' && state.doctors.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by name, specialty, or hospital…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
          />
        </div>
      )}

      {/* Doctor cards */}
      {state.phase === 'ready' && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((doctor) => {
            const open = openSlotsOf(doctor, bookingDate);
            const bookable = isBookableOn(doctor, bookingDate);
            return (
            <article key={doctor.doctorId} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs">
              <div className="flex items-start gap-3.5">
                {doctor.avatarUrl ? (
                  <img
                    src={doctor.avatarUrl}
                    alt={doctor.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm shrink-0">
                    {initialsOf(doctor.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[#101c28]">{doctor.name}</h3>
                    {doctor.rating > 0 && (
                      <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                        <span className="material-symbols-outlined text-[13px] text-amber-600">star</span>
                        <span className="text-[11px] font-bold text-[#101c28]">{doctor.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#bc000a]">{doctor.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 mt-0.5">
                    <span>{doctor.specialty}</span>
                    {doctor.hospital && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">domain</span>
                          {doctor.hospital}
                        </span>
                      </>
                    )}
                    {doctor.experienceYears > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{doctor.experienceYears} yrs exp.</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {doctor.about && (
                <p className="text-[11.5px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70 mt-3">
                  {doctor.about}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    open.length > 0 ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${open.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {doctor.slots.length === 0
                    ? 'No slots published'
                    : !bookable
                    ? `Available ${formatDayLabel(doctor.availabilityDate ?? bookingDate)}`
                    : doctor.isAvailableToday && open.length > 0
                    ? 'Available today'
                    : open.length > 0
                    ? `${open.length} open slot${open.length === 1 ? '' : 's'} · ${formatDayLabel(bookingDate)}`
                    : 'All slots booked'}
                </span>
                <button
                  onClick={() => handleBookingOpen(doctor)}
                  disabled={open.length === 0}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    open.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-[#bc000a] text-white hover:bg-[#a00008] cursor-pointer shadow-sm'
                  }`}
                >
                  Book Appointment
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {/* Booking modal */}
      {bookingDoctor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setBookingDoctor(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#101c28]">{bookingDoctor.name}</h3>
                <p className="text-xs text-slate-500">{bookingDoctor.title}</p>
              </div>
              <button
                onClick={() => setBookingDoctor(null)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                aria-label="Close booking"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Consultation mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">Consultation mode</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'telehealth', label: 'Telehealth', icon: 'videocam' },
                  { value: 'in_person', label: 'In-clinic', icon: 'apartment' },
                  { value: 'follow_up', label: 'Follow-up', icon: 'event_repeat' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setConsultationType(option.value)}
                    className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border text-[11px] font-semibold transition-all cursor-pointer ${
                      consultationType === option.value
                        ? 'bg-[#ffe8e8]/50 border-[#bc000a] text-[#bc000a]'
                        : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slots (only the doctor's real stored, still-open slots) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Open time slots · {formatDayLabel(bookingDate)}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {openSlotsOf(bookingDoctor, bookingDate).map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-3 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer ${
                      selectedSlot === slot
                        ? 'bg-[#bc000a] text-white border-[#bc000a]'
                        : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {openSlotsOf(bookingDoctor, bookingDate).length === 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  No open slots remain for {formatDayLabel(bookingDate)}. Please check back later.
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Review my latest ECG result"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>

            {bookingError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs" role="alert">
                {bookingError}
              </div>
            )}

            <button
              onClick={() => void handleBookingConfirm()}
              disabled={bookingBusy || !selectedSlot}
              className={`w-full min-h-[44px] py-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                bookingBusy || !selectedSlot
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#bc000a] text-white hover:bg-[#a50009] cursor-pointer shadow-md shadow-[#bc000a]/20'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${bookingBusy ? 'animate-spin' : ''}`}>
                {bookingBusy ? 'progress_activity' : 'calendar_today'}
              </span>
              {bookingBusy ? 'Requesting…' : 'Confirm Appointment'}
            </button>
            <p className="text-[10.5px] text-slate-500 text-center">
              After the appointment is scheduled, the doctor can see the health data you share during your care.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
