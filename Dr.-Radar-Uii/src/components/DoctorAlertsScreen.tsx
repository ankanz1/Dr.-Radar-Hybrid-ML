import React, { useState } from 'react';
import { ScreenTab } from '../types';
import { BENCHMARK_ECG_BEATS } from '../data/ecgQuantumData';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';

interface DoctorAlertsScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onSelectPatient?: (patientId: string) => void;
}

export const DoctorAlertsScreen: React.FC<DoctorAlertsScreenProps> = ({
  onNavigate,
  onSelectPatient,
}) => {
  const [alerts, setAlerts] = useState([
    {
      id: 'alt-1',
      patientId: 'p-102',
      patientName: 'Robert Vance',
      age: 67,
      sex: 'M',
      eventType: 'Ventricular Ectopic Run (3 PVCs)',
      severity: 'Critical',
      severityColor: 'bg-red-50 text-[#bc000a] border-red-200',
      time: '14 mins ago',
      heartRate: 114,
      sampleIndex: 1, // Class V
      acknowledged: false,
      notes: 'Consecutive premature ventricular depolarizations detected on Lead II. Heart rate peaked at 114 BPM before spontaneous termination.',
    },
    {
      id: 'alt-2',
      patientId: 'p-103',
      patientName: 'Sophia Chen',
      age: 48,
      sex: 'F',
      eventType: 'Frequent Supraventricular Ectopy (PAC)',
      severity: 'High Urgency',
      severityColor: 'bg-amber-50 text-amber-800 border-amber-200',
      time: '42 mins ago',
      heartRate: 88,
      sampleIndex: 2, // Class S
      acknowledged: false,
      notes: 'Cluster of 6 premature atrial contractions within 3-minute monitoring window. Narrow QRS complex.',
    },
    {
      id: 'alt-3',
      patientId: 'p-104',
      patientName: 'Elena Rostova',
      age: 61,
      sex: 'F',
      eventType: 'Ventricular Fusion Event',
      severity: 'Observation',
      severityColor: 'bg-purple-50 text-purple-800 border-purple-200',
      time: '2h 15m ago',
      heartRate: 82,
      sampleIndex: 3, // Class F
      acknowledged: true,
      notes: 'Coincident activation of ventricle from sinus pacemaker and ectopic focus.',
    },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    setToastMessage('Alert acknowledged and logged in audit trail.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • CLINICAL TRIAGE
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Arrhythmia Detection Queue
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Arrhythmia Clinical Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time critical events triaged by the hybrid quantum-classical decision pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            {alerts.filter((a) => !a.acknowledged).length} Unacknowledged Events
          </span>
        </div>
      </div>

      {/* Alerts Queue */}
      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`bg-white rounded-3xl p-6 border transition-all space-y-4 shadow-2xs ${
              alert.acknowledged
                ? 'border-slate-200/80 opacity-80'
                : 'border-red-200 ring-1 ring-red-50'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  alert.severity === 'Critical'
                    ? 'bg-red-100 text-[#bc000a]'
                    : alert.severity === 'High Urgency'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-purple-100 text-purple-900'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">
                    {alert.severity === 'Critical' ? 'emergency' : 'warning'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#101c28]">{alert.eventType}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded border font-semibold ${alert.severityColor}`}>
                      {alert.severity}
                    </span>
                    {alert.acknowledged && (
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Patient: <strong className="text-[#101c28]">{alert.patientName}</strong> ({alert.sex}, {alert.age}y) • {alert.time}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-lg font-black text-[#bc000a] leading-none block">{alert.heartRate} BPM</span>
                <span className="text-[10px] text-slate-400 font-mono">Lead II Peak</span>
              </div>
            </div>

            {/* Description & mini waveform */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-8 text-xs text-slate-600 leading-relaxed">
                <p>{alert.notes}</p>
              </div>

              <div className="md:col-span-4 h-14 bg-slate-50 rounded-xl border border-slate-200/80 relative overflow-hidden flex items-center px-2">
                <svg className="w-full h-full text-[#bc000a]" viewBox="0 0 187 60" preserveAspectRatio="none">
                  <path
                    d={BENCHMARK_ECG_BEATS[alert.sampleIndex].signal.map((val, idx) => {
                      const x = idx;
                      const y = 45 - ((val + 0.3) / 1.7) * 35;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(5, Math.min(55, y))}`;
                    }).join(' ')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => {
                    if (onSelectPatient) onSelectPatient(alert.patientId);
                    onNavigate('doctor-patients');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  <span>Open Patient Chart</span>
                </button>
                <button
                  onClick={() => onNavigate('ecg-analysis')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#bc000a]">show_chart</span>
                  <span>Detailed Waveform Analysis</span>
                </button>
              </div>

              {!alert.acknowledged ? (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#bc000a] hover:bg-[#a00008] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Acknowledge Alert</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-mono flex items-center justify-center sm:justify-start gap-1 py-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">done_all</span>
                  <span>Logged in Medical Record</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Clinical Disclaimer */}
      <ClinicalDisclaimer />
    </div>
  );
};
