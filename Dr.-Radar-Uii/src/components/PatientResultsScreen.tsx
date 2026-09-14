import React, { useState } from 'react';
import { ScreenTab } from '../types';
import { HISTORY_REPORTS, TREND_7_DAYS, TREND_30_DAYS } from '../data/mockData';
import { FullReportModal } from './FullReportModal';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { TreatmentRecommendationCard } from './recommendations/TreatmentRecommendationCard';
import { AssistantContext } from '../types/assistant';
import { HealthContextIndicator } from './health-info/HealthContextIndicator';
import { HealthContextSummary } from '../types/healthInfo';

interface PatientResultsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  healthSummary?: HealthContextSummary;
}

export const PatientResultsScreen: React.FC<PatientResultsScreenProps> = ({
  onNavigate,
  onOpenAssistant,
  healthSummary,
}) => {
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d'>('7d');
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const trendData = selectedRange === '7d' ? TREND_7_DAYS : TREND_30_DAYS;

  const handleOpenReport = (report: any) => {
    setActiveReportModal({
      title: report.title,
      date: report.date,
      bpmAvg: report.bpmAvg,
      rhythmStatus: report.rhythmStatus,
      summary: report.summary,
      isAttention: report.isAttention,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">file_download</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • RESULTS
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Historical ECG Reports
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Diagnostic Reports & Trends
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Archived ECG test sessions, cardiologist reviews, and resting rate trends.
          </p>
        </div>

        <button
          onClick={() => {
            handleOpenReport({
              title: 'Comprehensive 7-Day Cardiac Summary',
              date: 'October 24, 2023',
              bpmAvg: 70,
              rhythmStatus: 'Stable Sinus Rhythm (99.2%)',
              summary: '7-day continuous telemetry audit demonstrates stable sinus rhythm with physiological variability. No sustained arrhythmias or ischemic ST shifts noted.',
            });
          }}
          className="px-4 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a00008] transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export 7-Day Dossier (PDF)
        </button>
      </div>

      {/* Heart Rate Trend Chart Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#101c28]">Resting Heart Rate Trajectory</h2>
            <p className="text-xs text-slate-500">Daily resting averages logged by Dr. Radar sensor</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setSelectedRange('7d')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedRange === '7d' ? 'bg-white text-[#bc000a] shadow-xs' : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedRange('30d')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedRange === '30d' ? 'bg-white text-[#bc000a] shadow-xs' : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Trend Visualization */}
        <div className="h-44 w-full bg-[#f8fbfe] rounded-2xl border border-slate-200/80 relative p-4 flex flex-col justify-end">
          <svg className="w-full h-28 text-[#bc000a]" viewBox="0 0 300 80" preserveAspectRatio="none">
            {/* Horizontal guide lines */}
            <line x1="0" y1="20" x2="300" y2="20" stroke="#e2ecf9" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="50" x2="300" y2="50" stroke="#e2ecf9" strokeWidth="1" strokeDasharray="3 3" />
            {/* Trend Polyline */}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={trendData.map((d) => `${d.cx},${d.cy}`).join(' ')}
            />
            {/* Dots */}
            {trendData.map((d, i) => (
              <circle key={i} cx={d.cx} cy={d.cy} r="4" fill="#ffffff" stroke="#bc000a" strokeWidth="2.5" />
            ))}
          </svg>

          {/* X Axis labels */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/60">
            {trendData.map((d, i) => (
              <span key={i}>{d.day}</span>
            ))}
          </div>
        </div>

        {/* Key stats summary */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px]">7-Day Average</span>
            <span className="text-lg font-bold text-[#bc000a] mt-0.5 block">68 BPM</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Resting Minimum</span>
            <span className="text-lg font-bold text-[#101c28] mt-0.5 block">60 BPM</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Stability Index</span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">High (96%)</span>
          </div>
        </div>
      </div>

      {/* Historical Reports List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#101c28]">Archived Test Reports</h2>
            <p className="text-xs text-slate-500">Official medical decision-support summaries</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{HISTORY_REPORTS.length} Reports on file</span>
        </div>

        <div className="space-y-3">
          {HISTORY_REPORTS.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-2xl border border-slate-200/90 hover:border-[#bc000a]/40 bg-white hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  report.isAttention ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-[#0c3156]'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">{report.icon}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#101c28]">{report.title}</span>
                    {report.isAttention && (
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                        Attention
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{report.rhythmStatus}</p>
                  <p className="text-[11px] text-slate-400">{report.date} • Avg {report.bpmAvg} BPM</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleOpenReport(report)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  View
                </button>
                <button
                  onClick={() => {
                    setToastMessage(`Downloading ${report.title} (PDF)...`);
                    setTimeout(() => setToastMessage(null), 3000);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#bc000a] hover:bg-[#a00008] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relevant Health Context (Section 10) */}
      {healthSummary && (
        <HealthContextIndicator
          summary={healthSummary}
          variant="results-card"
          onViewHealthInfo={() => onNavigate('health-info')}
        />
      )}

      {/* Latest Result Treatment & Care Recommendations */}
      <div className="space-y-2">
        <TreatmentRecommendationCard
          clinicalInput={{
            modality: 'ecg',
            resultCode: 'N',
            findingTitle: 'Normal Sinus Rhythm (Latest Telemetry)',
            classificationLabel: 'Normal Sinus Rhythm (Class N)',
            confidence: '98.4%',
            patientContext: {
              previousResult: 'Normal Sinus Rhythm',
              bpm: 64,
            },
          }}
          onOpenAssistant={onOpenAssistant}
          onBookAppointment={() => onNavigate('patient-appointments')}
          sourceContextTitle="Latest 24h Telemetry Baseline"
        />
      </div>

      {/* Clinical Disclaimer */}
      <ClinicalDisclaimer />

      {/* Full Report Modal */}
      {activeReportModal && (
        <FullReportModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
          onOpenAssistant={onOpenAssistant}
          onNavigate={onNavigate}
          onDownload={() => {
            setToastMessage('Exporting clinical PDF...');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
};
