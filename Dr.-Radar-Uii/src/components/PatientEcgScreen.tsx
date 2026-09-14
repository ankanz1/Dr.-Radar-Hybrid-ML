import React, { useState, useEffect } from 'react';
import { ScreenTab } from '../types';
import { BENCHMARK_ECG_BEATS } from '../data/ecgQuantumData';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';

interface PatientEcgScreenProps {
  onNavigate: (tab: ScreenTab) => void;
}

export const PatientEcgScreen: React.FC<PatientEcgScreenProps> = ({ onNavigate }) => {
  const [selectedLead, setSelectedLead] = useState<'Lead II' | 'Lead V1' | 'Lead V5'>('Lead II');
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [liveBpm, setLiveBpm] = useState<number>(72);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(false);

  const sampleBeat = BENCHMARK_ECG_BEATS[0]; // Normal Sinus Rhythm

  // Gentle BPM fluctuation simulation for realistic live telemetry feel
  useEffect(() => {
    if (!isLiveActive) return;
    const interval = setInterval(() => {
      setLiveBpm(prev => Math.min(78, Math.max(68, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveActive]);

  // 30-second recording simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordProgress((prev) => {
          if (prev >= 100) {
            setIsRecording(false);
            return 100;
          }
          return prev + 5;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleStartRecording = () => {
    setRecordProgress(0);
    setIsRecording(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • TELEMETRY
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Personal Bio-Patch #BP-841
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            My ECG Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time cardiac waveform recording and rhythm stability monitor.
          </p>
        </div>

        {/* Lead Selection */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          {(['Lead II', 'Lead V1', 'Lead V5'] as const).map((lead) => (
            <button
              key={lead}
              onClick={() => setSelectedLead(lead)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedLead === lead
                  ? 'bg-white text-[#bc000a] shadow-xs'
                  : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              {lead}
            </button>
          ))}
        </div>
      </div>

      {/* Main Waveform Monitor Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        {/* Strip Header info */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#bc000a] to-[#920008] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">vital_signs</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#101c28]">{selectedLead} Waveform Strip</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  Signal Quality: 99.4%
                </span>
              </div>
              <p className="text-xs text-slate-500">25 mm/s • 10 mm/mV Standard Clinical Gain</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio pulse feedback toggle */}
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                audioFeedback ? 'bg-red-50 text-[#bc000a] border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Tone pulse feedback"
            >
              <span className="material-symbols-outlined text-[18px]">
                {audioFeedback ? 'volume_up' : 'volume_off'}
              </span>
              <span className="hidden sm:inline text-[11px] font-semibold">Pulse Audio</span>
            </button>

            {/* Live stream toggle */}
            <button
              onClick={() => setIsLiveActive(!isLiveActive)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                isLiveActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              {isLiveActive ? 'Telemetry Live' : 'Paused'}
            </button>
          </div>
        </div>

        {/* Big Medical Oscilloscope Display */}
        <div className="h-56 w-full bg-[#f8fbfe] rounded-2xl border border-slate-200/90 relative overflow-hidden flex items-center justify-center p-4">
          {/* Medical grid background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="my-ecg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#bc000a" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#my-ecg-grid)" />
          </svg>

          {/* Continuous multi-beat ECG visualization */}
          <svg
            className="w-full h-full text-[#bc000a] relative z-10"
            viewBox="0 0 374 120"
            preserveAspectRatio="none"
          >
            {/* Beat 1 */}
            <path
              d={sampleBeat.signal.map((val, idx) => {
                const x = idx;
                const y = 90 - ((val + 0.3) / 1.7) * 70;
                return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(15, Math.min(105, y))}`;
              }).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Beat 2 */}
            <path
              d={sampleBeat.signal.map((val, idx) => {
                const x = 187 + idx;
                const y = 90 - ((val + 0.3) / 1.7) * 70;
                return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(15, Math.min(105, y))}`;
              }).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Center R-peak annotation tag */}
          <div className="absolute top-4 left-1/4 -translate-x-1/2 bg-white/90 backdrop-blur-xs border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700 shadow-2xs">
            R-Peak: 1.24 mV
          </div>
          <div className="absolute top-4 left-3/4 -translate-x-1/2 bg-white/90 backdrop-blur-xs border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700 shadow-2xs">
            R-Peak: 1.22 mV
          </div>
        </div>

        {/* Real-time telemetry metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Heart Rate</span>
            <span className="text-2xl font-black text-[#bc000a] leading-none mt-1 block">
              {liveBpm} <span className="text-xs font-normal text-slate-500">BPM</span>
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">HRV (RMSSD)</span>
            <span className="text-2xl font-black text-[#101c28] leading-none mt-1 block">
              48 <span className="text-xs font-normal text-slate-500">ms</span>
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Rhythm Status</span>
            <span className="text-sm font-bold text-emerald-700 leading-none mt-1.5 block">
              Sinus Rhythm
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Battery & Sync</span>
            <span className="text-sm font-bold text-slate-700 leading-none mt-1.5 block">
              92% • Connected
            </span>
          </div>
        </div>
      </div>

      {/* 30-Second Diagnostic Recording Action */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#101c28]">Diagnostic 30-Second Recording</h3>
            <p className="text-xs text-slate-500">
              Captures high-resolution single-beat data to log in your medical chart for Dr. Ronald S.
            </p>
          </div>

          <button
            onClick={handleStartRecording}
            disabled={isRecording}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
              isRecording
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#bc000a] text-white hover:bg-[#a00008] shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isRecording ? 'hourglass_top' : 'fiber_manual_record'}
            </span>
            {isRecording ? 'Recording in progress...' : 'Record 30-Sec ECG'}
          </button>
        </div>

        {/* Recording progress bar */}
        {isRecording && (
          <div className="space-y-1.5 animate-in fade-in">
            <div className="flex justify-between text-xs font-mono text-slate-600">
              <span>Sampling Bio-Patch Telemetry...</span>
              <span>{recordProgress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#bc000a] transition-all duration-300"
                style={{ width: `${recordProgress}%` }}
              />
            </div>
          </div>
        )}

        {recordProgress === 100 && !isRecording && (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
              <span>Recording successfully saved to patient chart (Beat #100 - Normal Sinus Rhythm).</span>
            </div>
            <button
              onClick={() => onNavigate('patient-results')}
              className="text-xs font-bold text-emerald-900 underline"
            >
              View in Results
            </button>
          </div>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <ClinicalDisclaimer />
    </div>
  );
};
