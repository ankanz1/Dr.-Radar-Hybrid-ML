import React, { useState } from 'react';
import { EmergencyNotice } from '../../types/recommendations';

interface EmergencySymptomsNoticeProps {
  notice: EmergencyNotice;
  isUrgentResult?: boolean;
}

export const EmergencySymptomsNotice: React.FC<EmergencySymptomsNoticeProps> = ({
  notice,
  isUrgentResult = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(isUrgentResult);

  return (
    <div className="rounded-2xl border border-rose-200/90 bg-[#fff8f8] p-4 text-xs space-y-2.5 shadow-2xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-rose-100 text-[#bc000a] flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[18px]">emergency</span>
          </div>
          <div>
            <span className="font-bold text-[#bc000a] text-xs uppercase tracking-wide block">
              Emergency Warning Signs
            </span>
            <p className="text-slate-700 font-medium mt-0.5 leading-relaxed">
              These symptoms may require immediate medical attention. Please seek emergency care now.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-semibold text-[#bc000a] hover:underline flex items-center gap-0.5 shrink-0 pt-0.5 cursor-pointer"
        >
          <span>{isExpanded ? 'Hide' : 'Check Signs'}</span>
          <span className="material-symbols-outlined text-[16px]">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="pt-2 border-t border-rose-100 space-y-2.5 animate-in fade-in">
          <p className="text-slate-600 leading-relaxed text-[11.5px]">
            If you or anyone around you is experiencing any of the following, do not wait for AI analysis or test results:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700">
            {notice.symptomsList.map((symptom, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-[#bc000a] font-bold text-[13px] leading-none mt-0.5">•</span>
                <span>{symptom}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <a
              href="tel:911"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#bc000a] hover:bg-[#a00008] text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">call</span>
              <span>Call Emergency Services (911)</span>
            </a>
            <span className="text-[11px] text-slate-500 italic">
              Dr. Radar is an informational decision-support assistant, not an emergency medical service.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
