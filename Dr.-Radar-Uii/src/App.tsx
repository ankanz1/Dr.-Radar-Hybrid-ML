import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenTab, UserRole, HistoryReport } from './types';
import { Navigation } from './components/Navigation';

// Patient Experience Screens
import { PatientHomeScreen } from './components/PatientHomeScreen';
import { PatientEcgScreen } from './components/PatientEcgScreen';
import { PatientResultsScreen } from './components/PatientResultsScreen';
import { PatientProfileScreen } from './components/PatientProfileScreen';
import { BookingScreen } from './components/BookingScreen';

// Doctor Experience Screens
import { DoctorDashboardScreen } from './components/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './components/DoctorPatientsScreen';
import { DoctorAlertsScreen } from './components/DoctorAlertsScreen';
import { DoctorReportsScreen } from './components/DoctorReportsScreen';
import { ECGAnalysisScreen } from './components/ECGAnalysisScreen';

// Advanced Research & Diagnostic Screens (Secondary)
import { OverviewScreen } from './components/OverviewScreen';
import { QuantumLabScreen } from './components/QuantumLabScreen';
import { ExplainabilityScreen } from './components/ExplainabilityScreen';
import { BenchmarksScreen } from './components/BenchmarksScreen';
import { ExperimentsScreen } from './components/ExperimentsScreen';
import { DatasetScreen } from './components/DatasetScreen';

// Modals & Account Management
import { FullReportModal } from './components/FullReportModal';
import { SettingsModal } from './components/SettingsModal';
import { AccountSettingsModal, SettingsTab } from './components/AccountSettingsModal';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { PatientProfileModal } from './components/PatientProfileModal';
import { NotificationsModal } from './components/NotificationsModal';
import { HealthcareSupportModal } from './components/HealthcareSupportModal';
import { AskDrRadarModal } from './components/assistant/AskDrRadarModal';
import { AssistantContext } from './types/assistant';
import { useReminders } from './hooks/useReminders';
import { useUserAccount } from './hooks/useUserAccount';
import { ProfileAvatar } from './components/profile/ProfileAvatar';
import { ProfilePictureModal } from './components/profile/ProfilePictureModal';
import { useHealthInformation } from './hooks/useHealthInformation';

// Multimodal Analysis Hub & Reusable Architecture
import { AnalysisHubScreen } from './components/AnalysisHubScreen';
import { ReusableModalityAnalysisScreen } from './components/ReusableModalityAnalysisScreen';
import { DrRadarLogo } from './components/DrRadarLogo';

export default function App() {
  const {
    user,
    isOnboardingActive,
    currentStep,
    setCurrentStep,
    startOnboarding,
    completeOnboarding,
    updateProfile,
    updateProfilePicture,
    updateRole,
    setConsent,
    toggleResearchConsent,
    toggleNotification,
    toggleTwoFactor,
    signOut,
    deleteAccount,
    exportUserData,
  } = useUserAccount();

  // Centralized Health Context & Records (My Health Information)
  const {
    healthProfile,
    records: healthRecords,
    updateHealthProfile,
    updateSection: updateHealthSection,
    addMedicalRecord,
    renameMedicalRecord,
    deleteMedicalRecord,
    contextSummary: healthSummary,
  } = useHealthInformation();

  const [userRole, setUserRole] = useState<UserRole>(user.role || 'patient');
  const [currentTab, setCurrentTab] = useState<ScreenTab>(
    user.role === 'doctor' ? 'doctor-dashboard' : user.role === 'researcher' ? 'explainability' : 'patient-home'
  );
  const [selectedDoctorPatientId, setSelectedDoctorPatientId] = useState<string>('p-102');
  const [selectedModalityTestId, setSelectedModalityTestId] = useState<string>('imaging-cxr');
  const [activeReportModal, setActiveReportModal] = useState<Partial<HistoryReport> | null>(null);
  const [globalToast, setGlobalToast] = useState<{ message: string; type?: 'success' | 'info' | 'warning' } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState<SettingsTab>('profile');
  const [isProfilePictureModalOpen, setIsProfilePictureModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPatientProfileOpen, setIsPatientProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHealthcareOpen, setIsHealthcareOpen] = useState(false);

  // Ask Dr. Radar AI Assistant State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<AssistantContext | null>(null);

  const handleOpenAssistant = (context?: AssistantContext | null, initialQuery?: string) => {
    setAssistantContext(context || null);
    setIsAssistantOpen(true);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setGlobalToast({ message, type });
    setTimeout(() => setGlobalToast(null), 3500);
  };

  const reminders = useReminders(showToast);

  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    updateRole(newRole);
    if (newRole === 'patient') {
      setCurrentTab('patient-home');
    } else if (newRole === 'doctor') {
      setCurrentTab('doctor-dashboard');
    } else {
      setCurrentTab('explainability');
    }
  };

  const handleCompleteOnboarding = (role?: UserRole) => {
    const finalRole = role || user.role || 'patient';
    completeOnboarding(finalRole);
    setUserRole(finalRole);
    if (finalRole === 'patient') {
      setCurrentTab('patient-home');
    } else if (finalRole === 'doctor') {
      setCurrentTab('doctor-dashboard');
    } else {
      setCurrentTab('explainability');
    }
    showToast(`Welcome to Dr. Radar, ${user.displayName || 'Doctor'}!`, 'success');
  };

  const handleDownloadReport = () => {
    if (activeReportModal?.title) {
      showToast(`Downloading ${activeReportModal.title} (Clinical PDF)...`, 'info');
    }
    setActiveReportModal(null);
  };

  // Tab metadata for top bar headers
  const tabMetadata: Record<ScreenTab, { title: string; subtitle: string; icon: string; badge: string }> = {
    // Core Navigation Tabs
    home: {
      title: userRole === 'patient' ? 'Heart Health Overview' : 'Cardiology Review Dashboard',
      subtitle: userRole === 'patient' ? 'Daily telemetry summary, rhythm stability status, and next actions' : 'Real-time patient telemetry queue, urgent arrhythmia alerts, and decision triage',
      icon: userRole === 'patient' ? 'home' : 'dashboard',
      badge: userRole === 'patient' ? 'Bio-Patch Active' : '142 Active Patients',
    },
    analysis: {
      title: 'Start an Analysis',
      subtitle: 'Choose a clinical area to begin • Cardiology, Medical Imaging, Chronic Disease, Cancer & Liver',
      icon: 'category',
      badge: '5 Clinical Domains',
    },
    'reusable-analysis': {
      title: 'Multimodal Analysis Framework',
      subtitle: 'Standardized clinical input, VQC feature contraction & decision-support output hierarchy',
      icon: 'schema',
      badge: 'Standardized Blueprint',
    },
    patients: {
      title: 'Patient Cohort & Telemetry Chart',
      subtitle: 'Holistic patient records, 5-class AAMI predictions, probability distribution & clinical charting',
      icon: 'groups',
      badge: 'Clinical Charting',
    },
    results: {
      title: 'Diagnostic Reports & Trends',
      subtitle: 'Archived ECG test sessions, multimodal scans, and historical decision-support results',
      icon: 'description',
      badge: 'Diagnostic Archive',
    },
    reports: {
      title: 'Clinical Reports & Sign-Offs',
      subtitle: 'Official decision-support dossiers generated for hospital telemetry records and EHR',
      icon: 'description',
      badge: 'Physician Sign-Off',
    },
    profile: {
      title: 'Medical Profile & Devices',
      subtitle: 'Personal medical identification, connected hardware sensors, and emergency contacts',
      icon: 'person',
      badge: 'ID #PT-9042',
    },
    alerts: {
      title: 'Arrhythmia Clinical Alerts',
      subtitle: 'Real-time critical events triaged by the hybrid quantum-classical decision pipeline',
      icon: 'emergency',
      badge: '3 Events Queued',
    },

    // Patient Tabs
    'patient-home': {
      title: 'Heart Health Overview',
      subtitle: 'Daily telemetry summary, rhythm stability status, and next actions',
      icon: 'home',
      badge: 'Bio-Patch Active',
    },
    'patient-ecg': {
      title: 'My ECG Telemetry',
      subtitle: 'Real-time continuous lead monitoring & diagnostic 30-sec recording',
      icon: 'vital_signs',
      badge: '125 Hz Lead II',
    },
    'patient-results': {
      title: 'Diagnostic Reports & Trends',
      subtitle: 'Archived ECG test sessions, cardiologist reviews, and resting rate trends',
      icon: 'description',
      badge: 'Dossiers',
    },
    'patient-appointments': {
      title: 'Cardiology Consultations',
      subtitle: 'Schedule in-person visits or telehealth appointments with electrophysiologists',
      icon: 'calendar_today',
      badge: 'Verified Care Team',
    },
    'patient-profile': {
      title: 'Medical Profile & Devices',
      subtitle: 'Personal medical identification, connected hardware sensors, and emergency contacts',
      icon: 'person',
      badge: 'ID #PT-9042',
    },
    'health-info': {
      title: 'My Health Information',
      subtitle: 'Centralized patient health context, clinical questionnaire, and medical history',
      icon: 'vital_signs',
      badge: 'Context Active',
    },
    'medical-records': {
      title: 'Medical Records & Documents',
      subtitle: 'Upload and organize laboratory reports, clinical summaries, ECGs, and imaging files',
      icon: 'folder_shared',
      badge: 'Encrypted Vault',
    },

    // Doctor Tabs
    'doctor-dashboard': {
      title: 'Cardiology Review Dashboard',
      subtitle: 'Real-time patient telemetry queue, urgent arrhythmia alerts, and decision triage',
      icon: 'dashboard',
      badge: '142 Active Patients',
    },
    'doctor-patients': {
      title: 'Patient Detail & Telemetry Chart',
      subtitle: 'Holistic patient records, 5-class AAMI predictions, probability distribution & notes',
      icon: 'groups',
      badge: 'Clinical Charting',
    },
    'ecg-analysis': {
      title: 'ECG Waveform Analysis & Classification',
      subtitle: 'Single-beat morphological decomposition, VQC classification & saliency',
      icon: 'vital_signs',
      badge: 'Lead II • 125 Hz',
    },
    'doctor-alerts': {
      title: 'Arrhythmia Clinical Alerts',
      subtitle: 'Real-time critical events triaged by the hybrid quantum-classical decision pipeline',
      icon: 'emergency',
      badge: '3 Events Queued',
    },
    'doctor-reports': {
      title: 'Clinical Reports & Sign-Offs',
      subtitle: 'Official decision-support dossiers generated for hospital telemetry records and EHR',
      icon: 'description',
      badge: 'Physician Sign-Off',
    },

    // Research & Advanced Areas
    overview: {
      title: 'Biomedical Telemetry & Overview',
      subtitle: 'Real-time patient monitoring, 5-class AAMI predictions & system status',
      icon: 'hub',
      badge: 'Telemetry Stream',
    },
    dataset: {
      title: 'Biomedical Dataset Catalog',
      subtitle: 'MIT-BIH Arrhythmia Database, PTB-XL, Inter-Patient split & annotation audit',
      icon: 'database',
      badge: '109,449 Beats',
    },
    'quantum-lab': {
      title: 'Quantum Variational Lab & Circuit Explorer',
      subtitle: '10-Qubit strongly entangling ansatz, angle encoding & Pauli-Z observables',
      icon: 'memory',
      badge: 'AerSim Statevector',
    },
    explainability: {
      title: 'Explainable AI & Electrophysiological Saliency',
      subtitle: 'Integrated gradients attribution, P-QRS-T phase mappings & Quantum SHAP',
      icon: 'insights',
      badge: 'AAMI EC57',
    },
    benchmarks: {
      title: 'Model Benchmarking & Comparative Empirical Audit',
      subtitle: 'Hybrid VQC vs Classical ResNet-18, 1D-CNN, SVM & Confusion Matrices',
      icon: 'query_stats',
      badge: 'Inter-Patient DS1/DS2',
    },
    experiments: {
      title: 'Quantum Experiment Registry & Training Logs',
      subtitle: 'Ablation telemetry, circuit depth sweeps, angle encoding & convergence audits',
      icon: 'science',
      badge: 'Run Registry',
    },
  };

  const activeMeta = tabMetadata[currentTab] || tabMetadata['patient-home'];

  if (isOnboardingActive) {
    return (
      <div className="min-h-screen w-full bg-[#f8fbfe] text-[#101c28]">
        <OnboardingFlow
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          user={user}
          onUpdateProfile={updateProfile}
          onSetConsent={setConsent}
          onCompleteOnboarding={handleCompleteOnboarding}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fbfe] text-[#101c28] selection:bg-[#ffe8e8] selection:text-[#bc000a] flex overflow-x-hidden no-scrollbar">
      {/* Navigation (Desktop Left Sidebar + Mobile Bottom Bar) */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        userRole={userRole}
        onRoleChange={handleRoleChange}
        user={user}
        onOpenSettings={() => {
          setAccountSettingsTab('preferences');
          setIsAccountSettingsOpen(true);
        }}
        onOpenAccountSettings={() => {
          setAccountSettingsTab('profile');
          setIsAccountSettingsOpen(true);
        }}
        onOpenPatientProfile={() => {
          if (userRole === 'patient') {
            setCurrentTab('patient-profile');
          } else {
            setAccountSettingsTab('profile');
            setIsAccountSettingsOpen(true);
          }
        }}
        onOpenProfilePictureModal={() => setIsProfilePictureModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenHealthcareSupport={() => setIsHealthcareOpen(true)}
        onOpenAssistant={() => handleOpenAssistant()}
        activeAlertsCount={2}
      />

      {/* Main Workspace */}
      <div className="flex-1 w-full lg:pl-64 xl:pl-72 flex flex-col min-h-screen relative overflow-x-hidden">
        {/* Global Toast */}
        {globalToast && (
          <div
            id="global-toast"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#101c28]/95 text-white px-5 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in max-w-md text-center"
          >
            <span
              className={`material-symbols-outlined text-[18px] shrink-0 ${
                globalToast.type === 'warning'
                  ? 'text-[#ffb4ab]'
                  : globalToast.type === 'info'
                  ? 'text-[#82d3ff]'
                  : 'text-[#72fe88]'
              }`}
            >
              {globalToast.type === 'warning'
                ? 'warning'
                : globalToast.type === 'info'
                ? 'info'
                : 'check_circle'}
            </span>
            <span className="truncate">{globalToast.message}</span>
          </div>
        )}

        {/* Ambient Top Light Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-[#eaf2fc]/60 via-[#f0f7ff]/20 to-transparent" />
        </div>

        {/* Top Header Bar */}
        <header
          id="desktop-workstation-topbar"
          className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 select-none shadow-2xs"
        >
          {/* Left Title & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <DrRadarLogo size={36} animated className="drop-shadow-xs shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-[#101c28] font-sans">
                  DR. RADAR
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#5c7b99] tracking-tight leading-none mt-0.5 hidden sm:block">
                Hybrid Quantum–Classical Healthcare Intelligence
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Prominent Role Switcher in Top Bar (Patient, Doctor, Researcher) */}
            <div className="bg-slate-100 p-0.5 sm:p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
              <button
                id="topbar-role-patient"
                onClick={() => handleRoleChange('patient')}
                className={`py-1 px-2 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  userRole === 'patient'
                    ? 'bg-white text-[#bc000a] shadow-xs'
                    : 'text-slate-600 hover:text-[#101c28]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">person</span>
                <span className="hidden sm:inline">Patient</span>
              </button>
              <button
                id="topbar-role-doctor"
                onClick={() => handleRoleChange('doctor')}
                className={`py-1 px-2 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  userRole === 'doctor'
                    ? 'bg-white text-[#bc000a] shadow-xs'
                    : 'text-slate-600 hover:text-[#101c28]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">stethoscope</span>
                <span className="hidden sm:inline">Doctor</span>
              </button>
              <button
                id="topbar-role-researcher"
                onClick={() => handleRoleChange('researcher')}
                className={`py-1 px-2 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  userRole === 'researcher'
                    ? 'bg-white text-[#bc000a] shadow-xs'
                    : 'text-slate-600 hover:text-[#101c28]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">science</span>
                <span className="hidden sm:inline">Research</span>
              </button>
            </div>

            {/* Notifications Button */}
            <button
              id="topbar-notifications-btn"
              onClick={() => setIsNotificationsOpen(true)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#bc000a] transition-all cursor-pointer"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[19px]">notifications</span>
            </button>

            {/* Account Settings Button */}
            <button
              id="topbar-settings-btn"
              onClick={() => {
                setAccountSettingsTab('account');
                setIsAccountSettingsOpen(true);
              }}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#bc000a] transition-all cursor-pointer"
              title="Settings & Privacy"
            >
              <span className="material-symbols-outlined text-[19px]">tune</span>
            </button>

            {/* User Profile Dropdown Pill */}
            <div className="relative">
              <button
                id="topbar-profile-btn"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer"
              >
                <ProfileAvatar user={user} size="sm" showStatusIndicator />
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[100px]">
                    {user.displayName || user.firstName}
                  </div>
                  <div className="text-[9.5px] font-mono text-slate-400 uppercase leading-none">
                    {user.role}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  {isProfileMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  <div
                    id="topbar-profile-menu-backdrop"
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3">
                    <ProfileAvatar user={user} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-1.5 py-0.5 rounded border border-[#bc000a]/20">
                          {user.role}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {user.userId}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      id="topbar-change-picture-btn"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsProfilePictureModalOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#bc000a] flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">photo_camera</span>
                      <span>Change Profile Picture</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAccountSettingsTab('profile');
                        setIsAccountSettingsOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#bc000a] flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">person</span>
                      <span>Profile Details</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAccountSettingsTab('account');
                        setIsAccountSettingsOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#bc000a] flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">settings</span>
                      <span>Account Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAccountSettingsTab('privacy');
                        setIsAccountSettingsOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#bc000a] flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">shield</span>
                      <span>Privacy & Consent</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAccountSettingsTab('notifications');
                        setIsAccountSettingsOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#bc000a] flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">notifications</span>
                      <span>Notifications</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        startOnboarding('entry-animation');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-blue-600">replay</span>
                      <span>Replay Onboarding Tour</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        signOut();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-red-500">logout</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 relative w-full overflow-x-hidden">
          <div className="w-full max-w-2xl lg:max-w-7xl xl:max-w-[1540px] 2xl:max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-8 xl:px-10 py-4 lg:py-6">
            {/* In-Dashboard Profile Completion Prompt Banner */}
            {!user.profileCompleted && (
              <div
                id="profile-completion-banner"
                className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300/50">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-950">
                        Profile Setup Incomplete
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 border border-amber-300/60">
                        60% Complete
                      </span>
                    </div>
                    <p className="text-[11.5px] text-amber-900/90 mt-0.5 leading-snug">
                      Add your physiological details and emergency contact to customize baseline metrics and clinical reference ranges.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    id="banner-complete-profile-btn"
                    onClick={() => {
                      setAccountSettingsTab('profile');
                      setIsAccountSettingsOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span>Complete Profile</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                  <button
                    onClick={() => updateProfile({ profileCompleted: true })}
                    className="text-[11px] text-amber-800/80 hover:text-amber-950 px-2 py-1.5 font-medium cursor-pointer"
                    title="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {/* UNIFIED ANALYSIS HUB & MULTIMODAL FRAMEWORK */}
              {currentTab === 'analysis' && (
                <motion.div
                  key="analysis-hub"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <AnalysisHubScreen
                    onSelectEcgAnalysis={() => setCurrentTab('ecg-analysis')}
                    onSelectModalityPreview={(testId) => {
                      setSelectedModalityTestId(testId);
                      setCurrentTab('reusable-analysis');
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'reusable-analysis' && (
                <motion.div
                  key={`reusable-analysis-${selectedModalityTestId}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ReusableModalityAnalysisScreen
                    testId={selectedModalityTestId}
                    onBackToAnalysisHub={() => setCurrentTab('analysis')}
                    onNavigateToEcgAnalysis={() => setCurrentTab('ecg-analysis')}
                    onOpenAssistant={handleOpenAssistant}
                    onBookAppointment={() => setCurrentTab('patient-appointments')}
                  />
                </motion.div>
              )}

              {/* UNIFIED ROLE ALIASES */}
              {currentTab === 'home' && (
                <motion.div
                  key="unified-home"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {userRole === 'patient' ? (
                    <PatientHomeScreen
                      onNavigate={setCurrentTab}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                      onOpenAssistant={handleOpenAssistant}
                      onSelectModalityPreview={(testId) => {
                        setSelectedModalityTestId(testId);
                        setCurrentTab('reusable-analysis');
                      }}
                      user={user}
                      onOpenProfilePictureModal={() => setIsProfilePictureModalOpen(true)}
                    />
                  ) : (
                    <DoctorDashboardScreen
                      onNavigate={setCurrentTab}
                      onSelectPatient={(id) => setSelectedDoctorPatientId(id)}
                      onSelectModalityPreview={(testId) => {
                        setSelectedModalityTestId(testId);
                        setCurrentTab('reusable-analysis');
                      }}
                    />
                  )}
                </motion.div>
              )}

              {/* PATIENT SCREENS */}
              {currentTab === 'patient-home' && (
                <motion.div
                  key="patient-home"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientHomeScreen
                    onNavigate={setCurrentTab}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onOpenAssistant={handleOpenAssistant}
                    onSelectModalityPreview={(testId) => {
                      setSelectedModalityTestId(testId);
                      setCurrentTab('reusable-analysis');
                    }}
                    user={user}
                    onOpenProfilePictureModal={() => setIsProfilePictureModalOpen(true)}
                    healthSummary={healthSummary}
                  />
                </motion.div>
              )}

              {currentTab === 'patient-ecg' && (
                <motion.div
                  key="patient-ecg"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientEcgScreen onNavigate={setCurrentTab} />
                </motion.div>
              )}

              {(currentTab === 'patient-results' || currentTab === 'results') && (
                <motion.div
                  key="patient-results"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientResultsScreen
                    onNavigate={setCurrentTab}
                    onOpenAssistant={handleOpenAssistant}
                    healthSummary={healthSummary}
                  />
                </motion.div>
              )}

              {currentTab === 'patient-appointments' && (
                <motion.div
                  key="patient-appointments"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <BookingScreen />
                </motion.div>
              )}

              {(currentTab === 'patient-profile' ||
                currentTab === 'profile' ||
                currentTab === 'health-info' ||
                currentTab === 'medical-records') && (
                <motion.div
                  key="patient-profile"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientProfileScreen
                    onNavigate={setCurrentTab}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onOpenAccountSettings={(tab = 'profile') => {
                      setAccountSettingsTab(tab);
                      setIsAccountSettingsOpen(true);
                    }}
                    onOpenProfilePictureModal={() => setIsProfilePictureModalOpen(true)}
                    onRemoveProfilePicture={() => {
                      updateProfilePicture('none', null);
                      showToast('Profile picture reset to neutral default', 'info');
                    }}
                    user={user}
                    initialSubTab={
                      currentTab === 'health-info'
                        ? 'health-info'
                        : currentTab === 'medical-records'
                        ? 'records'
                        : 'personal'
                    }
                    healthProfile={healthProfile}
                    records={healthRecords}
                    onUpdateProfile={updateHealthProfile}
                    onUpdateSection={updateHealthSection}
                    onAddRecord={addMedicalRecord}
                    onRenameRecord={renameMedicalRecord}
                    onDeleteRecord={deleteMedicalRecord}
                    onExportData={exportUserData}
                    onToggleTwoFactor={toggleTwoFactor}
                    onToggleResearchConsent={toggleResearchConsent}
                  />
                </motion.div>
              )}

              {/* DOCTOR SCREENS */}
              {currentTab === 'doctor-dashboard' && (
                <motion.div
                  key="doctor-dashboard"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorDashboardScreen
                    onNavigate={setCurrentTab}
                    onSelectPatient={(id) => setSelectedDoctorPatientId(id)}
                    onSelectModalityPreview={(testId) => {
                      setSelectedModalityTestId(testId);
                      setCurrentTab('reusable-analysis');
                    }}
                  />
                </motion.div>
              )}

              {(currentTab === 'doctor-patients' || currentTab === 'patients') && (
                <motion.div
                  key="doctor-patients"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorPatientsScreen
                    onNavigate={setCurrentTab}
                    initialPatientId={selectedDoctorPatientId}
                  />
                </motion.div>
              )}

              {currentTab === 'ecg-analysis' && (
                <motion.div
                  key="ecg-analysis"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ECGAnalysisScreen
                    onNavigateToQuantumLab={() => setCurrentTab('quantum-lab')}
                    onNavigateToExplainability={() => setCurrentTab('explainability')}
                    onOpenAssistant={handleOpenAssistant}
                    onBookAppointment={() => setCurrentTab('patient-appointments')}
                    healthSummary={healthSummary}
                    onNavigate={setCurrentTab}
                  />
                </motion.div>
              )}

              {(currentTab === 'doctor-alerts' || currentTab === 'alerts') && (
                <motion.div
                  key="doctor-alerts"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorAlertsScreen
                    onNavigate={setCurrentTab}
                    onSelectPatient={(id) => setSelectedDoctorPatientId(id)}
                  />
                </motion.div>
              )}

              {(currentTab === 'doctor-reports' || currentTab === 'reports') && (
                <motion.div
                  key="doctor-reports"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorReportsScreen onNavigate={setCurrentTab} />
                </motion.div>
              )}

              {/* SECONDARY ADVANCED RESEARCH SCREENS */}
              {currentTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <OverviewScreen
                    onNavigate={setCurrentTab}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onOpenPatientProfile={() => setIsPatientProfileOpen(true)}
                    onOpenNotifications={() => setIsNotificationsOpen(true)}
                    onOpenHealthcareSupport={() => setIsHealthcareOpen(true)}
                  />
                </motion.div>
              )}

              {currentTab === 'dataset' && (
                <motion.div
                  key="dataset"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DatasetScreen
                    onNavigateToQuantumLab={() => setCurrentTab('quantum-lab')}
                    onNavigateToAnalysis={() => setCurrentTab('ecg-analysis')}
                    onNavigateToBenchmarks={() => setCurrentTab('benchmarks')}
                    onNavigateToExperiments={() => setCurrentTab('experiments')}
                  />
                </motion.div>
              )}

              {currentTab === 'quantum-lab' && (
                <motion.div
                  key="quantum-lab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <QuantumLabScreen
                    onNavigateToAnalysis={() => setCurrentTab('ecg-analysis')}
                    onNavigateToExplainability={() => setCurrentTab('explainability')}
                    onNavigateToExperiments={() => setCurrentTab('experiments')}
                  />
                </motion.div>
              )}

              {currentTab === 'explainability' && (
                <motion.div
                  key="explainability"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ExplainabilityScreen
                    onNavigateToAnalysis={() => setCurrentTab('ecg-analysis')}
                    onNavigateToBenchmarks={() => setCurrentTab('benchmarks')}
                  />
                </motion.div>
              )}

              {currentTab === 'benchmarks' && (
                <motion.div
                  key="benchmarks"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <BenchmarksScreen
                    onNavigateToAnalysis={() => setCurrentTab('ecg-analysis')}
                    onNavigateToQuantumLab={() => setCurrentTab('quantum-lab')}
                  />
                </motion.div>
              )}

              {currentTab === 'experiments' && (
                <motion.div
                  key="experiments"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ExperimentsScreen
                    onNavigateToQuantumLab={() => setCurrentTab('quantum-lab')}
                    onNavigateToOverview={() => setCurrentTab('overview')}
                    onNavigateToExplainability={() => setCurrentTab('explainability')}
                    onNavigateToBenchmarks={() => setCurrentTab('benchmarks')}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Secondary Healthcare / Teleconsult Support Modal */}
        <HealthcareSupportModal
          isOpen={isHealthcareOpen}
          onClose={() => setIsHealthcareOpen(false)}
        />

        {/* Report Preview Modal */}
        <FullReportModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
          onDownload={handleDownloadReport}
        />

        {/* Comprehensive Dr. Radar Account & Privacy Settings Modal */}
        <AccountSettingsModal
          isOpen={isAccountSettingsOpen}
          onClose={() => setIsAccountSettingsOpen(false)}
          user={user}
          onUpdateProfile={updateProfile}
          onUpdateRole={handleRoleChange}
          onToggleResearchConsent={toggleResearchConsent}
          onToggleNotification={toggleNotification}
          onToggleTwoFactor={toggleTwoFactor}
          onSignOut={signOut}
          onDeleteAccount={deleteAccount}
          onExportUserData={exportUserData}
          onShowToast={showToast}
          initialTab={accountSettingsTab}
        />

        {/* Legacy / System Preferences Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          remindersEnabled={reminders.enabled}
          reminderTime={reminders.time}
          soundEnabled={reminders.soundEnabled}
          permission={reminders.permission}
          isSupported={reminders.isSupported}
          onToggleReminders={reminders.toggleReminders}
          onTimeChange={reminders.setReminderTime}
          onToggleSound={reminders.toggleSound}
          onTestNotification={reminders.sendTestNotification}
          onRequestPermission={reminders.requestPermission}
        />

        {/* Patient / Researcher Profile Modal */}
        <PatientProfileModal
          isOpen={isPatientProfileOpen}
          onClose={() => setIsPatientProfileOpen(false)}
          onShowToast={showToast}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAccountSettings={(tab = 'profile') => {
            setAccountSettingsTab(tab);
            setIsAccountSettingsOpen(true);
          }}
          user={user}
          onOpenProfilePictureModal={() => setIsProfilePictureModalOpen(true)}
        />

        {/* Notifications Modal */}
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          onShowToast={showToast}
          onViewAnalysis={() => setCurrentTab('benchmarks')}
          onViewAppointment={() => setIsHealthcareOpen(true)}
        />
        {/* Ask Dr. Radar Core AI Assistant Modal */}
        <AskDrRadarModal
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole={userRole}
          initialContext={assistantContext}
          user={user}
          healthSummary={healthSummary}
          onNavigateToTab={setCurrentTab}
        />

        {/* Global Dr. Radar Profile Picture & Avatar Modal */}
        <ProfilePictureModal
          isOpen={isProfilePictureModalOpen}
          onClose={() => setIsProfilePictureModalOpen(false)}
          user={user}
          onSave={(pictureType, pictureValue) => {
            updateProfilePicture(pictureType, pictureValue);
            showToast('Profile picture updated successfully', 'success');
          }}
        />
      </div>
    </div>
  );
}
