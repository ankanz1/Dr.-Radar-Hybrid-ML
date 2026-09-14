import React, { useState } from 'react';
import { ScreenTab } from '../types';
import { FullReportModal } from './FullReportModal';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';

interface DoctorReportsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

export const DoctorReportsScreen: React.FC<DoctorReportsScreenProps> = ({ onNavigate }) => {
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [reports, setReports] = useState([
    {
      id: 'rep-doc-1',
      patientName: 'Robert Vance',
      patientId: 'PT-7643',
      date: 'Oct 24, 2023',
      rhythm: 'Ventricular Ectopic Beat (Class V)',
      status: 'Pending Physician Sign-Off',
      statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      bpm: 88,
      isAttention: true,
      summary: 'Isolated Premature Ventricular Contraction with compensatory pause observed on Lead II. 97.9% model confidence. Recommended 24-hr Holter study.',
    },
    {
      id: 'rep-doc-2',
      patientName: 'Ashton Miller',
      patientId: 'PT-9042',
      date: 'Oct 24, 2023',
      rhythm: 'Normal Sinus Rhythm (Class N)',
      status: 'Signed Off',
      statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      bpm: 72,
      isAttention: false,
      summary: 'Resting Lead II rhythm strip shows uniform P-QRS-T complexes without conduction delay or ST abnormalities.',
    },
    {
      id: 'rep-doc-3',
      patientName: 'Sophia Chen',
      patientId: 'PT-4419',
      date: 'Oct 23, 2023',
      rhythm: 'Premature Atrial Contractions (Class S)',
      status: 'Signed Off',
      statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      bpm: 76,
      isAttention: false,
      summary: 'Cluster of PACs identified during evening telemetry session. Advised reduction of stimulant intake. Telemetry ongoing.',
    },
    {
      id: 'rep-doc-4',
      patientName: 'Elena Rostova',
      patientId: 'PT-3108',
      date: 'Oct 22, 2023',
      rhythm: 'Ventricular Fusion Morphology (Class F)',
      status: 'Pending Physician Sign-Off',
      statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      bpm: 82,
      isAttention: true,
      summary: 'Hybrid conduction morphology between normal sinus pacing and ventricular ectopic focus.',
    },
  ]);

  const handleSignOff = (id: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'Signed Off by Dr. Ronald S.',
              statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            }
          : r
      )
    );
    setToastMessage('Clinical report signed off and archived.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">task_alt</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • CLINICAL DOCUMENTATION
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Physician Sign-Off Registry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Clinical Reports & Sign-Offs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Official decision-support dossiers generated for hospital telemetry records and EHR exports.
          </p>
        </div>

        <button
          onClick={() => {
            setToastMessage('Batch exporting all signed reports to EHR archive...');
            setTimeout(() => setToastMessage(null), 3000);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a00008] transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
          Batch Export to EHR
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3 hover:border-slate-300 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  report.isAttention ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-800'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#101c28]">{report.patientName}</span>
                    <span className="text-xs font-mono text-slate-400">({report.patientId})</span>
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded border font-semibold ${report.statusColor}`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{report.rhythm} • {report.date}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-bold text-[#bc000a] block">{report.bpm} BPM</span>
                <span className="text-[10px] text-slate-400 font-mono">Resting Lead II</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/60">
              {report.summary}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="text-[11px] text-slate-400 font-mono">
                Model: Dr. Radar Hybrid VQC (10-qubit Pauli-Z)
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => {
                    setActiveReportModal({
                      title: `ECG Diagnostic Report - ${report.patientName}`,
                      date: report.date,
                      bpmAvg: report.bpm,
                      rhythmStatus: report.rhythm,
                      summary: report.summary,
                      isAttention: report.isAttention,
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>View PDF Preview</span>
                </button>

                {report.status.includes('Pending') && (
                  <button
                    onClick={() => handleSignOff(report.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[16px]">draw</span>
                    <span>Sign Off</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clinical Disclaimer */}
      <ClinicalDisclaimer />

      {/* Modal */}
      {activeReportModal && (
        <FullReportModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
          onDownload={() => {
            setToastMessage('Exporting signed report...');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
};
