import { useState } from 'react';
import { ScreenTab, UserAccountState } from '../types';
import { ASSETS } from '../data/mockData';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { ProfileAvatar } from './profile/ProfileAvatar';

interface HeaderProps {
  currentTab: ScreenTab;
  onTabChange: (tab: ScreenTab) => void;
  onOpenSettings: () => void;
  user?: UserAccountState;
  onOpenProfilePictureModal?: () => void;
}

export const Header = ({
  currentTab,
  onTabChange,
  onOpenSettings,
  user,
  onOpenProfilePictureModal,
}: HeaderProps) => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  const getTitle = () => {
    switch (currentTab) {
      case 'overview':
        return 'OVERVIEW';
      case 'dataset':
        return 'DATASET';
      case 'ecg-analysis':
        return 'ECG ANALYSIS';
      case 'quantum-lab':
        return 'QUANTUM LAB';
      case 'experiments':
        return 'EXPERIMENTS';
      case 'explainability':
        return 'EXPLAINABILITY';
      case 'benchmarks':
        return 'BENCHMARKS';
      default:
        return 'OVERVIEW';
    }
  };

  return (
    <>
      <header
        id="app-header"
        className="fixed top-0 left-0 right-0 w-full z-40 bg-[#f4f8fd]/85 backdrop-blur-xl pt-safe border-b border-[#dceaf7]/70 shadow-[0_1px_8px_rgba(0,0,0,0.02)] transition-all"
      >
        <div className="max-w-md md:max-w-lg mx-auto h-16 px-6 flex items-center justify-between">
          {/* Logo & Brand */}
          <button
            id="brand-logo-btn"
            onClick={() => onTabChange('overview')}
            className="flex items-center gap-2 text-left focus:outline-none group active:scale-95 transition-transform"
          >
            <img
              alt="Dr. Radar Logo"
              className="h-8 w-auto object-contain drop-shadow-sm group-hover:brightness-105"
              src={ASSETS.logo}
            />
            <span className="font-semibold text-xl tracking-tight text-[#bc000a] hidden xs:inline-block">
              Dr. Radar
            </span>
          </button>

          {/* Current Screen Title */}
          <h1
            id="current-screen-title"
            className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#5d3f3b] text-center"
          >
            {getTitle()}
          </h1>

          {/* Right Header Actions: Settings & Profile */}
          <div className="flex items-center gap-2">
            <button
              id="header-settings-btn"
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-full bg-white/70 backdrop-blur-md flex items-center justify-center text-[#5d3f3b] hover:text-[#bc000a] hover:bg-white transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#bc000a]/20"
              title="Settings & Reminders"
            >
              <span className="material-symbols-outlined text-[19px]">settings</span>
            </button>

            {/* Profile Avatar with Indicator */}
            <button
              id="profile-avatar-btn"
              onClick={() => setShowProfileModal(true)}
              className="relative flex items-center justify-center rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-[#bc000a]/30 transition-transform active:scale-95 cursor-pointer"
              title="View Patient Profile"
            >
              <ProfileAvatar
                user={user}
                size="sm"
                showIndicator
                indicatorColor="green"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Patient Profile Modal */}
      {showProfileModal && (
        <div
          id="profile-modal-backdrop"
          onClick={() => setShowProfileModal(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            id="profile-modal-content"
            onClick={(e) => e.stopPropagation()}
            className="matte-3d-card w-full max-w-sm rounded-3xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  user={user}
                  size="lg"
                  borderStyle="brand"
                />
                <div>
                  <h3 className="font-semibold text-[#1b1b1d] text-base">
                    {user?.displayName || user?.firstName || 'Ashton Miller'}
                  </h3>
                  <p className="text-xs text-[#5d3f3b]">Patient ID: {user?.userId || 'IDV-89412'}</p>
                  {onOpenProfilePictureModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileModal(false);
                        onOpenProfilePictureModal();
                      }}
                      className="text-[11px] font-semibold text-[#bc000a] hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                      <span>Change Picture / Avatar</span>
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-full bg-[#f0edef] flex items-center justify-center text-[#5d3f3b] hover:bg-black/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#f6f3f5] p-3 rounded-2xl">
                <span className="text-[#5d3f3b] block">Biological Age</span>
                <span className="text-sm font-semibold text-[#1b1b1d] mt-0.5 block">34 yrs</span>
              </div>
              <div className="bg-[#f6f3f5] p-3 rounded-2xl">
                <span className="text-[#5d3f3b] block">Blood Type</span>
                <span className="text-sm font-semibold text-[#1b1b1d] mt-0.5 block">O+ Positive</span>
              </div>
              <div className="bg-[#f6f3f5] p-3 rounded-2xl">
                <span className="text-[#5d3f3b] block">Resting Avg</span>
                <span className="text-sm font-semibold text-[#bc000a] mt-0.5 block">62 BPM</span>
              </div>
              <div className="bg-[#f6f3f5] p-3 rounded-2xl">
                <span className="text-[#5d3f3b] block">Patch Sensor</span>
                <span className="text-sm font-semibold text-[#006b27] mt-0.5 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b27] animate-ping" />
                  Online
                </span>
              </div>
            </div>

            <div className="bg-[#ffdad5]/40 border border-[#bc000a]/20 p-3 rounded-2xl text-xs text-[#410001] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#bc000a] shrink-0">
                verified_user
              </span>
              <span>
                Continuously monitored by Dr. Radar AI Cardiac Core algorithm. All telemetry is encrypted and HIPAA compliant.
              </span>
            </div>

            <ClinicalDisclaimer />

            <div className="flex gap-2">
              <button
                id="profile-open-settings-btn"
                onClick={() => {
                  setShowProfileModal(false);
                  onOpenSettings();
                }}
                className="flex-1 py-2.5 rounded-full bg-[#f6f3f5] text-[#1b1b1d] text-xs font-semibold hover:bg-[#eae7ea] transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-[#bc000a]">tune</span>
                Reminders & Settings
              </button>

              <button
                id="profile-done-btn"
                onClick={() => setShowProfileModal(false)}
                className="px-6 py-2.5 rounded-full bg-[#bc000a] text-white text-xs font-semibold shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
