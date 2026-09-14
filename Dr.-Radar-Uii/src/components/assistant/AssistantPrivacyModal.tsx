import React from 'react';
import { useUserAccount } from '../../hooks/useUserAccount';

interface AssistantPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
}

export const AssistantPrivacyModal: React.FC<AssistantPrivacyModalProps> = ({
  isOpen,
  onClose,
  onClearHistory,
}) => {
  const { user, toggleResearchConsent } = useUserAccount();

  if (!isOpen) return null;

  return (
    <div
      id="assistant-privacy-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="assistant-privacy-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#f8fbfe]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#101c28]">AI & Data Privacy Controls</h3>
              <p className="text-[11px] text-slate-500">How Ask Dr. Radar handles your conversations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-600 max-h-[70vh] overflow-y-auto">
          {/* Privacy Principles */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-[#101c28]">Core Privacy Principles</h4>
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">
                  lock
                </span>
                <div>
                  <p className="font-bold text-[#101c28]">Local Session Storage</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Your conversation history is stored locally in your browser and encrypted in transit. You have full control to clear it anytime.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-[#bc000a] shrink-0 mt-0.5">
                  security
                </span>
                <div>
                  <p className="font-bold text-[#101c28]">No Sale of Health Data</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dr. Radar never sells personal health identifiers, ECG waveforms, or AI query transcripts to commercial data brokers or advertisers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Research Consent Setting */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-sm text-[#101c28] mb-2">Research & Intelligence Consent</h4>
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-amber-950">De-identified Academic Research</p>
                <p className="text-[11px] text-amber-900/80 mt-0.5">
                  Allow anonymized arrhythmia telemetry features to support hybrid quantum benchmark studies.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={user.researchConsent}
                  onChange={toggleResearchConsent}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#bc000a]" />
              </label>
            </div>
          </div>

          {/* Data Deletion CTA */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-sm text-[#101c28] mb-1">Clear AI Assistant History</h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Permanently erase all chat messages, attached context links, and cached threads on this device.
            </p>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all Ask Dr. Radar conversation history?')) {
                  onClearHistory();
                  onClose();
                }
              }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Clear All Assistant History
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-[#f8fbfe] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#101c28] hover:bg-[#203144] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
