import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PatientHealthProfile,
  MedicalRecord,
  HealthInfoSectionKey,
  HealthContextSummary,
} from '../types/healthInfo';

const HEALTH_PROFILE_STORAGE_KEY = 'dr_radar_health_profile_v1';
const MEDICAL_RECORDS_STORAGE_KEY = 'dr_radar_medical_records_v1';

export const DEFAULT_HEALTH_PROFILE: PatientHealthProfile = {
  primaryGoal: 'monitor',
  goalDescription: 'Continuous heart rhythm monitoring and preventive cardiovascular health tracking.',
  symptoms: {
    hasSymptoms: true,
    list: ['Occasional mild palpitations'],
    onset: '2 months ago',
    frequency: '1-2 times weekly, primarily late afternoon',
    severity: 'Mild',
    triggers: 'Heavy espresso intake or elevated workplace stress',
    alleviators: 'Deep breathing, seated rest, and hydration',
    notes: 'No chest pain, syncope, or radiating discomfort reported.',
  },
  conditions: {
    hasConditions: true,
    list: [
      {
        id: 'cond-1',
        name: 'Essential Hypertension',
        diagnosedYear: '2021',
        status: 'Managed',
      },
    ],
    notes: 'Well-controlled on single low-dose ACE inhibitor. Blood pressure consistently around 124/78 mmHg.',
  },
  medications: {
    takingMedications: true,
    list: [
      {
        id: 'med-1',
        name: 'Lisinopril',
        dosage: '10 mg',
        frequency: 'Once daily (morning)',
        purpose: 'Blood pressure maintenance',
      },
      {
        id: 'med-2',
        name: 'CoQ10 / Ubiquinol',
        dosage: '100 mg',
        frequency: 'Once daily',
        purpose: 'Cardiovascular supplement',
      },
    ],
    notes: 'Good adherence. Patient takes morning medications with food.',
  },
  allergies: {
    hasAllergies: true,
    list: [
      {
        id: 'all-1',
        allergen: 'Penicillin',
        type: 'Medication',
        severity: 'Moderate',
      },
    ],
    notes: 'Developed cutaneous hives during childhood treatment. No anaphylactic shock.',
  },
  procedures: {
    hadProcedures: false,
    list: [],
    notes: 'No major cardiovascular interventions or invasive surgeries to date.',
  },
  familyHistory: {
    hasHistory: true,
    list: [
      {
        id: 'fam-1',
        condition: 'Coronary Artery Disease',
        relation: 'Father (diagnosed at age 62)',
      },
      {
        id: 'fam-2',
        condition: 'Hypertension',
        relation: 'Mother (diagnosed at age 58)',
      },
    ],
    notes: 'Family history of late-onset CAD; motivates proactive preventive rhythm screening.',
  },
  lifestyle: {
    smoking: 'Never',
    alcohol: 'Occasional',
    physicalActivity: 'Moderate',
    sleepHours: 7,
    stressLevel: 'Moderate',
    notes: 'Brisk walking 3-4 days/week. 1-2 units of red wine on weekends.',
  },
  previousTests: {
    hasPreviousTests: false, // Not completed yet in questionnaire, keeping it at 60% baseline!
    list: [],
    notes: '',
  },
  completionPercentage: 60,
  lastUpdated: '2026-09-04T18:30:00Z',
};

export const DEFAULT_MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: 'rec-1',
    title: 'Blood Test (Comprehensive Metabolic & Lipid Panel)',
    category: 'blood-test',
    categoryLabel: 'Blood Test',
    uploadDate: '05 Sep 2026',
    fileType: 'PDF',
    fileSize: '1.2 MB',
    fileName: 'Quest_Diagnostics_Metabolic_Lipid_Panel_092026.pdf',
    status: 'ready',
    facility: 'Quest Diagnostics Regional Lab',
    notes: 'Fasting glucose 92 mg/dL, Total Cholesterol 188 mg/dL, eGFR > 90.',
    extractedSummary: 'AI document parsing and automated clinical extraction are queued for upcoming cloud processing modules. Raw file is securely retained in your patient profile.',
  },
  {
    id: 'rec-2',
    title: 'ECG Report (12-Lead Resting Telemetry Baseline)',
    category: 'ecg',
    categoryLabel: 'ECG Report',
    uploadDate: '28 Aug 2026',
    fileType: 'PDF',
    fileSize: '2.4 MB',
    fileName: 'Metro_Cardio_12Lead_ECG_Resting_Baseline.pdf',
    status: 'ready',
    facility: 'Metro Heart Institute',
    notes: 'Resting sinus rhythm at 68 bpm. PR 156ms, QRS 88ms, QTc 418ms. Normal axis.',
    extractedSummary: 'AI document parsing and automated clinical extraction are queued for upcoming cloud processing modules. Raw file is securely retained in your patient profile.',
  },
  {
    id: 'rec-3',
    title: 'MRI Report (Cardiac Functional Baseline)',
    category: 'mri',
    categoryLabel: 'MRI Report',
    uploadDate: '14 Aug 2026',
    fileType: 'PDF',
    fileSize: '4.1 MB',
    fileName: 'St_Jude_Cardiac_MRI_Cine_Report.pdf',
    status: 'ready',
    facility: 'St. Jude Advanced Diagnostic Center',
    notes: 'Normal left ventricular chamber volume and systolic ejection fraction (EF 62%). No late gadolinium enhancement.',
    extractedSummary: 'AI document parsing and automated clinical extraction are queued for upcoming cloud processing modules. Raw file is securely retained in your patient profile.',
  },
];

export function calculateCompletion(profile: PatientHealthProfile): number {
  let score = 0;
  const totalSections = 8;

  // 1. Symptoms
  if (profile.symptoms && (profile.symptoms.list.length > 0 || profile.symptoms.hasSymptoms === false)) {
    score += 1;
  }
  // 2. Conditions
  if (profile.conditions && (profile.conditions.list.length > 0 || profile.conditions.hasConditions === false)) {
    score += 1;
  }
  // 3. Medications
  if (profile.medications && (profile.medications.list.length > 0 || profile.medications.takingMedications === false)) {
    score += 1;
  }
  // 4. Allergies
  if (profile.allergies && (profile.allergies.list.length > 0 || profile.allergies.hasAllergies === false)) {
    score += 1;
  }
  // 5. Procedures
  if (profile.procedures && (profile.procedures.list.length > 0 || profile.procedures.hadProcedures === false)) {
    score += 1;
  }
  // 6. Family History
  if (profile.familyHistory && (profile.familyHistory.list.length > 0 || profile.familyHistory.hasHistory === false)) {
    score += 1;
  }
  // 7. Lifestyle
  if (
    profile.lifestyle &&
    profile.lifestyle.smoking !== 'Not provided' &&
    profile.lifestyle.physicalActivity !== 'Not provided'
  ) {
    score += 1;
  }
  // 8. Previous Tests
  if (profile.previousTests && (profile.previousTests.list.length > 0 || profile.previousTests.hasPreviousTests === false)) {
    score += 1;
  }

  // Round to nearest 5%
  const percentage = Math.round((score / totalSections) * 100);
  return percentage;
}

export function useHealthInformation() {
  const [healthProfile, setHealthProfile] = useState<PatientHealthProfile>(() => {
    try {
      const stored = localStorage.getItem(HEALTH_PROFILE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse health profile from localStorage', e);
    }
    return DEFAULT_HEALTH_PROFILE;
  });

  const [records, setRecords] = useState<MedicalRecord[]>(() => {
    try {
      const stored = localStorage.getItem(MEDICAL_RECORDS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse medical records from localStorage', e);
    }
    return DEFAULT_MEDICAL_RECORDS;
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(HEALTH_PROFILE_STORAGE_KEY, JSON.stringify(healthProfile));
    } catch (e) {
      console.warn('Failed to save health profile', e);
    }
  }, [healthProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(MEDICAL_RECORDS_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save medical records', e);
    }
  }, [records]);

  // Update whole profile or partial
  const updateHealthProfile = useCallback((updates: Partial<PatientHealthProfile>) => {
    setHealthProfile((prev) => {
      const updated = {
        ...prev,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      updated.completionPercentage = calculateCompletion(updated);
      return updated;
    });
  }, []);

  // Update a specific section
  const updateSection = useCallback(
    <K extends HealthInfoSectionKey>(key: K, data: PatientHealthProfile[K]) => {
      setHealthProfile((prev) => {
        const updated = {
          ...prev,
          [key]: data,
          lastUpdated: new Date().toISOString(),
        };
        updated.completionPercentage = calculateCompletion(updated);
        return updated;
      });
    },
    []
  );

  // Add a medical record
  const addMedicalRecord = useCallback(
    (
      record: Omit<MedicalRecord, 'id' | 'uploadDate'>,
      _file?: File
    ): MedicalRecord => {
      const newRecord: MedicalRecord = {
        ...record,
        id: `rec-${Date.now()}`,
        uploadDate: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };

      setRecords((prev) => [newRecord, ...prev]);
      return newRecord;
    },
    []
  );

  // Rename a medical record
  const renameMedicalRecord = useCallback((id: string, newTitle: string) => {
    setRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, title: newTitle.trim() } : rec))
    );
  }, []);

  // Delete a medical record
  const deleteMedicalRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((rec) => rec.id !== id));
  }, []);

  // Reset to default baseline data
  const resetToBaseline = useCallback(() => {
    setHealthProfile(DEFAULT_HEALTH_PROFILE);
    setRecords(DEFAULT_MEDICAL_RECORDS);
    localStorage.removeItem(HEALTH_PROFILE_STORAGE_KEY);
    localStorage.removeItem(MEDICAL_RECORDS_STORAGE_KEY);
  }, []);

  // High-level concise context summary for Dr. Radar analysis integration
  const contextSummary: HealthContextSummary = useMemo(() => {
    const hasSymp = healthProfile.symptoms?.list?.length > 0;
    const hasCond = healthProfile.conditions?.list?.length > 0;
    const hasMed = healthProfile.medications?.list?.length > 0;
    const hasAll = healthProfile.allergies?.list?.length > 0;

    return {
      symptomsSummary: hasSymp
        ? healthProfile.symptoms.list.join(', ')
        : 'No active symptoms reported',
      conditionsSummary: hasCond
        ? healthProfile.conditions.list.map((c) => c.name).join(', ')
        : 'No chronic conditions recorded',
      medicationsSummary: hasMed
        ? healthProfile.medications.list.map((m) => `${m.name} (${m.dosage || 'standard'})`).join(', ')
        : 'No regular medications',
      allergiesSummary: hasAll
        ? healthProfile.allergies.list.map((a) => `${a.allergen} (${a.type})`).join(', ')
        : 'No known allergies',
      lifestyleSummary: `${healthProfile.lifestyle?.smoking || 'Non-smoker'}, ${healthProfile.lifestyle?.physicalActivity || 'Moderate'} activity`,
      recordsCount: records.length,
      isAvailable: hasSymp || hasCond || hasMed || records.length > 0,
      completionPercentage: healthProfile.completionPercentage,
    };
  }, [healthProfile, records]);

  return {
    healthProfile,
    records,
    updateHealthProfile,
    updateSection,
    addMedicalRecord,
    renameMedicalRecord,
    deleteMedicalRecord,
    resetToBaseline,
    contextSummary,
  };
}
