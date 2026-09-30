import React, { useState } from 'react';
import { ScreenTab } from '../../types';
import {
  MULTIDISEASE_MODULES,
  ECG_ACTIVE_MODULE,
  countModulesByStatus,
} from '../../data/roadmapModules';
import {
  FeatureStatusBadge,
  ModuleCard,
  RoadmapSectionCard,
  PrototypeDisclaimer,
  DisabledActionRow,
  UploadPlaceholder,
  EmptyAnalysisState,
} from './RoadmapPrimitives';

/* ============================================================================
   Phase 5 — Multidisease Detection (research prototype UI)
   Overview dashboard + 5 sub-screens, each selectable via a sub-nav.
   ========================================================================== */

interface MultidiseaseScreenProps {
  initialModule?: ScreenTab;
  onNavigate: (tab: ScreenTab) => void;
  onOpenEcgAnalysis?: () => void;
}

const SUB_NAV: { id: ScreenTab; label: string; icon: string }[] = [
  { id: 'multidisease', label: 'Overview', icon: 'dashboard' },
  { id: 'multidisease-skin', label: 'Skin Disease', icon: 'healing' },
  { id: 'multidisease-imaging', label: 'Medical Imaging', icon: 'radiology' },
  { id: 'multidisease-cardio', label: 'Cardiovascular Models', icon: 'cardiology' },
  { id: 'multidisease-laboratory', label: 'Laboratory Risk', icon: 'labs' },
  { id: 'multidisease-modules', label: 'Disease Modules', icon: 'grid_view' },
];

/** Shared sub-screen chrome: breadcrumb, sub-nav, header. */
const MultidiseaseSubShell: React.FC<{
  title: string;
  subtitle: string;
  badge: string;
  activeTab: ScreenTab;
  onNavigate: (tab: ScreenTab) => void;
  children: React.ReactNode;
}> = ({ title, subtitle, badge, activeTab, onNavigate, children }) => (
  <div className="space-y-5 max-w-5xl mx-auto pb-20">
    <div className="border-b border-slate-200/80 pb-4">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <button
          onClick={() => onNavigate('multidisease')}
          className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Multidisease Detection
        </button>
        <span className="text-slate-300">/</span>
        <FeatureStatusBadge
          status={
            badge === 'Available'
              ? 'available'
              : badge === 'Prototype'
              ? 'prototype'
              : 'research-preview'
          }
          label={badge}
        />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">{title}</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
    </div>

    {/* Sub navigation */}
    <nav
      aria-label="Multidisease sections"
      className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1"
    >
      {SUB_NAV.map((item) => {
        const isActive = item.id === activeTab;
        return (
          <button
            key={item.id}
            id={`roadmap-subnav-${item.id}`}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              isActive
                ? 'bg-[#ffe8e8] text-[#bc000a] border-[#bc000a]/25'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>

    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const OverviewPanel: React.FC<{
  onNavigate: (tab: ScreenTab) => void;
  onOpenEcgAnalysis?: () => void;
}> = ({ onNavigate, onOpenEcgAnalysis }) => {
  const counts = countModulesByStatus(MULTIDISEASE_MODULES);
  const total = MULTIDISEASE_MODULES.length + 1; // + deployed ECG module

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Modules', value: total, icon: 'category', tone: 'text-[#101c28]' },
          { label: 'Available Now', value: counts.available + 1, icon: 'check_circle', tone: 'text-emerald-600' },
          { label: 'Coming Soon', value: counts['coming-soon'], icon: 'schedule', tone: 'text-amber-600' },
          {
            label: 'Research Preview',
            value: counts.prototype + counts['research-preview'],
            icon: 'science',
            tone: 'text-violet-600',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {stat.label}
              </span>
              <span className={`material-symbols-outlined text-[18px] ${stat.tone}`}>
                {stat.icon}
              </span>
            </div>
            <p className={`text-2xl font-extrabold tracking-tight mt-1.5 ${stat.tone}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Deployed ECG module — clearly separated */}
      <RoadmapSectionCard
        title="Available Now"
        subtitle="Deployed clinical pipeline"
        icon="verified"
        right={<FeatureStatusBadge status="available" />}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                {ECG_ACTIVE_MODULE.icon}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[#101c28]">{ECG_ACTIVE_MODULE.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {ECG_ACTIVE_MODULE.description}
              </p>
            </div>
          </div>
          <button
            id="roadmap-open-ecg-btn"
            onClick={onOpenEcgAnalysis ?? (() => onNavigate('ecg-analysis'))}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            Open ECG Analysis
          </button>
        </div>
      </RoadmapSectionCard>

      {/* Future modules grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400">grid_view</span>
            Planned & Prototype Modules
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            {MULTIDISEASE_MODULES.length} modules
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {MULTIDISEASE_MODULES.map((m) => (
            <ModuleCard
              key={m.id}
              name={m.name}
              description={m.description}
              category={m.category}
              icon={m.icon}
              status={m.status}
              onSelect={() => onNavigate(m.route)}
              footer={
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-[#bc000a] flex items-center gap-1">
                  View module
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              }
            />
          ))}
        </div>
      </div>

      <PrototypeDisclaimer message="This area presents the multidisease roadmap as an interactive specification. No disease prediction is performed and no clinical diagnosis is provided." />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Skin Disease Detection
// ---------------------------------------------------------------------------

const SkinDiseasePanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => (
  <div className="space-y-5">
    <MultidiseaseDisclaimerRow />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <RoadmapSectionCard
        title="Skin Image Upload"
        subtitle="Dermoscopic / clinical photograph"
        icon="healing"
        right={<FeatureStatusBadge status="coming-soon" />}
      >
        <UploadPlaceholderInline
          label="Drop a skin image here"
          hint="Supported: JPG / PNG dermoscopic or clinical photographs. Upload will be enabled when the analysis model is integrated."
        />
      </RoadmapSectionCard>

      <RoadmapSectionCard
        title="Supported Condition Categories"
        subtitle="Placeholder taxonomy — final scope TBD"
        icon="category"
        right={<FeatureStatusBadge status="coming-soon" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            'Melanocytic lesions',
            'Eczema / dermatitis',
            'Psoriasis spectrum',
            'Acne & follicular disorders',
            'Fungal infections',
            'Other / uncategorized',
          ].map((c) => (
            <div
              key={c}
              className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-400">circle</span>
              <span className="text-xs font-semibold text-slate-600">{c}</span>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-slate-400 mt-3 leading-relaxed">
          Category list is illustrative for UI layout only — it does not represent model classes or
          diagnostic capability.
        </p>
      </RoadmapSectionCard>
    </div>

    <RoadmapSectionCard title="Analysis Output" subtitle="Placeholder result area" icon="psychology">
      <EmptyAnalysisStateInline message="Skin image analysis requires a supported dermatology model. This prototype displays interface concepts only." />
      <div className="mt-4">
        <DisabledActionRow
          label="Analyze Skin Image"
          hint="Enable when a validated model is connected"
          icon="burst_mode"
        />
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="This screen does not currently provide a clinical diagnosis of any skin condition. Uploaded imagery is never stored or analyzed in this prototype." />

    <BackToOverviewRow onNavigate={onNavigate} />
  </div>
);

// ---------------------------------------------------------------------------
// Medical Image Analysis
// ---------------------------------------------------------------------------

const IMAGING_MODALITIES = [
  { id: 'xray', label: 'X-ray', icon: 'radiology' },
  { id: 'ct', label: 'CT', icon: 'view_in_ar' },
  { id: 'mri', label: 'MRI', icon: 'gradient' },
  { id: 'ultrasound', label: 'Ultrasound', icon: 'waves' },
  { id: 'other', label: 'Other', icon: 'more_horiz' },
];

const MedicalImagingPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => {
  const [modality, setModality] = useState<string>('xray');

  return (
    <div className="space-y-5">
      <MultidiseaseDisclaimerRow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RoadmapSectionCard
          title="Imaging Input"
          subtitle="Modality selection & file upload"
          icon="radiology"
          right={<FeatureStatusBadge status="prototype" />}
        >
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                Select modality
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {IMAGING_MODALITIES.map((m) => (
                  <button
                    key={m.id}
                    id={`imaging-modality-${m.id}`}
                    onClick={() => setModality(m.id)}
                    aria-pressed={modality === m.id}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      modality === m.id
                        ? 'bg-[#ffe8e8] border-[#bc000a]/30 text-[#bc000a]'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] block">{m.icon}</span>
                    <span className="text-[10px] font-bold mt-1 block">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <UploadPlaceholderInline
              label={`Upload ${IMAGING_MODALITIES.find((m) => m.id === modality)?.label ?? ''} study`}
              hint="DICOM / PNG interface mock. No file is read, stored, or transmitted in this prototype."
            />
          </div>
        </RoadmapSectionCard>

        <RoadmapSectionCard
          title="Analysis Summary"
          subtitle="Structured output placeholders"
          icon="description"
          right={<FeatureStatusBadge status="prototype" />}
        >
          <div className="space-y-3">
            {[
              { label: 'Findings', text: 'Findings list placeholder — generated by a supported model in the future.' },
              { label: 'Confidence / Interpretation', text: 'Confidence and interpretation placeholders — no fabricated percentages.' },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  {row.label}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{row.text}</p>
                <div className="mt-2.5 space-y-1.5" aria-hidden="true">
                  <div className="h-2 rounded-full bg-slate-200/70 w-4/5" />
                  <div className="h-2 rounded-full bg-slate-200/70 w-3/5" />
                </div>
              </div>
            ))}
            <EmptyAnalysisStateInline message="Imaging analysis will activate when a supported radiology pipeline is integrated." />
          </div>
        </RoadmapSectionCard>
      </div>

      <PrototypeDisclaimer message="This screen is a Research Preview. No medical findings, measurements, or interpretations are produced here." />

      <BackToOverviewRow onNavigate={onNavigate} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Additional Cardiovascular Models
// ---------------------------------------------------------------------------

const CardioModelsPanel: React.FC<{
  onNavigate: (tab: ScreenTab) => void;
  onOpenEcgAnalysis?: () => void;
}> = ({ onNavigate, onOpenEcgAnalysis }) => (
  <div className="space-y-5">
    <MultidiseaseDisclaimerRow />
    <RoadmapSectionCard
      title="Model Selection"
      subtitle="ECG/QML is the only currently available model"
      icon="cardiology"
      right={<FeatureStatusBadge status="available" label="1 Available" />}
    >
      <div className="space-y-3">
        {/* Currently available model */}
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">ecg_heart</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#101c28]">
                  ECG / Arrhythmia (VQC Beat Classifier)
                </h3>
                <FeatureStatusBadge status="available" />
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Deployed pipeline — 5 AAMI classes, Lead II, 125 Hz.
              </p>
            </div>
          </div>
          <button
            id="roadmap-cardio-open-ecg-btn"
            onClick={onOpenEcgAnalysis ?? (() => onNavigate('ecg-analysis'))}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Launch
          </button>
        </div>

        {/* Planned models */}
        {[
          {
            name: 'Cardiovascular Risk Model',
            desc: 'Multi-factor risk stratification concept. Model integration planned.',
          },
          {
            name: 'Heart Failure Risk Model',
            desc: 'Decompensation risk concept. Model integration planned.',
          },
          {
            name: 'Other Cardiovascular Models',
            desc: 'Additional cardiac model slots reserved for future roadmap items.',
          },
        ].map((m) => (
          <div
            key={m.name}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">cardiology</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-600">{m.name}</h3>
                  <FeatureStatusBadge status="coming-soon" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
              </div>
            </div>
            <span className="shrink-0 text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded self-start sm:self-center">
              Not Running
            </span>
          </div>
        ))}
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="Only the ECG/QML classifier currently runs. Additional cardiovascular models do not execute and cannot produce outputs in this prototype." />

    <BackToOverviewRow onNavigate={onNavigate} />
  </div>
);

// ---------------------------------------------------------------------------
// Laboratory-Based Risk Models
// ---------------------------------------------------------------------------

const LAB_CATEGORIES: {
  id: string;
  label: string;
  icon: string;
  rows: { name: string; unit: string; reference: string }[];
}[] = [
  {
    id: 'cbc',
    label: 'CBC',
    icon: 'bloodtype',
    rows: [
      { name: 'Hemoglobin', unit: 'g/dL', reference: '13.0–17.0' },
      { name: 'WBC Count', unit: '10³/µL', reference: '4.0–11.0' },
      { name: 'Platelets', unit: '10³/µL', reference: '150–450' },
    ],
  },
  {
    id: 'lipids',
    label: 'Lipid Profile',
    icon: 'water_drop',
    rows: [
      { name: 'LDL Cholesterol', unit: 'mg/dL', reference: '< 100' },
      { name: 'HDL Cholesterol', unit: 'mg/dL', reference: '> 40' },
      { name: 'Triglycerides', unit: 'mg/dL', reference: '< 150' },
    ],
  },
  {
    id: 'glucose',
    label: 'Glucose / HbA1c',
    icon: 'monitor_heart',
    rows: [
      { name: 'Fasting Glucose', unit: 'mg/dL', reference: '70–99' },
      { name: 'HbA1c', unit: '%', reference: '< 5.7' },
    ],
  },
  {
    id: 'liver',
    label: 'Liver Function',
    icon: 'labs',
    rows: [
      { name: 'ALT', unit: 'U/L', reference: '7–55' },
      { name: 'AST', unit: 'U/L', reference: '8–48' },
    ],
  },
  {
    id: 'kidney',
    label: 'Kidney Function',
    icon: 'urology',
    rows: [
      { name: 'Creatinine', unit: 'mg/dL', reference: '0.7–1.3' },
      { name: 'eGFR', unit: 'mL/min', reference: '> 90' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'more_horiz',
    rows: [{ name: 'Custom Biomarker', unit: '—', reference: 'Panel-dependent' }],
  },
];

const LaboratoryPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => {
  const [category, setCategory] = useState<string>('cbc');
  const active = LAB_CATEGORIES.find((c) => c.id === category) ?? LAB_CATEGORIES[0];

  return (
    <div className="space-y-5">
      <MultidiseaseDisclaimerRow />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <RoadmapSectionCard
            title="Lab Panel Categories"
            subtitle="Select a panel"
            icon="labs"
            right={<FeatureStatusBadge status="coming-soon" />}
          >
            <div className="space-y-2">
              {LAB_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  id={`lab-category-${c.id}`}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    category === c.id
                      ? 'bg-[#ffe8e8] border-[#bc000a]/25 text-[#bc000a]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
                  <span className="text-xs font-bold">{c.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">
                    {c.rows.length} fields
                  </span>
                </button>
              ))}
            </div>
          </RoadmapSectionCard>
        </div>

        <div className="lg:col-span-3 space-y-5">
          <RoadmapSectionCard
            title={`${active.label} — Structured Input`}
            subtitle="Values with unit / reference-range placeholders"
            icon="edit_note"
            right={<FeatureStatusBadge status="coming-soon" />}
          >
            <div className="space-y-2.5">
              {active.rows.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_130px] items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5"
                >
                  <span className="text-xs font-bold text-slate-700 truncate">{row.name}</span>
                  <span className="hidden sm:block text-[10px] font-mono text-slate-400">
                    {row.unit}
                  </span>
                  <input
                    type="text"
                    disabled
                    aria-label={`${row.name} value (disabled in prototype)`}
                    placeholder="e.g. 0.0"
                    className="w-full sm:w-[120px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-400 placeholder:text-slate-300 cursor-not-allowed"
                  />
                  <span className="col-span-2 sm:col-span-3 text-[10px] font-mono text-slate-400">
                    Reference: {row.reference} {row.unit}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <DisabledActionRow
                label="Run Risk Analysis"
                hint="Requires a validated laboratory risk model"
                icon="analytics"
              />
            </div>
          </RoadmapSectionCard>

          <RoadmapSectionCard
            title="Risk Analysis Result"
            subtitle="Placeholder output area"
            icon="insights"
          >
            <EmptyAnalysisStateInline message="Laboratory-based risk models are not integrated. No risk score, tier, or probability is displayed." />
          </RoadmapSectionCard>
        </div>
      </div>

      <PrototypeDisclaimer message="Reference ranges shown are common clinical conventions for layout purposes only — this prototype performs no laboratory interpretation." />

      <BackToOverviewRow onNavigate={onNavigate} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Disease-Specific Prediction Modules
// ---------------------------------------------------------------------------

const DISEASE_MODULE_EXAMPLES: {
  name: string;
  category: string;
  icon: string;
  status: 'coming-soon' | 'prototype';
  description: string;
}[] = [
  {
    name: 'Cardiovascular',
    category: 'Heart & Vessels',
    icon: 'cardiology',
    status: 'coming-soon',
    description: 'Expanded cardiac risk and rhythm model concepts beyond the deployed ECG classifier.',
  },
  {
    name: 'Metabolic',
    category: 'Endocrine',
    icon: 'monitor_heart',
    status: 'coming-soon',
    description: 'Glycemic and metabolic-syndrome prediction concepts awaiting supported models.',
  },
  {
    name: 'Neurological',
    category: 'Brain & Nerves',
    icon: 'neurology',
    status: 'coming-soon',
    description: 'Structural and functional neuro-imaging analysis concepts. Integration planned.',
  },
  {
    name: 'Dermatological',
    category: 'Skin',
    icon: 'healing',
    status: 'prototype',
    description: 'Skin lesion interface prototype linked from the Skin Disease module.',
  },
  {
    name: 'Respiratory',
    category: 'Lungs',
    icon: 'pulmonology',
    status: 'coming-soon',
    description: 'Chest imaging and spirometry analysis concepts. Integration planned.',
  },
  {
    name: 'Other',
    category: 'Multi-System',
    icon: 'category',
    status: 'prototype',
    description: 'Reserved slots for additional organ-system modules as the roadmap expands.',
  },
];

const DiseaseModulesPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => (
  <div className="space-y-5">
    <MultidiseaseDisclaimerRow />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {DISEASE_MODULE_EXAMPLES.map((m) => (
        <ModuleCard
          key={m.name}
          name={m.name}
          description={m.description}
          category={m.category}
          icon={m.icon}
          status={m.status}
          footer={
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Status: {m.status === 'coming-soon' ? 'Coming Soon' : 'Prototype UI'} · No predictions
            </span>
          }
        />
      ))}
    </div>
    <PrototypeDisclaimer message="These modules are roadmap concepts. None of them currently generates a disease prediction or clinical output." />
    <BackToOverviewRow onNavigate={onNavigate} />
  </div>
);

// ---------------------------------------------------------------------------
// Small inline helpers local to this file
// ---------------------------------------------------------------------------

const MultidiseaseDisclaimerRow: React.FC = () => (
  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
    <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">
      lab_profile
    </span>
    <p className="leading-relaxed">
      <span className="font-bold">Research prototype.</span> This module presents UI concepts only —
      no clinical analysis is performed and no diagnosis is generated.
    </p>
  </div>
);

const BackToOverviewRow: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => (
  <button
    onClick={() => onNavigate('multidisease')}
    className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 cursor-pointer transition-colors"
  >
    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
    Back to Multidisease Overview
  </button>
);

const UploadPlaceholderInline: React.FC<{ label: string; hint: string }> = ({ label, hint }) => (
  <UploadPlaceholder label={label} hint={hint} icon="add_photo_alternate" />
);

const EmptyAnalysisStateInline: React.FC<{ message: string }> = ({ message }) => (
  <EmptyAnalysisState message={message} />
);

export const MultidiseaseScreen: React.FC<MultidiseaseScreenProps> = ({
  initialModule = 'multidisease',
  onNavigate,
  onOpenEcgAnalysis,
}) => {
  return (
    <MultidiseaseSubShell
      title={
        initialModule === 'multidisease'
          ? 'Multidisease Detection'
          : (SUB_NAV.find((s) => s.id === initialModule)?.label ?? 'Multidisease Detection')
      }
      subtitle={
        initialModule === 'multidisease'
          ? 'Roadmap area for multi-disease analysis modules. ECG analysis is the only deployed capability; all other modules are prototype or planned.'
          : 'Part of the Multidisease Detection roadmap area — research prototype UI.'
      }
      badge={initialModule === 'multidisease' ? 'Research Preview' : 'Prototype'}
      activeTab={initialModule}
      onNavigate={onNavigate}
    >
      {initialModule === 'multidisease' && (
        <OverviewPanel onNavigate={onNavigate} onOpenEcgAnalysis={onOpenEcgAnalysis} />
      )}
      {initialModule === 'multidisease-skin' && <SkinDiseasePanel onNavigate={onNavigate} />}
      {initialModule === 'multidisease-imaging' && <MedicalImagingPanel onNavigate={onNavigate} />}
      {initialModule === 'multidisease-cardio' && (
        <CardioModelsPanel onNavigate={onNavigate} onOpenEcgAnalysis={onOpenEcgAnalysis} />
      )}
      {initialModule === 'multidisease-laboratory' && <LaboratoryPanel onNavigate={onNavigate} />}
      {initialModule === 'multidisease-modules' && <DiseaseModulesPanel onNavigate={onNavigate} />}
    </MultidiseaseSubShell>
  );
};
