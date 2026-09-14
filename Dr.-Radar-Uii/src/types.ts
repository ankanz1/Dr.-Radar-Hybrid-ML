export type UserRole = 'patient' | 'doctor' | 'researcher';

export type ProfilePictureType = 'uploaded' | 'avatar' | 'none';

export type OnboardingStep =
  | 'entry-animation'
  | 'welcome'
  | 'auth'
  | 'basic-info'
  | 'role-selection'
  | 'consent'
  | 'profile-setup'
  | 'completed';

export interface UserAccountState {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  profilePictureType?: ProfilePictureType;
  profilePicture?: string | null;
  dob?: string;
  gender?: string;
  country?: string;
  language?: string;
  professionalRole?: string;
  specialization?: string;
  organization?: string;
  onboardingCompleted: boolean;
  profileCompleted: boolean;
  termsAccepted: boolean;
  termsAcceptedDate?: string;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedDate?: string;
  researchConsent: boolean;
  researchConsentTimestamp?: string;
  notifications: {
    analysisResults: boolean;
    appointmentReminders: boolean;
    healthAlerts: boolean;
    researchUpdates: boolean;
    productUpdates: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    activeSessionsCount: number;
    lastPasswordChange: string;
  };
  createdAt: string;
}

export type ScreenTab =
  // Core Platform Navigation
  | 'home'
  | 'analysis'
  | 'ecg-analysis'
  | 'reusable-analysis'
  | 'patients'
  | 'results'
  | 'reports'
  | 'profile'
  | 'alerts'
  | 'health-info'
  | 'medical-records'
  // Direct / Legacy Mappings for seamless compatibility
  | 'patient-home'
  | 'patient-ecg'
  | 'patient-results'
  | 'patient-appointments'
  | 'patient-profile'
  | 'doctor-dashboard'
  | 'doctor-patients'
  | 'doctor-alerts'
  | 'doctor-reports'
  // Secondary Advanced Research Area
  | 'overview'
  | 'dataset'
  | 'quantum-lab'
  | 'experiments'
  | 'explainability'
  | 'benchmarks';

export type ClinicalAreaId = 'cardiology' | 'imaging' | 'cancer' | 'chronic' | 'liver';

export interface ClinicalModalityTest {
  id: string;
  areaId: ClinicalAreaId;
  name: string;
  code: string;
  modalityType: 'waveform' | 'image' | 'tabular';
  status: 'active' | 'planned';
  description: string;
  badge: string;
  sampleInputName: string;
  pipelineDescription: string;
}

export interface ClinicalArea {
  id: ClinicalAreaId;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  status: 'active' | 'planned' | 'coming_soon';
  badge: string;
  phase: string;
  tests: ClinicalModalityTest[];
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  rating: number;
  availableTag: string;
  nextAvailable: string;
  isAvailableToday: boolean;
  avatarUrl: string;
  experienceYears?: number;
  about?: string;
  hospital?: string;
  slots: string[];
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  icon: string;
  type: 'scan' | 'report' | 'alert';
}

export interface HistoryReport {
  id: string;
  title: string;
  date: string;
  badge?: string;
  isAttention?: boolean;
  bpmAvg: number;
  rhythmStatus: string;
  summary: string;
  icon: string;
}

export interface TrendDataPoint {
  day: string;
  bpm: number;
  cx: number;
  cy: number;
  dateStr: string;
}

export interface ScreeningPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  status: 'Scanning' | 'Analyzed' | 'Pending';
  bpm: number;
  risk: 'Low' | 'Moderate' | 'Elevated';
  rhythm: string;
}
