import React from 'react';
import { ASSETS } from '../../data/mockData';

interface AboutDrRadarAIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDrRadarAIModal: React.FC<AboutDrRadarAIModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="about-assistant-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="about-assistant-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50/60 to-slate-50">
          <div className="flex items-center gap-3">
            <img src={ASSETS.logo} alt="Dr. Radar" className="w-9 h-9 object-contain" />
            <div>
              <h3 className="text-base font-extrabold text-[#101c28] tracking-tight">
                ASK DR. RADAR
              </h3>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#bc000a] font-bold">
                Hybrid Quantum–Classical Healthcare Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600">
          <div className="p-3 rounded-2xl bg-[#ffe8e8]/50 border border-[#bc000a]/20 space-y-1">
            <span className="font-bold text-[#bc000a] block text-[11px] uppercase tracking-wider font-mono">
              Clinical Decision-Support Assistant
            </span>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              Ask Dr. Radar is an integrated AI healthcare information and decision-support assistant. It is designed to help patients, doctors, and researchers understand cardiovascular telemetry, biomedical classification results, and scientific findings.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-[#101c28] text-xs uppercase tracking-wider font-mono">
              Safety & Regulatory Positioning
            </h4>
            <ul className="space-y-1.5 text-[11.5px] list-disc list-inside text-slate-600">
              <li>
                <strong className="text-slate-800">Not a Doctor:</strong> The assistant is not a licensed physician and does not replace professional clinical evaluation.
              </li>
              <li>
                <strong className="text-slate-800">No Prescriptions:</strong> The assistant does not prescribe, adjust, or discontinue medications.
              </li>
              <li>
                <strong className="text-slate-800">Emergency Protocol:</strong> Acute symptoms (severe chest pain, shortness of breath, sudden weakness) must be immediately evaluated at an Emergency Room.
              </li>
              <li>
                <strong className="text-slate-800">Quantum-Classical Pipeline:</strong> Predictions are generated from 10-qubit Variational Quantum Circuits (VQC) benchmarked on MIT-BIH Arrhythmia databases.
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-mono text-slate-400">
            <span>Model: Gemini 3.8 Flash + VQC Pipeline</span>
            <span>AAMI EC57 Aligned</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#101c28] text-white text-xs font-bold rounded-xl hover:bg-[#203144] cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
