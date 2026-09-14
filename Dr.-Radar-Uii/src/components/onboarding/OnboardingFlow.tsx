import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OnboardingStep, UserRole, UserAccountState, ProfilePictureType } from '../../types';
import { DrRadarLogo } from '../DrRadarLogo';
import { LegalDocsModal } from './LegalDocsModal';
import { DR_RADAR_AVATARS, NEUTRAL_DEFAULT_AVATAR, resolveUserAvatarUrl } from '../../data/avatarsData';

interface OnboardingFlowProps {
  currentStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  user: UserAccountState;
  onUpdateProfile: (updates: Partial<UserAccountState>) => void;
  onSetConsent: (termsAccepted: boolean, privacyPolicyAccepted: boolean, researchConsent: boolean) => void;
  onCompleteOnboarding: (role?: UserRole) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  currentStep,
  onStepChange,
  user,
  onUpdateProfile,
  onSetConsent,
  onCompleteOnboarding,
}) => {
  // Authentication Sub-State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authEmail, setAuthEmail] = useState(user.email || '');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState(user.firstName || '');
  const [authLastName, setAuthLastName] = useState(user.lastName || '');
  const [authError, setAuthError] = useState<string | null>(null);

  // Basic Info Sub-State
  const [infoFirstName, setInfoFirstName] = useState(user.firstName || '');
  const [infoLastName, setInfoLastName] = useState(user.lastName || '');
  const [infoDob, setInfoDob] = useState(user.dob || '1990-05-12');
  const [infoGender, setInfoGender] = useState(user.gender || 'Prefer not to say');
  const [infoCountry, setInfoCountry] = useState(user.country || 'United States');
  const [infoLanguage, setInfoLanguage] = useState(user.language || 'English (US)');

  // Role Selection Sub-State
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role || 'patient');

  // Consent Sub-State
  const [termsAccepted, setTermsAccepted] = useState<boolean>(user.termsAccepted ?? false);
  const [researchConsent, setResearchConsent] = useState<boolean>(false); // Strict mandate: NOT pre-checked!
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isDataUsageExpanded, setIsDataUsageExpanded] = useState<boolean>(false);
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  // Profile Setup Sub-State
  const [profilePictureType, setProfilePictureType] = useState<ProfilePictureType>(
    user.profilePictureType || 'avatar'
  );
  const [profilePictureValue, setProfilePictureValue] = useState<string | null>(
    user.profilePicture || DR_RADAR_AVATARS[0].id
  );
  const [avatarTab, setAvatarTab] = useState<'avatar' | 'upload'>('avatar');
  const [uploadPreview, setUploadPreview] = useState<string | null>(
    user.profilePictureType === 'upload' ? user.profilePicture : null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileDisplayName, setProfileDisplayName] = useState(
    user.displayName || (infoFirstName ? `${infoFirstName} ${infoLastName}` : 'Alex Vance')
  );
  const [profRole, setProfRole] = useState(user.professionalRole || 'Clinical Fellow');
  const [specialization, setSpecialization] = useState(user.specialization || 'Cardiology');
  const [organization, setOrganization] = useState(user.organization || 'General Medical Institute');

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setUploadPreview(compressed);
          setProfilePictureType('upload');
          setProfilePictureValue(compressed);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Entry Animation timer
  useEffect(() => {
    if (currentStep === 'entry-animation') {
      const timer = setTimeout(() => {
        onStepChange('welcome');
      }, 3400);
      return () => clearTimeout(timer);
    }
  }, [currentStep, onStepChange]);

  // Auth Handler
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authEmail.includes('@') || !authEmail.includes('.')) {
      setAuthError('Please enter a valid medical or personal email address.');
      return;
    }

    if (authPassword.length < 8) {
      setAuthError('Password must contain at least 8 characters.');
      return;
    }

    if (authMode === 'signup') {
      if (!authFirstName.trim() || !authLastName.trim()) {
        setAuthError('Please provide your first and last name.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('Passwords do not match. Please re-enter.');
        return;
      }
      onUpdateProfile({
        firstName: authFirstName,
        lastName: authLastName,
        displayName: `${authFirstName} ${authLastName}`,
        email: authEmail,
      });
      setInfoFirstName(authFirstName);
      setInfoLastName(authLastName);
      onStepChange('basic-info');
    } else {
      // Sign In simulation
      onUpdateProfile({
        email: authEmail,
      });
      // Direct existing user forward
      onStepChange('role-selection');
    }
  };

  // Basic Info Handler
  const handleBasicInfoSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateProfile({
      firstName: infoFirstName || user.firstName,
      lastName: infoLastName || user.lastName,
      displayName: infoFirstName ? `${infoFirstName} ${infoLastName}` : user.displayName,
      dob: infoDob,
      gender: infoGender,
      country: infoCountry,
      language: infoLanguage,
    });
    onStepChange('role-selection');
  };

  // Role Submit Handler
  const handleRoleSubmit = () => {
    onUpdateProfile({ role: selectedRole });
    onStepChange('consent');
  };

  // Consent Submit Handler
  const handleConsentSubmit = () => {
    setConsentError(null);
    if (!termsAccepted) {
      setConsentError('Please review and accept the required terms to continue.');
      return;
    }

    onSetConsent(true, true, researchConsent);
    onStepChange('profile-setup');
  };

  // Profile Setup Complete Handler
  const handleProfileComplete = () => {
    const resolved = resolveUserAvatarUrl(profilePictureType, profilePictureValue);
    onUpdateProfile({
      profilePictureType,
      profilePicture: profilePictureValue,
      avatarUrl: resolved,
      displayName: profileDisplayName,
      professionalRole: selectedRole !== 'patient' ? profRole : undefined,
      specialization: selectedRole !== 'patient' ? specialization : undefined,
      organization: selectedRole !== 'patient' ? organization : undefined,
      profileCompleted: true,
    });
    onCompleteOnboarding(selectedRole);
  };

  // Profile Skip Handler (Mandate: never block users, defaults to neutral avatar)
  const handleProfileSkip = () => {
    onUpdateProfile({
      profilePictureType: 'none',
      profilePicture: null,
      avatarUrl: undefined,
      profileCompleted: false, // flag as incomplete for the 60% completion prompt
    });
    onCompleteOnboarding(selectedRole);
  };

  return (
    <div className="min-h-screen bg-[#f4f8fd] text-[#131c24] flex flex-col justify-between selection:bg-[#ffe8e8] selection:text-[#bc000a] relative overflow-hidden font-sans">
      {/* Background Subtle Geometry & Radial Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#dce5f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* Top Brand Micro Header (Visible after animation) */}
      {currentStep !== 'entry-animation' && (
        <header className="relative z-10 w-full max-w-5xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DrRadarLogo size={38} animated className="drop-shadow-xs" />
            <div>
              <span className="text-sm font-black tracking-tight text-[#101c28]">DR. RADAR</span>
              <p className="text-[10px] font-semibold text-[#5c7b99] tracking-tight leading-none hidden sm:block">
                Hybrid Quantum–Classical Healthcare Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secure Clinical Gateway</span>
          </div>
        </header>
      )}

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <AnimatePresence mode="wait">
          {/* =========================================================================
              1. ENTRY ANIMATION
          ========================================================================= */}
          {currentStep === 'entry-animation' && (
            <motion.div
              key="entry-animation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-md flex flex-col items-center text-center space-y-6"
            >
              {/* Scientific Waveform -> Network Circuit -> Radar Emblem */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Concentric subtle radar sweeps */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 rounded-full border border-slate-200 bg-white/70 shadow-lg flex items-center justify-center"
                />
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1.15, opacity: [0, 0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-2 rounded-full border border-red-300"
                />

                {/* SVG Sequence: ECG to Circuit Lattice */}
                <svg className="w-40 h-40 relative z-10" viewBox="0 0 200 200" fill="none">
                  {/* Subtle Quantum Grid */}
                  <circle cx="100" cy="100" r="70" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r="45" stroke="#e2e8f0" strokeWidth="1" />

                  {/* Dynamic ECG Lead Line */}
                  <motion.path
                    d="M 20 100 L 50 100 L 60 92 L 70 100 L 85 100 L 93 118 L 100 48 L 107 118 L 115 100 L 130 100 L 140 88 L 150 100 L 180 100"
                    stroke="#bc000a"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.6, ease: 'easeInOut' }}
                  />

                  {/* Circuit Nodes blooming at vertices */}
                  <motion.circle
                    cx="100"
                    cy="48"
                    r="4.5"
                    fill="#bc000a"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                  />
                  <motion.circle
                    cx="93"
                    cy="118"
                    r="3"
                    fill="#1e293b"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.3, duration: 0.3 }}
                  />
                  <motion.circle
                    cx="107"
                    cy="118"
                    r="3"
                    fill="#1e293b"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.4, duration: 0.3 }}
                  />
                </svg>

                {/* Center Dr Radar Emblem Bloom */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.7, duration: 0.5 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <DrRadarLogo size={90} animated />
                </motion.div>
              </div>

              {/* Wordmark and Descriptor */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8, duration: 0.5 }}
                className="space-y-1.5"
              >
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#101c28]">
                  DR. RADAR
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-[#5c7b99] tracking-tight">
                  Hybrid Quantum–Classical Healthcare Intelligence
                </p>
                <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#bc000a] animate-ping" />
                  Initializing Decision Support...
                </div>
              </motion.div>

              {/* Skip button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={() => onStepChange('welcome')}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors pt-2 cursor-pointer"
              >
                Skip intro →
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              2. WELCOME SCREEN
          ========================================================================= */}
          {currentStep === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xl space-y-7 text-center"
            >
              <div className="flex justify-center">
                <DrRadarLogo size={76} animated className="drop-shadow-sm" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">
                  Welcome to Dr. Radar
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mx-auto">
                  Intelligent healthcare analysis powered by hybrid quantum–classical AI.
                </p>
              </div>

              {/* Highlight Pillars */}
              <div className="grid grid-cols-3 gap-2.5 text-left py-1">
                <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-100">
                  <span className="material-symbols-outlined text-[18px] text-[#bc000a]">cardiology</span>
                  <div className="font-bold text-xs text-slate-800 mt-1">Arrhythmia</div>
                  <div className="text-[10px] text-slate-500">ECG Telemetry</div>
                </div>
                <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-100">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">neurology</span>
                  <div className="font-bold text-xs text-slate-800 mt-1">Multi-Modal</div>
                  <div className="text-[10px] text-slate-500">Imaging & Biomarkers</div>
                </div>
                <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-100">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">lock</span>
                  <div className="font-bold text-xs text-slate-800 mt-1">Privacy-First</div>
                  <div className="text-[10px] text-slate-500">You Control Data</div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <button
                  id="welcome-get-started-btn"
                  onClick={() => {
                    setAuthMode('signup');
                    onStepChange('auth');
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#bc000a] text-white font-bold text-sm shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Get Started
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>

                <button
                  id="welcome-sign-in-btn"
                  onClick={() => {
                    setAuthMode('signin');
                    onStepChange('auth');
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-[#101c28] transition-colors cursor-pointer"
                >
                  Already have an account? <span className="font-bold text-[#bc000a] underline">Sign In</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              3. LOGIN / SIGN UP
          ========================================================================= */}
          {currentStep === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <DrRadarLogo size={32} />
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                      DR. RADAR GATEWAY
                    </span>
                    <h2 className="text-base font-bold text-[#101c28]">
                      {authMode === 'signin' ? 'Welcome back to Dr. Radar' : 'Create your Dr. Radar account'}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => onStepChange('welcome')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Back
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'signup' ? 'bg-white text-[#bc000a] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'signin' ? 'bg-white text-[#bc000a] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        required
                        value={authFirstName}
                        onChange={(e) => setAuthFirstName(e.target.value)}
                        placeholder="e.g. Sarah"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        required
                        value={authLastName}
                        onChange={(e) => setAuthLastName(e.target.value)}
                        placeholder="e.g. Chen"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@clinical-domain.med"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Password
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => alert('Password reset verification link has been sent to your email.')}
                        className="text-[11px] text-[#bc000a] font-semibold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                  />
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    />
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#bc000a] text-white font-bold text-xs shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all cursor-pointer"
                  >
                    {authMode === 'signup' ? 'Create Account & Continue' : 'Sign In'}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center">
                    Protected by client-side encrypted credentials & healthcare tokenization.
                  </p>
                </div>
              </form>
            </motion.div>
          )}

          {/* =========================================================================
              4. BASIC USER INFORMATION
          ========================================================================= */}
          {currentStep === 'basic-info' && (
            <motion.div
              key="basic-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-5"
            >
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                    STEP 2 OF 5
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">• Personalization</span>
                </div>
                <h2 className="text-xl font-bold text-[#101c28]">
                  Tell us a little about yourself
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  This helps us personalize your Dr. Radar experience.
                </p>
              </div>

              <form onSubmit={handleBasicInfoSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={infoFirstName}
                      onChange={(e) => setInfoFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={infoLastName}
                      onChange={(e) => setInfoLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={infoDob}
                      onChange={(e) => setInfoDob(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Gender
                      </label>
                      <span className="text-[10px] text-slate-400 italic">Optional</span>
                    </div>
                    <select
                      value={infoGender}
                      onChange={(e) => setInfoGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Country / Region
                    </label>
                    <select
                      value={infoCountry}
                      onChange={(e) => setInfoCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    >
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="India">India</option>
                      <option value="Japan">Japan</option>
                      <option value="Australia">Australia</option>
                      <option value="Other">Other Region</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Preferred Language
                    </label>
                    <select
                      value={infoLanguage}
                      onChange={(e) => setInfoLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                    >
                      <option value="English (US)">English (US)</option>
                      <option value="English (UK)">English (UK)</option>
                      <option value="Spanish (Español)">Spanish (Español)</option>
                      <option value="French (Français)">French (Français)</option>
                      <option value="German (Deutsch)">German (Deutsch)</option>
                      <option value="Japanese (日本語)">Japanese (日本語)</option>
                      <option value="Hindi (हिन्दी)">Hindi (हिन्दी)</option>
                    </select>
                  </div>
                </div>

                {/* Privacy note */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">lock</span>
                  <span>We will never ask for government IDs, Aadhaar numbers, or financial credentials.</span>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-[#bc000a] text-white font-bold text-xs shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all cursor-pointer"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepChange('role-selection')}
                    className="py-3 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* =========================================================================
              5. USER ROLE
          ========================================================================= */}
          {currentStep === 'role-selection' && (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6"
            >
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                    STEP 3 OF 5
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">• Role Selection</span>
                </div>
                <h2 className="text-xl font-bold text-[#101c28]">
                  How will you use Dr. Radar?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose the workspace that fits your objective. You can switch anytime.
                </p>
              </div>

              {/* 3 Clean Role Cards */}
              <div className="grid grid-cols-1 gap-3">
                {/* 1. Patient */}
                <div
                  onClick={() => setSelectedRole('patient')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    selectedRole === 'patient'
                      ? 'border-[#bc000a] bg-red-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === 'patient' ? 'bg-[#bc000a] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Patient</h3>
                      {selectedRole === 'patient' && (
                        <span className="w-5 h-5 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[12px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      I want to understand and monitor my health analysis.
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                      <span>• Personal ECG Telemetry</span>
                      <span>• Clear Next Actions</span>
                      <span>• Diagnostic Archive</span>
                    </div>
                  </div>
                </div>

                {/* 2. Doctor / Healthcare Professional */}
                <div
                  onClick={() => setSelectedRole('doctor')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    selectedRole === 'doctor'
                      ? 'border-[#bc000a] bg-red-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === 'doctor' ? 'bg-[#bc000a] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">stethoscope</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Doctor / Healthcare Professional</h3>
                      {selectedRole === 'doctor' && (
                        <span className="w-5 h-5 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[12px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      I want to review patient analyses and clinical insights.
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                      <span>• Cohort Triage</span>
                      <span>• Urgent Arrhythmia Alerts</span>
                      <span>• Clinical Reports & EHR</span>
                    </div>
                  </div>
                </div>

                {/* 3. Researcher */}
                <div
                  onClick={() => setSelectedRole('researcher')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    selectedRole === 'researcher'
                      ? 'border-[#bc000a] bg-red-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === 'researcher' ? 'bg-[#bc000a] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">science</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Researcher</h3>
                      {selectedRole === 'researcher' && (
                        <span className="w-5 h-5 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[12px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      I want to explore models, experiments and healthcare AI research.
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                      <span>• 10-Qubit VQC Ansatz</span>
                      <span>• SHAP Saliency Explainability</span>
                      <span>• Benchmark Matrices</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                <button
                  id="role-continue-btn"
                  onClick={handleRoleSubmit}
                  className="w-full py-3 rounded-xl bg-[#bc000a] text-white font-bold text-xs shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all cursor-pointer"
                >
                  Continue as {selectedRole === 'doctor' ? 'Healthcare Professional' : selectedRole === 'researcher' ? 'Researcher' : 'Patient'}
                </button>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              6. PRIVACY & DATA CONSENT
          ========================================================================= */}
          {currentStep === 'consent' && (
            <motion.div
              key="consent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-5"
            >
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                    STEP 4 OF 5
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">• Data Governance</span>
                </div>
                <h2 className="text-xl font-bold text-[#101c28]">
                  Your Privacy Matters
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  We may use anonymized or de-identified information generated through Dr. Radar to improve our healthcare AI models, evaluate system performance, and conduct research. Your personal identity is not included in datasets used for these purposes.
                </p>
              </div>

              {/* Accurate De-identification Box */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">policy</span>
                    Anonymized & De-identified Data Standards
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ISO/IEC 27001</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  We use accurate clinical terms: data processed for research is strictly <em>anonymized and de-identified</em> by stripping patient identifiers, names, and contact parameters.
                </p>
                <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                  <button
                    type="button"
                    onClick={() => setLegalModalType('privacy')}
                    className="text-[#bc000a] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View Privacy Policy
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegalModalType('terms')}
                    className="text-[#bc000a] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View Terms of Service
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </button>
                </div>
              </div>

              {/* Expandable Section: How your data is used */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsDataUsageExpanded(!isDataUsageExpanded)}
                  className="w-full p-3 bg-[#f8fbfe] hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">info</span>
                    How your data is used
                  </span>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    {isDataUsageExpanded ? 'Hide' : 'Learn More'}
                    <span className="material-symbols-outlined text-[16px]">
                      {isDataUsageExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </button>

                {isDataUsageExpanded && (
                  <div className="p-3.5 space-y-2 text-xs text-slate-600 bg-white border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <span className="text-[#bc000a] font-bold">•</span>
                      <span><strong>What information is collected:</strong> Physiological waveforms (e.g., Lead II ECG) and signal metadata necessary for clinical analysis.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#bc000a] font-bold">•</span>
                      <span><strong>Why it is collected:</strong> To generate real-time rhythm stability assessments and detect cardiac arrhythmias.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#bc000a] font-bold">•</span>
                      <span><strong>Optional research use:</strong> Evaluates model accuracy and quantum circuit depth against baseline benchmark metrics.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#bc000a] font-bold">•</span>
                      <span><strong>User sovereignty:</strong> You can inspect, download, or withdraw research consent at any time from your Account Settings.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Consent Controls: Clear separation between REQUIRED and OPTIONAL */}
              <div className="space-y-3 pt-1">
                {/* REQUIRED */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent-required-terms"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (e.target.checked) setConsentError(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-[#bc000a] focus:ring-[#bc000a] cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor="consent-required-terms" className="text-xs font-bold text-slate-900 cursor-pointer">
                        I agree to the Terms of Service and Privacy Policy
                      </label>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-[#bc000a] px-1.5 py-0.2 rounded">
                        Required
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Required to access the core Dr. Radar clinical decision-support application.
                    </p>
                  </div>
                </div>

                {/* OPTIONAL RESEARCH CONSENT (NOT PRE-CHECKED) */}
                <div className="p-3.5 rounded-2xl bg-[#f8fbfe] border border-blue-200/80 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent-optional-research"
                    checked={researchConsent}
                    onChange={(e) => setResearchConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#bc000a] focus:ring-[#bc000a] cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor="consent-optional-research" className="text-xs font-bold text-slate-900 cursor-pointer">
                        I agree to allow my anonymized/de-identified data to be used for healthcare AI research, model training, evaluation, and improvement
                      </label>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded">
                        Optional
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      You may use the core platform without granting this consent. You can withdraw it at any time.
                    </p>
                  </div>
                </div>
              </div>

              {consentError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                  <span>{consentError}</span>
                </div>
              )}

              {/* Continue */}
              <div className="pt-2">
                <button
                  id="consent-continue-btn"
                  onClick={handleConsentSubmit}
                  className="w-full py-3 rounded-xl bg-[#bc000a] text-white font-bold text-xs shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              7. PROFILE SETUP
          ========================================================================= */}
          {currentStep === 'profile-setup' && (
            <motion.div
              key="profile-setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-5"
            >
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a]">
                    STEP 5 OF 5
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">• Profile Setup</span>
                </div>
                <h2 className="text-xl font-bold text-[#101c28]">
                  Set Up Your Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalize your Dr. Radar experience. You can always do this later.
                </p>
              </div>

              {/* Profile Picture / Avatar Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Add a Profile Picture <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Step 5a</span>
                </div>

                {/* Avatar Preview & Choice Switcher */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="relative shrink-0">
                    <img
                      src={resolveUserAvatarUrl(profilePictureType, profilePictureValue)}
                      alt="Selected Avatar Preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#bc000a] shadow-xs bg-white"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">
                      ✓
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-xs font-bold text-slate-900">
                      {profilePictureType === 'upload'
                        ? 'Custom Photo Uploaded'
                        : profilePictureType === 'avatar'
                        ? 'Dr. Radar Avatar Selected'
                        : 'Neutral Default Avatar'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Personalize your identity across Dr. Radar or skip to remain neutral.
                    </p>

                    {/* Mode Buttons */}
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarTab('avatar');
                          if (profilePictureType !== 'avatar') {
                            setProfilePictureType('avatar');
                            setProfilePictureValue(DR_RADAR_AVATARS[0].id);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          avatarTab === 'avatar' && profilePictureType === 'avatar'
                            ? 'bg-[#bc000a] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Choose Avatar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAvatarTab('upload');
                          if (uploadPreview) {
                            setProfilePictureType('upload');
                            setProfilePictureValue(uploadPreview);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          avatarTab === 'upload'
                            ? 'bg-[#bc000a] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Upload Photo
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfilePictureType('none');
                          setProfilePictureValue(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          profilePictureType === 'none'
                            ? 'bg-slate-800 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Use neutral fallback"
                      >
                        Skip Picture
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-view: Choose from Dr. Radar Avatar Collection */}
                {avatarTab === 'avatar' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500 font-medium">
                      Select one of 12 Dr. Radar 3D avatars:
                    </p>
                    <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                      {DR_RADAR_AVATARS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setProfilePictureType('avatar');
                            setProfilePictureValue(av.id);
                          }}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer p-0.5 group ${
                            profilePictureType === 'avatar' && profilePictureValue === av.id
                              ? 'border-[#bc000a] ring-2 ring-red-100 scale-105 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                          }`}
                          title={av.name}
                        >
                          <img
                            src={av.url}
                            alt={av.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          {profilePictureType === 'avatar' && profilePictureValue === av.id && (
                            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#bc000a] text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-view: Upload Photo */}
                {avatarTab === 'upload' && (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-[#bc000a]/50 bg-slate-50 hover:bg-red-50/20 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-2xl text-[#bc000a]">
                        cloud_upload
                      </span>
                      <p className="text-xs font-bold text-slate-800">
                        {uploadPreview ? 'Change uploaded photo' : 'Upload personal profile photo'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Drag and drop or click to browse (JPG, PNG, WebP up to 5MB)
                      </p>
                    </div>

                    {uploadError && (
                      <p className="text-xs text-red-600 font-medium">{uploadError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Alex Vance"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]"
                />
              </div>

              {/* Role-Specific Fields (Doctor / Researcher) */}
              {selectedRole !== 'patient' && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Professional Affiliation (Optional)
                    </span>
                    <span className="text-[10px] text-slate-400">Self-Declared</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                        Clinical / Research Role
                      </label>
                      <input
                        type="text"
                        value={profRole}
                        onChange={(e) => setProfRole(e.target.value)}
                        placeholder="e.g. Cardiologist"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                        Specialization
                      </label>
                      <input
                        type="text"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        placeholder="e.g. Electrophysiology"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                      Organization / Hospital
                    </label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. University Cardiology Institute"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  id="profile-complete-btn"
                  onClick={handleProfileComplete}
                  className="flex-1 py-3 rounded-xl bg-[#bc000a] text-white font-bold text-xs shadow-md shadow-[#bc000a]/20 hover:bg-[#a50009] transition-all cursor-pointer"
                >
                  Complete Profile
                </button>
                <button
                  id="profile-skip-btn"
                  onClick={handleProfileSkip}
                  className="py-3 px-5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Skip for Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {currentStep !== 'entry-animation' && (
        <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 py-4 text-center text-xs text-slate-400">
          Dr. Radar • Hybrid Quantum–Classical Healthcare Intelligence • Clinical Decision Support
        </footer>
      )}

      {/* Legal Documents Modal */}
      {legalModalType && (
        <LegalDocsModal
          isOpen={Boolean(legalModalType)}
          onClose={() => setLegalModalType(null)}
          documentType={legalModalType}
        />
      )}
    </div>
  );
};
