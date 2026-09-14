import React from 'react';
import { ASSETS } from '../../data/mockData';

interface AskDrRadarCardProps {
  onStartConversation: (initialQuery?: string) => void;
  latestResultSnippet?: string;
}

export const AskDrRadarCard: React.FC<AskDrRadarCardProps> = ({
  onStartConversation,
  latestResultSnippet,
}) => {
  const quickQuestions = [
    'Explain my latest ECG rhythm',
    'What does the confidence score mean?',
    'What questions should I ask my cardiologist?',
  ];

  return (
    <div
      id="ask-dr-radar-entry-card"
      className="matte-3d-card rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-white via-[#fcfdff] to-[#f5f9fd] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:border-[#bc000a]/40 transition-all"
    >
      {/* Subtle Quantum/Medical Decorative Backdrop */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#bc000a]/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute right-4 top-4 hidden sm:block opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <img src={ASSETS.logo} alt="Dr. Radar Logo Watermark" className="w-24 h-24 object-contain" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Info */}
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center font-bold text-xs shadow-2xs border border-[#bc000a]/25">
              <span className="material-symbols-outlined text-[19px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono uppercase font-black tracking-wider text-xs text-[#bc000a]">
                  ASK DR. RADAR
                </span>
                <span className="text-[9.5px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                  AI ASSISTANT
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Hybrid Quantum–Classical Healthcare Intelligence
              </p>
            </div>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-[#101c28] tracking-tight">
            Have a question about your health or your Dr. Radar results?
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Get plain-language explanations of your ECG telemetry, arrhythmia classifications, and medical terminology—or prepare questions for your doctor.
          </p>

          {latestResultSnippet && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-[11px] text-slate-500">Latest Test:</span>
              <span className="font-bold text-[#101c28] text-[11.5px]">{latestResultSnippet}</span>
            </div>
          )}
        </div>

        {/* Right CTA and Quick Questions */}
        <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
          <button
            id="start-conversation-cta-btn"
            onClick={() => onStartConversation()}
            className="w-full sm:w-auto px-6 py-3 bg-[#bc000a] hover:bg-[#a10008] text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-98 transition-all cursor-pointer group"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            <span>Start Conversation</span>
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </button>

          {/* Quick prompt shortcuts */}
          <div className="flex flex-wrap md:justify-end gap-1.5 w-full">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onStartConversation(q)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-[#ffe8e8] text-slate-600 hover:text-[#bc000a] border border-slate-200/80 hover:border-[#bc000a]/30 shadow-2xs transition-all cursor-pointer font-medium"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
