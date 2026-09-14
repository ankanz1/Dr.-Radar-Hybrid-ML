import React, { useState } from 'react';
import { ScreenTab } from '../types';
import { FullReportModal } from './FullReportModal';

interface DoctorDashboardScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onSelectPatient?: (patientId: string) => void;
  onSelectModalityPreview?: (testId: string) => void;
}

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({
  onNavigate,
  onSelectPatient,
  onSelectModalityPreview,
}) => {
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);

  // Attention Required patient queue
  const attentionRequiredList = [
    {
      id: 'pt-102',
      patientName: 'Robert Vance',
      age: 67,
      sex: 'M',
      analysisType: 'ECG Analysis',
      result: 'Arrhythmia (PVC)',
      detail: 'Isolated Premature Ventricular Contraction with compensatory pause',
      priority: 'High',
      priorityClass: 'bg-[#ffe8e8] text-[#bc000a] border-[#bc000a]/25',
      time: '12m ago',
      actionTab: 'ecg-analysis' as ScreenTab,
    },
    {
      id: 'pt-105',
      patientName: 'Marcus Brody',
      age: 59,
      sex: 'M',
      analysisType: 'Chest X-ray',
      result: 'Abnormal Finding',
      detail: 'Right lower lobe parenchymal consolidation, evaluate for pneumonia',
      priority: 'High',
      priorityClass: 'bg-[#ffe8e8] text-[#bc000a] border-[#bc000a]/25',
      time: '28m ago',
      testId: 'imaging-cxr',
    },
    {
      id: 'pt-104',
      patientName: 'Sophia Chen',
      age: 48,
      sex: 'F',
      analysisType: 'Diabetes Risk',
      result: 'Elevated Risk Tier',
      detail: 'Elevated HbA1c (6.8%) with fasting glucose 126 mg/dL',
      priority: 'Medium',
      priorityClass: 'bg-amber-50 text-amber-800 border-amber-200',
      time: '1h 15m ago',
      testId: 'chronic-diabetes',
    },
  ];

  // Recent analyses across modalities
  const recentAnalyses = [
    {
      id: 'rec-1',
      title: 'ECG Arrhythmia Classification',
      modality: 'ECG',
      patient: 'Elena Rostova (61F)',
      finding: 'Normal Sinus Rhythm (N) • 74 BPM',
      status: 'Reviewed',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      time: '18m ago',
      actionTab: 'ecg-analysis' as ScreenTab,
    },
    {
      id: 'rec-2',
      title: 'Chest Radiograph Screening',
      modality: 'Chest X-ray',
      patient: 'David K. Miller (52M)',
      finding: 'No pneumothorax, normal cardiac silhouette',
      status: 'Pending Sign-off',
      statusColor: 'text-blue-700 bg-blue-50 border-blue-200',
      time: '45m ago',
      testId: 'imaging-cxr',
    },
    {
      id: 'rec-3',
      title: 'T2-FLAIR Brain Volumetrics',
      modality: 'Brain MRI',
      patient: 'Clara Oswald (39F)',
      finding: 'No acute intracranial hemorrhage or mass effect',
      status: 'Pending Sign-off',
      statusColor: 'text-blue-700 bg-blue-50 border-blue-200',
      time: '2h ago',
      testId: 'imaging-mri',
    },
    {
      id: 'rec-4',
      title: 'Metabolic Syndrome Risk Score',
      modality: 'Diabetes',
      patient: 'Arthur Pendelton (65M)',
      finding: 'Moderate Glycemic Risk Profile (Score: 6.1)',
      status: 'Reviewed',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      time: '3h ago',
      testId: 'chronic-diabetes',
    },
    {
      id: 'rec-5',
      title: 'Hepatic Steatosis & Serology',
      modality: 'Liver',
      patient: 'Hannah Wells (44F)',
      finding: 'Grade 1 Mild Steatosis, normal ALT/AST ratio',
      status: 'Reviewed',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      time: '4h ago',
      testId: 'liver-nafld',
    },
  ];

  // Clinical Areas for quick access
  const clinicalAreas = [
    { id: 'cardiology', name: 'Cardiology', desc: 'ECG, Arrhythmia & CAD', status: 'Active', icon: 'cardiology' },
    { id: 'imaging', name: 'Medical Imaging', desc: 'X-ray, MRI & CT', status: 'Phase 2', icon: 'radiology' },
    { id: 'cancer', name: 'Cancer', desc: 'Mammography & Blood Diff', status: 'Phase 4', icon: 'biotech' },
    { id: 'chronic', name: 'Chronic Disease', desc: 'Diabetes & Hypertension', status: 'Phase 3', icon: 'table_chart' },
    { id: 'liver', name: 'Liver', desc: 'Hepatic Steatosis & Fibrosis', status: 'Phase 5', icon: 'science' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* 1. Header: DR. RADAR • Clinical Intelligence Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Clinical Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Multimodal clinical review, acute patient triage, and diagnostic decision-support.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('analysis')}
            className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_chart</span>
            Start New Analysis
          </button>
          <button
            onClick={() => onNavigate('alerts')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#bc000a]">notifications</span>
            Alerts (2)
          </button>
        </div>
      </div>

      {/* 2. TOP METRICS STRIP: Total Patients | Analyses to Review | High-Priority Alerts | Recent Results */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Patients
            </span>
            <span className="material-symbols-outlined text-[18px] text-slate-400">group</span>
          </div>
          <div className="text-2xl font-extrabold text-[#101c28]">142</div>
          <span className="text-[10px] text-slate-500 font-medium">18 Active Telemetry Feeds</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Analyses to Review
            </span>
            <span className="material-symbols-outlined text-[18px] text-blue-600">assignment</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-700">3</div>
          <span className="text-[10px] text-slate-500 font-medium">Awaiting Physician Sign-off</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              High-Priority Alerts
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#bc000a]">error</span>
          </div>
          <div className="text-2xl font-extrabold text-[#bc000a]">2</div>
          <span className="text-[10px] text-[#bc000a] font-semibold">Immediate Triage Required</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Recent Results
            </span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">fact_check</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">28</div>
          <span className="text-[10px] text-slate-500 font-medium">Processed past 24 hours</span>
        </div>
      </div>

      {/* 3. ATTENTION REQUIRED (Patient | Analysis | Result | Priority | Action) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#bc000a] animate-pulse" />
              <h2 className="text-base font-bold text-[#101c28]">
                Attention Required
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              High and moderate priority findings flagged by Dr. Radar decision-support pipeline.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#bc000a] bg-[#ffe8e8] px-2.5 py-1 rounded-lg border border-[#bc000a]/20 shrink-0">
            3 Cases
          </span>
        </div>

        {/* Mobile Card List (< sm screens) */}
        <div className="block sm:hidden space-y-3">
          {attentionRequiredList.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-[#101c28]">{item.patientName}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {item.age}Y • {item.sex} • {item.time}
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${item.priorityClass}`}>
                  {item.priority}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {item.analysisType}
                </div>
                <div className="font-bold text-[#101c28] mt-0.5">{item.result}</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">{item.detail}</p>
              </div>

              <button
                onClick={() => {
                  if (item.actionTab) {
                    onNavigate(item.actionTab);
                  } else if (item.testId && onSelectModalityPreview) {
                    onSelectModalityPreview(item.testId);
                    onNavigate('reusable-analysis');
                  }
                }}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#bc000a] hover:bg-[#920008] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Review Case</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          ))}
        </div>

        {/* Desktop Table View (>= sm screens) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Analysis</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attentionRequiredList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#101c28]">{item.patientName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.age}Y • {item.sex} • {item.time}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {item.analysisType}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-[#101c28] block">{item.result}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">{item.detail}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${item.priorityClass}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        if (item.actionTab) {
                          onNavigate(item.actionTab);
                        } else if (item.testId && onSelectModalityPreview) {
                          onSelectModalityPreview(item.testId);
                          onNavigate('reusable-analysis');
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#bc000a] hover:bg-[#920008] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. CLINICAL AREAS & RECENT ANALYSES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Clinical Areas */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400">domain</span>
              Clinical Areas
            </h2>
            <button
              onClick={() => onNavigate('analysis')}
              className="text-xs font-semibold text-[#bc000a] hover:underline cursor-pointer"
            >
              Analysis Hub →
            </button>
          </div>

          <div className="space-y-2">
            {clinicalAreas.map((area) => (
              <div
                key={area.id}
                onClick={() => onNavigate('analysis')}
                className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">{area.icon}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#101c28] text-xs block">{area.name}</span>
                    <span className="text-[10px] text-slate-500">{area.desc}</span>
                  </div>
                </div>

                <span
                  className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                    area.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {area.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (7 cols): Recent Analyses (ECG | Chest X-ray | Brain MRI | Diabetes | Liver) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400">history_edu</span>
              Recent Analyses
            </h2>
            <button
              onClick={() => onNavigate('results')}
              className="text-xs font-semibold text-[#bc000a] hover:underline cursor-pointer"
            >
              All Results
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentAnalyses.map((rec) => (
              <div key={rec.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#101c28]">{rec.modality}</span>
                    <span className="text-[10px] text-slate-400 font-mono">• {rec.patient}</span>
                  </div>
                  <span className="text-[11px] text-slate-600 block mt-0.5 line-clamp-1">
                    {rec.finding}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{rec.time}</span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border ${rec.statusColor}`}>
                    {rec.status}
                  </span>
                  <button
                    onClick={() => {
                      if (rec.actionTab) {
                        onNavigate(rec.actionTab);
                      } else if (rec.testId && onSelectModalityPreview) {
                        onSelectModalityPreview(rec.testId);
                        onNavigate('reusable-analysis');
                      }
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Report Modal */}
      <FullReportModal
        report={activeReportModal}
        onClose={() => setActiveReportModal(null)}
        onDownload={() => setActiveReportModal(null)}
      />
    </div>
  );
};
