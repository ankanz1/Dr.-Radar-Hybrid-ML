import React, { useState } from 'react';
import {
  PatientHealthProfile,
  MedicalRecord,
  HealthInfoSectionKey,
} from '../../types/healthInfo';
import { TellDrRadarQuestionnaireModal } from './TellDrRadarQuestionnaireModal';
import { EditHealthSectionModal } from './EditHealthSectionModal';

interface MyHealthInformationScreenProps {
  healthProfile: PatientHealthProfile;
  records: MedicalRecord[];
  onUpdateProfile: (profile: PatientHealthProfile) => void;
  onUpdateSection: (key: HealthInfoSectionKey, data: any) => void;
  onNavigateToRecords: () => void;
  onNavigateToPrivacy: () => void;
}

export const MyHealthInformationScreen: React.FC<MyHealthInformationScreenProps> = ({
  healthProfile,
  records,
  onUpdateProfile,
  onUpdateSection,
  onNavigateToRecords,
  onNavigateToPrivacy,
}) => {
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [editingSectionKey, setEditingSectionKey] = useState<HealthInfoSectionKey | null>(null);

  const completion = healthProfile.completionPercentage || 60;

  // Render content helper for each of the 8 sections
  const renderSectionContent = (key: HealthInfoSectionKey) => {
    switch (key) {
      case 'symptoms': {
        const has = healthProfile.symptoms?.hasSymptoms;
        const list = healthProfile.symptoms?.list || [];
        if (!has && list.length === 0) {
          return <span className="text-slate-400 italic">No active symptoms reported</span>;
        }
        if (list.length === 0) {
          return <span className="text-slate-400 italic">Not provided</span>;
        }
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5">
              {list.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#ffe8e8] text-[#bc000a] text-xs font-semibold"
                >
                  {sym}
                </span>
              ))}
            </div>
            {healthProfile.symptoms.severity && (
              <span className="text-[11px] text-slate-500 block">
                Severity: {healthProfile.symptoms.severity} • {healthProfile.symptoms.frequency || 'Occasional'}
              </span>
            )}
          </div>
        );
      }
      case 'conditions': {
        const list = healthProfile.conditions?.list || [];
        if (list.length === 0) {
          return <span className="text-slate-400 italic">No chronic conditions recorded</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((c) => (
              <span
                key={c.id || c.name}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-medium"
              >
                {c.name} {c.diagnosedYear ? `(${c.diagnosedYear})` : ''}
              </span>
            ))}
          </div>
        );
      }
      case 'medications': {
        const list = healthProfile.medications?.list || [];
        if (list.length === 0) {
          return <span className="text-slate-400 italic">Not taking regular medications</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((m) => (
              <span
                key={m.id || m.name}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-xs font-medium border border-blue-100"
              >
                {m.name} {m.dosage ? `(${m.dosage})` : ''}
              </span>
            ))}
          </div>
        );
      }
      case 'allergies': {
        const list = healthProfile.allergies?.list || [];
        if (list.length === 0) {
          return <span className="text-slate-400 italic">No known allergies (NKDA)</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((a) => (
              <span
                key={a.id || a.allergen}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200"
              >
                {a.allergen} ({a.type})
              </span>
            ))}
          </div>
        );
      }
      case 'procedures': {
        const list = healthProfile.procedures?.list || [];
        if (list.length === 0) {
          return <span className="text-slate-400 italic">No previous procedures reported</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((p) => (
              <span
                key={p.id || p.name}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
              >
                {p.name} {p.year ? `(${p.year})` : ''}
              </span>
            ))}
          </div>
        );
      }
      case 'familyHistory': {
        const list = healthProfile.familyHistory?.list || [];
        if (list.length === 0) {
          return <span className="text-slate-400 italic">No family cardiac history reported</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((f) => (
              <span
                key={f.id || f.condition}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-xs font-medium border border-purple-100"
              >
                {f.condition} ({f.relation})
              </span>
            ))}
          </div>
        );
      }
      case 'lifestyle': {
        const life = healthProfile.lifestyle;
        if (!life || (life.smoking === 'Not provided' && life.physicalActivity === 'Not provided')) {
          return <span className="text-slate-400 italic">Not provided</span>;
        }
        return (
          <span className="text-xs text-slate-700">
            Tobacco: <strong>{life.smoking}</strong> • Activity: <strong>{life.physicalActivity}</strong> • Sleep: <strong>{life.sleepHours || 7}h</strong>
          </span>
        );
      }
      case 'previousTests': {
        const list = healthProfile.previousTests?.list || [];
        if (list.length === 0 && records.length === 0) {
          return <span className="text-slate-400 italic">Not provided</span>;
        }
        if (records.length > 0) {
          return (
            <span className="text-xs text-slate-700 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
              <span>{records.length} clinical record(s) linked in repository</span>
            </span>
          );
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((t) => (
              <span
                key={t.id || t.type}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-100"
              >
                {t.type} ({t.date})
              </span>
            ))}
          </div>
        );
      }
      default:
        return <span className="text-slate-400 italic">Not provided</span>;
    }
  };

  const SECTIONS_CONFIG: {
    key: HealthInfoSectionKey;
    title: string;
    icon: string;
  }[] = [
    { key: 'symptoms', title: '1. Symptoms', icon: 'vital_signs' },
    { key: 'conditions', title: '2. Existing Conditions', icon: 'favorite' },
    { key: 'medications', title: '3. Medications', icon: 'prescriptions' },
    { key: 'allergies', title: '4. Allergies', icon: 'warning' },
    { key: 'procedures', title: '5. Previous Procedures', icon: 'medical_services' },
    { key: 'familyHistory', title: '6. Family History', icon: 'family_restroom' },
    { key: 'lifestyle', title: '7. Lifestyle', icon: 'directions_run' },
    { key: 'previousTests', title: '8. Previous Tests & Reports', icon: 'description' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/90">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bc000a] bg-[#ffe8e8] px-2 py-0.5 rounded border border-[#bc000a]/25">
            DR. RADAR • HEALTH CONTEXT
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Personal Clinical Baseline
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-[#101c28] tracking-tight">
          My Health Information
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Help Dr. Radar understand your health history and provide more relevant health information.
        </p>
      </div>

      {/* Completion Indicator Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#bc000a] animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Health Profile Completion
            </h3>
          </div>
          <span className="text-sm font-extrabold text-[#bc000a] font-mono">
            {completion}% complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-[#bc000a] h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completion}%` }}
          />
        </div>

        <p className="text-xs text-slate-500">
          Providing your complete health context helps Dr. Radar contextualize your ECG rhythms and provide more tailored follow-up care recommendations.
        </p>
      </div>

      {/* Primary Action Cards 1 & 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: Tell Dr. Radar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">chat</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#101c28]">Tell Dr. Radar</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Answer a few questions about your health, symptoms, medical history, and lifestyle.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsQuestionnaireOpen(true)}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-bold hover:bg-[#a00008] transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <span>{completion >= 80 ? 'Update Answers' : 'Continue Questions'}</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* CARD 2: Upload Medical Records */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">folder_shared</span>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-black text-[#101c28]">Upload Medical Records</h3>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {records.length} On File
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Add relevant medical reports and health documents to your health profile.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToRecords}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            <span>Upload Records</span>
          </button>
        </div>
      </div>

      {/* Your Health Information (8 Sections) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-[#101c28]">Your Health Information</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and keep your clinical context updated for optimal analysis accuracy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsQuestionnaireOpen(true)}
            className="text-xs font-bold text-[#bc000a] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Full Intake</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {SECTIONS_CONFIG.map((section) => (
            <div
              key={section.key}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition-all"
            >
              <div className="space-y-1 min-w-0 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">
                    {section.icon}
                  </span>
                  <span className="text-xs font-bold text-[#101c28]">{section.title}</span>
                </div>
                <div className="pl-6.5 text-xs">
                  {renderSectionContent(section.key)}
                </div>
              </div>

              <div className="pl-6.5 sm:pl-0 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingSectionKey(section.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Notice Banner (Section 12) */}
      <div className="bg-[#f8fafc] rounded-3xl p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-[#bc000a] flex items-center justify-center shrink-0 shadow-2xs">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Privacy & Sensitive Data
            </h4>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl leading-relaxed">
              Your health information is sensitive. Review your privacy and data settings to understand how your information is handled.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToPrivacy}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-2xs flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-600">verified_user</span>
          <span>Privacy & Data</span>
        </button>
      </div>

      {/* Conversational Intake Modal */}
      <TellDrRadarQuestionnaireModal
        isOpen={isQuestionnaireOpen}
        onClose={() => setIsQuestionnaireOpen(false)}
        currentProfile={healthProfile}
        onSaveProfile={onUpdateProfile}
        onOpenPrivacy={onNavigateToPrivacy}
      />

      {/* Quick Section Edit Modal */}
      <EditHealthSectionModal
        sectionKey={editingSectionKey}
        onClose={() => setEditingSectionKey(null)}
        profile={healthProfile}
        onSaveSection={onUpdateSection}
      />
    </div>
  );
};
