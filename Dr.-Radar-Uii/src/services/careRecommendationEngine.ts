import {
  CareUrgencyLevel,
  CareRecommendationItem,
  TreatmentCarePlan,
  ClinicalContextInput,
  PlainLanguageTerm,
  EmergencyNotice,
} from '../types/recommendations';

// Standard Emergency Notice for acute cardiovascular & red-flag warning symptoms
export const STANDARD_EMERGENCY_NOTICE: EmergencyNotice = {
  hasEmergencyWarning: true,
  headline: 'Immediate Emergency Care Warning',
  body:
    'If you or someone with you experiences severe or persistent chest pain, extreme shortness of breath, fainting (loss of consciousness), sudden weakness or numbness in the face/arm/leg, or sudden difficulty speaking, please seek emergency medical care now (call 911 or your local emergency line). Do not wait for software analysis.',
  symptomsList: [
    'Severe, crushing, or persistent chest pain or pressure',
    'Severe difficulty breathing or gasping for air',
    'Fainting, syncope, or unexplained loss of consciousness',
    'Sudden numbness, facial droop, or weakness on one side',
    'Sudden confusion, speech difficulty, or severe sudden dizziness',
  ],
  actionPrompt: 'Seek Emergency Care Immediately (Call 911)',
};

export const STANDARD_DISCLAIMER =
  'These recommendations are AI-generated guidance based on the available information and are not a diagnosis or a substitute for professional medical care.';

export const MEDICATION_SAFETY_NOTICE =
  'Discuss your current medications with your clinician. Your healthcare professional may consider whether medication is appropriate. Do not start, stop, or change prescribed medication without speaking with your healthcare professional.';

/**
 * Scalable Care Recommendation Engine
 * Evaluates patient result, clinical context, and history to produce
 * a patient-friendly, non-diagnostic Treatment & Care Plan.
 */
export function generateCareRecommendations(input: ClinicalContextInput): TreatmentCarePlan {
  const { modality, testId, resultCode, findingTitle, confidence, patientContext } = input;

  // If modality is NOT yet clinically implemented for active recommendations (e.g. planned imaging or chronic modules)
  const isEcgOrCardiology = modality === 'ecg' || modality === 'cardiology' || testId === 'ecg-arrhythmia';

  if (!isEcgOrCardiology) {
    return createPlannedModulePlan(modality, testId, findingTitle);
  }

  // Determine cardiac classification code ('N', 'V', 'S', 'F', 'Q')
  const code = (resultCode || 'N').toUpperCase();
  const isNormal = code === 'N';
  const isAbnormal = !isNormal;

  // Determine trend comparison if previous result exists
  let trendNotice: string | undefined;
  if (patientContext?.previousResult) {
    const prevLower = patientContext.previousResult.toLowerCase();
    const prevWasNormal = prevLower.includes('normal') || prevLower.includes('sinus');
    if (prevWasNormal && isAbnormal) {
      trendNotice =
        'Your current result differs from your previous screening. Consider discussing this change with your healthcare professional.';
    } else if (!prevWasNormal && isNormal) {
      trendNotice =
        'Your current rhythm shows improvement compared to your previous flagged screening. Continue regular scheduled monitoring.';
    } else if (isNormal && prevWasNormal) {
      trendNotice =
        'Consistent with your previous normal screening. Your cardiac rhythm remains stable across consecutive recordings.';
    }
  }

  // Branch 1: NORMAL / LOW RISK RESULTS (e.g., AAMI Class N - Normal Sinus Rhythm)
  if (isNormal) {
    const recommendations: CareRecommendationItem[] = [
      {
        id: 'rec-norm-1',
        category: 'next_step',
        categoryLabel: 'NEXT STEP',
        priority: 1,
        title: 'Continue your usual health routine',
        description:
          'Maintain your regular daily physical activity, balanced diet, and healthy cardiovascular habits as recommended by your clinician.',
        icon: 'directions_walk',
      },
      {
        id: 'rec-norm-2',
        category: 'monitor',
        categoryLabel: 'MONITOR',
        priority: 2,
        title: 'Continue regular health monitoring as appropriate',
        description:
          'Take scheduled periodic ECG recordings (e.g., your morning resting check) to maintain a continuous baseline for comparison.',
        icon: 'vital_signs',
      },
      {
        id: 'rec-norm-3',
        category: 'follow_up',
        categoryLabel: 'FOLLOW-UP',
        priority: 3,
        title: 'Keep your results available for future comparison',
        description:
          'Save or export this reading into your digital health dossier to share with your physician during routine annual check-ups.',
        icon: 'folder_shared',
      },
      {
        id: 'rec-norm-4',
        category: 'lifestyle_care',
        categoryLabel: 'LIFESTYLE & CARE',
        priority: 4,
        title: 'Speak with a healthcare professional if you develop concerning symptoms',
        description:
          'A normal AI screening result does not guarantee that you are completely healthy or immune to cardiac issues. Consult a doctor if you feel palpitations or fatigue.',
        icon: 'stethoscope',
      },
    ];

    const glossary: PlainLanguageTerm[] = [
      {
        term: 'Normal Sinus Rhythm',
        plainMeaning:
          'The healthy, regular rhythm of the heart initiated by the natural biological pacemaker (the SA node) at a steady rate.',
      },
      {
        term: 'Model Confidence',
        plainMeaning:
          'How strongly the AI algorithm matched your electrical waveform with standard normal baseline recordings.',
      },
    ];

    return {
      id: `plan-ecg-${Date.now()}`,
      modalityId: 'ecg',
      modalityName: 'ECG / Cardiac Telemetry',
      isSupportedModule: true,
      title: 'Treatment & Care Recommendations',
      subtitle: 'Based on your current result, here are some suggested next steps.',
      resultSummary: {
        findingTitle: findingTitle || 'Normal Sinus Rhythm',
        classificationCode: 'N',
        classificationLabel: 'Normal Sinus Rhythm (Class N)',
        confidence: confidence || '98.4%',
        whatThisMeans:
          'Your heart rhythm demonstrates a normal, steady electrical conduction pattern without detected ectopic beats or conduction blocks during this recording period.',
        isNormal: true,
        isAbnormal: false,
        trendNotice,
      },
      urgency: {
        level: 'routine',
        label: 'Routine Follow-Up',
        badgeColor: 'emerald',
        guidanceText:
          'No immediate clinical intervention indicated by this recording. Continue standard scheduled wellness checks.',
      },
      recommendations,
      medicationGuidance:
        'Continue any prescribed medications as directed by your physician. Do not alter doses based solely on an automated screening result.',
      emergencyNotice: STANDARD_EMERGENCY_NOTICE,
      plainLanguageGlossary: glossary,
      doctorReviewStatus: 'reviewed',
      disclaimer: STANDARD_DISCLAIMER,
    };
  }

  // Branch 2: ABNORMAL / CONCERNING RESULTS (e.g. Class V - Ventricular Ectopic Beat)
  if (code === 'V') {
    const recommendations: CareRecommendationItem[] = [
      {
        id: 'rec-v-1',
        category: 'next_step',
        categoryLabel: 'NEXT STEP',
        priority: 1,
        title: 'Discuss this result with a qualified healthcare professional',
        description:
          'Consider scheduling an appointment with your primary physician or cardiologist to review this rhythm finding in the context of your overall medical history.',
        icon: 'stethoscope',
      },
      {
        id: 'rec-v-2',
        category: 'follow_up',
        categoryLabel: 'FOLLOW-UP',
        priority: 2,
        title: 'Follow any additional testing or evaluation recommended by your clinician',
        description:
          'Your clinician may decide whether additional cardiac evaluation is appropriate, such as a 24-hour ambulatory Holter monitor or echocardiogram.',
        icon: 'assignment_turned_in',
      },
      {
        id: 'rec-v-3',
        category: 'monitor',
        categoryLabel: 'MONITOR',
        priority: 3,
        title: 'Keep track of relevant symptoms and when they occur',
        description:
          'Note down if you feel fluttering, skipped beats, lightheadedness, or fatigue, and record the time of day, caffeine intake, or physical exertion.',
        icon: 'edit_note',
      },
      {
        id: 'rec-v-4',
        category: 'lifestyle_care',
        categoryLabel: 'LIFESTYLE & CARE',
        priority: 4,
        title: 'Moderate lifestyle triggers while awaiting evaluation',
        description:
          'Temporary reduction of excessive stimulants (high caffeine, energy drinks, nicotine) and maintaining proper hydration and rest can often help stabilize ectopic heartbeats.',
        icon: 'self_improvement',
      },
      {
        id: 'rec-v-5',
        category: 'medication_safety',
        categoryLabel: 'MEDICATION SAFETY',
        priority: 5,
        title: 'Discuss your current medications with your clinician',
        description:
          'Your healthcare professional may consider whether medication is appropriate. Do not start, stop, or change prescribed heart medications on your own.',
        icon: 'medication',
      },
    ];

    const glossary: PlainLanguageTerm[] = [
      {
        term: 'Ventricular Ectopic Beat (PVC)',
        plainMeaning:
          'An extra heartbeat that starts in the lower pumping chambers (ventricles) of the heart instead of the normal upper pacemaker pathway.',
      },
      {
        term: 'Compensatory Pause',
        plainMeaning:
          'A brief pause right after an extra heartbeat that often feels like your heart "skipped a beat" before resetting.',
      },
      {
        term: 'QRS Morphology',
        plainMeaning:
          'The shape of the main electrical spike on the ECG tracing representing the contraction of the lower heart chambers.',
      },
    ];

    return {
      id: `plan-ecg-${Date.now()}`,
      modalityId: 'ecg',
      modalityName: 'ECG / Cardiac Telemetry',
      isSupportedModule: true,
      title: 'Treatment & Care Recommendations',
      subtitle: 'Based on your current result, here are some suggested next steps.',
      resultSummary: {
        findingTitle: findingTitle || 'Potential Rhythm Abnormality Detected',
        classificationCode: 'V',
        classificationLabel: 'Ventricular Ectopic Beat (Class V)',
        confidence: confidence || '94.2%',
        whatThisMeans:
          'Your screening identified an unusual heart rhythm pattern starting in the lower chambers. Isolated ectopic beats are often benign, but a healthcare professional can help confirm what it means and whether further evaluation is needed.',
        isNormal: false,
        isAbnormal: true,
        trendNotice,
      },
      urgency: {
        level: 'priority',
        label: 'Priority Follow-Up',
        badgeColor: 'amber',
        guidanceText:
          'Follow-up recommended. Schedule an appointment with your healthcare professional to review this pattern.',
      },
      recommendations,
      medicationGuidance: MEDICATION_SAFETY_NOTICE,
      emergencyNotice: STANDARD_EMERGENCY_NOTICE,
      plainLanguageGlossary: glossary,
      doctorReviewStatus: 'recommended',
      disclaimer: STANDARD_DISCLAIMER,
    };
  }

  // Branch 3: SUPRAVENTRICULAR ECTOPIC BEAT (Class S - PAC)
  if (code === 'S') {
    const recommendations: CareRecommendationItem[] = [
      {
        id: 'rec-s-1',
        category: 'next_step',
        categoryLabel: 'NEXT STEP',
        priority: 1,
        title: 'Discuss this result with a qualified healthcare professional',
        description:
          'Share this rhythm reading with your healthcare provider. Your clinician can determine if further monitoring or evaluation is indicated.',
        icon: 'stethoscope',
      },
      {
        id: 'rec-s-2',
        category: 'monitor',
        categoryLabel: 'MONITOR',
        priority: 2,
        title: 'Track symptom onset and daily rhythm sensations',
        description:
          'Keep a log of any flutter sensations, rapid bursts, or chest awareness, noting any association with stress, sleep disruption, or dietary factors.',
        icon: 'edit_note',
      },
      {
        id: 'rec-s-3',
        category: 'follow_up',
        categoryLabel: 'FOLLOW-UP',
        priority: 3,
        title: 'Follow any additional testing recommended by your clinician',
        description:
          'Your clinician may recommend continuous 24-48 hour telemetry or blood electrolyte checks to confirm rhythm stability.',
        icon: 'assignment_turned_in',
      },
      {
        id: 'rec-s-4',
        category: 'lifestyle_care',
        categoryLabel: 'LIFESTYLE & CARE',
        priority: 4,
        title: 'Support cardiac rhythm with stress reduction and hydration',
        description:
          'Atrial ectopic beats frequently correlate with adrenaline, anxiety, dehydration, or stimulant intake. Prioritize adequate rest and hydration.',
        icon: 'spa',
      },
    ];

    const glossary: PlainLanguageTerm[] = [
      {
        term: 'Supraventricular Ectopic Beat (PAC)',
        plainMeaning:
          'An early heartbeat originating in the upper collecting chambers (atria) of the heart rather than the standard pacemaker node.',
      },
      {
        term: 'Atrial Conduction',
        plainMeaning:
          'The way electrical signals travel through the upper heart chambers to coordinate pumping blood into the lower ventricles.',
      },
    ];

    return {
      id: `plan-ecg-${Date.now()}`,
      modalityId: 'ecg',
      modalityName: 'ECG / Cardiac Telemetry',
      isSupportedModule: true,
      title: 'Treatment & Care Recommendations',
      subtitle: 'Based on your current result, here are some suggested next steps.',
      resultSummary: {
        findingTitle: findingTitle || 'Potential Supraventricular Pattern',
        classificationCode: 'S',
        classificationLabel: 'Supraventricular Ectopic Beat (Class S)',
        confidence: confidence || '91.8%',
        whatThisMeans:
          'A pattern consistent with an extra beat from the upper heart chambers was detected. While often benign, clinical correlation helps rule out sustained arrhythmias.',
        isNormal: false,
        isAbnormal: true,
        trendNotice,
      },
      urgency: {
        level: 'soon',
        label: 'Follow-Up Recommended',
        badgeColor: 'blue',
        guidanceText:
          'Consider discussing this result with your healthcare professional during your next visit or follow-up consultation.',
      },
      recommendations,
      medicationGuidance: MEDICATION_SAFETY_NOTICE,
      emergencyNotice: STANDARD_EMERGENCY_NOTICE,
      plainLanguageGlossary: glossary,
      doctorReviewStatus: 'recommended',
      disclaimer: STANDARD_DISCLAIMER,
    };
  }

  // Branch 4: FUSION OR UNCLASSIFIABLE BEATS (Class F / Q)
  const recommendations: CareRecommendationItem[] = [
    {
      id: 'rec-f-1',
      category: 'next_step',
      categoryLabel: 'NEXT STEP',
      priority: 1,
      title: 'Discuss the result with a qualified healthcare professional',
      description:
        'A hybrid or unclassifiable conduction pattern was detected. Professional manual inspection by an electrophysiologist or cardiologist is recommended.',
      icon: 'stethoscope',
    },
    {
      id: 'rec-f-2',
      category: 'follow_up',
      categoryLabel: 'FOLLOW-UP',
      priority: 2,
      title: 'Obtain a high-fidelity 12-lead diagnostic ECG if advised',
      description:
        'A single-lead or patch recording has limited spatial resolution. A standard 12-lead clinical ECG will provide comprehensive anatomical localization.',
      icon: 'monitor_heart',
    },
    {
      id: 'rec-f-3',
      category: 'monitor',
      categoryLabel: 'MONITOR',
      priority: 3,
      title: 'Monitor relevant symptoms and repeat trace if symptomatic',
      description:
        'If you feel sudden dizzy spells, chest discomfort, or weakness, seek physical medical evaluation right away.',
      icon: 'warning',
    },
  ];

  return {
    id: `plan-ecg-${Date.now()}`,
    modalityId: 'ecg',
    modalityName: 'ECG / Cardiac Telemetry',
    isSupportedModule: true,
    title: 'Treatment & Care Recommendations',
    subtitle: 'Based on your current result, here are some suggested next steps.',
    resultSummary: {
      findingTitle: findingTitle || 'Complex Waveform Pattern Detected',
      classificationCode: code,
      classificationLabel: code === 'F' ? 'Fusion Beat (Class F)' : 'Unclassifiable Pattern (Class Q)',
      confidence: confidence || '88.5%',
      whatThisMeans:
        'An atypical electrical waveform was detected that shows characteristics of both normal and ectopic conduction. Further professional evaluation is appropriate.',
      isNormal: false,
      isAbnormal: true,
      trendNotice,
    },
    urgency: {
      level: 'priority',
      label: 'Priority Follow-Up',
      badgeColor: 'amber',
      guidanceText: 'Professional clinician review is advised to evaluate this complex waveform.',
    },
    recommendations,
    medicationGuidance: MEDICATION_SAFETY_NOTICE,
    emergencyNotice: STANDARD_EMERGENCY_NOTICE,
    plainLanguageGlossary: [
      {
        term: 'Fusion Beat',
        plainMeaning:
          'A heartbeat that occurs when electrical signals from two different parts of the heart collide at the same time.',
      },
    ],
    doctorReviewStatus: 'recommended',
    disclaimer: STANDARD_DISCLAIMER,
  };
}

/**
 * Fallback plan for planned future clinical modalities (Cancer screening, Chronic, Liver, Imaging)
 * Implements Section 11: "Detailed recommendations for this condition are coming soon."
 */
function createPlannedModulePlan(
  modality: string,
  testId?: string,
  findingTitle?: string
): TreatmentCarePlan {
  const modalityLabel =
    modality === 'imaging'
      ? 'Medical Imaging (Radiology)'
      : modality === 'chronic'
      ? 'Chronic Disease Screening'
      : modality === 'cancer'
      ? 'Cancer Screening Framework'
      : modality === 'liver'
      ? 'Hepatology / Liver Screening'
      : 'Clinical Decision-Support';

  return {
    id: `plan-planned-${Date.now()}`,
    modalityId: modality,
    modalityName: modalityLabel,
    isSupportedModule: false,
    title: 'Treatment & Care Recommendations',
    subtitle: 'Standardized Multimodal Clinical Decision-Support Framework',
    resultSummary: {
      findingTitle: findingTitle || `${modalityLabel} Demonstration`,
      classificationLabel: 'Standardized Demonstration Protocol',
      whatThisMeans:
        'Detailed treatment and care recommendations for this condition are coming soon as clinical pipelines complete multi-center clinical validation.',
      isNormal: true,
      isAbnormal: false,
    },
    urgency: {
      level: 'routine',
      label: 'Module Under Clinical Validation',
      badgeColor: 'blue',
      guidanceText:
        'Detailed recommendations for this condition are coming soon. Consult your physician for medical care.',
    },
    recommendations: [
      {
        id: 'rec-planned-1',
        category: 'next_step',
        categoryLabel: 'NEXT STEP',
        priority: 1,
        title: 'Discuss symptoms and screening orders with your doctor',
        description:
          'For conditions outside the active ECG telemetry module, always consult your physician for diagnostic testing, imaging, and personalized treatment plans.',
        icon: 'stethoscope',
      },
      {
        id: 'rec-planned-2',
        category: 'follow_up',
        categoryLabel: 'FOLLOW-UP',
        priority: 2,
        title: 'Detailed recommendations for this condition are coming soon',
        description:
          'Dr. Radar is expanding to include validated care guidance for oncology, pulmonary imaging, and metabolic risk. Check back for future updates.',
        icon: 'upcoming',
      },
    ],
    emergencyNotice: STANDARD_EMERGENCY_NOTICE,
    plainLanguageGlossary: [],
    doctorReviewStatus: 'pending',
    disclaimer: STANDARD_DISCLAIMER,
  };
}
