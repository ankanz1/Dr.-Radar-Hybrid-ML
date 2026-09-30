import type React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ScreenTab, UserAccountState } from '../types';
import { loadHealthAssessment } from '../services/healthProfileService';
import { fetchPatientEcgUploads, StoredEcgUpload } from '../services/ecgUploadService';
import { fetchEcgHistory, EcgHistoryEntry } from '../services/ecgPersistence';
import { fetchMyAppointments, AppointmentView } from '../services/doctorDirectoryService';
import { getAamiClass } from '../data/aamiClassSystem';
import { AamiClassBadge } from './AamiClassBadge';
import { AamiClassCode } from '../data/aamiClassSystem';
import { formatAppointmentDate, formatAppointmentTime } from '../lib/appointmentTime';

/**
 * Journey step 1 — Patient Home ("How is your health?").
 *
 * Everything shown comes from the database:
 *   - latest assessment   -> public.health_profiles (via healthProfileService)
 *   - latest ECG analysis -> public.ecg_records + predictions (via fetchEcgHistory)
 *   - latest saved record -> public.ecg_uploads (via fetchPatientEcgUploads)
 *   - doctor connection   -> public.appointments (via fetchMyAppointments)
 *   - upcoming consult    -> first scheduled appointment
 *
 * No fabricated health scores, no fake results: a section with no data shows an
 * honest empty state and points to the next journey step.
 */

interface JourneyHomeScreenProps {
  user: UserAccountState;
  onNavigate: (tab: ScreenTab) => void;
}

type LoadState<T> =
  | { phase: 'loading' }
  | { phase: 'ready'; data: T };

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const JourneyHomeScreen: React.FC<JourneyHomeScreenProps> = ({ user, onNavigate }) => {
  const [assessment, setAssessment] = useState<LoadState<{ savedAt: string | null; completion: number }>>({
    phase: 'loading',
  });
  const [latestAnalysis, setLatestAnalysis] = useState<LoadState<EcgHistoryEntry | null>>({ phase: 'loading' });
  const [latestRecord, setLatestRecord] = useState<LoadState<StoredEcgUpload | null>>({ phase: 'loading' });
  const [appointments, setAppointments] = useState<LoadState<AppointmentView[]>>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const assessmentResult = await loadHealthAssessment();
      if (!cancelled) {
        setAssessment({
          phase: 'ready',
          data: {
            savedAt: assessmentResult.ok ? assessmentResult.assessment?.lastUpdated ?? null : null,
            completion: assessmentResult.ok ? assessmentResult.assessment?.completionPercentage ?? 0 : 0,
          },
        });
      }

      const historyResult = await fetchEcgHistory(10);
      if (!cancelled) {
        setLatestAnalysis({ phase: 'ready', data: historyResult.ok ? historyResult.entries?.[0] ?? null : null });
      }

      const uploadsResult = await fetchPatientEcgUploads(10);
      if (!cancelled) {
        setLatestRecord({ phase: 'ready', data: uploadsResult.ok ? uploadsResult.uploads?.[0] ?? null : null });
      }

      const appointmentsResult = await fetchMyAppointments(20);
      if (!cancelled) {
        setAppointments({ phase: 'ready', data: appointmentsResult.ok ? appointmentsResult.appointments : [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user.displayName?.split(' ')[0] || user.firstName || 'there';
  const upcoming = appointments.phase === 'ready' ? appointments.data.find((a) => a.status === 'scheduled') ?? null : null;
  const doctorConnected = appointments.phase === 'ready' && appointments.data.length > 0;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* ================= Greeting + primary CTA ================= */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs space-y-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            {greetingForNow()}, {firstName}
          </h1>
          <p className="text-base sm:text-lg font-semibold text-[#bc000a] mt-1">Let's check your health</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg leading-relaxed">
            Complete a quick assessment and upload your health records for analysis.
          </p>
        </div>

        <button
          id="journey-start-assessment-btn"
          onClick={() => onNavigate('journey-assessment')}
          className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-[#bc000a] text-white text-sm font-bold hover:bg-[#a00008] transition-all shadow-md shadow-[#bc000a]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
          Start Health Assessment
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </motion.section>

      {/* ================= Recent Health Activity ================= */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">Recent Health Activity</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* --- Latest ECG --- */}
          <button
            onClick={() => onNavigate('journey-records')}
            className="text-left bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest ECG</span>
              <span className="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-[#bc000a]">ecg_heart</span>
            </div>
            {latestAnalysis.phase === 'loading' ? (
              <span className="text-xs text-slate-400">Loading…</span>
            ) : latestAnalysis.data && latestAnalysis.data.prediction ? (
              <>
                <div className="flex items-center gap-2">
                  <AamiClassBadge
                    code={latestAnalysis.data.prediction.predictedClass as AamiClassCode}
                    variant="compact"
                    size="sm"
                  />
                  <span className="text-xs font-bold text-[#101c28]">
                    {getAamiClass(latestAnalysis.data.prediction.predictedClass).name}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1 font-mono">
                  {formatDate(latestAnalysis.data.recordedAt)} · {(latestAnalysis.data.prediction.confidence * 100).toFixed(0)}%
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500">No analysis yet</span>
            )}
          </button>

          {/* --- Latest record --- */}
          <button
            onClick={() => onNavigate('journey-upload')}
            className="text-left bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Health Record</span>
              <span className="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-[#bc000a]">folder_shared</span>
            </div>
            {latestRecord.phase === 'loading' ? (
              <span className="text-xs text-slate-400">Loading…</span>
            ) : latestRecord.data ? (
              <>
                <span className="text-xs font-bold text-[#101c28] block truncate">{latestRecord.data.fileName}</span>
                <span className="text-[11px] text-slate-500 block mt-1 font-mono">{formatDate(latestRecord.data.createdAt)}</span>
              </>
            ) : (
              <span className="text-xs text-slate-500">No record uploaded yet</span>
            )}
          </button>

          {/* --- Doctor --- */}
          <button
            onClick={() => onNavigate(doctorConnected ? 'journey-appointments' : 'journey-doctors')}
            className="text-left bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Doctor</span>
              <span className="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-[#bc000a]">stethoscope</span>
            </div>
            {appointments.phase === 'loading' ? (
              <span className="text-xs text-slate-400">Loading…</span>
            ) : doctorConnected ? (
              <>
                <span className="text-xs font-bold text-[#101c28] block truncate">
                  {upcoming ? upcoming.doctorName : 'Connected'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  {upcoming ? 'Upcoming consultation' : 'View appointments'}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500">Not connected yet</span>
            )}
          </button>
        </div>

        {/* --- Assessment status strip --- */}
        <button
          onClick={() => onNavigate('journey-assessment')}
          className="w-full text-left bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer flex items-center gap-3"
        >
          <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">checklist</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[#101c28]">
              {assessment.phase === 'loading'
                ? 'Checking assessment…'
                : assessment.data.savedAt
                ? `Health assessment saved — ${assessment.data.completion}% complete`
                : 'Health assessment not started'}
            </span>
            <span className="block text-[11px] text-slate-500">
              {assessment.phase === 'ready' && assessment.data.savedAt
                ? `Last updated ${formatDate(assessment.data.savedAt)} — tap to review`
                : 'A few quick questions to give your doctor context'}
            </span>
          </span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">chevron_right</span>
        </button>

        {/* --- Roadmap preview entry (Phase 5/6/7 prototype screens) --- */}
        <button
          id="journey-roadmap-preview-btn"
          onClick={() => onNavigate('multidisease')}
          className="w-full text-left bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer flex items-center gap-3"
        >
          <span className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">science</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#101c28]">Explore Health Roadmap</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                Preview
              </span>
            </span>
            <span className="block text-[11px] text-slate-500">
              Upcoming analysis areas — skin, imaging, labs, multimodal & research tools
            </span>
          </span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">chevron_right</span>
        </button>

        {/* --- Upcoming consultation --- */}
        {upcoming && (
          <button
            onClick={() => onNavigate('journey-appointments')}
            className="w-full text-left bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/40 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer flex items-center gap-3"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">event_available</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[#101c28]">Upcoming consultation</span>
              <span className="block text-[11px] text-slate-600">
                {upcoming.doctorName} ·{' '}
                {formatAppointmentDate(upcoming.startTime)} · {formatAppointmentTime(upcoming.startTime)}
              </span>
            </span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">chevron_right</span>
          </button>
        )}
      </section>

      {/* Disclaimer */}
      <p className="text-center text-[10px] font-mono text-slate-400 pt-1">
        Dr. Radar provides automated decision-support output — not medical diagnoses.
      </p>
    </div>
  );
};
