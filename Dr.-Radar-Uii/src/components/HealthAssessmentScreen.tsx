import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../types';
import {
  PatientHealthProfile,
  HealthInfoSectionKey,
  SymptomsInfo,
  ConditionsInfo,
  MedicationsInfo,
  AllergiesInfo,
  ProceduresInfo,
  FamilyHistoryInfo,
  LifestyleInfo,
  PreviousTestsInfo,
  ConditionItem,
  MedicationItem,
  AllergyItem,
  ProcedureItem,
  FamilyHistoryItem,
} from '../types/healthInfo';
import { saveHealthAssessment, loadHealthAssessment } from '../services/healthProfileService';

/**
 * Journey step 2 — Health Assessment.
 *
 * A single-screen stepper over the EXISTING 8-section PatientHealthProfile
 * (types/healthInfo.ts). Nothing new is invented: the same shape used by
 * MyHealthInformationScreen / TellDrRadarQuestionnaireModal is persisted to
 * the EXISTING public.health_profiles table (migration 004 RLS).
 *
 * Sections map to the requested flow:
 *   A. Basic health information  -> lifestyle (smoking/activity/sleep/stress)
 *   B. Symptoms                  -> symptoms
 *   C. Medical history           -> conditions + procedures + familyHistory
 *   D. Current medications       -> medications + allergies
 *   E. Optional additional info  -> previousTests + notes
 */

interface HealthAssessmentScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  /** Locally-edited profile from useHealthInformation (pre-fill source). */
  draftProfile: PatientHealthProfile;
  /** Called after a successful save so App state stays in sync. */
  onProfileSaved: (profile: PatientHealthProfile) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const STEP_LABELS = [
  { title: 'About your lifestyle', hint: 'Daily habits that provide helpful context.' },
  { title: 'Symptoms', hint: 'Anything you have noticed recently.' },
  { title: 'Medical history', hint: 'Conditions, procedures, and family history.' },
  { title: 'Medications & allergies', hint: 'What you take and what to avoid.' },
  { title: 'Additional information', hint: 'Optional — previous tests or anything else.' },
];

const inputClass =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#bc000a]';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
        checked
          ? 'bg-[#bc000a] text-white border-[#bc000a]'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function TagListEditor<T>({
  items,
  onRemove,
  placeholderFor,
}: {
  items: T[];
  onRemove: (index: number) => void;
  placeholderFor: (item: T) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700"
        >
          {placeholderFor(item)}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-slate-400 hover:text-[#bc000a] cursor-pointer"
            aria-label="Remove"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </span>
      ))}
    </div>
  );
}

export const HealthAssessmentScreen: React.FC<HealthAssessmentScreenProps> = ({
  onNavigate,
  draftProfile,
  onProfileSaved,
  onShowToast,
}) => {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<PatientHealthProfile>(draftProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverSaved, setServerSaved] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // On mount: pre-fill from the server-saved assessment when one exists,
  // otherwise keep the local draft. Refresh-safe (state 13).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadHealthAssessment();
      if (cancelled) return;
      if (result.ok && result.assessment) {
        const a = result.assessment;
        setProfile((prev) => ({
          ...prev,
          primaryGoal: (a.primaryGoal as PatientHealthProfile['primaryGoal']) ?? prev.primaryGoal,
          goalDescription: a.goalDescription ?? prev.goalDescription,
          symptoms: (a.symptoms as SymptomsInfo) ?? prev.symptoms,
          conditions: (a.conditions as ConditionsInfo) ?? prev.conditions,
          medications: (a.medications as MedicationsInfo) ?? prev.medications,
          allergies: (a.allergies as AllergiesInfo) ?? prev.allergies,
          procedures: (a.procedures as ProceduresInfo) ?? prev.procedures,
          familyHistory: (a.familyHistory as FamilyHistoryInfo) ?? prev.familyHistory,
          lifestyle: (a.lifestyle as LifestyleInfo) ?? prev.lifestyle,
          previousTests: (a.previousTests as PreviousTestsInfo) ?? prev.previousTests,
          completionPercentage: a.completionPercentage || prev.completionPercentage,
        }));
        setServerSaved(true);
      } else if (result.ok && !result.assessment) {
        setServerSaved(false);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof PatientHealthProfile>(key: K, value: PatientHealthProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const isFinalStep = step === STEP_LABELS.length - 1;

  const completion = useMemo(() => {
    let score = 0;
    if (profile.lifestyle && profile.lifestyle.smoking !== 'Not provided') score += 1;
    if (profile.symptoms && (profile.symptoms.list.length > 0 || profile.symptoms.hasSymptoms === false)) score += 1;
    if (profile.conditions && (profile.conditions.list.length > 0 || profile.conditions.hasConditions === false)) score += 1;
    if (profile.medications && (profile.medications.list.length > 0 || profile.medications.takingMedications === false)) score += 1;
    if (profile.allergies && (profile.allergies.list.length > 0 || profile.allergies.hasAllergies === false)) score += 1;
    if (profile.procedures && (profile.procedures.list.length > 0 || profile.procedures.hadProcedures === false)) score += 1;
    if (profile.familyHistory && (profile.familyHistory.list.length > 0 || profile.familyHistory.hasHistory === false)) score += 1;
    if (profile.previousTests && (profile.previousTests.list.length > 0 || profile.previousTests.hasPreviousTests === false)) score += 1;
    return Math.round((score / 8) * 100);
  }, [profile]);

  // ---------------------------------------------------------------------
  // Save & Continue: persist to public.health_profiles (upsert on patient_id)
  // ---------------------------------------------------------------------
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const completedProfile: PatientHealthProfile = {
      ...profile,
      completionPercentage: completion,
      lastUpdated: new Date().toISOString(),
    };

    const result = await saveHealthAssessment(completedProfile);
    if (!result.ok) {
      setSaving(false);
      setError(result.error ?? 'Could not save your assessment.');
      return;
    }

    setSaving(false);
    setServerSaved(true);
    onProfileSaved(completedProfile);
    onShowToast('Health assessment saved', 'success');
    // Continue the journey: next step is the upload screen.
    onNavigate('journey-upload');
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600 max-w-3xl mx-auto">
        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
        Loading your assessment…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">Health Assessment</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          A few quick questions about your health. Your answers give your doctor and the analysis helpful context.
        </p>
        {serverSaved && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Previously saved — update anything and save again
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Assessment sections">
        {STEP_LABELS.map((s, index) => (
          <button
            key={s.title}
            role="tab"
            aria-selected={index === step}
            onClick={() => setStep(index)}
            className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
              index <= step ? 'bg-[#bc000a]' : 'bg-slate-200 hover:bg-slate-300'
            }`}
            title={s.title}
          />
        ))}
      </div>
      <div>
        <p className="text-sm font-bold text-[#101c28]">
          Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step].title}
        </p>
        <p className="text-xs text-slate-500">{STEP_LABELS[step].hint}</p>
      </div>

      {/* ---------------- Step 0: Lifestyle (A. Basic health information) ---------------- */}
      {step === 0 && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Smoking</label>
              <select
                className={inputClass}
                value={profile.lifestyle.smoking}
                onChange={(e) => update('lifestyle', { ...profile.lifestyle, smoking: e.target.value as LifestyleInfo['smoking'] })}
              >
                {['Never', 'Former', 'Current', 'Not provided'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Physical activity</label>
              <select
                className={inputClass}
                value={profile.lifestyle.physicalActivity}
                onChange={(e) =>
                  update('lifestyle', { ...profile.lifestyle, physicalActivity: e.target.value as LifestyleInfo['physicalActivity'] })
                }
              >
                {['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active', 'Not provided'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Alcohol</label>
              <select
                className={inputClass}
                value={profile.lifestyle.alcohol}
                onChange={(e) => update('lifestyle', { ...profile.lifestyle, alcohol: e.target.value as LifestyleInfo['alcohol'] })}
              >
                {['None', 'Occasional', 'Moderate', 'Heavy', 'Not provided'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Sleep (hours per night)</label>
              <input
                type="number"
                min={0}
                max={24}
                className={inputClass}
                value={profile.lifestyle.sleepHours ?? 7}
                onChange={(e) => update('lifestyle', { ...profile.lifestyle, sleepHours: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                What brings you here? (goal)
              </label>
              <select
                className={inputClass}
                value={profile.primaryGoal}
                onChange={(e) => update('primaryGoal', e.target.value as PatientHealthProfile['primaryGoal'])}
              >
                <option value="monitor">Routine monitoring</option>
                <option value="symptoms">I have symptoms</option>
                <option value="understand-report">Understand a report</option>
                <option value="other">Something else</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Step 1: Symptoms (B) ---------------- */}
      {step === 1 && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update('symptoms', { ...profile.symptoms, hasSymptoms: true })}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                profile.symptoms.hasSymptoms
                  ? 'bg-[#bc000a] text-white border-[#bc000a]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              I have symptoms
            </button>
            <button
              type="button"
              onClick={() => update('symptoms', { ...profile.symptoms, hasSymptoms: false })}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                !profile.symptoms.hasSymptoms
                  ? 'bg-[#bc000a] text-white border-[#bc000a]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              No symptoms
            </button>
          </div>
          {profile.symptoms.hasSymptoms && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Describe your symptoms (one per line)
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  placeholder={'e.g.\nOccasional palpitations\nShortness of breath on stairs'}
                  value={profile.symptoms.list.join('\n')}
                  onChange={(e) =>
                    update('symptoms', {
                      ...profile.symptoms,
                      list: e.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Severity</label>
                  <select
                    className={inputClass}
                    value={profile.symptoms.severity ?? 'Mild'}
                    onChange={(e) =>
                      update('symptoms', { ...profile.symptoms, severity: e.target.value as SymptomsInfo['severity'] })
                    }
                  >
                    {['Mild', 'Moderate', 'Severe', 'Acute'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">How often</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 1-2 times weekly"
                    value={profile.symptoms.frequency ?? ''}
                    onChange={(e) => update('symptoms', { ...profile.symptoms, frequency: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            If you are experiencing severe or sudden symptoms, seek emergency care immediately.
          </p>
        </section>
      )}

      {/* ---------------- Step 2: Medical history (C) ---------------- */}
      {step === 2 && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-5">
          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Chronic conditions</label>
              <Toggle
                label={profile.conditions.hasConditions ? 'I have conditions' : 'None'}
                checked={profile.conditions.hasConditions}
                onChange={(v) => update('conditions', { ...profile.conditions, hasConditions: v })}
              />
            </div>
            {profile.conditions.hasConditions && (
              <div className="flex gap-2">
                <input
                  id="condition-input"
                  className={inputClass}
                  placeholder="Condition name, e.g. Hypertension"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const name = input.value.trim();
                      if (!name) return;
                      const item: ConditionItem = { id: `cond-${Date.now()}`, name, status: 'Managed' };
                      update('conditions', { ...profile.conditions, list: [...profile.conditions.list, item] });
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('condition-input') as HTMLInputElement | null;
                    const name = input?.value.trim();
                    if (!input || !name) return;
                    const item: ConditionItem = { id: `cond-${Date.now()}`, name, status: 'Managed' };
                    update('conditions', { ...profile.conditions, list: [...profile.conditions.list, item] });
                    input.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <TagListEditor
              items={profile.conditions.list}
              onRemove={(index) =>
                update('conditions', { ...profile.conditions, list: profile.conditions.list.filter((_, i) => i !== index) })
              }
              placeholderFor={(c: ConditionItem) => c.name}
            />
          </div>

          {/* Procedures */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Past procedures</label>
              <Toggle
                label={profile.procedures.hadProcedures ? 'I had procedures' : 'None'}
                checked={profile.procedures.hadProcedures}
                onChange={(v) => update('procedures', { ...profile.procedures, hadProcedures: v })}
              />
            </div>
            {profile.procedures.hadProcedures && (
              <div className="flex gap-2">
                <input
                  id="procedure-input"
                  className={inputClass}
                  placeholder="Procedure, e.g. Stent placement (2022)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const name = input.value.trim();
                      if (!name) return;
                      const item: ProcedureItem = { id: `proc-${Date.now()}`, name };
                      update('procedures', { ...profile.procedures, list: [...profile.procedures.list, item] });
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('procedure-input') as HTMLInputElement | null;
                    const name = input?.value.trim();
                    if (!input || !name) return;
                    const item: ProcedureItem = { id: `proc-${Date.now()}`, name };
                    update('procedures', { ...profile.procedures, list: [...profile.procedures.list, item] });
                    input.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <TagListEditor
              items={profile.procedures.list}
              onRemove={(index) =>
                update('procedures', { ...profile.procedures, list: profile.procedures.list.filter((_, i) => i !== index) })
              }
              placeholderFor={(p: ProcedureItem) => p.name}
            />
          </div>

          {/* Family history */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Family heart history</label>
              <Toggle
                label={profile.familyHistory.hasHistory ? 'Yes' : 'None'}
                checked={profile.familyHistory.hasHistory}
                onChange={(v) => update('familyHistory', { ...profile.familyHistory, hasHistory: v })}
              />
            </div>
            {profile.familyHistory.hasHistory && (
              <div className="flex gap-2">
                <input
                  id="family-input"
                  className={inputClass}
                  placeholder="e.g. Father — heart disease (age 62)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const value = input.value.trim();
                      if (!value) return;
                      const [condition, relation] = value.split('—').map((part) => part.trim());
                      const item: FamilyHistoryItem = {
                        id: `fam-${Date.now()}`,
                        condition: condition || value,
                        relation: relation || 'Relative',
                      };
                      update('familyHistory', { ...profile.familyHistory, list: [...profile.familyHistory.list, item] });
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('family-input') as HTMLInputElement | null;
                    const value = input?.value.trim();
                    if (!input || !value) return;
                    const [condition, relation] = value.split('—').map((part) => part.trim());
                    const item: FamilyHistoryItem = {
                      id: `fam-${Date.now()}`,
                      condition: condition || value,
                      relation: relation || 'Relative',
                    };
                    update('familyHistory', { ...profile.familyHistory, list: [...profile.familyHistory.list, item] });
                    input.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <TagListEditor
              items={profile.familyHistory.list}
              onRemove={(index) =>
                update('familyHistory', {
                  ...profile.familyHistory,
                  list: profile.familyHistory.list.filter((_, i) => i !== index),
                })
              }
              placeholderFor={(f: FamilyHistoryItem) => `${f.condition} (${f.relation})`}
            />
          </div>
        </section>
      )}

      {/* ---------------- Step 3: Medications & allergies (D) ---------------- */}
      {step === 3 && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Current medications</label>
              <Toggle
                label={profile.medications.takingMedications ? 'I take medications' : 'None'}
                checked={profile.medications.takingMedications}
                onChange={(v) => update('medications', { ...profile.medications, takingMedications: v })}
              />
            </div>
            {profile.medications.takingMedications && (
              <div className="flex gap-2">
                <input
                  id="medication-input"
                  className={inputClass}
                  placeholder="e.g. Lisinopril 10 mg, once daily"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const value = input.value.trim();
                      if (!value) return;
                      const item: MedicationItem = { id: `med-${Date.now()}`, name: value };
                      update('medications', { ...profile.medications, list: [...profile.medications.list, item] });
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('medication-input') as HTMLInputElement | null;
                    const value = input?.value.trim();
                    if (!input || !value) return;
                    const item: MedicationItem = { id: `med-${Date.now()}`, name: value };
                    update('medications', { ...profile.medications, list: [...profile.medications.list, item] });
                    input.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <TagListEditor
              items={profile.medications.list}
              onRemove={(index) =>
                update('medications', { ...profile.medications, list: profile.medications.list.filter((_, i) => i !== index) })
              }
              placeholderFor={(m: MedicationItem) => m.name}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Allergies</label>
              <Toggle
                label={profile.allergies.hasAllergies ? 'I have allergies' : 'None'}
                checked={profile.allergies.hasAllergies}
                onChange={(v) => update('allergies', { ...profile.allergies, hasAllergies: v })}
              />
            </div>
            {profile.allergies.hasAllergies && (
              <div className="flex gap-2">
                <input
                  id="allergy-input"
                  className={inputClass}
                  placeholder="e.g. Penicillin (medication)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const value = input.value.trim();
                      if (!value) return;
                      const item: AllergyItem = { id: `all-${Date.now()}`, allergen: value, type: 'Other', severity: 'Mild' };
                      update('allergies', { ...profile.allergies, list: [...profile.allergies.list, item] });
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('allergy-input') as HTMLInputElement | null;
                    const value = input?.value.trim();
                    if (!input || !value) return;
                    const item: AllergyItem = { id: `all-${Date.now()}`, allergen: value, type: 'Other', severity: 'Mild' };
                    update('allergies', { ...profile.allergies, list: [...profile.allergies.list, item] });
                    input.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <TagListEditor
              items={profile.allergies.list}
              onRemove={(index) =>
                update('allergies', { ...profile.allergies, list: profile.allergies.list.filter((_, i) => i !== index) })
              }
              placeholderFor={(a: AllergyItem) => a.allergen}
            />
          </div>
        </section>
      )}

      {/* ---------------- Step 4: Optional additional info (E) ---------------- */}
      {step === 4 && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Previous tests or reports (optional, one per line)
            </label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder={'e.g.\nStress test — 2025\nCholesterol panel — Jan 2026'}
              value={
                profile.previousTests.list.length > 0
                  ? profile.previousTests.list.map((t) => `${t.type} — ${t.date}`).join('\n')
                  : ''
              }
              onChange={(e) => {
                const items = e.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                update('previousTests', {
                  hasPreviousTests: items.length > 0,
                  list: items.map((line, index) => {
                    const [type, date] = line.split('—').map((part) => part.trim());
                    return { id: `test-${Date.now()}-${index}`, type: type || line, date: date || 'date not given' };
                  }),
                  notes: profile.previousTests.notes,
                } as PreviousTestsInfo);
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Everything above is optional. You can also add real documents in the next step.
          </p>
        </section>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs" role="alert">
          <span className="font-bold">Could not save:</span> {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            step === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 cursor-pointer'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">arrow_back</span>
          Back
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 hidden sm:block">{completion}% complete</span>
          {!isFinalStep ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))}
              className="px-5 py-2.5 rounded-xl bg-[#101c28] text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5"
            >
              Continue
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#bc000a] text-white hover:bg-[#a00008] cursor-pointer shadow-sm'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${saving ? 'animate-spin' : ''}`}>
                {saving ? 'progress_activity' : 'save'}
              </span>
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>
          )}
        </div>
      </div>

      {/* Save is available at any step — few clicks, refresh-safe */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save now and upload a record'}
        </button>
      </div>
    </div>
  );
};
