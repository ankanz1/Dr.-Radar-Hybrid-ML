import React, { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../types';
import {
  getAuthenticatedDoctor,
  fetchAuthorizedPatients,
  DoctorIdentity,
  AuthorizedPatient,
} from '../services/doctorEcgService';
import { AamiClassBadge } from './AamiClassBadge';
import { AamiClassCode, getAamiClass } from '../data/aamiClassSystem';
import {
  fetchMyAvailability,
  publishMySlots,
  fetchMyDoctorAppointments,
  DoctorAppointmentView,
  DoctorAvailability,
} from '../services/doctorAvailabilityService';

/**
 * Doctor Dashboard (journey step 9) — clinician-facing overview.
 *
 * ALL data comes from the database through the existing RLS-enforced services:
 *   - Patients: fetchAuthorizedPatients (public.patients rows RLS returns for
 *     this doctor — scheduled/completed appointments only, migration 007).
 *   - Each patient's latest stored ECG classification + confidence + timestamp
 *     come from the same fetch (ecg_records -> predictions), read-only.
 *
 * No mock patients, no fabricated alerts, no fake counts. If RLS returns zero
 * patients, the dashboard says exactly that and explains the appointment
 * authorization model.
 *
 * Medical wording: the QML model performs AAMI EC57 heartbeat classification
 * (N/S/V/F/Q). Non-N results are shown as "abnormal ECG classification —
 * needs review", never as a disease diagnosis or disease probability.
 *
 * "Talk With Patient" remains an entry point to the EXISTING consultation
 * workflow (appointments + consultations tables).
 */

interface DoctorDashboardScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onSelectPatient?: (patientId: string) => void;
  onSelectModalityPreview?: (testId: string) => void;
}

type DashboardPhase =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; doctor: DoctorIdentity; patients: AuthorizedPatient[]; warning?: string };

type ReviewStatus = 'needs-review' | 'normal' | 'no-data';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return iso;
  const diffMs = Date.now() - date;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Non-N AAMI classification (S/V/F/Q) => flagged for clinical review. */
function isAbnormalClassification(code: string | null | undefined): boolean {
  if (!code) return false;
  return code.trim().toUpperCase() !== 'N';
}

function getReviewStatus(patient: AuthorizedPatient): ReviewStatus {
  if (isAbnormalClassification(patient.latestPrediction?.predictedClass)) return 'needs-review';
  if (patient.latestPrediction?.predictedClass) return 'normal';
  return 'no-data';
}

const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; className: string; dot: string }> = {
  'needs-review': {
    label: 'Needs Review',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  normal: {
    label: 'Normal',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'no-data': {
    label: 'No ECG Data',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
    dot: 'bg-slate-300',
  },
};

const ReviewStatusChip: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const meta = REVIEW_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

/** YYYY-MM-DD for `offsetDays` from today (same UTC-date convention the patient flow uses). */
function isoDayOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** "Sat, Sep 27" label for a YYYY-MM-DD date (date-only, no timezone drift). */
function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** 30-minute HH:MM labels from 08:00 through 17:30. */
function buildSlotOptions(endHour: number, endMinute: number): string[] {
  const options: string[] = [];
  for (let hour = 8; hour <= endHour; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === endHour && minute > endMinute) continue;
      options.push(`${String(hour).padStart(2, '0')}:${minute === 0 ? '00' : '30'}`);
    }
  }
  return options;
}

const SLOT_OPTIONS: string[] = buildSlotOptions(17, 30);

const MyAvailabilitySection: React.FC = () => {
  const [availability, setAvailability] = useState<DoctorAvailability | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => isoDayOffset(1));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Patients book tomorrow, so the publishable days start tomorrow (5 days).
  const dateOptions = useMemo(() => [1, 2, 3, 4, 5].map((offset) => isoDayOffset(offset)), []);

  const load = async () => {
    setPhase('loading');
    const result = await fetchMyAvailability();
    if (result.ok && result.availability) {
      const publishedDate = result.availability.availabilityDate;
      const date = publishedDate && dateOptions.includes(publishedDate) ? publishedDate : dateOptions[0];
      setAvailability(result.availability);
      setSelectedDate(date);
      setSelected(publishedDate === date ? result.availability.slots : []);
      setPhase('ready');
    } else {
      setError(result.error ?? 'Could not load availability.');
      setPhase('error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleSlot = (slot: string) => {
    setSelected((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    // Only pre-fill the picker with slots that were actually published for this day.
    setSelected(availability?.availabilityDate === date ? availability.slots : []);
  };

  const handlePublish = async () => {
    setBusy(true);
    setError(null);
    const result = await publishMySlots([...selected].sort(), selectedDate);
    setBusy(false);
    if (result.ok && result.availability) {
      setAvailability(result.availability);
      setSelectedDate(result.availability.availabilityDate ?? selectedDate);
      setSelected(result.availability.slots);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } else {
      setError(result.error ?? 'Could not publish slots.');
    }
  };

  const publishedForSelected =
    availability?.availabilityDate === selectedDate && availability.slots.length > 0;

  return (
    <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3" aria-label="My availability">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#bc000a]">event_available</span>
          My Availability
        </h2>
        {availability && (
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              publishedForSelected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {publishedForSelected
              ? `${availability.slots.length} slot${availability.slots.length === 1 ? '' : 's'} published`
              : 'nothing published for this day'}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Pick a day, switch on the 30-minute slots you can see patients for, then publish. Patients book the
        slots you publish for tomorrow, so keep tomorrow open if you want to be bookable.
      </p>

      {phase === 'loading' && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          Loading your published slots…
        </div>
      )}

      {phase === 'error' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-2" role="status">
          <p className="font-mono">{error}</p>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          {/* Day picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">Day</span>
            <div className="flex flex-wrap gap-1.5">
              {dateOptions.map((date, index) => {
                const isSelected = date === selectedDate;
                return (
                  <button
                    key={date}
                    onClick={() => chooseDate(date)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#bc000a] text-white border-[#bc000a] shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {index === 0 ? `Tomorrow · ${formatDayLabel(date)}` : formatDayLabel(date)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Available times on {formatDayLabel(selectedDate)}
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {SLOT_OPTIONS.map((slot) => {
                const isSelected = selected.includes(slot);
                return (
                  <button
                    key={slot}
                    onClick={() => toggleSlot(slot)}
                    className={`py-2 rounded-xl border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#bc000a] text-white border-[#bc000a] shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handlePublish()}
              disabled={busy}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                busy
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#bc000a] text-white hover:bg-[#920008] cursor-pointer shadow-sm'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${busy ? 'animate-spin' : ''}`}>
                {busy ? 'progress_activity' : 'publish'}
              </span>
              {busy ? 'Publishing…' : 'Publish Slots'}
            </button>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Clear selection
              </button>
            )}
            {savedFlash && (
              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved — visible to patients instantly
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Stored in public.doctors.slots + availability_date (your own row, RLS-enforced). Publishing an empty
            list hides all slots for that day.
          </p>
        </>
      )}
    </section>
  );
};

const STATUS_BADGE: Record<DoctorAppointmentView['status'], { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show: { label: 'Missed', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

function formatAppointmentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DoctorAppointmentsSection: React.FC = () => {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; appointments: DoctorAppointmentView[] }
  >({ phase: 'loading' });

  const load = async () => {
    setState({ phase: 'loading' });
    const result = await fetchMyDoctorAppointments();
    if (result.ok && result.appointments) {
      setState({ phase: 'ready', appointments: result.appointments });
    } else {
      setState({ phase: 'error', message: result.error ?? 'Could not load appointments.' });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upcoming =
    state.phase === 'ready'
      ? state.appointments.filter((a) => a.status === 'scheduled' && new Date(a.startTime).getTime() >= Date.now())
      : [];

  return (
    <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3" aria-label="Upcoming appointments">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#bc000a]">calendar_month</span>
          Upcoming Appointments
        </h2>
        {state.phase === 'ready' && (
          <span className="text-[10px] font-mono text-slate-400">{upcoming.length} scheduled</span>
        )}
      </div>

      {state.phase === 'loading' && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          Loading appointments…
        </div>
      )}

      {state.phase === 'error' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-2" role="status">
          <p className="font-mono">{state.message}</p>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {state.phase === 'ready' && upcoming.length === 0 && (
        <p className="text-xs text-slate-500">
          No upcoming appointments yet. Publish slots above so patients can book a consultation with you.
        </p>
      )}

      {state.phase === 'ready' && upcoming.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {upcoming.map((appointment) => (
            <li key={appointment.id} className="py-2.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-[#101c28] truncate">{appointment.patientName}</span>
                <span className="block text-[10px] text-slate-500 font-mono">
                  {formatAppointmentTime(appointment.startTime)}
                  {appointment.consultationType ? ` · ${appointment.consultationType.replace('_', '-')}` : ''}
                </span>
              </span>
              <span
                className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                  STATUS_BADGE[appointment.status].className
                }`}
              >
                {STATUS_BADGE[appointment.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const PatientAvatar: React.FC<{ name: string }> = ({ name }) => {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="w-10 h-10 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0 font-extrabold text-sm select-none">
      {initial}
    </span>
  );
};

interface PatientCardProps {
  patient: AuthorizedPatient;
  onOpen: () => void;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, onOpen }) => {
  const status = getReviewStatus(patient);
  const prediction = patient.latestPrediction;
  const classMeta = prediction ? getAamiClass(prediction.predictedClass) : null;

  return (
    <button
      onClick={onOpen}
      className={`group text-left bg-white rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
        status === 'needs-review' ? 'border-amber-300/80 ring-1 ring-amber-100' : 'border-slate-200/90'
      }`}
    >
      <div className="flex items-start gap-3">
        <PatientAvatar name={patient.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#101c28] truncate">{patient.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{patient.email ?? 'no email visible'}</p>
        </div>
        <span className="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-[#bc000a] transition-colors shrink-0">
          chevron_right
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest ECG classification</span>
          <ReviewStatusChip status={status} />
        </div>

        {prediction && classMeta ? (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <AamiClassBadge code={prediction.predictedClass as AamiClassCode} variant="compact" size="sm" />
              <span className="text-xs font-semibold text-[#101c28] truncate">{classMeta.name}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 shrink-0">
              {(prediction.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No stored analyses yet</p>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {patient.latestAnalysisAt
            ? `last analysis ${formatRelative(patient.latestAnalysisAt)}`
            : 'awaiting first analysis'}
        </div>
      </div>
    </button>
  );
};

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({ onNavigate, onSelectPatient }) => {
  const [dashboard, setDashboard] = useState<DashboardPhase>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDashboard({ phase: 'loading' });
      const doctorResult = await getAuthenticatedDoctor();
      if (cancelled) return;

      if (doctorResult.status === 'signed-out' || doctorResult.status === 'no-doctor-record') {
        setDashboard({
          phase: 'error',
          message:
            doctorResult.status === 'signed-out'
              ? 'Sign in with your doctor account to view patient records.'
              : 'No doctor profile (public.doctors) is linked to this account.',
        });
        return;
      }
      if (doctorResult.status === 'error') {
        setDashboard({ phase: 'error', message: doctorResult.error });
        return;
      }

      const patientsResult = await fetchAuthorizedPatients();
      if (cancelled) return;
      if (!patientsResult.ok || !patientsResult.data) {
        setDashboard({ phase: 'error', message: patientsResult.error ?? 'Could not load patients.' });
        return;
      }

      setDashboard({
        phase: 'ready',
        doctor: { doctorId: doctorResult.doctorId, displayName: doctorResult.displayName },
        patients: patientsResult.data,
        warning: patientsResult.error,
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const patients = dashboard.phase === 'ready' ? dashboard.patients : [];

  // Derived overview data — all from the already-fetched authorized patient
  // list (each entry carries its latest stored classification + confidence).
  const { needsReview, withStoredEcgs, recentAnalyses } = useMemo(() => {
    const review = patients.filter((p) => getReviewStatus(p) === 'needs-review');
    const sortedRecent = patients
      .filter((p) => p.latestAnalysisAt)
      .sort((a, b) => ((a.latestAnalysisAt ?? '') < (b.latestAnalysisAt ?? '') ? 1 : -1));
    return {
      needsReview: review,
      withStoredEcgs: sortedRecent.length,
      recentAnalyses: sortedRecent.slice(0, 6),
    };
  }, [patients]);

  const openPatient = (patientId: string) => {
    // Preserved navigation: select the patient, then open the existing
    // doctor ECG records screen (DoctorPatientEcgDashboard deep-links to it).
    onSelectPatient?.(patientId);
    onNavigate('doctor-ecg-records');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DOCTOR DASHBOARD
            </span>
            <span className="text-[11px] font-mono text-slate-500">RLS-enforced patient access</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            {dashboard.phase === 'ready' ? dashboard.doctor.displayName : 'Doctor Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Clinical overview of your appointment-authorized patients and their latest ECG classifications.
          </p>
        </div>
        {dashboard.phase === 'ready' && (
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold shrink-0 self-start sm:self-auto">
            doctor {dashboard.doctor.doctorId.slice(0, 8)}…
          </span>
        )}
      </div>

      {/* Loading */}
      {dashboard.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Resolving your doctor profile and authorized patients…
        </div>
      )}

      {/* Error */}
      {dashboard.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-1" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Doctor dashboard unavailable
          </div>
          <p className="font-mono">{dashboard.message}</p>
        </div>
      )}

      {dashboard.phase === 'ready' && (
        <>
          {dashboard.warning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs" role="status">
              {dashboard.warning}
            </div>
          )}

          {/* 2. Patient Overview — real counts only */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Patients</span>
                <span className="material-symbols-outlined text-[18px] text-slate-400">groups</span>
              </div>
              <div className="text-2xl font-extrabold text-[#101c28]">{patients.length}</div>
              <span className="text-[10px] text-slate-500 font-medium">Appointment-authorized</span>
            </div>

            <div className={`bg-white rounded-2xl p-4 border shadow-2xs ${needsReview.length > 0 ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/60 to-white' : 'border-slate-200/90'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Needs Review</span>
                <span className={`material-symbols-outlined text-[18px] ${needsReview.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                  flag
                </span>
              </div>
              <div className={`text-2xl font-extrabold ${needsReview.length > 0 ? 'text-amber-600' : 'text-[#101c28]'}`}>
                {needsReview.length}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Abnormal ECG classifications</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent ECG Analyses</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-600">ecg_heart</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">{withStoredEcgs}</div>
              <span className="text-[10px] text-slate-500 font-medium">Patients with stored analyses</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Data</span>
                <span className="material-symbols-outlined text-[18px] text-slate-400">hourglass_empty</span>
              </div>
              <div className="text-2xl font-extrabold text-[#101c28]">{patients.length - withStoredEcgs}</div>
              <span className="text-[10px] text-slate-500 font-medium">No stored analyses yet</span>
            </div>
          </div>

          {/* 3. Needs Review — abnormal ECG classifications (NOT diagnoses) */}
          <section
            className={`rounded-3xl border overflow-hidden ${
              needsReview.length > 0
                ? 'bg-gradient-to-br from-amber-50/80 to-white border-amber-300/70 shadow-2xs'
                : 'bg-white border-slate-200/90 shadow-2xs'
            }`}
            aria-label="Patients needing review"
          >
            <div className="px-4 py-3 border-b border-amber-200/60 flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm text-[#101c28] flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${needsReview.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                  flag
                </span>
                Needs Review
                {needsReview.length > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    {needsReview.length}
                  </span>
                )}
              </h2>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:block">Clinical Review Recommended</span>
            </div>

            {needsReview.length === 0 ? (
              <div className="px-4 py-3.5 flex items-center gap-2 text-xs text-slate-600">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                No abnormal ECG classifications among your authorized patients.
              </div>
            ) : (
              <ul className="divide-y divide-amber-200/50">
                {needsReview.map((patient) => {
                  const prediction = patient.latestPrediction;
                  const classMeta = prediction ? getAamiClass(prediction.predictedClass) : null;
                  return (
                    <li key={patient.patientId}>
                      <button
                        onClick={() => openPatient(patient.patientId)}
                        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-amber-100/40 cursor-pointer transition-colors"
                      >
                        <PatientAvatar name={patient.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#101c28] truncate">{patient.name}</span>
                          <span className="block text-[11px] text-amber-800 font-semibold">
                            Abnormal ECG Classification — {classMeta?.name ?? 'unclassified'}
                            {prediction ? ` · ${(prediction.confidence * 100).toFixed(1)}% confidence` : ''}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {patient.latestAnalysisAt
                              ? `last analysis ${formatTimestamp(patient.latestAnalysisAt)}`
                              : 'analysis time unknown'}
                          </span>
                        </span>
                        {prediction && (
                          <AamiClassBadge
                            code={prediction.predictedClass as AamiClassCode}
                            variant="compact"
                            size="md"
                          />
                        )}
                        <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">chevron_right</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {needsReview.length > 0 && (
              <p className="px-4 py-2.5 border-t border-amber-200/60 bg-white/60 text-[10px] text-slate-500 leading-relaxed">
                Abnormal finding = any non-Normal AAMI EC57 heartbeat classification (S/V/F/Q) from the QML model.
                This is an ECG classification flag, not a disease diagnosis — clinical review recommended.
              </p>
            )}
          </section>

          {/* 3b. My availability (publish/manage slots) */}
          <MyAvailabilitySection />

          {/* 3c. Upcoming appointments (doctor side) */}
          <DoctorAppointmentsSection />

          {/* 4. Patients */}
          <section aria-label="Patients" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-sm text-[#101c28]">Patients</h2>
              <span className="text-[10px] font-mono text-slate-400">
                {patients.length} authorized via appointments · click to open records
              </span>
            </div>

            {patients.length === 0 ? (
              <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">group_off</span>
                </div>
                <p className="text-sm font-bold text-[#101c28]">No authorized patients yet.</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Patients appear here when a scheduled or completed appointment links them to your doctor profile.
                  Ask patients to book an appointment with you from their Dr. Radar home screen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {patients.map((patient) => (
                  <PatientCard key={patient.patientId} patient={patient} onOpen={() => openPatient(patient.patientId)} />
                ))}
              </div>
            )}
          </section>

          {/* 5. Recent ECG analyses */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3" aria-label="Recent ECG analyses">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400">history_edu</span>
              Recent ECG Analyses
            </h2>

            {recentAnalyses.length === 0 ? (
              <p className="text-xs text-slate-500">
                No stored patient analyses yet. When an authorized patient saves an ECG analysis, it appears here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAnalyses.map((patient) => {
                  const prediction = patient.latestPrediction;
                  return (
                    <div key={patient.patientId} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#101c28] truncate">{patient.name}</span>
                          {prediction && (
                            <AamiClassBadge code={prediction.predictedClass as AamiClassCode} variant="compact" size="xs" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {patient.latestAnalysisAt ? formatTimestamp(patient.latestAnalysisAt) : ''}
                          {prediction ? ` · ${(prediction.confidence * 100).toFixed(1)}%` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => openPatient(patient.patientId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        View Record
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 6. Talk With Patient + consultation note (existing functionality) */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#bc000a]">chat</span>
              Talk With Patient
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Consultations run through your scheduled appointments. Open a patient's record to review their shared
              health data, then discuss findings with them in the consultation. Real-time messaging is not part of the
              platform yet — appointment details and consultation notes are stored with each appointment.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate('doctor-patients')}
                className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#920008] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">forum</span>
                Open Patient Consultations
              </button>
              <button
                onClick={() => onNavigate('doctor-ecg-records')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">ecg_heart</span>
                Patient ECG Records
              </button>
            </div>
          </section>

          {/* Medical wording disclaimer */}
          <p className="text-[10px] text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
            ECG classifications are AAMI EC57 heartbeat categories (N/S/V/F/Q) produced by the QML model. They are
            stored model outputs — not validated cardiovascular-disease probabilities or diagnoses. Abnormal findings
            are flagged for clinical review.
          </p>
        </>
      )}
    </div>
  );
};
