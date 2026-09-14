import React from 'react';
import { HealthContextSummary } from '../../types/healthInfo';

interface HealthContextIndicatorProps {
  summary: HealthContextSummary;
  onViewHealthInfo: () => void;
  onAddRecords?: () => void;
  variant?: 'results-card' | 'analysis-banner' | 'home-entry';
}

export const HealthContextIndicator: React.FC<HealthContextIndicatorProps> = ({
  summary,
  onViewHealthInfo,
  onAddRecords,
  variant = 'results-card',
}) => {
  // 1. Results Card Variant (Matches Section 10 explicitly)
  if (variant === 'results-card') {
    return (
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#bc000a]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Relevant Health Context
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Profile Baseline</span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>Symptoms provided: <strong className="text-[#101c28]">{summary.symptomsSummary}</strong></span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>
              {summary.recordsCount > 0
                ? `${summary.recordsCount} Previous Medical Record(s) available in profile`
                : 'Previous ECG & medical reports not yet uploaded'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>Medical history: <strong className="text-[#101c28]">{summary.conditionsSummary}</strong></span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Health Profile: {summary.completionPercentage}% complete
          </span>
          <button
            type="button"
            onClick={onViewHealthInfo}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>View Health Information</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Analysis Banner Variant (Matches Section 9)
  if (variant === 'analysis-banner') {
    return (
      <div className="bg-[#f8fafc] rounded-2xl p-4 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="material-symbols-outlined text-[20px] text-[#bc000a] shrink-0 mt-0.5">
            medical_information
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#101c28]">
                {summary.isAvailable ? 'Health context considered in evaluation' : 'No health context attached'}
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {summary.completionPercentage}% Complete
              </span>
            </div>
            <p className="text-slate-500 text-[11px] truncate mt-0.5">
              {summary.isAvailable
                ? `${summary.conditionsSummary} • ${summary.medicationsSummary}`
                : 'Complete your health profile to provide Dr. Radar with symptom onset and clinical baseline.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewHealthInfo}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer shrink-0 self-start sm:self-auto text-xs"
        >
          {summary.isAvailable ? 'View Health Context' : 'Complete Health Profile'}
        </button>
      </div>
    );
  }

  // 3. Home Screen Entry Variant (Section 2)
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0 shadow-2xs">
          <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
              PATIENT HEALTH CONTEXT
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {summary.completionPercentage}% Complete
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-[#101c28] mt-0.5">
            Help Dr. Radar understand your health context
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Provide your symptoms, existing conditions, medications, and prior reports so Dr. Radar can deliver more personalized care guidance.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
        {onAddRecords && (
          <button
            type="button"
            onClick={onAddRecords}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Add Medical Records
          </button>
        )}
        <button
          type="button"
          onClick={onViewHealthInfo}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#bc000a] hover:bg-[#a00008] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <span>Complete Profile</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
