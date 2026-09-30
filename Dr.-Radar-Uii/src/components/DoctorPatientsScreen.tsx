import React, { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../types';
import {
  fetchAuthorizedPatients,
  DoctorIdentity,
  AuthorizedPatient,
} from '../services/doctorEcgService';
import {
  fetchMyDoctorAppointments,
  DoctorAppointmentView,
} from '../services/doctorAvailabilityService';
import { getAuthenticatedDoctor } from '../services/doctorEcgService';
import { AamiClassBadge } from './AamiClassBadge';
import { AamiClassCode, getAamiClass } from '../data/aamiClassSystem';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { formatAppointmentDate, formatAppointmentTime } from '../lib/appointmentTime';

/**
 * Doctor → Patients (upgraded).
 *
 * The previous version of this screen rendered a hardcoded mock roster with
 * fabricated medications, allergies and benchmark ECG beats. It is now built
 * on the SAME real data layer the doctor dashboard uses:
 *   - Roster: fetchAuthorizedPatients — the patients rows RLS returns for this
 *     doctor (appointment-authorized only, migration 007), each carrying the
 *     patient's latest STORED ECG classification + confidence + timestamp.
 *   - Upcoming appointments: fetchMyDoctorAppointments — the doctor's own
 *     appointment rows (doctor_own_appointment_ids), used to show each
 *     patient's next scheduled slot with its exact stored date/time.
 *
 * Nothing medical is fabricated: fields the database does not have are shown
 * as "—", never invented. Review status derives only from the stored AAMI
 * classification (non-N = flagged for review — an ECG classification flag,
 * NOT a diagnosis).
 */

interface DoctorPatientsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  /** Deep-link: pre-select this patient (best effort — noop if not authorized). */
  initialPatientId?: string;
  /** Opens the patient's ECG records in the existing doctor records screen. */
  onSelectPatient?: (patientId: string) => void;
}

type PatientsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      doctor: DoctorIdentity;
      patients: AuthorizedPatient[];
      warning?: string;
    };

type ReviewStatus = 'needs-review' | 'normal' | 'no-data';

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

/** Age in completed years from a DOB timestamp; null when absent/invalid. */
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function getReviewStatus(patient: AuthorizedPatient): ReviewStatus {
  const code = patient.latestPrediction?.predictedClass;
  if (!code) return 'no-data';
  return code.trim().toUpperCase() !== 'N' ? 'needs-review' : 'normal';
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
      data-testid="patient-review-status"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const PatientAvatar: React.FC<{ name: string }> = ({ name }) => {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      data-testid="patient-avatar"
      className="w-11 h-11 rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0 font-extrabold text-sm select-none"
    >
      {initials}
    </span>
  );
};

/** Earliest still-future scheduled appointment per patient id. */
function upcomingAppointmentByPatient(
  appointments: DoctorAppointmentView[]
): Map<string, DoctorAppointmentView> {
  const now = Date.now();
  const byPatient = new Map<string, DoctorAppointmentView>();
  for (const appointment of appointments) {
    if (appointment.status !== 'scheduled') continue;
    if (new Date(appointment.startTime).getTime() < now) continue;
    const current = byPatient.get(appointment.patientId);
    if (
      !current ||
      new Date(appointment.startTime).getTime() < new Date(current.startTime).getTime()
    ) {
      byPatient.set(appointment.patientId, appointment);
    }
  }
  return byPatient;
}

interface PatientCardProps {
  patient: AuthorizedPatient;
  upcoming: DoctorAppointmentView | undefined;
  onOpenRecords: () => void;
  onViewAppointments: () => void;
  onOpenChat: () => void;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  upcoming,
  onOpenRecords,
  onViewAppointments,
  onOpenChat,
}) => {
  const status = getReviewStatus(patient);
  const prediction = patient.latestPrediction;
  const classMeta = prediction ? getAamiClass(prediction.predictedClass) : null;
  const age = ageFromDob(patient.dob);

  return (
    <article
      data-testid="patient-card"
      className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col gap-3 transition-all hover:shadow-md ${
        status === 'needs-review' ? 'border-amber-300/80 ring-1 ring-amber-100' : 'border-slate-200/90'
      }`}
    >
      {/* Identity row */}
      <div className="flex items-start gap-3">
        <PatientAvatar name={patient.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#101c28] truncate" data-testid="patient-name">
            {patient.name}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{patient.email ?? 'no email visible'}</p>
          <p className="text-[11px] text-slate-500 mt-0.5" data-testid="patient-demographics">
            {age !== null ? `${age} yrs` : 'Age —'}
            {patient.gender ? ` · ${patient.gender}` : ''}
          </p>
        </div>
        <ReviewStatusChip status={status} />
      </div>

      {/* Latest stored ECG classification (real data only) */}
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Latest ECG classification
          </span>
          {patient.latestAnalysisAt && (
            <span className="text-[10px] text-slate-400 font-mono">
              {formatRelative(patient.latestAnalysisAt)}
            </span>
          )}
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
      </div>

      {/* Upcoming appointment (exact stored date + time) */}
      <div data-testid="patient-upcoming" className="flex items-center gap-2 text-[11px]">
        <span className="material-symbols-outlined text-[15px] text-emerald-600">event_available</span>
        {upcoming ? (
          <span className="text-slate-600 truncate">
            Next:{' '}
            <span className="font-semibold text-[#101c28]">
              {formatAppointmentDate(upcoming.startTime)} · {formatAppointmentTime(upcoming.startTime)}
            </span>
          </span>
        ) : (
          <span className="text-slate-400">No upcoming appointment</span>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={onOpenRecords}
          className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-[11px] font-bold hover:bg-[#a00008] cursor-pointer flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">folder_open</span>
          Open Records
        </button>
        <button
          onClick={onViewAppointments}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px] text-[#bc000a]">calendar_month</span>
          Appointments
        </button>
        <button
          onClick={onOpenChat}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px] text-[#bc000a]">chat</span>
          Chat
        </button>
      </div>
    </article>
  );
};

export const DoctorPatientsScreen: React.FC<DoctorPatientsScreenProps> = ({
  onNavigate,
  onSelectPatient,
}) => {
  const [state, setState] = useState<PatientsState>({ phase: 'loading' });
  const [appointments, setAppointments] = useState<DoctorAppointmentView[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ phase: 'loading' });
      const doctorResult = await getAuthenticatedDoctor();
      if (cancelled) return;

      if (doctorResult.status === 'signed-out' || doctorResult.status === 'no-doctor-record') {
        setState({
          phase: 'error',
          message:
            doctorResult.status === 'signed-out'
              ? 'Sign in with your doctor account to view patient records.'
              : 'No doctor profile (public.doctors) is linked to this account.',
        });
        return;
      }
      if (doctorResult.status === 'error') {
        setState({ phase: 'error', message: doctorResult.error });
        return;
      }

      const [patientsResult, appointmentsResult] = await Promise.all([
        fetchAuthorizedPatients(),
        fetchMyDoctorAppointments(),
      ]);
      if (cancelled) return;

      if (!patientsResult.ok || !patientsResult.data) {
        setState({ phase: 'error', message: patientsResult.error ?? 'Could not load patients.' });
        return;
      }

      setAppointments(appointmentsResult.ok ? appointmentsResult.appointments ?? [] : []);

      setState({
        phase: 'ready',
        doctor: { doctorId: doctorResult.doctorId, displayName: doctorResult.displayName },
        patients: patientsResult.data,
        warning:
          patientsResult.error ??
          (appointmentsResult.ok ? undefined : appointmentsResult.error ?? undefined),
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingByPatient = useMemo(
    () => upcomingAppointmentByPatient(appointments),
    [appointments]
  );

  const patients = state.phase === 'ready' ? state.patients : [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        (patient.email ?? '').toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  const openRecords = (patientId: string) => {
    onSelectPatient?.(patientId);
    onNavigate('doctor-ecg-records');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • PATIENTS
            </span>
            <span className="text-[11px] font-mono text-slate-500">RLS-enforced access</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            {state.phase === 'ready' ? state.doctor.displayName : 'Patients'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your appointment-authorized patients with their latest stored ECG classifications and
            upcoming appointments.
          </p>
        </div>
        {state.phase === 'ready' && (
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold shrink-0 self-start sm:self-auto">
            {patients.length} authorized · doctor {state.doctor.doctorId.slice(0, 8)}…
          </span>
        )}
      </div>

      {/* Loading */}
      {state.phase === 'loading' && (
        <div data-testid="patients-loading" className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading your authorized patients…
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div data-testid="patients-error" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-1" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Patients list unavailable
          </div>
          <p className="font-mono">{state.message}</p>
        </div>
      )}

      {state.phase === 'ready' && (
        <>
          {state.warning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs" role="status">
              {state.warning}
            </div>
          )}

          {/* Search */}
          <div className="relative" data-testid="patients-search">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              id="patient-search-input"
              type="text"
              placeholder="Search patients by name or email…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear patient search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#101c28] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>

          {/* Empty roster (real state: no appointment-authorized patients) */}
          {patients.length === 0 && (
            <div data-testid="patients-empty" className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">group_off</span>
              </div>
              <p className="text-sm font-bold text-[#101c28]">No authorized patients yet.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Patients appear here when a scheduled or completed appointment links them to your
                doctor profile. Ask patients to book an appointment with you from their Dr. Radar
                home screen.
              </p>
            </div>
          )}

          {/* Empty search result */}
          {patients.length > 0 && filtered.length === 0 && (
            <div data-testid="patients-search-empty" className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">person_search</span>
              </div>
              <p className="text-sm font-bold text-[#101c28]">No patients match “{searchQuery}”.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Patient cards */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5" data-testid="patients-grid">
              {filtered.map((patient) => (
                <PatientCard
                  key={patient.patientId}
                  patient={patient}
                  upcoming={upcomingByPatient.get(patient.patientId)}
                  onOpenRecords={() => openRecords(patient.patientId)}
                  onViewAppointments={() => onNavigate('doctor-dashboard')}
                  onOpenChat={() => onNavigate('doctor-messages')}
                />
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Access scope: patients linked to you by a scheduled or completed appointment (RLS
            appointments_select_own). ECG flags are AAMI EC57 heartbeat classifications from the QML
            model — decision-support output, not diagnoses.
          </p>
        </>
      )}

      <ClinicalDisclaimer />
    </div>
  );
};
