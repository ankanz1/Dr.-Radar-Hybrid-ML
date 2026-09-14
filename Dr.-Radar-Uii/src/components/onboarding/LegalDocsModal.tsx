import React from 'react';
import { DrRadarLogo } from '../DrRadarLogo';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'privacy' | 'terms';
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({
  isOpen,
  onClose,
  documentType,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="legal-docs-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="legal-docs-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col border border-slate-200/80 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#f8fbfe]">
          <div className="flex items-center gap-3">
            <DrRadarLogo size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#bc000a]">
                  DR. RADAR LEGAL COMPLIANCE
                </span>
                <span className="text-[10px] font-mono text-slate-400">v2.4 • ISO/IEC 27001</span>
              </div>
              <h3 className="text-lg font-bold text-[#101c28]">
                {documentType === 'privacy' ? 'Clinical Privacy & Data Policy' : 'Terms of Clinical Service'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600 leading-relaxed">
          {documentType === 'privacy' ? (
            <>
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 text-blue-900 text-xs flex gap-2.5 items-start">
                <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">verified_user</span>
                <div>
                  <strong>Our Privacy Commitment:</strong> Dr. Radar is built upon the principle of patient confidentiality and data sovereignty. We do not sell personal health information or link personal identities to publicly accessible research models.
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">1. Scope of Data Collection</h4>
                <p>
                  Dr. Radar collects only the physiological waveforms (such as 12-lead or single-lead ECG signals), multimodal biomedical scans, and basic demographic parameters necessary to provide computational analysis and algorithmic decision-support.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">2. Anonymized & De-identified Data Handling</h4>
                <p>
                  When you grant optional research consent, your data is processed through automated de-identification pipelines in compliance with HIPAA Safe Harbor and GDPR pseudonymization guidelines. Direct identifiers (name, email, device serials) are permanently stripped before any computational benchmarking or model refinement.
                </p>
                <p className="mt-1 text-xs text-slate-500 italic">
                  Note: While state-of-the-art cryptographic noise and feature hashing are utilized, no computational system can mathematically guarantee absolute zero re-identification risk; we use the standard term &quot;Anonymized and De-identified Data&quot; to accurately describe these protections.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">3. Research & Model Improvement</h4>
                <p>
                  Participation in research training datasets is <strong>strictly optional</strong>. If you decline or subsequently withdraw research consent, your decision will never affect your access to clinical decision-support tools or diagnostic telemetry analysis.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">4. Data Subject Rights & Withdrawal</h4>
                <p>
                  You retain the right at any time to:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                  <li>Inspect all stored personal data through the &quot;View My Data&quot; feature in Account Settings.</li>
                  <li>Export a structured JSON copy of your profile via &quot;Download My Data&quot;.</li>
                  <li>Instantly withdraw optional research consent with immediate effect.</li>
                  <li>Request permanent deletion of your account and associated local records.</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-100 text-amber-900 text-xs flex gap-2.5 items-start">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">warning</span>
                <div>
                  <strong>Medical Disclaimer:</strong> Dr. Radar is an algorithmic decision-support tool powered by hybrid quantum–classical machine learning. It is not an autonomous medical device and does not replace the licensed clinical judgment of a physician.
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">1. Intended Use & Clinical Advisory</h4>
                <p>
                  Dr. Radar provides probabilistic classifications (including AAMI-standard arrhythmia classes and disease probability distributions) intended to assist clinicians, researchers, and patients. In cases of acute chest pain, dyspnea, or medical emergency, immediately contact emergency medical services.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">2. User Account Responsibilities</h4>
                <p>
                  You agree to provide accurate basic information to support appropriate signal normalization and clinical context. You are responsible for maintaining the confidentiality of your credentials and monitoring active sessions.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">3. Hybrid Quantum–Classical Compute Service</h4>
                <p>
                  Algorithmic inferences may utilize parameterized quantum circuits (VQCs) simulated or executed on quantum processor units. Latency and confidence bounds reflect computational stochasticity inherent to variational quantum architectures.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">4. Termination and Data Retention</h4>
                <p>
                  You may close your account at any time via Account Settings. Upon closure, all active sessions are invalidated and account identifiers are removed in accordance with our data retention schedule.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">Dr. Radar • Effective September 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a50009] transition-all cursor-pointer shadow-xs"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
