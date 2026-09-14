import { useState, useEffect } from 'react';
import { UserAccountState, UserRole, OnboardingStep, ProfilePictureType } from '../types';
import { resolveUserAvatarUrl, NEUTRAL_DEFAULT_AVATAR_URL } from '../data/avatarsData';

const STORAGE_KEY = 'dr_radar_account_v2';
const ONBOARDING_STEP_KEY = 'dr_radar_onboarding_step_v2';

const DEFAULT_USER: UserAccountState = {
  userId: 'USR-89410',
  firstName: 'Alexander',
  lastName: 'Vance',
  displayName: 'Alex Vance',
  email: 'a.vance@cardio-telemetry.med',
  role: 'patient',
  profilePictureType: 'none',
  profilePicture: null,
  avatarUrl: NEUTRAL_DEFAULT_AVATAR_URL,
  dob: '1984-06-14',
  gender: 'Male',
  country: 'United States',
  language: 'English (US)',
  professionalRole: 'Biomedical Fellow',
  specialization: 'Electrophysiology',
  organization: 'Institute for Computational Medicine',
  onboardingCompleted: true, // Default to true if already configured, but first-time visits trigger onboarding
  profileCompleted: true,
  termsAccepted: true,
  termsAcceptedDate: '2026-08-15T09:00:00Z',
  privacyPolicyAccepted: true,
  privacyPolicyAcceptedDate: '2026-08-15T09:00:00Z',
  researchConsent: true,
  researchConsentTimestamp: '2026-08-15T09:00:00Z',
  notifications: {
    analysisResults: true,
    appointmentReminders: true,
    healthAlerts: true,
    researchUpdates: false,
    productUpdates: true,
  },
  security: {
    twoFactorEnabled: false,
    activeSessionsCount: 1,
    lastPasswordChange: '2026-08-15',
  },
  createdAt: '2026-08-15',
};

export function useUserAccount() {
  const [user, setUser] = useState<UserAccountState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_USER;
  });

  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(() => {
    try {
      // Check if user has not completed onboarding
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // If brand new session, default to active onboarding
        return true;
      }
      const parsed = JSON.parse(stored);
      return !parsed.onboardingCompleted;
    } catch {
      return false;
    }
  });

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(() => {
    try {
      const step = localStorage.getItem(ONBOARDING_STEP_KEY) as OnboardingStep;
      if (step) return step;
    } catch {
      // Fallback
    }
    return 'entry-animation';
  });

  // Persist user changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  }, [user]);

  // Persist onboarding step
  useEffect(() => {
    try {
      localStorage.setItem(ONBOARDING_STEP_KEY, currentStep);
    } catch {
      // ignore
    }
  }, [currentStep]);

  const startOnboarding = (initialStep: OnboardingStep = 'entry-animation') => {
    setCurrentStep(initialStep);
    setIsOnboardingActive(true);
  };

  const completeOnboarding = (targetRole?: UserRole) => {
    const roleToUse = targetRole || user.role;
    setUser((prev) => ({
      ...prev,
      role: roleToUse,
      onboardingCompleted: true,
    }));
    setIsOnboardingActive(false);
    setCurrentStep('completed');
  };

  const updateProfile = (updates: Partial<UserAccountState>) => {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      if (updates.profilePictureType !== undefined || updates.profilePicture !== undefined) {
        merged.avatarUrl = resolveUserAvatarUrl(merged);
      }
      if (updates.firstName || updates.lastName) {
        merged.displayName = updates.displayName || `${updates.firstName || prev.firstName} ${updates.lastName || prev.lastName}`;
      }
      return merged;
    });
  };

  const updateProfilePicture = (pictureType: ProfilePictureType, pictureValue: string | null) => {
    const resolved = resolveUserAvatarUrl({
      profilePictureType: pictureType,
      profilePicture: pictureValue,
    });
    setUser((prev) => ({
      ...prev,
      profilePictureType: pictureType,
      profilePicture: pictureValue,
      avatarUrl: resolved,
    }));
  };

  const updateRole = (newRole: UserRole) => {
    setUser((prev) => ({
      ...prev,
      role: newRole,
    }));
  };

  const setConsent = (
    termsAccepted: boolean,
    privacyPolicyAccepted: boolean,
    researchConsent: boolean
  ) => {
    const now = new Date().toISOString();
    setUser((prev) => ({
      ...prev,
      termsAccepted,
      termsAcceptedDate: termsAccepted ? now : undefined,
      privacyPolicyAccepted,
      privacyPolicyAcceptedDate: privacyPolicyAccepted ? now : undefined,
      researchConsent,
      researchConsentTimestamp: researchConsent ? now : prev.researchConsentTimestamp,
    }));
  };

  const toggleResearchConsent = () => {
    const now = new Date().toISOString();
    setUser((prev) => ({
      ...prev,
      researchConsent: !prev.researchConsent,
      researchConsentTimestamp: !prev.researchConsent ? now : prev.researchConsentTimestamp,
    }));
  };

  const toggleNotification = (key: keyof UserAccountState['notifications']) => {
    setUser((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  const toggleTwoFactor = () => {
    setUser((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        twoFactorEnabled: !prev.security.twoFactorEnabled,
      },
    }));
  };

  const signOut = () => {
    // Return to entry/welcome screen and reset active state
    setUser((prev) => ({
      ...prev,
      onboardingCompleted: false,
    }));
    setCurrentStep('welcome');
    setIsOnboardingActive(true);
  };

  const deleteAccount = () => {
    // Clear storage and reset to clean initial user in onboarding
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    setUser({
      ...DEFAULT_USER,
      userId: `USR-${Math.floor(10000 + Math.random() * 90000)}`,
      firstName: '',
      lastName: '',
      displayName: '',
      email: '',
      onboardingCompleted: false,
      profileCompleted: false,
      termsAccepted: false,
      privacyPolicyAccepted: false,
      researchConsent: false,
      createdAt: new Date().toISOString().split('T')[0],
    });
    setCurrentStep('welcome');
    setIsOnboardingActive(true);
  };

  const exportUserData = () => {
    const exportPayload = {
      platform: 'DR. RADAR — Hybrid Quantum–Classical Healthcare Intelligence',
      exportTimestamp: new Date().toISOString(),
      userRecord: {
        userId: user.userId,
        name: user.displayName,
        email: user.email,
        role: user.role,
        dob: user.dob,
        gender: user.gender,
        country: user.country,
        language: user.language,
        clinicalAffiliation: {
          professionalRole: user.professionalRole,
          specialization: user.specialization,
          organization: user.organization,
        },
        consentHistory: {
          termsAccepted: user.termsAccepted,
          termsAcceptedDate: user.termsAcceptedDate,
          privacyPolicyAccepted: user.privacyPolicyAccepted,
          privacyPolicyAcceptedDate: user.privacyPolicyAcceptedDate,
          researchConsent: user.researchConsent,
          researchConsentTimestamp: user.researchConsentTimestamp,
        },
        notifications: user.notifications,
        security: {
          twoFactorEnabled: user.security.twoFactorEnabled,
          activeSessionsCount: user.security.activeSessionsCount,
        },
      },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dr-radar-user-data-${user.userId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
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
  };
}
