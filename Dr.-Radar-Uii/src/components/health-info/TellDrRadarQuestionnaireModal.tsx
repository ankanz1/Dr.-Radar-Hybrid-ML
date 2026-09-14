import React, { useState } from 'react';
import { PatientHealthProfile, SymptomsInfo, ConditionItem, MedicationItem, AllergyItem } from '../../types/healthInfo';

interface TellDrRadarQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: PatientHealthProfile;
  onSaveProfile: (profile: PatientHealthProfile) => void;
  onOpenPrivacy?: () => void;
}

export const TellDrRadarQuestionnaireModal: React.FC<TellDrRadarQuestionnaireModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSaveProfile,
  onOpenPrivacy,
}) => {
  // Step tracker (1 to 8, plus 9 for summary)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 8;

  // Local working state
  const [primaryGoal, setPrimaryGoal] = useState<PatientHealthProfile['primaryGoal']>(
    currentProfile.primaryGoal || 'monitor'
  );

  // Symptoms State
  const [hasSymptoms, setHasSymptoms] = useState<boolean>(currentProfile.symptoms?.hasSymptoms ?? false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(
    currentProfile.symptoms?.list || []
  );
  const [symptomOnset, setSymptomOnset] = useState<string>(currentProfile.symptoms?.onset || '');
  const [symptomFrequency, setSymptomFrequency] = useState<string>(currentProfile.symptoms?.frequency || '');
  const [symptomSeverity, setSymptomSeverity] = useState<SymptomsInfo['severity']>(
    currentProfile.symptoms?.severity || 'Mild'
  );
  const [symptomTriggers, setSymptomTriggers] = useState<string>(currentProfile.symptoms?.triggers || '');
  const [symptomAlleviators, setSymptomAlleviators] = useState<string>(currentProfile.symptoms?.alleviators || '');

  // Conditions State
  const [hasConditions, setHasConditions] = useState<boolean>(currentProfile.conditions?.hasConditions ?? false);
  const [conditionsList, setConditionsList] = useState<ConditionItem[]>(
    currentProfile.conditions?.list || []
  );
  const [newConditionName, setNewConditionName] = useState('');

  // Medications State
  const [takingMedications, setTakingMedications] = useState<boolean>(
    currentProfile.medications?.takingMedications ?? false
  );
  const [medicationsList, setMedicationsList] = useState<MedicationItem[]>(
    currentProfile.medications?.list || []
  );
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');

  // Allergies State
  const [hasAllergies, setHasAllergies] = useState<boolean>(currentProfile.allergies?.hasAllergies ?? false);
  const [allergiesList, setAllergiesList] = useState<AllergyItem[]>(
    currentProfile.allergies?.list || []
  );
  const [newAllergen, setNewAllergen] = useState('');
  const [newAllergyType, setNewAllergyType] = useState<AllergyItem['type']>('Medication');

  // Family History State
  const [hasFamilyHistory, setHasFamilyHistory] = useState<boolean>(
    currentProfile.familyHistory?.hasHistory ?? false
  );
  const [familyConditions, setFamilyConditions] = useState<{ condition: string; relation: string }[]>(
    currentProfile.familyHistory?.list || []
  );
  const [newFamCondition, setNewFamCondition] = useState('');
  const [newFamRelation, setNewFamRelation] = useState('');

  // Lifestyle State
  const [smoking, setSmoking] = useState<PatientHealthProfile['lifestyle']['smoking']>(
    currentProfile.lifestyle?.smoking || 'Never'
  );
  const [alcohol, setAlcohol] = useState<PatientHealthProfile['lifestyle']['alcohol']>(
    currentProfile.lifestyle?.alcohol || 'Occasional'
  );
  const [physicalActivity, setPhysicalActivity] = useState<PatientHealthProfile['lifestyle']['physicalActivity']>(
    currentProfile.lifestyle?.physicalActivity || 'Moderate'
  );
  const [sleepHours, setSleepHours] = useState<number>(currentProfile.lifestyle?.sleepHours || 7);

  // Previous Tests State
  const [hasPreviousTests, setHasPreviousTests] = useState<boolean>(
    currentProfile.previousTests?.hasPreviousTests ?? false
  );
  const [previousTestsList, setPreviousTestsList] = useState(
    currentProfile.previousTests?.list || []
  );
  const [newTestType, setNewTestType] = useState('');
  const [newTestDate, setNewTestDate] = useState('');
  const [newTestFinding, setNewTestFinding] = useState('');

  // Save changes and compile final profile
  const handleFinalSave = () => {
    const updated: PatientHealthProfile = {
      ...currentProfile,
      primaryGoal,
      symptoms: {
        hasSymptoms,
        list: hasSymptoms ? selectedSymptoms : [],
        onset: hasSymptoms ? symptomOnset : undefined,
        frequency: hasSymptoms ? symptomFrequency : undefined,
        severity: hasSymptoms ? symptomSeverity : undefined,
        triggers: hasSymptoms ? symptomTriggers : undefined,
        alleviators: hasSymptoms ? symptomAlleviators : undefined,
        notes: hasSymptoms && selectedSymptoms.length > 0 ? `Reported: ${selectedSymptoms.join(', ')}` : 'No active symptoms reported',
      },
      conditions: {
        hasConditions,
        list: hasConditions ? conditionsList : [],
        notes: hasConditions ? `${conditionsList.length} condition(s) recorded` : 'No chronic conditions',
      },
      medications: {
        takingMedications,
        list: takingMedications ? medicationsList : [],
        notes: takingMedications ? `${medicationsList.length} medication(s) reported` : 'No regular medications',
      },
      allergies: {
        hasAllergies,
        list: hasAllergies ? allergiesList : [],
        notes: hasAllergies ? `${allergiesList.length} allergy item(s) logged` : 'No known allergies',
      },
      procedures: currentProfile.procedures || { hadProcedures: false, list: [] },
      familyHistory: {
        hasHistory: hasFamilyHistory,
        list: hasFamilyHistory ? familyConditions.map((c, i) => ({ id: `fam-${i}`, ...c })) : [],
      },
      lifestyle: {
        smoking,
        alcohol,
        physicalActivity,
        sleepHours,
        stressLevel: 'Moderate',
      },
      previousTests: {
        hasPreviousTests,
        list: hasPreviousTests ? previousTestsList : [],
      },
      completionPercentage: 85, // Updated post-questionnaire
      lastUpdated: new Date().toISOString(),
    };

    onSaveProfile(updated);
    onClose();
  };

  if (!isOpen) return null;

  // Emergency symptoms check
  const hasUrgentSymptoms =
    hasSymptoms &&
    (selectedSymptoms.includes('Severe chest discomfort / pressure') ||
      selectedSymptoms.includes('Sudden severe shortness of breath') ||
      symptomSeverity === 'Severe' ||
      symptomSeverity === 'Acute');

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  onClose();
                }
              }}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
                  TELL DR. RADAR
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {currentStep <= totalSteps ? `Question ${currentStep} of ${totalSteps}` : 'Review & Summary'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#101c28]">
                {currentStep <= totalSteps ? 'Conversational Health Intake' : 'Health Information Updated'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="Exit and save for later"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Progress Line */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-[#bc000a] h-1.5 transition-all duration-300"
            style={{ width: `${currentStep <= totalSteps ? progressPercent : 100}%` }}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Dr. Radar conversational prompt bubble */}
          {currentStep <= totalSteps && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#f8fbfe] border border-blue-100">
              <div className="w-9 h-9 rounded-xl bg-[#bc000a] text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <span className="font-bold text-[#101c28] block">Dr. Radar Guide</span>
                <p className="text-slate-600 leading-relaxed">
                  {currentStep === 1 && "Let's understand your health a little better. What brings you to Dr. Radar today?"}
                  {currentStep === 2 && "Are you currently experiencing any physical symptoms or heart sensations?"}
                  {currentStep === 3 && "Do you have any diagnosed medical conditions or existing diagnoses?"}
                  {currentStep === 4 && "Are you currently taking any prescription medications, inhalers, or daily supplements?"}
                  {currentStep === 5 && "Do you have any known allergies to medications, foods, or environmental factors?"}
                  {currentStep === 6 && "Does your immediate family have a history of cardiovascular disease or related conditions?"}
                  {currentStep === 7 && "Let's touch on your general routine, sleep, and physical activity levels."}
                  {currentStep === 8 && "Have you completed previous diagnostic tests such as ECGs, blood tests, or imaging?"}
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: What brings you to Dr. Radar */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Select your primary objective:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'routine', label: 'Routine health check', icon: 'stethoscope', desc: 'Periodic wellness baseline and check-in' },
                  { id: 'symptoms', label: 'I have symptoms', icon: 'vital_signs', desc: 'Heart flutter, shortness of breath, or fatigue' },
                  { id: 'understand-report', label: 'I want to understand a report', icon: 'description', desc: 'Decipher an ECG, blood test, or imaging' },
                  { id: 'monitor', label: 'I want to monitor my health', icon: 'trending_up', desc: 'Continuous preventive tracking & bio-patch' },
                  { id: 'other', label: 'Other clinical objective', icon: 'more_horiz', desc: 'General exploration or physician referral' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrimaryGoal(opt.id as any)}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      primaryGoal === opt.id
                        ? 'bg-[#fff8f8] border-[#bc000a] ring-2 ring-[#bc000a]/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`material-symbols-outlined text-[22px] ${primaryGoal === opt.id ? 'text-[#bc000a]' : 'text-slate-500'}`}>
                        {opt.icon}
                      </span>
                      {primaryGoal === opt.id && (
                        <span className="material-symbols-outlined text-[18px] text-[#bc000a]">check_circle</span>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#101c28] block">{opt.label}</span>
                      <span className="text-xs text-slate-500 mt-0.5 block">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Current Symptoms */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHasSymptoms(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !hasSymptoms
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  No active symptoms (feeling normal)
                </button>
                <button
                  type="button"
                  onClick={() => setHasSymptoms(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    hasSymptoms
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  I am experiencing symptoms
                </button>
              </div>

              {hasSymptoms && (
                <div className="space-y-4 pt-2 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      Which symptoms are present? (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Occasional mild palpitations',
                        'Rapid or fluttering heart rate',
                        'Skipped beats feeling',
                        'Chest discomfort / pressure',
                        'Severe chest discomfort / pressure',
                        'Shortness of breath on exertion',
                        'Sudden severe shortness of breath',
                        'Lightheadedness or dizziness',
                        'Unusual fatigue or exhaustion',
                        'Swelling in legs/ankles',
                      ].map((sym) => {
                        const isSelected = selectedSymptoms.includes(sym);
                        const isSevereFlag = sym.includes('Severe');
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
                              } else {
                                setSelectedSymptoms([...selectedSymptoms, sym]);
                              }
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? isSevereFlag
                                  ? 'bg-red-600 text-white border-red-700 shadow-xs'
                                  : 'bg-[#bc000a] text-white border-[#bc000a] shadow-xs'
                                : isSevereFlag
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>{sym}</span>
                            {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Urgent Symptoms Alert */}
                  {hasUrgentSymptoms && (
                    <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-400 text-red-950 space-y-2 animate-in shake">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                        <span className="material-symbols-outlined text-[22px] text-red-600">emergency</span>
                        <span>IMPORTANT MEDICAL NOTICE</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        You have selected severe symptoms (such as severe chest discomfort or acute shortness of breath).
                        <strong> Please seek immediate emergency medical care</strong> by calling your local emergency number (e.g., 911)
                        or visiting the nearest emergency department. Do not rely on screening apps for acute emergencies.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">When did they start?</label>
                      <input
                        type="text"
                        placeholder="e.g. 2 months ago, or yesterday"
                        value={symptomOnset}
                        onChange={(e) => setSymptomOnset(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">How often do they occur?</label>
                      <input
                        type="text"
                        placeholder="e.g. 1-2 times weekly, after coffee"
                        value={symptomFrequency}
                        onChange={(e) => setSymptomFrequency(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Severity</label>
                    <div className="flex gap-2">
                      {(['Mild', 'Moderate', 'Severe'] as const).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setSymptomSeverity(sev)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                            symptomSeverity === sev
                              ? 'bg-[#bc000a] text-white border-[#bc000a]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Existing Conditions */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasConditions(false);
                    setConditionsList([]);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !hasConditions
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  No diagnosed chronic conditions
                </button>
                <button
                  type="button"
                  onClick={() => setHasConditions(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    hasConditions
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  I have existing conditions
                </button>
              </div>

              {hasConditions && (
                <div className="space-y-4 pt-2 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      Common conditions (Tap to toggle):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Essential Hypertension',
                        'Type 2 Diabetes',
                        'Atrial Fibrillation / Arrhythmia',
                        'High Cholesterol (Hyperlipidemia)',
                        'Coronary Artery Disease',
                        'Asthma / COPD',
                        'Thyroid Disorder',
                      ].map((cond) => {
                        const existing = conditionsList.find((c) => c.name === cond);
                        return (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => {
                              if (existing) {
                                setConditionsList(conditionsList.filter((c) => c.name !== cond));
                              } else {
                                setConditionsList([
                                  ...conditionsList,
                                  { id: `c-${Date.now()}-${cond}`, name: cond, status: 'Managed' },
                                ]);
                              }
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                              existing
                                ? 'bg-[#bc000a] text-white border-[#bc000a] shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>{cond}</span>
                            {existing && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add custom condition */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add another condition..."
                      value={newConditionName}
                      onChange={(e) => setNewConditionName(e.target.value)}
                      className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newConditionName.trim()) {
                          setConditionsList([
                            ...conditionsList,
                            { id: `c-${Date.now()}`, name: newConditionName.trim(), status: 'Managed' },
                          ]);
                          setNewConditionName('');
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-black cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Medications */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTakingMedications(false);
                    setMedicationsList([]);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !takingMedications
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Not taking regular medications
                </button>
                <button
                  type="button"
                  onClick={() => setTakingMedications(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    takingMedications
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  I take medications
                </button>
              </div>

              {takingMedications && (
                <div className="space-y-3 pt-2 animate-in fade-in">
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                    <strong>Patient Safety Reminder:</strong> Dr. Radar never prescribes medications. Never start, stop, or change prescribed medications without direct consultation with your healthcare provider.
                  </div>

                  {/* Current list */}
                  {medicationsList.map((med, idx) => (
                    <div
                      key={med.id || idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#101c28] block">{med.name}</span>
                        <span className="text-slate-500">
                          {med.dosage ? `${med.dosage} • ` : ''}
                          {med.frequency || 'Daily'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedicationsList(medicationsList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}

                  {/* Add medication */}
                  <div className="p-3 rounded-xl border border-slate-200 space-y-2 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block">Add Medication</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Medication name (e.g. Lisinopril)"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Dose (e.g. 10 mg)"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Frequency (e.g. Once daily)"
                        value={newMedFreq}
                        onChange={(e) => setNewMedFreq(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newMedName.trim()) {
                          setMedicationsList([
                            ...medicationsList,
                            {
                              id: `m-${Date.now()}`,
                              name: newMedName.trim(),
                              dosage: newMedDosage.trim() || undefined,
                              frequency: newMedFreq.trim() || 'Once daily',
                            },
                          ]);
                          setNewMedName('');
                          setNewMedDosage('');
                          setNewMedFreq('');
                        }
                      }}
                      className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-black cursor-pointer"
                    >
                      + Add to Medication List
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Allergies */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasAllergies(false);
                    setAllergiesList([]);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !hasAllergies
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  No known allergies (NKDA)
                </button>
                <button
                  type="button"
                  onClick={() => setHasAllergies(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    hasAllergies
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  I have allergies
                </button>
              </div>

              {hasAllergies && (
                <div className="space-y-3 pt-2 animate-in fade-in">
                  {allergiesList.map((all, idx) => (
                    <div
                      key={all.id || idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#101c28] block">{all.allergen}</span>
                        <span className="text-slate-500">{all.type} • {all.severity}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllergiesList(allergiesList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Allergen name (e.g. Penicillin, Peanuts)"
                      value={newAllergen}
                      onChange={(e) => setNewAllergen(e.target.value)}
                      className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200"
                    />
                    <select
                      value={newAllergyType}
                      onChange={(e) => setNewAllergyType(e.target.value as any)}
                      className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="Medication">Medication</option>
                      <option value="Food">Food</option>
                      <option value="Environmental">Environmental</option>
                      <option value="Other">Other</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (newAllergen.trim()) {
                          setAllergiesList([
                            ...allergiesList,
                            {
                              id: `a-${Date.now()}`,
                              allergen: newAllergen.trim(),
                              type: newAllergyType,
                              severity: 'Moderate',
                            },
                          ]);
                          setNewAllergen('');
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-black cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Family History */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasFamilyHistory(false);
                    setFamilyConditions([]);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !hasFamilyHistory
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  No known cardiac family history
                </button>
                <button
                  type="button"
                  onClick={() => setHasFamilyHistory(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    hasFamilyHistory
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Family history present
                </button>
              </div>

              {hasFamilyHistory && (
                <div className="space-y-3 pt-2 animate-in fade-in">
                  {familyConditions.map((fam, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#101c28] block">{fam.condition}</span>
                        <span className="text-slate-500">{fam.relation}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFamilyConditions(familyConditions.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Condition (e.g. Coronary Artery Disease)"
                      value={newFamCondition}
                      onChange={(e) => setNewFamCondition(e.target.value)}
                      className="text-xs p-2.5 rounded-xl border border-slate-200"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Relative (e.g. Father, Mother)"
                        value={newFamRelation}
                        onChange={(e) => setNewFamRelation(e.target.value)}
                        className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newFamCondition.trim()) {
                            setFamilyConditions([
                              ...familyConditions,
                              {
                                condition: newFamCondition.trim(),
                                relation: newFamRelation.trim() || 'Immediate family',
                              },
                            ]);
                            setNewFamCondition('');
                            setNewFamRelation('');
                          }
                        }}
                        className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-black cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Lifestyle */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Smoking / Tobacco History</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Never', 'Former', 'Current'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSmoking(opt)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        smoking === opt
                          ? 'bg-[#bc000a] text-white border-[#bc000a]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Alcohol Consumption</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['None', 'Occasional', 'Moderate', 'Heavy'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAlcohol(opt)}
                      className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                        alcohol === opt
                          ? 'bg-[#bc000a] text-white border-[#bc000a]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Weekly Physical Activity</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPhysicalActivity(opt)}
                      className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                        physicalActivity === opt
                          ? 'bg-[#bc000a] text-white border-[#bc000a]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Average Nightly Sleep: {sleepHours} hours
                </label>
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full accent-[#bc000a]"
                />
              </div>
            </div>
          )}

          {/* STEP 8: Previous Tests */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasPreviousTests(false);
                    setPreviousTestsList([]);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    !hasPreviousTests
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  No previous tests recorded
                </button>
                <button
                  type="button"
                  onClick={() => setHasPreviousTests(true)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    hasPreviousTests
                      ? 'bg-[#ffe8e8] border-[#bc000a] text-[#bc000a] ring-2 ring-[#bc000a]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  I have previous reports
                </button>
              </div>

              {hasPreviousTests && (
                <div className="space-y-3 pt-2 animate-in fade-in">
                  {previousTestsList.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#101c28] block">{t.type}</span>
                        <span className="text-slate-500">{t.date} • {t.keyFinding || 'Normal'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviousTestsList(previousTestsList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}

                  <div className="p-3 rounded-xl border border-slate-200 space-y-2 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block">Add Prior Test</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Test Type (e.g. 12-Lead ECG)"
                        value={newTestType}
                        onChange={(e) => setNewTestType(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Date (e.g. Aug 2025)"
                        value={newTestDate}
                        onChange={(e) => setNewTestDate(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Key Finding (e.g. Normal sinus)"
                        value={newTestFinding}
                        onChange={(e) => setNewTestFinding(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-slate-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTestType.trim()) {
                          setPreviousTestsList([
                            ...previousTestsList,
                            {
                              id: `pt-${Date.now()}`,
                              type: newTestType.trim(),
                              date: newTestDate.trim() || 'Recent',
                              keyFinding: newTestFinding.trim() || 'Reviewed',
                            },
                          ]);
                          setNewTestType('');
                          setNewTestDate('');
                          setNewTestFinding('');
                        }
                      }}
                      className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-black cursor-pointer"
                    >
                      + Add Prior Test
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUMMARY STEP (Step 9) */}
          {currentStep > totalSteps && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-emerald-600">check_circle</span>
                <div>
                  <span className="font-bold text-sm text-emerald-900 block">Health Information Completed</span>
                  <p className="text-xs text-emerald-700">
                    Your answers will help Dr. Radar understand your baseline and contextualize upcoming analyses.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs bg-white">
                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Primary Focus</span>
                    <span className="text-slate-500 capitalize">{primaryGoal}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Symptoms</span>
                    <span className="text-slate-500">
                      {hasSymptoms && selectedSymptoms.length > 0
                        ? selectedSymptoms.join(', ')
                        : 'No active symptoms'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Existing Conditions</span>
                    <span className="text-slate-500">
                      {hasConditions && conditionsList.length > 0
                        ? conditionsList.map((c) => c.name).join(', ')
                        : 'None reported'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Medications</span>
                    <span className="text-slate-500">
                      {takingMedications && medicationsList.length > 0
                        ? medicationsList.map((m) => m.name).join(', ')
                        : 'None reported'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Allergies</span>
                    <span className="text-slate-500">
                      {hasAllergies && allergiesList.length > 0
                        ? allergiesList.map((a) => a.allergen).join(', ')
                        : 'No known allergies'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 block">Lifestyle Factors</span>
                    <span className="text-slate-500">
                      Tobacco: {smoking} • Exercise: {physicalActivity} • Sleep: {sleepHours}h
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(7)}
                    className="text-[#bc000a] font-semibold text-xs cursor-pointer hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          {currentStep <= totalSteps ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(totalSteps + 1, prev + 1))}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Skip Question
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Save & Exit Later
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-5 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(totalSteps)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Back to Questions
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                className="px-6 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Save Information</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
