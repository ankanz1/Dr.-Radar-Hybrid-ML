import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenTab, UserRole, HistoryReport, UserAccountState } from './types';
import { Navigation } from './components/Navigation';
import { supabase } from './lib/supabase';

// Patient Experience Screens
import { JourneyHomeScreen } from './components/JourneyHomeScreen';
import { HealthAssessmentScreen } from './components/HealthAssessmentScreen';
import { UploadAnalyzeScreen } from './components/UploadAnalyzeScreen';
import { PatientJourneyRecordsScreen } from './components/PatientJourneyRecordsScreen';
import { ConnectDoctorScreen } from './components/ConnectDoctorScreen';
import { PatientJourneyAppointmentsScreen } from './components/PatientJourneyAppointmentsScreen';
import { AppointmentChatScreen } from './components/AppointmentChatScreen';
import { DoctorMessagesScreen } from './components/DoctorMessagesScreen';
import { PatientHomeScreen } from './components/PatientHomeScreen';
import { PatientEcgScreen } from './components/PatientEcgScreen';
import { PatientEcgHistoryScreen } from './components/PatientEcgHistoryScreen';
import { PatientResultsScreen } from './components/PatientResultsScreen';
import { PatientProfileScreen } from './components/PatientProfileScreen';
import { BookingScreen } from './components/BookingScreen';

// Doctor Experience Screens
import { DoctorDashboardScreen } from './components/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './components/DoctorPatientsScreen';
import { DoctorAlertsScreen } from './components/DoctorAlertsScreen';
import { DoctorReportsScreen } from './components/DoctorReportsScreen';
import { ECGAnalysisScreen } from './components/ECGAnalysisScreen';
import { DoctorPatientEcgDashboard } from './components/DoctorPatientEcgDashboard';

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
import { provisionAccount } from './services/accountProvisioning';

// Multimodal Analysis Hub & Reusable Architecture
import { AnalysisHubScreen } from './components/AnalysisHubScreen';
import { ReusableModalityAnalysisScreen } from './components/ReusableModalityAnalysisScreen';
import { DrRadarLogo } from './components/DrRadarLogo';

// Roadmap prototype screens (Phase 5 / 6 / 7)
import { MultidiseaseScreen } from './components/roadmap/MultidiseaseScreen';
import { MultimodalScreen } from './components/roadmap/MultimodalScreen';
import { ResearchScreen } from './components/roadmap/ResearchScreen';

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

  const [userRole, setUserRole] = useState<UserRole>(user.role === 'researcher' ? 'patient' : user.role || 'patient');
  const [currentTab, setCurrentTab] = useState<ScreenTab>(
    user.role === 'doctor' ? 'doctor-dashboard' : 'journey-home'
  );
  const [selectedDoctorPatientId, setSelectedDoctorPatientId] = useState<string | null>(null);
  // Deep-link appointment for the patient chat (set by an appointment card's Chat button;
  // cleared when the patient opens Messages from normal navigation).
  const [chatAppointmentId, setChatAppointmentId] = useState<string | null>(null);
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
      setCurrentTab('journey-home');
    } else if (newRole === 'doctor') {
      setCurrentTab('doctor-dashboard');
    }
  };

const handleCompleteOnboarding = async (
    role?: UserRole,
    profileOverrides?: Partial<UserAccountState>
  ): Promise<{ ok: boolean; message?: string }> => {
    // Merge onboarding-entered values explicitly passed by OnboardingFlow — App's
    // `user` state has not re-rendered yet when this runs in the same tick.
    const profile: UserAccountState = { ...user, ...profileOverrides };
    const result = await provisionAccount({
      role: role || user.role,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      profileCompleted: profile.profileCompleted,
      dob: profile.dob,
      gender: profile.gender,
      country: profile.country,
      language: profile.language,
      professionalRole: profile.professionalRole,
      specialization: profile.specialization,
      organization: profile.organization,
    });

    if (!result.ok) {
      // Do NOT finish onboarding when provisioning fails — the user stays here
      // and the actual error is shown in development.
      return result;
    }

    completeOnboarding(role || user.role || 'patient');
    setUserRole(role || user.role || 'patient');
    const finalRole = role || user.role || 'patient';
    if (finalRole === 'doctor') {
      setCurrentTab('doctor-dashboard');
    } else {
      setCurrentTab('journey-home');
    }
    showToast(`Welcome to Dr. Radar, ${profile.displayName || 'Doctor'}!`, 'success');
    return { ok: true };
  };

  const handleDownloadReport = () => {
    if (activeReportModal?.title) {
      showToast(`Downloading ${activeReportModal.title} (Clinical PDF)...`, 'info');
    }
    setActiveReportModal(null);
  };

  // Tab metadata for top bar headers
  const tabMetadata: Partial<Record<ScreenTab, { title: string; subtitle: string; icon: string; badge: string }>> = {
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
    'journey-home': {
      title: userRole === 'patient' ? 'How is your health?' : 'Cardiology Review Dashboard',
      subtitle: 'Your health overview, latest results, and next steps',
      icon: 'home',
      badge: 'Patient First',
    },
    'journey-assessment': {
      title: 'Health Assessment',
      subtitle: 'A few quick questions that give your doctor context',
      icon: 'health_and_safety',
      badge: 'Step 1',
    },
    'journey-upload': {
      title: 'Upload Health Record',
      subtitle: 'Upload an ECG or health record for analysis',
      icon: 'cloud_upload',
      badge: 'Step 2',
    },
    'journey-records': {
      title: 'My Records',
      subtitle: 'Uploaded health records and saved analysis results',
      icon: 'folder_shared',
      badge: 'History',
    },
    'journey-doctors': {
      title: 'Connect With Doctor',
      subtitle: 'Registered doctors and appointment booking',
      icon: 'stethoscope',
      badge: 'Care Team',
    },
    'journey-appointments': {
      title: 'Appointments',
      subtitle: 'Your consultations and care team',
      icon: 'calendar_today',
      badge: 'Care Team',
    },
    'journey-messages': {
      title: 'Messages',
      subtitle: 'Chat with your doctor about an appointment',
      icon: 'chat',
      badge: 'Care Team',
    },
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
    'patient-ecg-history': {
      title: 'My ECG History',
      subtitle: 'Previously analyzed heartbeats saved to your personal medical history',
      icon: 'history',
      badge: 'Saved Analyses',
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
    'doctor-ecg-records': {
      title: 'Patient ECG Records',
      subtitle: 'Stored ECG analyses for appointment-authorized patients — read-only, RLS-enforced',
      icon: 'ecg_heart',
      badge: 'Authorized Access',
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
    'doctor-messages': {
      title: 'Patient Messages',
      subtitle: 'Appointment-scoped conversations with your patients',
      icon: 'chat',
      badge: 'Care Team',
    },

    // Roadmap prototype tabs (Phase 5 / 6 / 7)
    'multidisease': {
      title: 'Multidisease Detection',
      subtitle: 'Roadmap modules for skin, imaging, cardiovascular, laboratory & multi-system analysis — research prototype',
      icon: 'grid_view',
      badge: 'Prototype',
    },
    'multidisease-skin': {
      title: 'Skin Disease Detection',
      subtitle: 'Dermatology image interface concept — Coming Soon',
      icon: 'healing',
      badge: 'Coming Soon',
    },
    'multidisease-imaging': {
      title: 'Medical Image Analysis',
      subtitle: 'X-ray, CT, MRI & ultrasound review concept — Research Preview',
      icon: 'radiology',
      badge: 'Research Preview',
    },
    'multidisease-cardio': {
      title: 'Additional Cardiovascular Models',
      subtitle: 'ECG/QML is available; further cardiac models are planned',
      icon: 'cardiology',
      badge: 'Coming Soon',
    },
    'multidisease-laboratory': {
      title: 'Laboratory-Based Risk Models',
      subtitle: 'Structured lab panels feeding planned risk models — Coming Soon',
      icon: 'labs',
      badge: 'Coming Soon',
    },
    'multidisease-modules': {
      title: 'Disease-Specific Prediction Modules',
      subtitle: 'Organ-system module grid — concepts only, no predictions',
      icon: 'grid_view',
      badge: 'Prototype',
    },
    'multimodal': {
      title: 'Multimodal AI',
      subtitle: 'Concept screens for combining history, labs, imaging & longitudinal context',
      icon: 'hub',
      badge: 'Research Preview',
    },
    'multimodal-history-labs': {
      title: 'Clinical History + Laboratory Data',
      subtitle: 'Combine history and lab context — prototype interaction',
      icon: 'timeline',
      badge: 'Prototype',
    },
    'multimodal-imaging-context': {
      title: 'Imaging + Clinical Information',
      subtitle: 'Paired imaging and context review — prototype layout',
      icon: 'image_search',
      badge: 'Prototype',
    },
    'multimodal-risk-profile': {
      title: 'Multimodal Patient Risk Profile',
      subtitle: 'Cross-domain risk layout — awaiting supported model',
      icon: 'donut_small',
      badge: 'Research Preview',
    },
    'multimodal-longitudinal': {
      title: 'Longitudinal Health Tracking',
      subtitle: 'Health event timeline with future trend placeholders',
      icon: 'monitoring',
      badge: 'Prototype',
    },
    'research-overview': {
      title: 'Clinical Research',
      subtitle: 'Validation, prospective evaluation, explainability, calibration, fairness & workflow frameworks',
      icon: 'science',
      badge: 'Research Preview',
    },
    'research-validation': {
      title: 'External Validation',
      subtitle: 'Independent cohort validation — planned',
      icon: 'fact_check',
      badge: 'Coming Soon',
    },
    'research-prospective': {
      title: 'Prospective Evaluation',
      subtitle: 'Forward-looking study design — planned',
      icon: 'event_note',
      badge: 'Coming Soon',
    },
    'research-explainability': {
      title: 'Explainability',
      subtitle: 'Attribution for supported models — ECG saliency referenced',
      icon: 'insights',
      badge: 'Prototype',
    },
    'research-calibration': {
      title: 'Calibration',
      subtitle: 'Calibration curves & metrics — coming soon',
      icon: 'straighten',
      badge: 'Coming Soon',
    },
    'research-fairness': {
      title: 'Bias / Fairness Analysis',
      subtitle: 'Demographic group comparison — research only',
      icon: 'balance',
      badge: 'Research Preview',
    },
    'research-workflow': {
      title: 'Clinical Workflow Evaluation',
      subtitle: 'Clinician-in-the-loop evaluation loop — planned',
      icon: 'account_tree',
      badge: 'Planned',
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
        onTabChange={(tab) => {
          // Opening Messages from normal navigation (nav item/bottom bar) clears
          // any card Chat deep-link so the default conversation selection applies.
          if (tab === 'journey-messages') setChatAppointmentId(null);
          setCurrentTab(tab);
        }}
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
{/* 
            Account Settings Button
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
            </button> */}

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

              {/* PATIENT-FIRST JOURNEY SCREENS */}
              {currentTab === 'journey-home' && (
                <motion.div
                  key="journey-home"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <JourneyHomeScreen user={user} onNavigate={setCurrentTab} />
                </motion.div>
              )}

              {currentTab === 'journey-assessment' && (
                <motion.div
                  key="journey-assessment"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <HealthAssessmentScreen
                    onNavigate={setCurrentTab}
                    draftProfile={healthProfile}
                    onProfileSaved={updateHealthProfile}
                    onShowToast={showToast}
                  />
                </motion.div>
              )}

              {currentTab === 'journey-upload' && (
                <motion.div
                  key="journey-upload"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <UploadAnalyzeScreen onNavigate={setCurrentTab} />
                </motion.div>
              )}

              {currentTab === 'journey-records' && (
                <motion.div
                  key="journey-records"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientJourneyRecordsScreen onNavigate={setCurrentTab} />
                </motion.div>
              )}

              {currentTab === 'journey-doctors' && (
                <motion.div
                  key="journey-doctors"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ConnectDoctorScreen onNavigate={setCurrentTab} onShowToast={showToast} />
                </motion.div>
              )}

              {currentTab === 'journey-appointments' && (
                <motion.div
                  key="journey-appointments"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientJourneyAppointmentsScreen
                    onNavigate={setCurrentTab}
                    onOpenChat={(appointmentId) => {
                      setChatAppointmentId(appointmentId);
                      setCurrentTab('journey-messages');
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'journey-messages' && (
                <motion.div
                  key="journey-messages"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <AppointmentChatScreen
                    key={chatAppointmentId ?? 'chat-default'}
                    onNavigate={setCurrentTab}
                    initialAppointmentId={chatAppointmentId}
                  />
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

              {currentTab === 'patient-ecg-history' && (
                <motion.div
                  key="patient-ecg-history"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientEcgHistoryScreen onNavigate={setCurrentTab} />
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

              {currentTab === 'doctor-ecg-records' && (
                <motion.div
                  key="doctor-ecg-records"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorPatientEcgDashboard onNavigate={setCurrentTab} initialPatientId={selectedDoctorPatientId} />
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
                    onSelectPatient={(id) => setSelectedDoctorPatientId(id)}
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

              {currentTab === 'doctor-messages' && (
                <motion.div
                  key="doctor-messages"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <DoctorMessagesScreen
                    onOpenPatient={(patientId) => {
                      setSelectedDoctorPatientId(patientId);
                      setCurrentTab('doctor-ecg-records');
                    }}
                  />
                </motion.div>
              )}

              {/* ============ ROADMAP PROTOTYPE SCREENS (PHASE 5/6/7) ============ */}
              {currentTab.startsWith('multidisease') && (
                <motion.div
                  key={`multidisease-${currentTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <MultidiseaseScreen
                    initialModule={currentTab}
                    onNavigate={setCurrentTab}
                    onOpenEcgAnalysis={() => setCurrentTab('ecg-analysis')}
                  />
                </motion.div>
              )}

              {currentTab.startsWith('multimodal') && (
                <motion.div
                  key={`multimodal-${currentTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <MultimodalScreen
                    initialModule={currentTab}
                    onNavigate={setCurrentTab}
                  />
                </motion.div>
              )}

              {currentTab.startsWith('research') && (
                <motion.div
                  key={`research-${currentTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ResearchScreen
                    initialModule={currentTab}
                    onNavigate={setCurrentTab}
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
          onViewAnalysis={() => setCurrentTab('ecg-analysis')}
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
