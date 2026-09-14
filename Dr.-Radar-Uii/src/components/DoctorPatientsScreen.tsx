import React, { useState } from 'react';
import { ScreenTab } from '../types';
import { BENCHMARK_ECG_BEATS } from '../data/ecgQuantumData';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { FullReportModal } from './FullReportModal';

interface DoctorPatientsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  initialPatientId?: string;
}

export const DoctorPatientsScreen: React.FC<DoctorPatientsScreenProps> = ({
  onNavigate,
  initialPatientId = 'p-102',
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [clinicalNotes, setClinicalNotes] = useState<Record<string, string>>({
    'p-102': 'Patient reported mild palpitations during evening stairs climbing. Lead II single-beat analysis flags Class V (PVC) with 97.9% confidence. Compensatory pause observed. Recommended 24-hr Holter continuation.',
    'p-101': 'Routine annual cardiology screening. Baseline sinus rhythm preserved with normal PR/QRS intervals. Continue healthy diet and exercise.',
    'p-103': 'Frequent isolated premature atrial contractions. Patient advised to reduce caffeine intake. Review in 4 weeks.',
    'p-104': 'Occasional fusion morphology. Echo shows preserved ejection fraction (58%). No symptoms of syncope or presyncope.',
  });
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [noteSavedToast, setNoteSavedToast] = useState<boolean>(false);
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);

  // Patient roster database
  const patientsList = [
    {
      id: 'p-102',
      name: 'Robert Vance',
      age: 67,
      sex: 'Male',
      indication: 'Ventricular Ectopy Follow-up',
      status: 'Review Required',
      statusColor: 'bg-red-50 text-[#bc000a] border-red-200',
      sampleIndex: 1, // Class V (Ventricular Ectopic)
      heartRate: 88,
      lastReading: 'Today, 12:28 PM',
      medications: ['Metoprolol 25mg BID', 'Atorvastatin 20mg QD'],
      allergies: 'Penicillin',
      historyCount: 14,
    },
    {
      id: 'p-101',
      name: 'Ashton Miller',
      age: 34,
      sex: 'Male',
      indication: 'Preventive Holter Screening',
      status: 'Stable Baseline',
      statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      sampleIndex: 0, // Class N (Normal Sinus Rhythm)
      heartRate: 72,
      lastReading: 'Today, 2:15 PM',
      medications: ['None reported'],
      allergies: 'NKDA',
      historyCount: 8,
    },
    {
      id: 'p-103',
      name: 'Sophia Chen',
      age: 48,
      sex: 'Female',
      indication: 'Supraventricular Ectopy (PAC)',
      status: 'Observation',
      statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      sampleIndex: 2, // Class S (Supraventricular Ectopic)
      heartRate: 76,
      lastReading: 'Today, 10:42 AM',
      medications: ['Diltiazem 120mg QD'],
      allergies: 'Sulfa Drugs',
      historyCount: 19,
    },
    {
      id: 'p-104',
      name: 'Elena Rostova',
      age: 61,
      sex: 'Female',
      indication: 'Cardiac Conduction Fusion Event',
      status: 'Observation',
      statusColor: 'bg-purple-50 text-purple-800 border-purple-200',
      sampleIndex: 3, // Class F (Fusion)
      heartRate: 82,
      lastReading: 'Yesterday, 4:10 PM',
      medications: ['Lisinopril 10mg QD', 'Aspirin 81mg QD'],
      allergies: 'NKDA',
      historyCount: 22,
    },
    {
      id: 'p-105',
      name: 'Marcus Miller',
      age: 55,
      sex: 'Male',
      indication: 'Paced Rhythm Evaluation',
      status: 'Stable Paced',
      statusColor: 'bg-slate-100 text-slate-700 border-slate-200',
      sampleIndex: 4, // Class Q (Unknown / Paced)
      heartRate: 60,
      lastReading: 'Yesterday, 9:20 AM',
      medications: ['Carvedilol 12.5mg BID'],
      allergies: 'Latex',
      historyCount: 31,
    },
  ];

  const currentPatient = patientsList.find((p) => p.id === selectedPatientId) || patientsList[0];
  const currentBeat = BENCHMARK_ECG_BEATS[currentPatient.sampleIndex];

  const handleSaveNote = () => {
    setIsSavingNote(true);
    setTimeout(() => {
      setIsSavingNote(false);
      setNoteSavedToast(true);
      setTimeout(() => setNoteSavedToast(false), 2500);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Toast */}
      {noteSavedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">check_circle</span>
          <span>Clinical note saved to patient chart.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • PATIENTS
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Clinical Telemetry Cohort
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Patient Detail & Telemetry Chart
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Holistic patient records, 5-class AAMI predictions, probability distribution, and chart notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('ecg-analysis')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[16px] text-[#bc000a]">show_chart</span>
            <span>Open in ECG Analysis</span>
          </button>
          <button
            onClick={() => {
              setActiveReportModal({
                title: `Clinical Telemetry Dossier - ${currentPatient.name}`,
                date: currentPatient.lastReading,
                bpmAvg: currentPatient.heartRate,
                rhythmStatus: currentBeat.className,
                summary: clinicalNotes[currentPatient.id] || 'ECG beat evaluated with hybrid quantum-classical pipeline. Conduction parameters recorded.',
                isAttention: currentBeat.classType !== 'N',
              });
            }}
            className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a00008] transition-all shadow-sm flex items-center gap-1.5 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN WORKSPACE: PATIENTS ROSTER (LEFT) + PATIENT DETAIL (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Patients List (4 cols on desktop, full width on mobile when mobileView === 'list') */}
        <div className={`lg:col-span-4 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3 ${
          mobileView === 'detail' ? 'hidden lg:block' : 'block'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#101c28]">Monitored Cohort</h2>
              <p className="text-[11px] text-slate-500">{patientsList.length} Active Patients</p>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
              Live Feed
            </span>
          </div>

          <div className="space-y-2">
            {patientsList.map((patient) => {
              const isSelected = patient.id === selectedPatientId;
              return (
                <div
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatientId(patient.id);
                    setMobileView('detail');
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-[#bc000a] bg-[#fff8f8] shadow-xs'
                      : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#101c28]">{patient.name}</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${patient.statusColor}`}>
                      {patient.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{patient.sex}, {patient.age}y</span>
                    <span className="font-mono text-[#bc000a] font-semibold">{patient.heartRate} BPM</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-1">
                    {patient.indication}
                  </div>
                  {/* Mobile tap prompt */}
                  <div className="lg:hidden mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#bc000a]">
                    <span>View Telemetry Dossier</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Patient Detail (8 cols on desktop, full width on mobile when mobileView === 'detail') */}
        <div className={`lg:col-span-8 space-y-6 ${
          mobileView === 'list' ? 'hidden lg:block' : 'block'
        }`}>
          {/* Mobile Back Button (< lg screens) */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileView('list')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-2xs hover:bg-slate-50 transition-all cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px] text-[#bc000a]">arrow_back</span>
              <span>← Back to Patients Roster</span>
            </button>
          </div>

          {/* 1. Patient Info Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#bc000a] to-[#920008] text-white flex items-center justify-center font-black text-base shadow-xs">
                  {currentPatient.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[#101c28]">{currentPatient.name}</h2>
                    <span className="text-xs font-mono text-slate-400 font-semibold">({currentPatient.id})</span>
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded border font-semibold ${currentPatient.statusColor}`}>
                      {currentPatient.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {currentPatient.sex}, {currentPatient.age} years old • {currentPatient.indication}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-mono">Last Synchronized</span>
                <span className="text-xs font-bold text-slate-700">{currentPatient.lastReading}</span>
              </div>
            </div>

            {/* Clinical Demographics & Meds */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Active Meds</span>
                <span className="font-semibold text-[#101c28] block truncate mt-0.5" title={currentPatient.medications.join(', ')}>
                  {currentPatient.medications[0]}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Known Allergies</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{currentPatient.allergies}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Heart Rate</span>
                <span className="font-bold text-[#bc000a] block mt-0.5">{currentPatient.heartRate} BPM</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Telemetry History</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{currentPatient.historyCount} Sessions</span>
              </div>
            </div>
          </div>

          {/* 2. Latest ECG Waveform & 5-Class Prediction */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#bc000a] block">
                  AAMI EC57 Classification
                </span>
                <h3 className="text-base font-bold text-[#101c28]">
                  {currentBeat.className} (Class {currentBeat.classType})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Model Confidence:</span>
                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  {(currentBeat.probabilities[currentBeat.classType] * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Waveform Strip */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Lead II Single-Beat Window (187 points, 125 Hz)</span>
                <span>R-Peak centered at sample #70</span>
              </div>

              <div className="h-40 w-full bg-[#f8fbfe] rounded-2xl border border-slate-200/90 relative overflow-hidden flex items-center justify-center p-3">
                {/* Medical grid */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
                  <pattern id="patient-detail-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#bc000a" strokeWidth="0.5" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#patient-detail-grid)" />
                </svg>

                {/* Saliency / Waveform attribution underlay */}
                <svg className="w-full h-full text-[#bc000a] relative z-10" viewBox="0 0 187 80" preserveAspectRatio="none">
                  <path
                    d={currentBeat.signal.map((val, idx) => {
                      const x = idx;
                      const y = 60 - ((val + 0.3) / 1.7) * 50;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(8, Math.min(72, y))}`;
                    }).join(' ')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">PR Interval</span>
                  <span className="font-semibold text-slate-800">{currentBeat.fiducials.prIntervalMs} ms</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">QRS Complex</span>
                  <span className="font-semibold text-slate-800">{currentBeat.fiducials.qrsDurationMs} ms</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">QTc Interval</span>
                  <span className="font-semibold text-slate-800">{currentBeat.fiducials.qtIntervalMs} ms</span>
                </div>
              </div>
            </div>

            {/* 3. N/S/V/F/Q Probability Distribution Bar Chart */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">
                5-Class Softmax Posterior Probabilities
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                {(['N', 'S', 'V', 'F', 'Q'] as const).map((cls) => {
                  const prob = currentBeat.probabilities[cls];
                  const isTop = cls === currentBeat.classType;
                  return (
                    <div key={cls} className={`p-2.5 rounded-xl border text-center ${
                      isTop ? 'bg-[#fff5f5] border-[#bc000a]/40 shadow-xs' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <span className="font-black text-xs block text-[#101c28]">Class {cls}</span>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden my-1">
                        <div
                          className={`h-full ${isTop ? 'bg-[#bc000a]' : 'bg-slate-400'}`}
                          style={{ width: `${Math.round(prob * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-mono font-bold ${isTop ? 'text-[#bc000a]' : 'text-slate-500'}`}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Waveform Explainability Highlights */}
            <div className="p-3 bg-[#f0f7ff] rounded-xl border border-[#d2e5fb] space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#0c3156]">
                <span className="material-symbols-outlined text-[16px] text-blue-600">insights</span>
                Waveform Saliency & Attribution Summary
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Attribution concentrated in the <strong>QRS complex ({currentBeat.segmentAttribution.qrsComplex}%)</strong> and{' '}
                <strong>ST segment ({currentBeat.segmentAttribution.stSegment}%)</strong>. Features extracted via 10-dimensional bottleneck representation and variational quantum statevector expectation values.
              </p>
            </div>
          </div>

          {/* 5. Clinical Notes & Charting */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-[#101c28]">Attending Physician Clinical Notes</h3>
              <span className="text-[11px] font-mono text-slate-400">Dr. Ronald S., MD</span>
            </div>

            <textarea
              value={clinicalNotes[selectedPatientId] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setClinicalNotes((prev) => ({ ...prev, [selectedPatientId]: val }));
              }}
              rows={3}
              placeholder="Enter patient assessment, rhythm observations, or clinical plan..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-[#bc000a] focus:ring-1 focus:ring-[#bc000a]/20 resize-none font-sans"
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-slate-400 italic">
                Notes are persisted to the patient&apos;s digital telemetry chart.
              </p>
              <button
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className="px-4 py-2 rounded-xl bg-[#bc000a] hover:bg-[#a00008] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {isSavingNote ? 'Saving...' : 'Save Note to Chart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <ClinicalDisclaimer />

      {/* Full Report Modal */}
      {activeReportModal && (
        <FullReportModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
          onDownload={() => {
            alert('Exporting clinical decision-support dossier (PDF)...');
          }}
        />
      )}
    </div>
  );
};
