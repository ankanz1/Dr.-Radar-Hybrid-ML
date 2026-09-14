import { useState } from 'react';
import { ScreenTab, UserRole, UserAccountState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { DrRadarLogo } from './DrRadarLogo';
import { ProfileAvatar } from './profile/ProfileAvatar';

interface NavigationProps {
  currentTab: ScreenTab;
  onTabChange: (tab: ScreenTab) => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenSettings?: () => void;
  onOpenPatientProfile?: () => void;
  onOpenNotifications?: () => void;
  onOpenHealthcareSupport?: () => void;
  onOpenAccountSettings?: () => void;
  onOpenProfilePictureModal?: () => void;
  user?: UserAccountState;
  activeAlertsCount?: number;
  onOpenAssistant?: () => void;
}

export const Navigation = ({
  currentTab,
  onTabChange,
  userRole,
  onRoleChange,
  onOpenSettings,
  onOpenPatientProfile,
  onOpenNotifications,
  onOpenHealthcareSupport,
  onOpenAccountSettings,
  onOpenProfilePictureModal,
  user,
  activeAlertsCount = 2,
  onOpenAssistant,
}: NavigationProps) => {
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isResearchSectionOpen, setIsResearchSectionOpen] = useState(false);

  // PATIENT Primary Navigation: Home, Analysis, Results, Appointments, Profile
  const patientNavItems: {
    id: ScreenTab;
    label: string;
    icon: string;
    badge?: string;
    description: string;
    matchTabs?: ScreenTab[];
  }[] = [
    {
      id: 'patient-home',
      label: 'Home',
      icon: 'home',
      description: 'Status, latest ECG & next steps',
      matchTabs: ['patient-home', 'home'],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: 'vital_signs',
      badge: 'Cardiology Ready',
      description: 'Cardiology, imaging & chronic care',
      matchTabs: ['analysis', 'patient-ecg', 'ecg-analysis', 'reusable-analysis'],
    },
    {
      id: 'patient-results',
      label: 'Results',
      icon: 'description',
      badge: 'Reports',
      description: 'Diagnostic archives & trends',
      matchTabs: ['patient-results', 'results'],
    },
    {
      id: 'patient-appointments',
      label: 'Appointments',
      icon: 'calendar_today',
      description: 'Care team consultations',
      matchTabs: ['patient-appointments'],
    },
    {
      id: 'patient-profile',
      label: 'Profile',
      icon: 'person',
      description: 'Medical ID & sensors',
      matchTabs: ['patient-profile', 'profile', 'health-info', 'medical-records'],
    },
  ];

  // DOCTOR Primary Navigation: Dashboard, Patients, Analysis, Alerts, Reports
  const doctorPrimaryNavItems: {
    id: ScreenTab;
    label: string;
    icon: string;
    badge?: string;
    description: string;
    matchTabs?: ScreenTab[];
  }[] = [
    {
      id: 'doctor-dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      description: 'Review queue & active triage',
      matchTabs: ['doctor-dashboard', 'home'],
    },
    {
      id: 'doctor-patients',
      label: 'Patients',
      icon: 'groups',
      badge: '142',
      description: 'Cohort charts, beats & records',
      matchTabs: ['doctor-patients', 'patients'],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: 'biotech',
      badge: 'Active: ECG',
      description: 'Clinical gateway & disease modules',
      matchTabs: ['analysis', 'ecg-analysis', 'reusable-analysis'],
    },
    {
      id: 'doctor-alerts',
      label: 'Alerts',
      icon: 'emergency',
      badge: activeAlertsCount > 0 ? `${activeAlertsCount} Urgent` : undefined,
      description: 'Arrhythmia clinical triage',
      matchTabs: ['doctor-alerts', 'alerts'],
    },
    {
      id: 'doctor-reports',
      label: 'Reports',
      icon: 'description',
      description: 'Physician sign-offs & dossiers',
      matchTabs: ['doctor-reports', 'reports'],
    },
  ];

  // Secondary Research & Advanced Tools (For Doctor role only)
  const researchNavItems: {
    id: ScreenTab;
    label: string;
    icon: string;
    badge?: string;
    description: string;
  }[] = [
    {
      id: 'explainability',
      label: 'Model Insights',
      icon: 'insights',
      description: 'Saliency maps & SHAP attributions',
    },
    {
      id: 'quantum-lab',
      label: 'Quantum Lab',
      icon: 'memory',
      badge: '10-Qubit',
      description: 'VQC ansatz & Pauli-Z observables',
    },
    {
      id: 'benchmarks',
      label: 'Benchmarks',
      icon: 'query_stats',
      description: 'Comparative matrices & Macro-F1',
    },
    {
      id: 'experiments',
      label: 'Experiments',
      icon: 'science',
      badge: '#EXP-024',
      description: 'Ablation sweeps & training logs',
    },
    {
      id: 'dataset',
      label: 'Datasets',
      icon: 'database',
      badge: 'MIT-BIH',
      description: 'Standardized clinical cohorts',
    },
  ];

  const isResearchTabActive = [
    'explainability',
    'quantum-lab',
    'benchmarks',
    'experiments',
    'dataset',
    'overview',
  ].includes(currentTab);

  return (
    <>
      {/* =========================================================================
          1. DESKTOP LEFT SIDEBAR (Visible on lg: and wider screens)
          ========================================================================= */}
      <aside
        id="desktop-left-sidebar"
        aria-label="Desktop Navigation Sidebar"
        className="hidden lg:flex flex-col fixed top-0 bottom-0 left-0 w-64 xl:w-72 bg-white/95 backdrop-blur-md border-r border-slate-200/90 z-30 shadow-xs select-none"
      >
        {/* Sidebar Header: Brand & Identity */}
        <div className="p-5 xl:p-6 border-b border-slate-200/80 space-y-3.5">
          <div className="flex items-center gap-3">
            <DrRadarLogo size={42} animated className="shrink-0 drop-shadow-xs" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-[#101c28] font-sans">
                  DR. RADAR
                </h1>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-1.5 py-0.5 rounded border border-[#bc000a]/20">
                  {userRole.toUpperCase()}
                </span>
              </div>
              <p className="text-[10.5px] font-semibold text-[#5c7b99] tracking-tight leading-tight mt-0.5">
                Hybrid Quantum–Classical Healthcare Intelligence
              </p>
            </div>
          </div>

          {/* ROLE SWITCHER TOGGLE (3 ROLES) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              id="role-switch-patient"
              onClick={() => onRoleChange('patient')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                userRole === 'patient'
                  ? 'bg-white text-[#bc000a] shadow-xs'
                  : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">person</span>
              Patient
            </button>
            <button
              id="role-switch-doctor"
              onClick={() => onRoleChange('doctor')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                userRole === 'doctor'
                  ? 'bg-white text-[#bc000a] shadow-xs'
                  : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">stethoscope</span>
              Doctor
            </button>
            <button
              id="role-switch-researcher"
              onClick={() => onRoleChange('researcher')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                userRole === 'researcher'
                  ? 'bg-white text-[#bc000a] shadow-xs'
                  : 'text-slate-600 hover:text-[#101c28]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">science</span>
              Research
            </button>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {/* PATIENT VIEW NAVIGATION: Home, Analysis, Results, Appointments, Profile */}
          {userRole === 'patient' && (
            <>
              <div className="px-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Patient Portal
              </div>

              {patientNavItems.map((item) => {
                const isActive = item.matchTabs
                  ? item.matchTabs.includes(currentTab)
                  : currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => onTabChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#ffe8e8] text-[#bc000a] shadow-2xs font-semibold border border-[#bc000a]/20'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[20px] shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-[#bc000a]' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="truncate">
                        <span className="text-xs xl:text-[13px] block leading-snug truncate font-medium">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] block truncate font-normal ${
                            isActive ? 'text-[#bc000a]/80' : 'text-slate-400'
                          }`}
                        >
                          {item.description}
                        </span>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0 ${
                          isActive
                            ? 'bg-white/80 text-[#bc000a] border border-[#bc000a]/30'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* DOCTOR VIEW NAVIGATION: Dashboard, Patients, Analysis, Alerts, Reports */}
          {userRole === 'doctor' && (
            <>
              <div className="px-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Clinical Workflow
              </div>

              {doctorPrimaryNavItems.map((item) => {
                const isActive = item.matchTabs
                  ? item.matchTabs.includes(currentTab)
                  : currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => onTabChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#ffe8e8] text-[#bc000a] shadow-2xs font-semibold border border-[#bc000a]/20'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[20px] shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-[#bc000a]' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="truncate">
                        <span className="text-xs xl:text-[13px] block leading-snug truncate font-medium">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] block truncate font-normal ${
                            isActive ? 'text-[#bc000a]/80' : 'text-slate-400'
                          }`}
                        >
                          {item.description}
                        </span>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0 ${
                          isActive
                            ? 'bg-white/80 text-[#bc000a] border border-[#bc000a]/30'
                            : item.badge.includes('Urgent')
                            ? 'bg-red-100 text-[#bc000a] font-bold'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Collapsible Research & Advanced Tools Section */}
              <div className="pt-3">
                <button
                  onClick={() => setIsResearchSectionOpen(!isResearchSectionOpen)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">science</span>
                    Research / Model Insights
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    {isResearchSectionOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {(isResearchSectionOpen || isResearchTabActive) && (
                  <div className="mt-1 space-y-1 pl-1">
                    {researchNavItems.map((item) => {
                      const isActive = currentTab === item.id;
                      return (
                        <button
                          key={item.id}
                          id={`nav-${item.id}`}
                          onClick={() => onTabChange(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-[#f0f7ff] text-[#0c3156] font-semibold border border-[#d2e5fb]'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`material-symbols-outlined text-[18px] shrink-0 ${
                                isActive ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span className="text-xs truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* RESEARCHER VIEW NAVIGATION */}
          {userRole === 'researcher' && (
            <>
              <div className="px-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Research & Benchmarks
              </div>

              {/* Research items */}
              {researchNavItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => onTabChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#ffe8e8] text-[#bc000a] shadow-2xs font-semibold border border-[#bc000a]/20'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[20px] shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-[#bc000a]' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="truncate">
                        <span className="text-xs xl:text-[13px] block leading-snug truncate font-medium">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] block truncate font-normal ${
                            isActive ? 'text-[#bc000a]/80' : 'text-slate-400'
                          }`}
                        >
                          {item.description}
                        </span>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0 ${
                          isActive
                            ? 'bg-white/80 text-[#bc000a] border border-[#bc000a]/30'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Analysis Hub shortcut */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  id="nav-analysis-hub-research"
                  onClick={() => onTabChange('analysis')}
                  className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentTab === 'analysis'
                      ? 'bg-[#ffe8e8] text-[#bc000a] font-semibold border border-[#bc000a]/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-[#bc000a]">category</span>
                    <span className="text-xs font-bold">Analysis Hub</span>
                  </div>
                  <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    All Areas
                  </span>
                </button>
              </div>
            </>
          )}
        </nav>

        {/* ASK DR. RADAR SIDEBAR ENTRY */}
        <div className="px-3 pb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-red-50/70 via-white to-slate-50 border border-[#bc000a]/25 shadow-2xs">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-[#bc000a] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                </div>
                <span className="font-mono font-bold text-[11px] text-[#bc000a] tracking-wider">
                  ASK DR. RADAR
                </span>
              </div>
              <span className="text-[8.5px] font-mono uppercase px-1 py-0.2 rounded bg-[#ffe8e8] text-[#bc000a] font-bold">
                AI Assistant
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight mb-2">
              Clinical decision-support & health telemetry assistant.
            </p>
            {onOpenAssistant && (
              <button
                id="sidebar-ask-dr-radar-btn"
                onClick={onOpenAssistant}
                className="w-full py-1.5 px-2 bg-[#bc000a] hover:bg-[#a10008] text-white font-bold rounded-xl text-[11px] shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span>Start Conversation</span>
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Footer: Role Info & Settings */}
        <div className="p-3 xl:p-4 border-t border-slate-200/80 bg-slate-50/60 space-y-2">
          {onOpenSettings && (
            <button
              id="desktop-sidebar-settings-btn"
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white hover:text-[#bc000a] hover:shadow-2xs border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-slate-500">tune</span>
                <span>Settings</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Config</span>
            </button>
          )}

          {/* User Profile / Physician Card */}
          <div
            onClick={onOpenAccountSettings || onOpenPatientProfile}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left bg-white border border-slate-200 shadow-2xs hover:border-[#bc000a]/40 transition-all cursor-pointer group"
          >
            <ProfileAvatar
              user={user}
              size="sm"
              showIndicator
              indicatorColor="green"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#bc000a]">
                {user?.displayName || (userRole === 'patient' ? 'Ashton Miller' : userRole === 'researcher' ? 'Dr. Sarah Vance' : 'Dr. Sarah Jenkins')}
              </div>
              <div className="text-[10px] text-slate-400 truncate capitalize">
                {user ? `${user.role} • ${user.userId}` : (userRole === 'patient' ? 'Patient #PT-9042' : userRole === 'researcher' ? 'Healthcare AI Researcher' : 'Attending Cardiologist')}
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-slate-600">
              chevron_right
            </span>
          </div>

          <div className="pt-1 text-center">
            <span className="text-[9.5px] font-mono text-slate-400 block tracking-tight">
              Investigational Platform • Decision Support
            </span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MOBILE BOTTOM NAVIGATION (Visible on mobile/tablet <lg)
          ========================================================================= */}
      <nav
        id="mobile-bottom-navigation"
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-0.75rem)] max-w-[500px] select-none"
      >
        <div className="relative rounded-full bg-white/95 backdrop-blur-2xl border border-white/95 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] py-1 px-1.5 flex items-center justify-between overflow-hidden">
          {/* Top Sheen */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

          {/* PATIENT MOBILE TABS */}
          {userRole === 'patient' &&
            patientNavItems.map((tab) => {
              const isActive = tab.matchTabs
                ? tab.matchTabs.includes(currentTab)
                : currentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`mobile-nav-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex-1 py-1 px-0.5 flex flex-col items-center justify-center rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
                    isActive ? 'text-[#bc000a]' : 'text-[#64748b] hover:text-[#1e293b]'
                  }`}
                >
                  {tab.id === 'patient-profile' ? (
                    <div className="py-0.5 flex items-center justify-center">
                      <ProfileAvatar
                        user={user}
                        size="xs"
                        borderStyle={isActive ? 'brand' : 'subtle'}
                        className={`transition-transform ${isActive ? 'scale-110 shadow-2xs' : ''}`}
                      />
                    </div>
                  ) : (
                    <span
                      className={`material-symbols-outlined transition-all text-[20px] px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#ffe8e8] border border-[#fca5a5]/60 text-[#bc000a] shadow-xs scale-105'
                          : 'border border-transparent text-[#64748b]'
                      }`}
                    >
                      {tab.icon}
                    </span>
                  )}
                  <span
                    className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors mt-0.5 leading-none ${
                      isActive ? 'font-bold text-[#bc000a]' : 'font-medium text-[#64748b]'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}

          {/* DOCTOR MOBILE TABS */}
          {userRole === 'doctor' && (
            <>
              {doctorPrimaryNavItems.slice(0, 4).map((tab) => {
                const isActive = tab.matchTabs
                  ? tab.matchTabs.includes(currentTab)
                  : currentTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`mobile-nav-${tab.id}`}
                    onClick={() => {
                      onTabChange(tab.id);
                      setIsMobileMoreOpen(false);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex-1 py-1 px-0.5 flex flex-col items-center justify-center rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
                      isActive ? 'text-[#bc000a]' : 'text-[#64748b] hover:text-[#1e293b]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined transition-all text-[20px] px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#ffe8e8] border border-[#fca5a5]/60 text-[#bc000a] shadow-xs scale-105'
                          : 'border border-transparent text-[#64748b]'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span
                      className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors mt-0.5 leading-none ${
                        isActive ? 'font-bold text-[#bc000a]' : 'font-medium text-[#64748b]'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}

              {/* 5th Tab: More Drawer */}
              <button
                id="mobile-nav-more"
                onClick={() => setIsMobileMoreOpen((prev) => !prev)}
                aria-expanded={isMobileMoreOpen}
                aria-label="More options"
                className={`relative flex-1 py-1 px-0.5 flex flex-col items-center justify-center rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
                  isMobileMoreOpen || isResearchTabActive || currentTab === 'doctor-reports'
                    ? 'text-[#bc000a]'
                    : 'text-[#64748b] hover:text-[#1e293b]'
                }`}
              >
                <span
                  className={`material-symbols-outlined transition-all text-[20px] px-2.5 py-0.5 rounded-full ${
                    isMobileMoreOpen || isResearchTabActive || currentTab === 'doctor-reports'
                      ? 'bg-[#ffe8e8] border border-[#fca5a5]/60 text-[#bc000a] shadow-xs scale-105'
                      : 'border border-transparent text-[#64748b]'
                  }`}
                >
                  {isMobileMoreOpen ? 'close' : 'more_horiz'}
                </span>
                <span
                  className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors mt-0.5 leading-none ${
                    isMobileMoreOpen || isResearchTabActive || currentTab === 'doctor-reports'
                      ? 'font-bold text-[#bc000a]'
                      : 'font-medium text-[#64748b]'
                  }`}
                >
                  More
                </span>
              </button>
            </>
          )}

          {/* RESEARCHER MOBILE TABS */}
          {userRole === 'researcher' && (
            <>
              {researchNavItems.slice(0, 4).map((tab) => {
                const isActive = currentTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`mobile-nav-${tab.id}`}
                    onClick={() => {
                      onTabChange(tab.id);
                      setIsMobileMoreOpen(false);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex-1 py-1 px-0.5 flex flex-col items-center justify-center rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
                      isActive ? 'text-[#bc000a]' : 'text-[#64748b] hover:text-[#1e293b]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined transition-all text-[20px] px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#ffe8e8] border border-[#fca5a5]/60 text-[#bc000a] shadow-xs scale-105'
                          : 'border border-transparent text-[#64748b]'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span
                      className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors mt-0.5 leading-none ${
                        isActive ? 'font-bold text-[#bc000a]' : 'font-medium text-[#64748b]'
                      }`}
                    >
                      {tab.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}

              {/* 5th Tab: More Drawer */}
              <button
                id="mobile-nav-more-researcher"
                onClick={() => setIsMobileMoreOpen((prev) => !prev)}
                aria-expanded={isMobileMoreOpen}
                aria-label="More options"
                className={`relative flex-1 py-1 px-0.5 flex flex-col items-center justify-center rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
                  isMobileMoreOpen
                    ? 'text-[#bc000a]'
                    : 'text-[#64748b] hover:text-[#1e293b]'
                }`}
              >
                <span
                  className={`material-symbols-outlined transition-all text-[20px] px-2.5 py-0.5 rounded-full ${
                    isMobileMoreOpen
                      ? 'bg-[#ffe8e8] border border-[#fca5a5]/60 text-[#bc000a] shadow-xs scale-105'
                      : 'border border-transparent text-[#64748b]'
                  }`}
                >
                  {isMobileMoreOpen ? 'close' : 'more_horiz'}
                </span>
                <span
                  className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors mt-0.5 leading-none ${
                    isMobileMoreOpen ? 'font-bold text-[#bc000a]' : 'font-medium text-[#64748b]'
                  }`}
                >
                  More
                </span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* =========================================================================
          3. MOBILE "MORE" BOTTOM SHEET / MODAL
          ========================================================================= */}
      <AnimatePresence>
        {isMobileMoreOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMoreOpen(false)}
              className="absolute inset-0 bg-[#0c1926]/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-[480px] bg-white rounded-3xl p-5 shadow-2xl border border-slate-200/90 z-10 space-y-4 mb-16 max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <DrRadarLogo size={34} animated className="shrink-0 drop-shadow-xs" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#bc000a]">
                        DR. RADAR
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Role & Tools</span>
                    </div>
                    <h3 className="text-base font-bold text-[#101c28]">Navigation & Modules</h3>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* User Profile & Account Settings Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-50/70 via-slate-50 to-white border border-[#bc000a]/20 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProfileAvatar
                    user={user}
                    size="md"
                    showIndicator
                    indicatorColor="green"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {user?.displayName || (userRole === 'doctor' ? 'Dr. Ronald S.' : userRole === 'researcher' ? 'Dr. Sarah Vance' : 'Ashton Miller')}
                      </span>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-1.5 py-0.5 rounded border border-[#bc000a]/20 shrink-0">
                        {userRole}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user?.email || 'Medical ID & Account Profile'}
                    </p>
                  </div>
                </div>
                <button
                  id="mobile-drawer-profile-settings-btn"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    if (onOpenAccountSettings) {
                      onOpenAccountSettings();
                    } else if (onOpenPatientProfile) {
                      onOpenPatientProfile();
                    }
                  }}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#bc000a] active:bg-[#990008] text-white text-xs font-bold transition-all shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  <span>Profile</span>
                </button>
              </div>

              {/* Mobile Role Switcher */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
                <button
                  onClick={() => {
                    onRoleChange('patient');
                    setIsMobileMoreOpen(false);
                  }}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                    userRole === 'patient'
                      ? 'bg-white text-[#bc000a] shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">person</span>
                  Patient
                </button>
                <button
                  onClick={() => {
                    onRoleChange('doctor');
                    setIsMobileMoreOpen(false);
                  }}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                    userRole === 'doctor'
                      ? 'bg-white text-[#bc000a] shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">stethoscope</span>
                  Doctor
                </button>
                <button
                  onClick={() => {
                    onRoleChange('researcher');
                    setIsMobileMoreOpen(false);
                  }}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                    userRole === 'researcher'
                      ? 'bg-white text-[#bc000a] shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">science</span>
                  Research
                </button>
              </div>

              {/* Reports Option */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    onTabChange('doctor-reports');
                    setIsMobileMoreOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-600">description</span>
                    <div>
                      <span className="text-xs font-bold text-[#101c28] block">Doctor Reports</span>
                      <span className="text-[10px] text-slate-500">Physician sign-offs & dossiers</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>
              </div>

              {/* Advanced Research Views */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Research / Model Insights
                </span>
                {researchNavItems.map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setIsMobileMoreOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                        isActive
                          ? 'bg-[#ffe8e8] border border-[#bc000a]/20 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isActive
                              ? 'bg-[#bc000a] text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>
                        <div>
                          <span
                            className={`text-xs font-bold ${
                              isActive ? 'text-[#bc000a]' : 'text-slate-800'
                            }`}
                          >
                            {item.label}
                          </span>
                          <p className="text-[10px] text-slate-500">{item.description}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-[18px]">
                        chevron_right
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Settings & Profile Actions */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  id="mobile-drawer-account-settings-btn"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    if (onOpenAccountSettings) {
                      onOpenAccountSettings();
                    } else if (onOpenPatientProfile) {
                      onOpenPatientProfile();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#bc000a]">badge</span>
                  <span>Profile Settings</span>
                </button>
                {onOpenSettings ? (
                  <button
                    id="mobile-drawer-system-settings-btn"
                    onClick={() => {
                      setIsMobileMoreOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-500">tune</span>
                    <span>Preferences</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsMobileMoreOpen(false);
                      if (onOpenAccountSettings) onOpenAccountSettings();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-500">settings</span>
                    <span>Account</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
