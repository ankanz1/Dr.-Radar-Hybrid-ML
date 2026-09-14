export type HealthInfoSectionKey =
  | 'symptoms'
  | 'conditions'
  | 'medications'
  | 'allergies'
  | 'procedures'
  | 'familyHistory'
  | 'lifestyle'
  | 'previousTests';

export type MedicalDocumentCategory =
  | 'ecg'
  | 'blood-test'
  | 'xray'
  | 'mri'
  | 'ct'
  | 'ultrasound'
  | 'prescription'
  | 'discharge-summary'
  | 'diagnosis-report'
  | 'other';

export interface MedicalRecord {
  id: string;
  title: string;
  category: MedicalDocumentCategory;
  categoryLabel: string;
  uploadDate: string;
  fileType: 'PDF' | 'JPG' | 'JPEG' | 'PNG' | 'DICOM' | 'DOC';
  fileSize: string;
  fileName: string;
  status: 'ready' | 'processing' | 'uploading' | 'failed';
  fileDataUrl?: string;
  notes?: string;
  facility?: string;
  extractedSummary?: string; // transparent note, no fake AI medical values
}

export interface SymptomsInfo {
  hasSymptoms: boolean;
  list: string[];
  onset?: string;
  frequency?: string;
  severity?: 'Mild' | 'Moderate' | 'Severe' | 'Acute';
  triggers?: string;
  alleviators?: string;
  notes?: string;
}

export interface ConditionItem {
  id: string;
  name: string;
  diagnosedYear?: string;
  status: 'Active' | 'Managed' | 'Resolved';
}

export interface ConditionsInfo {
  hasConditions: boolean;
  list: ConditionItem[];
  notes?: string;
}

export interface MedicationItem {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  purpose?: string;
}

export interface MedicationsInfo {
  takingMedications: boolean;
  list: MedicationItem[];
  notes?: string;
}

export interface AllergyItem {
  id: string;
  allergen: string;
  type: 'Medication' | 'Food' | 'Environmental' | 'Other';
  severity: 'Mild' | 'Moderate' | 'Severe';
}

export interface AllergiesInfo {
  hasAllergies: boolean;
  list: AllergyItem[];
  notes?: string;
}

export interface ProcedureItem {
  id: string;
  name: string;
  year?: string;
  hospital?: string;
  notes?: string;
}

export interface ProceduresInfo {
  hadProcedures: boolean;
  list: ProcedureItem[];
  notes?: string;
}

export interface FamilyHistoryItem {
  id: string;
  condition: string;
  relation: string;
}

export interface FamilyHistoryInfo {
  hasHistory: boolean;
  list: FamilyHistoryItem[];
  notes?: string;
}

export interface LifestyleInfo {
  smoking: 'Never' | 'Former' | 'Current' | 'Not provided';
  alcohol: 'None' | 'Occasional' | 'Moderate' | 'Heavy' | 'Not provided';
  physicalActivity: 'Sedentary' | 'Light' | 'Moderate' | 'Active' | 'Very Active' | 'Not provided';
  sleepHours?: number;
  stressLevel?: 'Low' | 'Moderate' | 'High' | 'Not provided';
  notes?: string;
}

export interface PreviousTestItem {
  id: string;
  type: string;
  date: string;
  facility?: string;
  keyFinding?: string;
}

export interface PreviousTestsInfo {
  hasPreviousTests: boolean;
  list: PreviousTestItem[];
  notes?: string;
}

export interface PatientHealthProfile {
  primaryGoal: 'routine' | 'symptoms' | 'understand-report' | 'monitor' | 'other';
  goalDescription?: string;
  symptoms: SymptomsInfo;
  conditions: ConditionsInfo;
  medications: MedicationsInfo;
  allergies: AllergiesInfo;
  procedures: ProceduresInfo;
  familyHistory: FamilyHistoryInfo;
  lifestyle: LifestyleInfo;
  previousTests: PreviousTestsInfo;
  completionPercentage: number;
  lastUpdated: string;
}

export interface HealthContextSummary {
  symptomsSummary: string;
  conditionsSummary: string;
  medicationsSummary: string;
  allergiesSummary: string;
  lifestyleSummary: string;
  recordsCount: number;
  isAvailable: boolean;
  completionPercentage: number;
}
