import React, { useState } from 'react';
import {
  PatientHealthProfile,
  HealthInfoSectionKey,
} from '../../types/healthInfo';

interface EditHealthSectionModalProps {
  sectionKey: HealthInfoSectionKey | null;
  onClose: () => void;
  profile: PatientHealthProfile;
  onSaveSection: (key: HealthInfoSectionKey, data: any) => void;
}

export const EditHealthSectionModal: React.FC<EditHealthSectionModalProps> = ({
  sectionKey,
  onClose,
  profile,
  onSaveSection,
}) => {
  if (!sectionKey) return null;

  // Local states based on section
  const [symptomText, setSymptomText] = useState(
    profile.symptoms?.list?.join(', ') || ''
  );
  const [conditionsText, setConditionsText] = useState(
    profile.conditions?.list?.map((c) => c.name).join(', ') || ''
  );
  const [medicationsText, setMedicationsText] = useState(
    profile.medications?.list?.map((m) => `${m.name} ${m.dosage || ''}`).join(', ') || ''
  );
  const [allergiesText, setAllergiesText] = useState(
    profile.allergies?.list?.map((a) => a.allergen).join(', ') || ''
  );
  const [lifestyleSmoking, setLifestyleSmoking] = useState(
    profile.lifestyle?.smoking || 'Never'
  );
  const [lifestyleActivity, setLifestyleActivity] = useState(
    profile.lifestyle?.physicalActivity || 'Moderate'
  );
  const [familyHistoryText, setFamilyHistoryText] = useState(
    profile.familyHistory?.list?.map((f) => `${f.condition} (${f.relation})`).join(', ') || ''
  );
  const [proceduresText, setProceduresText] = useState(
    profile.procedures?.list?.map((p) => p.name).join(', ') || ''
  );

  const handleSave = () => {
    switch (sectionKey) {
      case 'symptoms': {
        const list = symptomText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('symptoms', {
          ...profile.symptoms,
          hasSymptoms: list.length > 0,
          list,
          notes: list.length > 0 ? `Updated: ${list.join(', ')}` : 'No active symptoms reported',
        });
        break;
      }
      case 'conditions': {
        const list = conditionsText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('conditions', {
          ...profile.conditions,
          hasConditions: list.length > 0,
          list: list.map((name, i) => ({ id: `c-edit-${i}`, name, status: 'Managed' })),
        });
        break;
      }
      case 'medications': {
        const list = medicationsText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('medications', {
          ...profile.medications,
          takingMedications: list.length > 0,
          list: list.map((name, i) => ({ id: `m-edit-${i}`, name, frequency: 'Daily' })),
        });
        break;
      }
      case 'allergies': {
        const list = allergiesText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('allergies', {
          ...profile.allergies,
          hasAllergies: list.length > 0,
          list: list.map((allergen, i) => ({ id: `a-edit-${i}`, allergen, type: 'Medication', severity: 'Moderate' })),
        });
        break;
      }
      case 'familyHistory': {
        const list = familyHistoryText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('familyHistory', {
          ...profile.familyHistory,
          hasHistory: list.length > 0,
          list: list.map((item, i) => ({ id: `f-edit-${i}`, condition: item, relation: 'Family' })),
        });
        break;
      }
      case 'lifestyle': {
        onSaveSection('lifestyle', {
          ...profile.lifestyle,
          smoking: lifestyleSmoking,
          physicalActivity: lifestyleActivity,
        });
        break;
      }
      case 'procedures': {
        const list = proceduresText.split(',').map((s) => s.trim()).filter(Boolean);
        onSaveSection('procedures', {
          ...profile.procedures,
          hadProcedures: list.length > 0,
          list: list.map((name, i) => ({ id: `p-edit-${i}`, name })),
        });
        break;
      }
      default:
        break;
    }
    onClose();
  };

  const getSectionTitle = () => {
    switch (sectionKey) {
      case 'symptoms':
        return 'Edit Symptoms';
      case 'conditions':
        return 'Edit Existing Conditions';
      case 'medications':
        return 'Edit Medications';
      case 'allergies':
        return 'Edit Allergies';
      case 'procedures':
        return 'Edit Previous Procedures';
      case 'familyHistory':
        return 'Edit Family History';
      case 'lifestyle':
        return 'Edit Lifestyle';
      case 'previousTests':
        return 'Edit Previous Tests & Reports';
      default:
        return 'Edit Section';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded">
              QUICK EDIT
            </span>
            <h3 className="text-base font-bold text-[#101c28]">{getSectionTitle()}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {sectionKey === 'symptoms' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Symptoms (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="e.g. Occasional mild palpitations, lightheadedness"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Leave blank if you have no active symptoms.
              </span>
            </div>
          )}

          {sectionKey === 'conditions' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Existing Conditions (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
                placeholder="e.g. Essential Hypertension, High Cholesterol"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>
          )}

          {sectionKey === 'medications' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Prescription Medications & Supplements (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={medicationsText}
                onChange={(e) => setMedicationsText(e.target.value)}
                placeholder="e.g. Lisinopril 10mg, CoQ10 100mg"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>
          )}

          {sectionKey === 'allergies' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Allergies (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa drugs"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>
          )}

          {sectionKey === 'lifestyle' && (
            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tobacco / Smoking</label>
                <select
                  value={lifestyleSmoking}
                  onChange={(e) => setLifestyleSmoking(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="Never">Never</option>
                  <option value="Former">Former</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Physical Activity</label>
                <select
                  value={lifestyleActivity}
                  onChange={(e) => setLifestyleActivity(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="Sedentary">Sedentary</option>
                  <option value="Light">Light</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Active">Active</option>
                  <option value="Very Active">Very Active</option>
                </select>
              </div>
            </div>
          )}

          {sectionKey === 'familyHistory' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Family History Conditions (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={familyHistoryText}
                onChange={(e) => setFamilyHistoryText(e.target.value)}
                placeholder="e.g. Coronary Artery Disease (Father), Hypertension (Mother)"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>
          )}

          {sectionKey === 'procedures' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Previous Procedures & Surgeries (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={proceduresText}
                onChange={(e) => setProceduresText(e.target.value)}
                placeholder="e.g. Appendectomy 2018, Knee Arthroscopy 2021"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#bc000a]"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#bc000a] hover:bg-[#a00008] cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
