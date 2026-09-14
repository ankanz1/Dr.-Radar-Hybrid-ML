import React from 'react';
import { AssistantContext } from '../../types/assistant';
import { AamiClassBadge } from '../AamiClassBadge';

interface AssistantContextDrawerProps {
  context: AssistantContext | null;
  onClearContext?: () => void;
  onSelectModality?: (tab: any) => void;
}

export const AssistantContextDrawer: React.FC<AssistantContextDrawerProps> = ({
  context,
  onClearContext,
}) => {
  if (!context) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/50 border-l border-slate-200/80">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
          <span className="material-symbols-outlined text-[24px]">dataset</span>
        </div>
        <p className="text-xs font-bold text-slate-700">No Context Attached</p>
        <p className="text-[11px] text-slate-400 max-w-[200px] mt-1 leading-relaxed">
          Open Ask Dr. Radar directly from an ECG result or patient chart to attach live diagnostic context.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#f8fbfe] border-l border-slate-200/80 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono uppercase font-bold text-[10.5px] tracking-wider text-[#101c28]">
            Active Dr. Radar Context
          </span>
        </div>
        {onClearContext && (
          <button
            onClick={onClearContext}
            className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer font-medium"
            title="Detach context"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Detach
          </button>
        )}
      </div>

      {/* Main Context Card */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[9.5px] font-mono uppercase px-2 py-0.5 rounded bg-[#ffe8e8] text-[#bc000a] font-bold border border-[#bc000a]/20">
              {context.type.toUpperCase()} CONTEXT
            </span>
            <h4 className="text-sm font-extrabold text-[#101c28] mt-1.5 leading-snug">
              {context.title}
            </h4>
            {context.subtitle && (
              <p className="text-[11px] text-slate-500 mt-0.5">{context.subtitle}</p>
            )}
          </div>
          {context.aamiClass && (
            <AamiClassBadge code={context.aamiClass} variant="compact" size="sm" />
          )}
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {context.prediction && (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[9.5px] font-mono text-slate-400 block uppercase">Prediction</span>
              <span className="font-bold text-[#101c28] text-[11px] truncate block">
                {context.prediction}
              </span>
            </div>
          )}

          {context.confidence !== undefined && (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[9.5px] font-mono text-slate-400 block uppercase">Confidence</span>
              <span className="font-bold text-[#bc000a] text-[11px]">
                {context.confidence}
              </span>
            </div>
          )}

          {context.sampleId && (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[9.5px] font-mono text-slate-400 block uppercase">Sample ID</span>
              <span className="font-mono text-slate-700 text-[11px]">
                {context.sampleId}
              </span>
            </div>
          )}

          {context.heartRate && (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[9.5px] font-mono text-slate-400 block uppercase">Heart Rate</span>
              <span className="font-bold text-slate-800 text-[11px]">
                {context.heartRate} BPM
              </span>
            </div>
          )}
        </div>

        {/* Intervals if ECG */}
        {context.intervals && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-mono text-slate-500">
            {context.intervals.prMs && <span>PR: {context.intervals.prMs} ms</span>}
            {context.intervals.qrsMs && (
              <span className="font-bold text-[#bc000a]">QRS: {context.intervals.qrsMs} ms</span>
            )}
            {context.intervals.qtMs && <span>QT: {context.intervals.qtMs} ms</span>}
          </div>
        )}

        {/* Patient metadata if available */}
        {context.patientName && (
          <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-blue-600">person</span>
            <span className="font-medium">Patient: {context.patientName}</span>
          </div>
        )}

        {/* Clinical findings/notes snippet */}
        {context.findings && (
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold block text-[10px] uppercase font-mono text-amber-800 mb-0.5">
              Findings
            </span>
            {context.findings}
          </div>
        )}
      </div>

      {/* Quantum-Classical Grounding Note */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#101c28] font-bold text-[11px]">
          <span className="material-symbols-outlined text-[15px] text-[#0284c7]">memory</span>
          <span>Decision-Support Grounding</span>
        </div>
        <p className="text-[10.5px] text-slate-500 leading-relaxed">
          The assistant grounds responses directly in this session’s 10-qubit VQC classification readouts, saliency mappings, and AAMI standards.
        </p>
      </div>
    </div>
  );
};
