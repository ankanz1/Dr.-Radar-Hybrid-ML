export type CareUrgencyLevel =
  | 'routine' // Routine Follow-Up (Normal / Low Risk)
  | 'soon' // Follow-Up Recommended (Isolated finding, minor variance)
  | 'priority' // Priority Follow-Up (Potential rhythm abnormality, noticeable symptoms)
  | 'urgent' // Urgent Medical Attention (Significant tachyarrhythmia, severe anomaly)
  | 'emergency'; // Emergency Medical Care (Acute red-flag symptoms)

export type RecommendationCategory =
  | 'next_step'
  | 'monitor'
  | 'follow_up'
  | 'lifestyle_care'
  | 'medication_safety';

export interface CareRecommendationItem {
  id: string;
  category: RecommendationCategory;
  categoryLabel: 'NEXT STEP' | 'MONITOR' | 'FOLLOW-UP' | 'LIFESTYLE & CARE' | 'MEDICATION SAFETY';
  priority: number; // 1 (highest) to 5
  title: string;
  description: string;
  icon: string;
}

export interface EmergencyNotice {
  hasEmergencyWarning: boolean;
  headline: string;
  body: string;
  symptomsList: string[];
  actionPrompt: string;
}

export interface PlainLanguageTerm {
  term: string;
  plainMeaning: string;
}

export interface TreatmentCarePlan {
  id: string;
  modalityId: 'ecg' | 'cardiology' | 'imaging-cxr' | 'chronic-diabetes' | 'cancer' | 'liver' | string;
  modalityName: string;
  isSupportedModule: boolean; // True for active modules (ECG), false for planned future modules
  title: string; // "Treatment & Care Recommendations"
  subtitle: string; // "Based on your current result, here are some suggested next steps."
  
  resultSummary: {
    findingTitle: string; // e.g. "Potential Rhythm Abnormality" or "Normal Sinus Rhythm"
    classificationCode?: string; // e.g. "V", "S", "N"
    classificationLabel: string; // e.g. "Ventricular Ectopic Beat (PVC)"
    confidence?: string | number;
    whatThisMeans: string; // Plain-language explanation
    isNormal: boolean;
    isAbnormal: boolean;
    trendNotice?: string; // Trend context compared to prior result
  };

  urgency: {
    level: CareUrgencyLevel;
    label: string; // e.g. "Routine Follow-Up", "Priority Follow-Up", "Urgent Medical Attention"
    badgeColor: 'emerald' | 'blue' | 'amber' | 'rose' | 'red';
    guidanceText: string;
  };

  recommendations: CareRecommendationItem[]; // 3-5 prioritized recommendations
  medicationGuidance?: string; // Strict compliance: never prescribe, cautious framing
  emergencyNotice: EmergencyNotice;
  plainLanguageGlossary: PlainLanguageTerm[];
  doctorReviewStatus: 'recommended' | 'reviewed' | 'pending';
  disclaimer: string;
}

export interface PatientContextInput {
  patientId?: string;
  patientName?: string;
  age?: number;
  gender?: string;
  previousResult?: string; // e.g., 'Normal Sinus Rhythm'
  previousDate?: string;
  bpm?: number;
  knownConditions?: string[];
  reportedSymptoms?: string[];
}

export interface ClinicalContextInput {
  modality: 'ecg' | 'cardiology' | 'imaging' | 'chronic' | 'cancer' | 'liver';
  testId?: string;
  resultCode?: string; // e.g. 'N', 'V', 'S', 'F', 'Q'
  findingTitle?: string;
  classificationLabel?: string;
  confidence?: string | number;
  rawFindings?: string;
  patientContext?: PatientContextInput;
}
