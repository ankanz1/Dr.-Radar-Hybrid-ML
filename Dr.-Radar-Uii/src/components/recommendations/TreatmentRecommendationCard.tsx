import React, { useState } from 'react';
import { TreatmentCarePlan, ClinicalContextInput } from '../../types/recommendations';
import { generateCareRecommendations } from '../../services/careRecommendationEngine';
import { UrgencyIndicator } from './UrgencyIndicator';
import { EmergencySymptomsNotice } from './EmergencySymptomsNotice';
import { AssistantContext } from '../../types/assistant';

interface TreatmentRecommendationCardProps {
  carePlan?: TreatmentCarePlan;
  clinicalInput?: ClinicalContextInput;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  onBookAppointment?: () => void;
  onShareWithDoctor?: () => void;
  compact?: boolean;
  className?: string;
  sourceContextTitle?: string;
}

export const TreatmentRecommendationCard: React.FC<TreatmentRecommendationCardProps> = ({
  carePlan: propPlan,
  clinicalInput,
  onOpenAssistant,
  onBookAppointment,
  onShareWithDoctor,
  compact = false,
  className = '',
  sourceContextTitle,
}) => {
  const [showGlossary, setShowGlossary] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Derive or generate the plan
  const plan: TreatmentCarePlan =
    propPlan ||
    (clinicalInput
      ? generateCareRecommendations(clinicalInput)
      : generateCareRecommendations({
          modality: 'ecg',
          resultCode: 'N',
          findingTitle: 'Normal Sinus Rhythm',
        }));

  const { resultSummary, urgency, recommendations, plainLanguageGlossary } = plan;

  const handleAskDrRadar = () => {
    if (!onOpenAssistant) return;

    const assistantContext: AssistantContext = {
      type: 'ecg',
      title: `${resultSummary.findingTitle} • Care Guidance`,
      subtitle: `${urgency.label} • Dr. Radar Decision-Support`,
      prediction: resultSummary.classificationLabel,
      confidence: resultSummary.confidence,
      findings: resultSummary.whatThisMeans,
    };

    const suggestedQuery = resultSummary.isAbnormal
      ? `What do these care recommendations mean for my ${resultSummary.classificationLabel} result, and what questions should I ask my doctor?`
      : 'Can you explain these next steps and what healthy habits support this normal rhythm?';

    onOpenAssistant(assistantContext, suggestedQuery);
  };

  const handleShareClick = () => {
    if (onShareWithDoctor) {
      onShareWithDoctor();
    }
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3000);
  };

  return (
    <div
      id="treatment-care-recommendation-card"
      className={`rounded-3xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden ${className}`}
    >
      {/* Top Banner / Card Title */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-b from-[#fbfcfe] to-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              CARE GUIDANCE
            </span>
            <span className="text-xs font-mono text-slate-500">
              {sourceContextTitle || plan.modalityName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <UrgencyIndicator level={urgency.level} label={urgency.label} />
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {plan.doctorReviewStatus === 'reviewed' ? 'Clinician Reviewed' : 'Recommended for Clinician Review'}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#101c28] tracking-tight">
            {plan.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{plan.subtitle}</p>
        </div>

        {/* Clinical Result & "What This Means" Summary */}
        <div className="p-4 rounded-2xl bg-[#f8fbfe] border border-slate-200/80 space-y-2 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">
                {resultSummary.isNormal ? 'task_alt' : 'vital_signs'}
              </span>
              <span className="font-bold text-sm text-[#101c28]">
                {resultSummary.findingTitle}
              </span>
            </div>
            {resultSummary.confidence && (
              <span className="text-[11px] font-mono text-slate-500">
                Confidence: <strong className="text-slate-800">{resultSummary.confidence}</strong>
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              What This Means
            </span>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {resultSummary.whatThisMeans}
            </p>
          </div>

          {/* Trend Notice (if patient has prior reading) */}
          {resultSummary.trendNotice && (
            <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-xs text-[#0c3156] bg-blue-50/60 p-2.5 rounded-xl border border-blue-100/80">
              <span className="material-symbols-outlined text-[16px] text-blue-700 shrink-0 mt-0.5">
                trending_up
              </span>
              <div className="space-y-0.5">
                <span className="font-bold block text-[11px] uppercase tracking-wider text-blue-900">
                  Result History & Trend Context
                </span>
                <p className="text-[11.5px] leading-relaxed text-blue-800">
                  {resultSummary.trendNotice}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Body: Prioritized Recommended Next Steps */}
      <div className="p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">checklist</span>
              Recommended Next Steps
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {recommendations.length} Actionable Steps
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Organized by clinical priority to assist your follow-up decisions.
          </p>
        </div>

        {/* Recommendation Items List */}
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.id}
              className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50/50 transition-all flex items-start gap-3.5 shadow-2xs"
            >
              {/* Number Badge & Icon */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <span className="w-6 h-6 rounded-full bg-[#101c28] text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="material-symbols-outlined text-[16px] text-slate-400 mt-1.5">
                  {rec.icon}
                </span>
              </div>

              {/* Text Content */}
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border ${
                      rec.category === 'next_step'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : rec.category === 'monitor'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : rec.category === 'follow_up'
                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {rec.categoryLabel}
                  </span>
                  <h4 className="text-sm font-bold text-[#101c28]">{rec.title}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Medication Safety & No Cure Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="material-symbols-outlined text-[16px] text-[#bc000a]">medication</span>
            <span>Medication & Treatment Safety</span>
          </div>
          <p className="leading-relaxed text-[11.5px]">
            {plan.medicationGuidance ||
              'Discuss your current medications with your clinician. Your healthcare professional may consider whether medication is appropriate. Do not start, stop, or change prescribed medication without speaking with your healthcare professional.'}
          </p>
          <p className="text-[11px] text-slate-500 italic">
            Treatment options and outcomes depend on a confirmed clinical diagnosis and evaluation by a licensed healthcare provider.
          </p>
        </div>

        {/* Plain Language Medical Glossary Toggle */}
        {plainLanguageGlossary && plainLanguageGlossary.length > 0 && (
          <div className="border border-slate-200/80 rounded-2xl p-3.5 bg-white space-y-2">
            <button
              type="button"
              onClick={() => setShowGlossary(!showGlossary)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#101c28] cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">help</span>
                <span>Medical Terms Explained in Plain Language</span>
              </div>
              <span className="material-symbols-outlined text-[18px]">
                {showGlossary ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showGlossary && (
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs animate-in fade-in">
                {plainLanguageGlossary.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-50 space-y-0.5">
                    <span className="font-bold text-[#101c28] block text-[11.5px]">
                      {item.term}:
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{item.plainMeaning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency Symptoms Notice */}
        <EmergencySymptomsNotice
          notice={plan.emergencyNotice}
          isUrgentResult={urgency.level === 'urgent' || urgency.level === 'emergency'}
        />

        {/* Primary Patient Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            What Should I Do Next?
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Ask Dr. Radar CTA */}
            <button
              id="recommendation-ask-dr-radar-btn"
              type="button"
              onClick={handleAskDrRadar}
              className="py-3 px-4 rounded-2xl bg-[#ffe8e8] hover:bg-[#ffdcdc] text-[#bc000a] border border-[#bc000a]/25 text-xs sm:text-sm font-bold shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-98"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">
                smart_toy
              </span>
              <span>Ask Dr. Radar About This</span>
            </button>

            {/* Book / Contact Doctor CTA */}
            <button
              id="recommendation-book-doctor-btn"
              type="button"
              onClick={onBookAppointment}
              className="py-3 px-4 rounded-2xl bg-[#101c28] hover:bg-[#bc000a] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-98"
            >
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              <span>Book / Contact Healthcare Professional</span>
            </button>
          </div>

          {/* Clinician Review / Share Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleShareClick}
              className="text-xs font-semibold text-slate-600 hover:text-[#bc000a] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {shareSuccess ? 'check_circle' : 'share'}
              </span>
              <span>
                {shareSuccess
                  ? 'Flagged for Clinician Review!'
                  : 'Share Result & Recommendations with Doctor'}
              </span>
            </button>

            <span className="text-[10px] font-mono text-slate-400">
              ID: {plan.id.slice(0, 16)}
            </span>
          </div>
        </div>

        {/* AI Transparency Disclaimer */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10.5px] text-slate-500 text-center leading-relaxed">
            {plan.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};
