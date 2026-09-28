import type React from 'react';
import { useState, useEffect } from 'react';
import { ScreenTab } from '../types';
import { fetchMyAppointments, AppointmentView } from '../services/doctorDirectoryService';
import { saveJourneyResume, clearJourneyResume } from '../services/journeyState';

/**
 * Journey step 10 (patient side) — Appointments & Talk With Patient.
 *
 * Lists the signed-in patient's OWN appointment rows (RLS
 * appointments_select_own from migration 007). This is the entry point to the
 * consultation workflow: the appointment is the authorization that lets the
 * doctor see shared health data, and the doctor's dashboard offers the
 * consultation entry point.
 *
 * Honesty rule (requirement 10): real-time chat is NOT implemented in the
 * backend, so nothing here pretends to chat. The screen connects the patient
 * to the existing consultation/appointment workflow and states plainly that
 * discussion happens in the consultation.
 */

interface PatientJourneyAppointmentsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  /** Opens the chat screen scoped to THIS appointment (card Chat button). */
  onOpenChat?: (appointmentId: string) => void;
}

type AppointmentsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; appointments: AppointmentView[] };

function formatDateTime(iso: string): string {
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

const STATUS_META: Record<AppointmentView['status'], { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show: { label: 'Missed', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

export const PatientJourneyAppointmentsScreen: React.FC<PatientJourneyAppointmentsScreenProps> = ({ onNavigate, onOpenChat }) => {
  const [state, setState] = useState<AppointmentsState>({ phase: 'loading' });

  useEffect(() => {
    saveJourneyResume('journey-appointments');
    return () => clearJourneyResume();
  }, []);

  const load = async () => {
    setState({ phase: 'loading' });
    const result = await fetchMyAppointments();
    if (result.ok) {
      setState({ phase: 'ready', appointments: result.appointments });
    } else {
      setState({ phase: 'error', message: result.error });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upcoming = state.phase === 'ready' ? state.appointments.filter((a) => a.status === 'scheduled') : [];
  const past = state.phase === 'ready' ? state.appointments.filter((a) => a.status !== 'scheduled') : [];

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Appointments</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Your consultations. A scheduled appointment lets your doctor view the health data you share.
        </p>
      </div>

      {/* Loading */}
      {state.phase === 'loading' && (
        <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading your appointments…
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-2" role="alert">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            Could not load your appointments
          </div>
          <p className="font-mono">{state.message}</p>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {state.phase === 'ready' && state.appointments.length === 0 && (
        <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">calendar_today</span>
          </div>
          <p className="text-sm font-bold text-[#101c28]">No appointments yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Connect with a doctor to schedule your first consultation.
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

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Upcoming</h2>
          {upcoming.map((appointment) => (
            <article key={appointment.id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">stethoscope</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#101c28]">{appointment.doctorName}</h3>
                    <p className="text-[11px] text-slate-500">{appointment.doctorSpecialty ?? 'Consultation'}</p>
                    <p className="text-xs font-semibold text-[#101c28] mt-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600">event_available</span>
                      {formatDateTime(appointment.startTime)}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${STATUS_META[appointment.status].className}`}>
                  {STATUS_META[appointment.status].label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                {appointment.consultationType && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 capitalize">
                    {appointment.consultationType.replace('_', '-')}
                  </span>
                )}
                {appointment.reason && <span className="truncate max-w-xs">“{appointment.reason}”</span>}
              </div>

              {/* Consultation entry point — honest about what exists */}
              <div className="p-3 bg-[#f8fbfe] rounded-2xl border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#bc000a] shrink-0 mt-0.5">chat</span>
                <p>
                  <strong>Talk with your doctor:</strong> discuss this appointment and your results during the
                  consultation. Your doctor can see the analysis and records you shared through Dr. Radar.
                </p>
              </div>

              {/* Chat action: opens the appointment-scoped conversation for THIS card */}
              <div>
                <button
                  id={`appointment-chat-${appointment.id}`}
                  onClick={(event) => {
                    event.stopPropagation(); // cards are not clickable, but never bubble a card-level action
                    if (onOpenChat) onOpenChat(appointment.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  Chat
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Past</h2>
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            {past.map((appointment) => (
              <div key={appointment.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#101c28] truncate">{appointment.doctorName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{formatDateTime(appointment.startTime)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${STATUS_META[appointment.status].className}`}>
                    {STATUS_META[appointment.status].label}
                  </span>
                  <button
                    id={`appointment-chat-${appointment.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onOpenChat) onOpenChat(appointment.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#bc000a] text-white text-[10.5px] font-bold hover:bg-[#a00008] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">chat</span>
                    Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      {state.phase === 'ready' && state.appointments.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => onNavigate('journey-doctors')}
            className="text-xs font-semibold text-[#bc000a] hover:underline cursor-pointer"
          >
            Connect with another doctor
          </button>
        </div>
      )}
    </div>
  );
};
