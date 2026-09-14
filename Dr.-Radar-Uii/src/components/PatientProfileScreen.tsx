import React, { useState } from 'react';
import { ScreenTab, UserAccountState } from '../types';
import { ClinicalDisclaimer } from './ClinicalDisclaimer';
import { ProfileAvatar } from './profile/ProfileAvatar';
import { MyHealthInformationScreen } from './health-info/MyHealthInformationScreen';
import { MedicalRecordsSection } from './health-info/MedicalRecordsSection';
import {
  PatientHealthProfile,
  MedicalRecord,
  HealthInfoSectionKey,
} from '../types/healthInfo';

export type ProfileSubTab =
  | 'personal'
  | 'health-info'
  | 'records'
  | 'privacy'
  | 'notifications'
  | 'security'
  | 'settings';

interface PatientProfileScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings?: () => void;
  onOpenAccountSettings?: (tab?: 'profile' | 'account' | 'privacy' | 'security' | 'notifications') => void;
  onOpenProfilePictureModal?: () => void;
  onRemoveProfilePicture?: () => void;
  user?: UserAccountState;
  initialSubTab?: ProfileSubTab;
  // Health Information props
  healthProfile: PatientHealthProfile;
  records: MedicalRecord[];
  onUpdateProfile: (profile: PatientHealthProfile) => void;
  onUpdateSection: (key: HealthInfoSectionKey, data: any) => void;
  onAddRecord: (record: Omit<MedicalRecord, 'id' | 'uploadDate'>, file?: File) => MedicalRecord;
  onRenameRecord: (id: string, newTitle: string) => void;
  onDeleteRecord: (id: string) => void;
  onExportData?: () => void;
  onToggleTwoFactor?: () => void;
  onToggleResearchConsent?: () => void;
}

export const PatientProfileScreen: React.FC<PatientProfileScreenProps> = ({
  onNavigate,
  onOpenSettings,
  onOpenAccountSettings,
  onOpenProfilePictureModal,
  onRemoveProfilePicture,
  user,
  initialSubTab = 'personal',
  healthProfile,
  records,
  onUpdateProfile,
  onUpdateSection,
  onAddRecord,
  onRenameRecord,
  onDeleteRecord,
  onExportData,
  onToggleTwoFactor,
  onToggleResearchConsent,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>(initialSubTab);

  // Local state for notifications & devices
  const [remindersOn, setRemindersOn] = useState(true);
  const [patchSynced, setPatchSynced] = useState(true);
  const [irregularAlertsOn, setIrregularAlertsOn] = useState(true);
  const [digestEmailOn, setDigestEmailOn] = useState(true);

  // Privacy states
  const [retentionPeriod, setRetentionPeriod] = useState<'30d' | '90d' | '1y' | 'indefinite'>('1y');
  const [researchConsent, setResearchConsent] = useState(user?.privacy?.researchConsent ?? true);
  const [twoFactorActive, setTwoFactorActive] = useState(user?.security?.twoFactorEnabled ?? false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const displayName =
    user?.displayName ||
    (user?.firstName ? `${user.firstName} ${user.lastName}` : 'Ashton Miller');

  const hasCustomPicture = user?.profilePictureType && user.profilePictureType !== 'none';

  const SUB_TABS_CONFIG: {
    id: ProfileSubTab;
    label: string;
    icon: string;
    badge?: string;
  }[] = [
    { id: 'personal', label: 'Personal Information', icon: 'badge' },
    {
      id: 'health-info',
      label: 'My Health Information',
      icon: 'vital_signs',
      badge: `${healthProfile.completionPercentage || 60}%`,
    },
    {
      id: 'records',
      label: 'Medical Records',
      icon: 'folder_shared',
      badge: `${records.length}`,
    },
    { id: 'privacy', label: 'Privacy & Data', icon: 'shield' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'security', label: 'Security', icon: 'lock' },
    { id: 'settings', label: 'Account Settings', icon: 'settings' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#72fe88]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
              DR. RADAR • PATIENT PROFILE
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              ID #{user?.userId || 'PT-9042'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
            Patient Profile & Health Context
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your personal data, medical context, uploaded records, privacy preferences, and telemetry devices.
          </p>
        </div>

        {/* Quick External Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubTab('health-info')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#ffe8e8] text-[#bc000a] text-xs font-bold hover:bg-[#ffd9d9] transition-all border border-[#bc000a]/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[17px]">vital_signs</span>
            <span>Health Info</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('records')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[17px]">upload_file</span>
            <span>Add Records</span>
          </button>
        </div>
      </div>

      {/* Profile Section Navigation Bar (7 Core Sections) */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/90 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {SUB_TABS_CONFIG.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#bc000a] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#101c28] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: PERSONAL INFORMATION */}
      {activeSubTab === 'personal' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Patient Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border-b border-slate-100 pb-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4.5">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={onOpenProfilePictureModal}
                >
                  <ProfileAvatar
                    user={user}
                    size="2xl"
                    borderStyle="brand"
                    showIndicator
                    indicatorColor="green"
                    className="shadow-md ring-4 ring-[#bc000a]/10 group-hover:scale-105 transition-transform"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfilePictureModal?.();
                    }}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#bc000a] text-white flex items-center justify-center shadow-md hover:bg-[#a00008] transition-all cursor-pointer"
                    title="Change Photo or Avatar"
                  >
                    <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#101c28]">{displayName}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ffe8e8] text-[#bc000a] border border-[#bc000a]/20 font-bold uppercase tracking-wider">
                      {user?.role || 'Patient'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Active Monitoring
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {user?.dob ? `Born: ${user.dob}` : '34 yrs'} • {user?.gender || 'Male'} • Blood Type O+ • Primary Indication: Preventive Rhythm Telemetry
                  </p>

                  {/* Photo & Avatar Controls */}
                  <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                    <button
                      type="button"
                      id="profile-change-photo-btn"
                      onClick={onOpenProfilePictureModal}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#bc000a]">add_a_photo</span>
                      <span>Change Photo</span>
                    </button>

                    <button
                      type="button"
                      id="profile-choose-avatar-btn"
                      onClick={onOpenProfilePictureModal}
                      className="px-3 py-1.5 rounded-lg bg-[#ffe8e8]/60 hover:bg-[#ffe8e8] text-[#bc000a] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-[#bc000a]/20"
                    >
                      <span className="material-symbols-outlined text-[15px]">face</span>
                      <span>Choose Avatar</span>
                    </button>

                    {hasCustomPicture && (
                      <button
                        type="button"
                        id="profile-remove-photo-btn"
                        onClick={onRemoveProfilePicture || onOpenProfilePictureModal}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        <span>Remove Photo</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveSubTab('settings')}
                      className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 ml-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Edit Details</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('patient-appointments')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a00008] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                Book Consultation
              </button>
            </div>

            {/* Clinical Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Primary Cardiologist</span>
                <span className="font-bold text-[#101c28] mt-0.5 block">Dr. Ronald S.</span>
                <span className="text-[10px] text-slate-500">Metro Heart Inst.</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Enrolled Protocol</span>
                <span className="font-bold text-[#101c28] mt-0.5 block">AAMI EC57 Baseline</span>
                <span className="text-[10px] text-slate-500">Continuous 1-Lead</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Daily Resting Average</span>
                <span className="font-bold text-[#bc000a] mt-0.5 block">71 BPM</span>
                <span className="text-[10px] text-emerald-700">Healthy Conduction</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Emergency Contact</span>
                <span className="font-bold text-[#101c28] mt-0.5 block">Claire Miller</span>
                <span className="text-[10px] text-slate-500">+1 (555) 019-2834</span>
              </div>
            </div>
          </div>

          {/* Connected Telemetry Hardware */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#101c28]">Connected Telemetry Device</h3>
                <p className="text-xs text-slate-500">Wireless biopotential sensor paired via BLE</p>
              </div>
              <span className="text-xs font-mono text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#f8fbfe] border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#bc000a] shadow-2xs">
                  <span className="material-symbols-outlined text-[24px]">sensors</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#101c28]">Dr. Radar Bio-Patch #BP-841</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      Firmware v2.4.1
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Single-Lead ECG • 125 Hz Sampling Rate • 24-Bit ADC</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700 block">Battery 92%</span>
                  <span className="text-[10px] text-slate-400">Est. 4 days remaining</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('patient-ecg')}
                  className="px-3.5 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#a00008] transition-all shadow-2xs cursor-pointer"
                >
                  Test Sensor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY HEALTH INFORMATION (Main Dashboard View) */}
      {activeSubTab === 'health-info' && (
        <MyHealthInformationScreen
          healthProfile={healthProfile}
          records={records}
          onUpdateProfile={(updated) => {
            onUpdateProfile(updated);
            triggerToast('Health profile updated successfully');
          }}
          onUpdateSection={(key, data) => {
            onUpdateSection(key, data);
            triggerToast('Health section saved');
          }}
          onNavigateToRecords={() => setActiveSubTab('records')}
          onNavigateToPrivacy={() => setActiveSubTab('privacy')}
        />
      )}

      {/* TAB 3: MEDICAL RECORDS */}
      {activeSubTab === 'records' && (
        <MedicalRecordsSection
          records={records}
          onAddRecord={(rec, file) => {
            const added = onAddRecord(rec, file);
            triggerToast('Medical record uploaded and saved');
            return added;
          }}
          onRenameRecord={(id, title) => {
            onRenameRecord(id, title);
            triggerToast('Document renamed');
          }}
          onDeleteRecord={(id) => {
            onDeleteRecord(id);
            triggerToast('Document removed from records');
          }}
          onNavigateToHealthInfo={() => setActiveSubTab('health-info')}
        />
      )}

      {/* TAB 4: PRIVACY & DATA (Section 12) */}
      {activeSubTab === 'privacy' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#bc000a]">shield</span>
                <h3 className="text-base font-bold text-[#101c28]">Privacy & Data Governance</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Your health information is sensitive. Review how your clinical data, uploaded medical records, and ECG recordings are protected.
              </p>
            </div>

            {/* Privacy highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">lock</span>
                  AES-256 Encryption
                </span>
                <p className="text-slate-500 text-[11px]">
                  All uploaded medical records, ECG vectors, and profile answers are encrypted at rest and in transit.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">verified_user</span>
                  HIPAA Security Rule
                </span>
                <p className="text-slate-500 text-[11px]">
                  Configured according to administrative, physical, and technical safeguards for protected health information.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#bc000a]">person_remove</span>
                  Patient Controlled
                </span>
                <p className="text-slate-500 text-[11px]">
                  You retain full ownership. You can export, modify, or permanently delete your health record at any time.
                </p>
              </div>
            </div>

            {/* Retention Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">
                Telemetry Waveform Data Retention
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '30d', label: '30 Days' },
                  { id: '90d', label: '90 Days' },
                  { id: '1y', label: '1 Year (Recommended)' },
                  { id: 'indefinite', label: 'Indefinite' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setRetentionPeriod(opt.id as any);
                      triggerToast(`Data retention updated to ${opt.label}`);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      retentionPeriod === opt.id
                        ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Research & AI Model Training */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f8fbfe] border border-blue-100">
              <div>
                <span className="font-bold text-xs text-[#101c28] block">
                  Anonymous Research Contribution
                </span>
                <span className="text-[11px] text-slate-500">
                  Allow de-identified ECG waveforms to improve Dr. Radar's arrhythmias detection models.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResearchConsent(!researchConsent);
                  onToggleResearchConsent?.();
                  triggerToast(`Research contribution ${!researchConsent ? 'enabled' : 'disabled'}`);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  researchConsent ? 'bg-[#bc000a]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    researchConsent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Export button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Download a complete copy of your profile, medical documents, and ECG logs.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onExportData) {
                    onExportData();
                  }
                  triggerToast('Health dossier exported');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Export Health Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#101c28]">Notifications & Reminders</h3>
            <p className="text-xs text-slate-500">Control alert frequency and clinical screening prompts</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-xs text-[#101c28] block">Daily Morning ECG Reminder</span>
                <span className="text-[11px] text-slate-500">Receive a gentle prompt to take your 30-sec resting scan at 08:00 AM</span>
              </div>
              <button
                type="button"
                onClick={() => setRemindersOn(!remindersOn)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  remindersOn ? 'bg-[#bc000a]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    remindersOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-xs text-[#101c28] block">Urgent Rhythm Anomaly Alerts</span>
                <span className="text-[11px] text-slate-500">Immediate push notifications if telemetry detects sustained ventricular ectopic runs</span>
              </div>
              <button
                type="button"
                onClick={() => setIrregularAlertsOn(!irregularAlertsOn)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  irregularAlertsOn ? 'bg-[#bc000a]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    irregularAlertsOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-xs text-[#101c28] block">Weekly Cardiologist Digest</span>
                <span className="text-[11px] text-slate-500">Email summary of 7-day average heart rate, PVC burdens, and rhythm stability</span>
              </div>
              <button
                type="button"
                onClick={() => setDigestEmailOn(!digestEmailOn)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  digestEmailOn ? 'bg-[#bc000a]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    digestEmailOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#101c28]">Account Security & Credentials</h3>
            <p className="text-xs text-slate-500">Protect access to your clinical records and health monitoring</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-xs text-[#101c28] block">Two-Factor Authentication (2FA)</span>
                <span className="text-[11px] text-slate-500">
                  Require an authenticator code or SMS token when signing in.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorActive(!twoFactorActive);
                  onToggleTwoFactor?.();
                  triggerToast(`Two-factor authentication ${!twoFactorActive ? 'enabled' : 'disabled'}`);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  twoFactorActive ? 'bg-[#bc000a]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    twoFactorActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800 block">Active Device Sessions</span>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Chrome on MacOS (Current Session)
                </span>
                <span className="font-mono text-slate-400">Active now</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">Last password update: 42 days ago</span>
              <button
                type="button"
                onClick={() => onOpenAccountSettings?.('security')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ACCOUNT SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#101c28]">Account Settings</h3>
            <p className="text-xs text-slate-500">Identity details, communication email, and workspace roles</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Full Legal Name</label>
              <input
                type="text"
                disabled
                value={displayName}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || 'ashton.miller@example.health'}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onOpenAccountSettings?.('account')}
              className="px-4 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] cursor-pointer"
            >
              Open Full Account Editor
            </button>
            <span className="text-[11px] text-slate-400">
              Dr. Radar Patient Platform v2.4.0
            </span>
          </div>
        </div>
      )}

      {/* Regulatory Clinical Disclaimer */}
      <ClinicalDisclaimer variant="card" />
    </div>
  );
};
