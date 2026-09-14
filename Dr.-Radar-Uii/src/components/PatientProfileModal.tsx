import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { UserAccountState } from '../types';
import { ProfileAvatar } from './profile/ProfileAvatar';

interface PatientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onOpenSettings?: () => void;
  onOpenAccountSettings?: (tab?: 'profile' | 'account' | 'privacy' | 'security' | 'notifications') => void;
  user?: UserAccountState;
  onOpenProfilePictureModal?: () => void;
}

export const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onOpenSettings,
  onOpenAccountSettings,
  user,
  onOpenProfilePictureModal,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const patientId = 'HR-993-21A';

  const handleCopyId = () => {
    navigator.clipboard.writeText(patientId);
    onShowToast(`Copied Patient ID: ${patientId}`, 'success');
  };

  const toggleSection = (section: string) => {
    setActiveSection(prev => (prev === section ? null : section));
  };

  return (
    <AnimatePresence>
      <div
        id="patient-profile-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          id="patient-profile-sheet"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[400px] bg-white rounded-[32px] shadow-2xl border border-black/[0.06] overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* Subtle Top Atmospheric Warm Gradient */}
          <div className="absolute top-0 inset-x-0 h-44 bg-gradient-to-b from-[#ffedeb]/70 via-[#fff8f8]/40 to-transparent pointer-events-none" />

          {/* Header Bar */}
          <header className="relative z-10 px-6 pt-5 pb-3 flex items-center">
            <button
              id="patient-profile-back-btn"
              onClick={onClose}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#101c28] hover:bg-black/5 active:scale-95 transition-all focus:outline-none"
              title="Close Profile"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="text-[20px] font-bold text-[#101c28] ml-2 tracking-tight">
              Profile
            </h1>
          </header>

          {/* Scrollable Content Body */}
          <div className="relative z-10 overflow-y-auto px-6 pb-7 space-y-5 no-scrollbar">
            {/* Avatar & Verification Badge */}
            <div className="flex flex-col items-center text-center pt-1">
              <div
                className="relative group cursor-pointer"
                onClick={onOpenProfilePictureModal}
                title="Change Photo or Choose Avatar"
              >
                <ProfileAvatar
                  user={user}
                  size="2xl"
                  borderStyle="brand"
                  showIndicator
                  indicatorColor="green"
                  className="shadow-sm ring-4 ring-[#bc000a]/10 group-hover:scale-105 transition-transform"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfilePictureModal?.();
                  }}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#bc000a] text-white flex items-center justify-center shadow-md hover:bg-[#a00008] transition-all cursor-pointer"
                  title="Change Profile Picture"
                >
                  <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                </button>
              </div>

              {/* Patient Name */}
              <h2 className="text-[23px] font-bold text-[#101c28] tracking-tight mt-3">
                {user?.displayName || (user?.firstName ? `${user.firstName} ${user.lastName}` : 'Ashton Simpson')}
              </h2>

              {onOpenProfilePictureModal && (
                <button
                  type="button"
                  onClick={onOpenProfilePictureModal}
                  className="text-xs font-semibold text-[#bc000a] hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                  <span>Change Photo / Choose Avatar</span>
                </button>
              )}

              {/* ID Capsule Pill & Copy Action */}
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="text-[12px] font-semibold text-[#52525b] bg-[#f4f4f6] px-3 py-1 rounded-full border border-black/[0.04] tracking-wide">
                  ID: {patientId}
                </span>
                <button
                  id="copy-patient-id-btn"
                  onClick={handleCopyId}
                  className="text-[12px] font-semibold text-[#bc000a] flex items-center gap-1 hover:opacity-80 active:scale-95 transition-all px-1.5 py-0.5 rounded focus:outline-none"
                  title="Copy Patient ID to Clipboard"
                >
                  <span>Copy</span>
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>
              </div>
            </div>

            {/* Two Stat Cards (Avg Vitals & Status) */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              {/* Card 1: Avg Vitals */}
              <div className="bg-[#f9fafb] rounded-[22px] p-3.5 border border-black/[0.04] flex flex-col justify-between h-[100px] relative overflow-hidden">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#52525b]">
                  <span className="material-symbols-outlined text-[#bc000a] text-[15px] fill-current">
                    favorite
                  </span>
                  <span>Avg Vitals</span>
                </div>

                <div className="flex items-baseline gap-1 z-10 relative mt-1">
                  <span className="text-[26px] font-extrabold text-[#101c28] tracking-tight leading-none">
                    98
                  </span>
                  <span className="text-[11px] font-bold text-[#71717a] tracking-wider uppercase">
                    BPM
                  </span>
                </div>

                {/* Ambient Subtle ECG Sparkline Wave */}
                <svg
                  className="absolute bottom-1 left-0 right-0 w-full h-8 pointer-events-none opacity-70"
                  viewBox="0 0 120 30"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 20 L25 20 L35 15 L42 26 L50 4 L58 25 L65 18 L74 22 L82 14 L92 24 L120 20"
                    stroke="#f87171"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Card 2: Status */}
              <div className="bg-[#f9fafb] rounded-[22px] p-3.5 border border-black/[0.04] flex flex-col justify-between h-[100px]">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#52525b]">
                  <span className="material-symbols-outlined text-[#0284c7] text-[16px]">
                    monitor_heart
                  </span>
                  <span>Status</span>
                </div>

                <div className="flex items-center gap-2 mt-auto mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0" />
                  <span className="text-[20px] font-bold text-[#15803d] tracking-tight leading-none">
                    Stable
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Sections List */}
            <div className="space-y-2.5 pt-1">
              {/* Item 1: Personal Information */}
              <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
                <button
                  id="section-personal-info"
                  onClick={() => toggleSection('personal')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ffebe9] flex items-center justify-center shrink-0 text-[#bc000a]">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#101c28] leading-tight">
                        Personal Information
                      </h3>
                      <p className="text-[11px] text-[#71717a] mt-0.5">
                        Contact, Address, Emergency
                      </p>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[#a1a1aa] text-[20px] transition-transform ${
                      activeSection === 'personal' ? 'rotate-90 text-[#bc000a]' : ''
                    }`}
                  >
                    chevron_right
                  </span>
                </button>

                {activeSection === 'personal' && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-[#fafafa]/50 text-xs text-[#3f3f46] space-y-2 animate-in fade-in">
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Age & Gender</span>
                      <span className="font-semibold text-[#101c28]">34 yrs • Male</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Blood Type</span>
                      <span className="font-semibold text-[#bc000a]">O-Positive (O+)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Phone</span>
                      <span className="font-semibold text-[#101c28]">+1 (555) 234-8901</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Emergency Contact</span>
                      <span className="font-semibold text-[#101c28]">Sarah S. (Spouse)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#71717a]">Allergies</span>
                      <span className="font-semibold text-amber-700">Penicillin (Mild)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 2: Health Records */}
              <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
                <button
                  id="section-health-records"
                  onClick={() => toggleSection('health')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#e0f2fe] flex items-center justify-center shrink-0 text-[#0284c7]">
                      <span className="material-symbols-outlined text-[20px]">medical_services</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#101c28] leading-tight">
                        Health Records
                      </h3>
                      <p className="text-[11px] text-[#71717a] mt-0.5">
                        Scans, Lab Results, Notes
                      </p>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[#a1a1aa] text-[20px] transition-transform ${
                      activeSection === 'health' ? 'rotate-90 text-[#0284c7]' : ''
                    }`}
                  >
                    chevron_right
                  </span>
                </button>

                {activeSection === 'health' && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-[#fafafa]/50 text-xs text-[#3f3f46] space-y-2 animate-in fade-in">
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Latest Cardiac Scan</span>
                      <span className="font-semibold text-[#16a34a]">Verified Stable (Today)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Holter Rhythm 24h</span>
                      <span className="font-semibold text-[#101c28]">Sinus Rhythm (99.4%)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Lipid Panel</span>
                      <span className="font-semibold text-[#101c28]">Optimal (Aug 24)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#71717a]">Assigned Cardiologist</span>
                      <span className="font-semibold text-[#bc000a]">Dr. Ronald S.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 3: Insurance Details */}
              <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
                <button
                  id="section-insurance"
                  onClick={() => toggleSection('insurance')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center shrink-0 text-[#16a34a]">
                      <span className="material-symbols-outlined text-[20px]">shield</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#101c28] leading-tight">
                        Insurance Details
                      </h3>
                      <p className="text-[11px] text-[#71717a] mt-0.5">
                        Primary & Secondary Coverage
                      </p>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[#a1a1aa] text-[20px] transition-transform ${
                      activeSection === 'insurance' ? 'rotate-90 text-[#16a34a]' : ''
                    }`}
                  >
                    chevron_right
                  </span>
                </button>

                {activeSection === 'insurance' && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-[#fafafa]/50 text-xs text-[#3f3f46] space-y-2 animate-in fade-in">
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Carrier</span>
                      <span className="font-semibold text-[#101c28]">BlueCross Premier PPO</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Policy Number</span>
                      <span className="font-mono font-semibold text-[#101c28]">#BC-88492048</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-black/[0.03]">
                      <span className="text-[#71717a]">Cardiology Copay</span>
                      <span className="font-semibold text-[#16a34a]">$25.00</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#71717a]">Status</span>
                      <span className="font-semibold text-[#16a34a]">Active • In-Network</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 4: Account & Profile Settings */}
              <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
                <button
                  id="section-account-settings"
                  onClick={() => {
                    onClose();
                    if (onOpenAccountSettings) {
                      onOpenAccountSettings('profile');
                    } else if (onOpenSettings) {
                      onOpenSettings();
                    } else {
                      toggleSection('settings');
                    }
                  }}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ffe8e8] flex items-center justify-center shrink-0 text-[#bc000a]">
                      <span className="material-symbols-outlined text-[20px]">badge</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#101c28] leading-tight">
                        Profile & Account Settings
                      </h3>
                      <p className="text-[11px] text-[#71717a] mt-0.5">
                        Demographics, Security, Privacy Controls
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#a1a1aa] text-[20px]">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {/* Subtle Clinical Non-Diagnostic Disclaimer */}
            <ClinicalDisclaimer className="mt-2" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
