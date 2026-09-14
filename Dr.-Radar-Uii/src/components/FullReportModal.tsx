import { HistoryReport, ScreenTab } from '../types';
import { AamiClassBadge } from './AamiClassBadge';
import { AamiClassCode } from '../data/aamiClassSystem';
import { PrototypeResultBadge } from './ClinicalDisclaimer';
import { TreatmentRecommendationCard } from './recommendations/TreatmentRecommendationCard';
import { AssistantContext } from '../types/assistant';

interface FullReportModalProps {
  report: Partial<HistoryReport> | null;
  onClose: () => void;
  onDownload: () => void;
  onOpenAssistant?: (context?: AssistantContext, query?: string) => void;
  onNavigate?: (tab: ScreenTab) => void;
}

export const FullReportModal = ({
  report,
  onClose,
  onDownload,
  onOpenAssistant,
  onNavigate,
}: FullReportModalProps) => {
  if (!report) return null;

  const aamiCode: AamiClassCode = report.isAttention || (report.rhythmStatus && report.rhythmStatus.toLowerCase().includes('ventricular'))
    ? 'V'
    : report.rhythmStatus && report.rhythmStatus.toLowerCase().includes('supraventricular')
    ? 'S'
    : 'N';

  return (
    <div
      id="report-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
    >
      <div
        id="report-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="matte-3d-card w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-white border border-slate-200 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[#bc000a] uppercase tracking-widest block">
                Dr. Radar • Telemetry Dossier
              </span>
              <PrototypeResultBadge type="sample" size="xs" />
            </div>
            <h3 className="font-bold text-lg text-[#1b1b1d]">{report.title || 'Dr. Radar ECG Evaluation'}</h3>
            <p className="text-xs text-[#5d3f3b]">{report.date || 'Oct 24, 2023'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#e2ecf9] flex items-center justify-center text-[#415569] hover:bg-black/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Status Badge & Avg BPM */}
        <div className="bg-[#eaf2fc] p-4 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#5d3f3b] block font-medium">AAMI Cardiac Classification</span>
            <div className="flex items-center gap-2">
              <AamiClassBadge code={aamiCode} variant="compact" size="sm" />
              <span className="font-bold text-sm text-[#1b1b1d]">
                {report.rhythmStatus || (aamiCode === 'V' ? 'Ventricular Ectopic' : 'Normal Sinus Rhythm')}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#5d3f3b] block">24h Average</span>
            <span className="text-2xl font-bold text-[#bc000a] leading-tight">
              {report.bpmAvg || 62}{' '}
              <span className="text-xs text-[#5d3f3b] font-normal">BPM</span>
            </span>
          </div>
        </div>

        {/* Diagnostic ECG Lead Strip */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#1b1b1d]">Telemetry Lead II Snapshot</span>
            <span className="text-[#5d3f3b] text-[11px]">25mm/s • 10mm/mV</span>
          </div>
          <div className="w-full h-20 rounded-xl bg-[#ffdad5]/20 border border-[#bc000a]/15 p-2 relative overflow-hidden flex items-center">
            <svg
              className="w-full h-full text-[#bc000a]"
              preserveAspectRatio="none"
              viewBox="0 0 240 60"
            >
              {/* Grid Background */}
              <pattern id="ecg-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#bc000a" strokeOpacity="0.07" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#ecg-grid)" />
              {/* ECG Line */}
              <path
                d="M 0 30 L 20 30 L 25 28 L 30 32 L 35 30 L 45 30 L 50 12 L 56 48 L 62 5 L 68 36 L 72 30 L 85 30 L 92 24 L 100 30 L 120 30 L 125 28 L 130 32 L 135 30 L 145 30 L 150 12 L 156 48 L 162 5 L 168 36 L 172 30 L 185 30 L 192 24 L 200 30 L 240 30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Biometrics Parameters */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-[#f6f3f5]">
            <span className="text-[#5d3f3b] block text-[11px]">PR Interval</span>
            <span className="font-semibold text-[#1b1b1d] mt-0.5 block">152 ms</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#f6f3f5]">
            <span className="text-[#5d3f3b] block text-[11px]">QRS Complex</span>
            <span className="font-semibold text-[#1b1b1d] mt-0.5 block">88 ms</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#f6f3f5]">
            <span className="text-[#5d3f3b] block text-[11px]">QTc Bazett</span>
            <span className="font-semibold text-[#1b1b1d] mt-0.5 block">412 ms</span>
          </div>
        </div>

        {/* AI Model Decision-Support Summary */}
        <div className="text-xs text-[#415569] space-y-1 bg-[#dbeafc] p-3 rounded-2xl border border-[#b5d2f0]">
          <span className="font-semibold text-[#1b1b1d] block">Model Prediction & Classification Summary</span>
          <p className="leading-relaxed">
            {report.summary ||
              'No significant arrhythmias detected during the 24h monitoring period. Sinus rhythm maintained throughout with appropriate physiologic rate variability during rest and moderate exertion.'}
          </p>
        </div>

        {/* Treatment & Care Recommendations */}
        <TreatmentRecommendationCard
          clinicalInput={{
            modality: 'ecg',
            resultCode: aamiCode,
            findingTitle: report.rhythmStatus || (aamiCode === 'V' ? 'Potential Ventricular Ectopic Finding' : 'Normal Sinus Rhythm'),
            classificationLabel: aamiCode === 'V' ? 'Ventricular Ectopic Beat (Class V)' : aamiCode === 'S' ? 'Supraventricular Ectopic Beat (Class S)' : 'Normal Sinus Rhythm (Class N)',
            confidence: aamiCode === 'V' ? '94.2%' : '98.4%',
            patientContext: {
              previousResult: 'Normal Sinus Rhythm',
              bpm: report.bpmAvg || 68,
            },
          }}
          onOpenAssistant={(ctx, q) => {
            onClose();
            if (onOpenAssistant) onOpenAssistant(ctx, q);
          }}
          onBookAppointment={() => {
            onClose();
            if (onNavigate) onNavigate('patient-appointments');
          }}
          sourceContextTitle={report.title || 'Telemetry Dossier'}
        />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={onDownload}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-full bg-[#bc000a] text-white text-xs font-semibold shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Download PDF Report</span>
          </button>
          <button
            onClick={onClose}
            className="min-h-[44px] py-2.5 px-5 rounded-full bg-[#eae7ea] text-[#1b1b1d] text-xs font-semibold hover:bg-[#e4e2e4] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
