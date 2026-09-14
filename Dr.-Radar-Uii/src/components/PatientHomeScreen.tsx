import React, { useState } from 'react';
import { ScreenTab, UserAccountState } from '../types';
import { FullReportModal } from './FullReportModal';
import { AssistantContext } from '../types/assistant';
import { TreatmentRecommendationCard } from './recommendations/TreatmentRecommendationCard';
import { HealthContextIndicator } from './health-info/HealthContextIndicator';
import { HealthContextSummary } from '../types/healthInfo';

interface PatientHomeScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings?: () => void;
  onSelectModalityPreview?: (testId: string) => void;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  user?: UserAccountState;
  onOpenProfilePictureModal?: () => void;
  healthSummary?: HealthContextSummary;
}

export const PatientHomeScreen: React.FC<PatientHomeScreenProps> = ({
  onNavigate,
  onSelectModalityPreview,
  onOpenAssistant,
  user,
  onOpenProfilePictureModal,
  healthSummary,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);
  const [previewAbnormalRec, setPreviewAbnormalRec] = useState(false);

  // Latest ECG Context for Ask Dr. Radar
  const latestEcgContext: AssistantContext = {
    type: 'ecg',
    title: 'ECG Telemetry (Lead II)',
    subtitle: 'Analyzed Today • 2:15 PM',
    sampleId: 'ECG-0248',
    patientName: 'Ashton Miller',
    patientId: 'PT-9042',
    prediction: 'Normal Sinus Rhythm',
    confidence: '98.4%',
    heartRate: 72,
    aamiClass: 'N',
    intervals: {
      prMs: 156,
      qrsMs: 88,
      qtMs: 390,
    },
    findings: 'Conduction intervals are regular and physiological. No ventricular ectopy or ischemic ST deviation detected.',
  };

  // Recent results list representing patient's verified test records
  const recentResults = [
    {
      id: 'res-ecg',
      modality: 'ECG Analysis',
      area: 'Cardiology',
      date: 'Today, 2:15 PM',
      status: 'Normal Sinus Rhythm',
      statusType: 'normal',
      metric: '72 BPM • 98.4% certainty',
      icon: 'vital_signs',
      actionLabel: 'View Waveform',
      tab: 'ecg-analysis' as ScreenTab,
    },
    {
      id: 'res-cxr',
      modality: 'Chest X-ray',
      area: 'Medical Imaging',
      date: 'Aug 14, 2023',
      status: 'Reviewed • Clear Lung Fields',
      statusType: 'normal',
      metric: 'Normal cardiothoracic ratio',
      icon: 'radiology',
      actionLabel: 'View Record',
      testId: 'imaging-cxr',
    },
    {
      id: 'res-diab',
      modality: 'Diabetes Risk',
      area: 'Chronic Disease',
      date: 'Jun 22, 2023',
      status: 'Low Risk Tier',
      statusType: 'normal',
      metric: 'HbA1c 5.4% • Glucose 92 mg/dL',
      icon: 'table_chart',
      actionLabel: 'View Record',
      testId: 'chronic-diabetes',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* 1. Header: DR. RADAR • Patient Greeting */}
      <div className="border-b border-slate-200/80 pb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight truncate">
            Good morning, {user?.displayName || user?.firstName || 'Ashton'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
            Here is your personal health overview, latest test analysis, and daily recommendations.
          </p>
        </div>
      </div>

      {/* 2. Contextual Health Information Entry Point */}
      {healthSummary && (
        <HealthContextIndicator
          summary={healthSummary}
          variant="home-entry"
          onViewHealthInfo={() => onNavigate('health-info')}
          onAddRecords={() => onNavigate('medical-records')}
        />
      )}

      {/* 3. YOUR LATEST ANALYSIS CARD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your Latest Analysis
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Analyzed Today • 2:15 PM</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold text-[#101c28]">
                ECG Analysis
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Normal rhythm
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
              Your heart beat pattern is regular and steady. Conduction intervals (PR: 156 ms, QRS: 88 ms) are within healthy physiological limits with no critical arrhythmias detected.
            </p>
            <div className="pt-1 flex items-center gap-4 text-xs">
              <span className="font-semibold text-slate-700">
                Heart Rate: <strong className="text-[#bc000a]">72 BPM</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700">
                Certainty: <strong className="text-emerald-700">98.4%</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2">
            <button
              id="patient-view-latest-result-btn"
              onClick={() => onNavigate('ecg-analysis')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#101c28] text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Result</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>

            {/* Direct Ask Dr. Radar Connection with ECG Context */}
            <button
              id="patient-ask-dr-radar-ecg-btn"
              onClick={() =>
                onOpenAssistant?.(
                  latestEcgContext,
                  'Can you explain my latest normal sinus rhythm ECG result?'
                )
              }
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#ffe8e8] text-[#bc000a] hover:bg-[#ffdcdc] border border-[#bc000a]/25 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              <span>Ask Dr. Radar</span>
            </button>

            <button
              onClick={() => onNavigate('results')}
              className="w-full sm:w-auto px-3 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors text-center"
            >
              View All Past Results
            </button>
          </div>
        </div>
      </div>

      {/* 3. THREE PATIENT QUESTIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Q1: What is my latest result? */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Question 1
            </span>
            <h3 className="text-sm font-bold text-[#101c28] mb-2">
              What is my latest result?
            </h3>
            <div className="bg-[#f0f7ff] rounded-xl p-3 border border-[#d2e5fb] mb-2">
              <span className="text-xs font-bold text-slate-900 block">
                Normal Sinus Rhythm
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                Resting rate 72 BPM. Electrophysiological conduction is steady and regular.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ecg-analysis')}
            className="text-xs font-semibold text-[#bc000a] hover:underline flex items-center gap-1 pt-2 cursor-pointer"
          >
            Review waveform details
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        {/* Q2: Is anything concerning? */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Question 2
              </span>
              <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                Low Risk
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#101c28] mb-2">
              Is anything concerning?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              No dangerous ventricular runs, ectopic burdens, or ischemic changes were found during this test cycle.
            </p>
          </div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 pt-2 cursor-pointer"
          >
            {showExplanation ? 'Hide plain language guide' : 'Read plain language guide'}
            <span className="material-symbols-outlined text-[14px]">
              {showExplanation ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Q3: What should I do next? */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Question 3
            </span>
            <h3 className="text-sm font-bold text-[#101c28] mb-2">
              What should I do next?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Maintain your daily routine. Take your scheduled morning 30-second trace tomorrow before breakfast.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={() => onNavigate('patient-ecg')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold text-center transition-colors cursor-pointer"
            >
              Take ECG Now
            </button>
            <button
              onClick={() => onNavigate('patient-appointments')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold text-center transition-colors cursor-pointer"
            >
              Book Doctor
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Plain Language Guide */}
      {showExplanation && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs text-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-[#101c28]">Understanding Your ECG Beat</span>
            <span className="text-[10px] text-slate-400">Patient Education</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="font-bold text-[#bc000a] block mb-1">P-Wave (Atria)</span>
              <p className="text-slate-600 leading-relaxed">
                Represents your upper heart chambers filling with blood. In your reading, this wave appears smooth and timely.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="font-bold text-[#bc000a] block mb-1">QRS Complex (Ventricles)</span>
              <p className="text-slate-600 leading-relaxed">
                The main heart contraction pumping blood through the body. Your complex width (88 ms) is normal and crisp.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="font-bold text-[#bc000a] block mb-1">T-Wave (Recovery)</span>
              <p className="text-slate-600 leading-relaxed">
                The electrical relaxation phase preparing for the next heartbeat. Steady and properly upright.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Patient Treatment & Care Recommendations Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#bc000a]">recommend</span>
            Personalized Care Guidance
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline">Scenario Preview:</span>
            <button
              type="button"
              onClick={() => setPreviewAbnormalRec(!previewAbnormalRec)}
              className="text-[11px] font-mono px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              {previewAbnormalRec ? 'Showing: Class V (Ectopic Beat)' : 'Showing: Class N (Normal Sinus)'} (Switch)
            </button>
          </div>
        </div>

        <TreatmentRecommendationCard
          clinicalInput={{
            modality: 'ecg',
            resultCode: previewAbnormalRec ? 'V' : 'N',
            findingTitle: previewAbnormalRec
              ? 'Potential Ventricular Ectopic Finding Detected'
              : 'Normal Sinus Rhythm (Current Recording)',
            classificationLabel: previewAbnormalRec
              ? 'Ventricular Ectopic Beat (Class V)'
              : 'Normal Sinus Rhythm (Class N)',
            confidence: previewAbnormalRec ? '94.2%' : '98.4%',
            patientContext: {
              patientName: 'Ashton Miller',
              age: 48,
              gender: 'Male',
              previousResult: 'Normal Sinus Rhythm',
              bpm: 64,
            },
          }}
          onOpenAssistant={onOpenAssistant}
          onBookAppointment={() => onNavigate('patient-appointments')}
          sourceContextTitle="Today's ECG Screening • Beat #100"
        />
      </div>

      {/* 4. START A NEW ANALYSIS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400">add_chart</span>
            Start a New Analysis
          </h2>
          <button
            onClick={() => onNavigate('analysis')}
            className="text-xs font-semibold text-[#bc000a] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            Explore Analysis Hub
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Cardiology */}
          <button
            onClick={() => onNavigate('analysis')}
            className="p-4 rounded-2xl bg-white border border-[#bc000a]/30 shadow-2xs hover:border-[#bc000a] transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">cardiology</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                Ready
              </span>
            </div>
            <span className="text-xs font-extrabold text-[#101c28] block">Cardiology</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">ECG & Arrhythmia</span>
          </button>

          {/* Card 2: Medical Imaging */}
          <button
            onClick={() => {
              if (onSelectModalityPreview) onSelectModalityPreview('imaging-cxr');
              onNavigate('reusable-analysis');
            }}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">radiology</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                Coming Soon
              </span>
            </div>
            <span className="text-xs font-bold text-[#101c28] block">Medical Imaging</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">X-ray, MRI & CT</span>
          </button>

          {/* Card 3: Chronic Disease */}
          <button
            onClick={() => {
              if (onSelectModalityPreview) onSelectModalityPreview('chronic-diabetes');
              onNavigate('reusable-analysis');
            }}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">table_chart</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                Coming Soon
              </span>
            </div>
            <span className="text-xs font-bold text-[#101c28] block">Chronic Disease</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Diabetes & Vascular</span>
          </button>

          {/* Card 4: Cancer Screening */}
          <button
            onClick={() => {
              if (onSelectModalityPreview) onSelectModalityPreview('cancer-breast');
              onNavigate('reusable-analysis');
            }}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">biotech</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                Coming Soon
              </span>
            </div>
            <span className="text-xs font-bold text-[#101c28] block">Cancer Screening</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Early Detection</span>
          </button>
        </div>
      </div>

      {/* 5. RECENT RESULTS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400">history</span>
            Recent Results
          </h2>
          <button
            onClick={() => onNavigate('results')}
            className="text-xs font-semibold text-[#bc000a] hover:underline cursor-pointer"
          >
            All Archives
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentResults.map((item) => (
            <div
              key={item.id}
              className="py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#101c28]">{item.modality}</span>
                    <span className="text-[10px] text-slate-400 font-mono">• {item.area}</span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-semibold block">
                    {item.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.date} • {item.metric}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (item.tab) {
                    onNavigate(item.tab);
                  } else if (item.testId && onSelectModalityPreview) {
                    onSelectModalityPreview(item.testId);
                    onNavigate('reusable-analysis');
                  } else {
                    onNavigate('results');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold shrink-0 cursor-pointer"
              >
                {item.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Disclaimer Footnote */}
      <div className="text-center text-[10px] font-mono text-slate-400 pt-2">
        Dr. Radar Biomedical Platform • Investigational Clinical Decision-Support Output
      </div>

      {/* Report Modal */}
      <FullReportModal
        report={activeReportModal}
        onClose={() => setActiveReportModal(null)}
        onDownload={() => setActiveReportModal(null)}
        onOpenAssistant={onOpenAssistant}
        onNavigate={onNavigate}
      />
    </div>
  );
};
