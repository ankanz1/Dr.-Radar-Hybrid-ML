import React, { useState } from 'react';
import { ScreenTab } from '../../types';
import {
  FeatureStatusBadge,
  RoadmapSectionCard,
  PrototypeDisclaimer,
  EmptyAnalysisState,
  ResearchMetricCard,
  TimelinePlaceholder,
} from './RoadmapPrimitives';

/* ============================================================================
   Phase 7 — Clinical Research (research preview UI)
   Overview + validation, prospective, explainability, calibration, fairness,
   workflow evaluation.
   ========================================================================== */

interface ResearchScreenProps {
  initialModule?: ScreenTab;
  onNavigate: (tab: ScreenTab) => void;
}

const SUB_NAV: { id: ScreenTab; label: string; icon: string }[] = [
  { id: 'research-overview', label: 'Overview', icon: 'dashboard' },
  { id: 'research-validation', label: 'Validation', icon: 'fact_check' },
  { id: 'research-prospective', label: 'Prospective', icon: 'event_note' },
  { id: 'research-explainability', label: 'Explainability', icon: 'insights' },
  { id: 'research-calibration', label: 'Calibration', icon: 'straighten' },
  { id: 'research-fairness', label: 'Fairness', icon: 'balance' },
  { id: 'research-workflow', label: 'Workflow', icon: 'account_tree' },
];

const ResearchSubShell: React.FC<{
  title: string;
  subtitle: string;
  activeTab: ScreenTab;
  onNavigate: (tab: ScreenTab) => void;
  children: React.ReactNode;
}> = ({ title, subtitle, activeTab, onNavigate, children }) => (
  <div className="space-y-5 max-w-5xl mx-auto pb-20">
    <div className="border-b border-slate-200/80 pb-4">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <button
          onClick={() => onNavigate('research-overview')}
          className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Clinical Research
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
          Research Preview
        </span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101c28] tracking-tight">{title}</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
    </div>

    <nav
      aria-label="Clinical Research sections"
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

const OVERVIEW_ITEMS: {
  id: ScreenTab;
  name: string;
  desc: string;
  icon: string;
  status: 'coming-soon' | 'prototype' | 'research-preview';
}[] = [
  {
    id: 'research-validation',
    name: 'External Validation',
    desc: 'Independent cohort validation projects. Planned.',
    icon: 'fact_check',
    status: 'coming-soon',
  },
  {
    id: 'research-prospective',
    name: 'Prospective Evaluation',
    desc: 'Forward-looking study design and evaluation timeline. Planned.',
    icon: 'event_note',
    status: 'coming-soon',
  },
  {
    id: 'research-explainability',
    name: 'Explainability',
    desc: 'Attribution views for supported models; ECG saliency referenced where real.',
    icon: 'insights',
    status: 'prototype',
  },
  {
    id: 'research-calibration',
    name: 'Calibration',
    desc: 'Calibration curves and metrics for planned models. Coming soon.',
    icon: 'straighten',
    status: 'coming-soon',
  },
  {
    id: 'research-fairness',
    name: 'Bias / Fairness Analysis',
    desc: 'Demographic-group comparison framework. Research-only.',
    icon: 'balance',
    status: 'research-preview',
  },
  {
    id: 'research-workflow',
    name: 'Workflow Evaluation',
    desc: 'Clinician-in-the-loop workflow study. Planned.',
    icon: 'account_tree',
    status: 'coming-soon',
  },
];

const OverviewPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {OVERVIEW_ITEMS.map((m) => (
        <button
          key={m.id}
          onClick={() => onNavigate(m.id)}
          className="text-left bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
            </div>
            <FeatureStatusBadge status={m.status} />
          </div>
          <h3 className="text-sm font-extrabold text-[#101c28]">{m.name}</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</p>
          <span className="text-[11px] font-semibold text-slate-500 group-hover:text-[#bc000a] mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1">
            Open
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </span>
        </button>
      ))}
    </div>

    <PrototypeDisclaimer message="The Clinical Research area presents planned study and evaluation frameworks. No study is enrolling, no dataset is connected, and no metric is measured." />
  </div>
);

// ---------------------------------------------------------------------------
// 1. External Validation
// ---------------------------------------------------------------------------

const ValidationPanel: React.FC = () => (
  <div className="space-y-5">
    <RoadmapSectionCard
      title="Validation Dataset / Project"
      subtitle="Cohort card placeholder"
      icon="fact_check"
      right={<FeatureStatusBadge status="coming-soon" />}
    >
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-extrabold text-[#101c28]">External Validation Project</h3>
          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
            Planned
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { label: 'Cohort size', value: 'Not enrolled' },
            { label: 'Data source', value: 'Not connected' },
            { label: 'Sites', value: 'Not confirmed' },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {f.label}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </RoadmapSectionCard>

    <RoadmapSectionCard
      title="Performance Metrics"
      subtitle="Placeholder — no measured values"
      icon="query_stats"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResearchMetricCard label="AUROC" state="Awaiting dataset" />
        <ResearchMetricCard label="Sensitivity" state="Awaiting dataset" />
        <ResearchMetricCard label="Specificity" state="Awaiting dataset" />
        <ResearchMetricCard label="Macro-F1" state="Awaiting dataset" />
      </div>
      <div className="mt-4">
        <EmptyAnalysisState
          title="Validation not started"
          message="Metrics populate only after an external dataset is connected and a validation run completes."
        />
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="No external dataset is connected. All cohort fields and metrics are placeholders." />
  </div>
);

// ---------------------------------------------------------------------------
// 2. Prospective Evaluation
// ---------------------------------------------------------------------------

const ProspectivePanel: React.FC = () => (
  <div className="space-y-5">
    <RoadmapSectionCard
      title="Study / Project Card"
      subtitle="Prospective evaluation framework"
      icon="event_note"
      right={<FeatureStatusBadge status="coming-soon" />}
    >
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-extrabold text-[#101c28]">Prospective Clinical Evaluation</h3>
          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
            Planned
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          A forward-looking evaluation in which model outputs are reviewed by clinicians in a live
          care-context workflow. Design and enrollment have not started.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { label: 'Participants', value: 'Not recruiting' },
            { label: 'Sites', value: 'Not confirmed' },
            { label: 'Duration', value: 'TBD' },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {f.label}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </RoadmapSectionCard>

    <RoadmapSectionCard title="Evaluation Timeline" subtitle="Planned phases" icon="timeline">
      <div>
        <TimelinePlaceholder
          date="Phase 0"
          title="Protocol design"
          message="Define endpoints, population, and review workflow."
          icon="edit_document"
        />
        <TimelinePlaceholder
          date="Phase 1"
          title="Ethics & governance"
          message="IRB / ethics submission and site agreements."
          icon="gavel"
          tone="muted"
        />
        <TimelinePlaceholder
          date="Phase 2"
          title="Enrollment"
          message="Participant recruitment and consent."
          icon="group_add"
          tone="muted"
        />
        <TimelinePlaceholder
          date="Phase 3"
          title="Evaluation & analysis"
          message="Prospective data collection and statistical evaluation."
          icon="analytics"
          tone="muted"
        />
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="No study is enrolling. The timeline represents the intended evaluation structure only." />
  </div>
);

// ---------------------------------------------------------------------------
// 3. Explainability
// ---------------------------------------------------------------------------

const EXPLAINABLE_MODELS = [
  { id: 'ecg', label: 'ECG / QML Beat Classifier', supported: true },
  { id: 'future', label: 'Future disease models', supported: false },
];

const ExplainabilityPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => {
  const [model, setModel] = useState<string>('ecg');
  const active = EXPLAINABLE_MODELS.find((m) => m.id === model) ?? EXPLAINABLE_MODELS[0];

  return (
    <div className="space-y-5">
      <RoadmapSectionCard
        title="Model Selection"
        subtitle="Only the deployed ECG classifier exposes real attribution"
        icon="insights"
        right={<FeatureStatusBadge status="prototype" />}
      >
        <div className="flex flex-wrap gap-2">
          {EXPLAINABLE_MODELS.map((m) => (
            <button
              key={m.id}
              id={`explain-model-${m.id}`}
              onClick={() => setModel(m.id)}
              aria-pressed={model === m.id}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                model === m.id
                  ? 'bg-[#ffe8e8] border-[#bc000a]/25 text-[#bc000a]'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {m.supported ? 'check_circle' : 'schedule'}
              </span>
              {m.label}
              {!m.supported && (
                <span className="text-[9px] font-mono uppercase text-slate-400">Coming Soon</span>
              )}
            </button>
          ))}
        </div>
      </RoadmapSectionCard>

      {active.supported ? (
        <RoadmapSectionCard
          title="ECG Attribution"
          subtitle="Real capability reference"
          icon="show_chart"
          right={<FeatureStatusBadge status="available" />}
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            The deployed ECG pipeline provides saliency attribution for classified heartbeats. The
            full interactive view lives in the existing analysis screen.
          </p>
          <button
            id="explain-open-ecg-btn"
            onClick={() => onNavigate('ecg-analysis')}
            className="mt-3 px-4 py-2.5 rounded-xl bg-[#bc000a] text-white text-xs font-semibold hover:bg-[#920008] transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Open ECG Analysis (Live)
          </button>
        </RoadmapSectionCard>
      ) : (
        <RoadmapSectionCard
          title="Feature / Contribution Visualization"
          subtitle="Placeholder panel"
          icon="bar_chart"
        >
          <div className="space-y-2.5" aria-hidden="true">
            {['Feature A', 'Feature B', 'Feature C', 'Feature D'].map((f, i) => (
              <div key={f} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400 w-16 shrink-0">{f}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-300/70"
                    style={{ width: `${75 - i * 15}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <EmptyAnalysisState
              title="No supported model"
              message="Contribution bars are layout placeholders. Explanations cannot be generated for models that do not exist."
            />
          </div>
        </RoadmapSectionCard>
      )}

      <PrototypeDisclaimer message="Explanations are never fabricated. Attribution UI activates only for models that actually compute it — currently the ECG/QML classifier." />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Calibration
// ---------------------------------------------------------------------------

const CalibrationPanel: React.FC = () => {
  const [model, setModel] = useState<string>('ecg');

  return (
    <div className="space-y-5">
      <RoadmapSectionCard
        title="Model Selection"
        subtitle="Choose a model to inspect calibration"
        icon="memory"
        right={<FeatureStatusBadge status="coming-soon" />}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ecg', label: 'ECG / QML (deployed)' },
            { id: 'future', label: 'Future models' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              aria-pressed={model === m.id}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                model === m.id
                  ? 'bg-[#ffe8e8] border-[#bc000a]/25 text-[#bc000a]'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </RoadmapSectionCard>

      <RoadmapSectionCard
        title="Calibration Curve"
        subtitle="Chart placeholder"
        icon="ssid_chart"
      >
        <div className="rounded-xl bg-slate-950 border border-slate-800 aspect-21/9 relative flex items-center justify-center overflow-hidden">
          {/* Diagonal reference line (perfect calibration) purely as layout art */}
          <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full opacity-30" aria-hidden="true">
            <line x1="10" y1="50" x2="90" y2="10" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2 2" />
          </svg>
          <div className="relative z-10 text-center">
            <span className="material-symbols-outlined text-[28px] text-slate-600">straighten</span>
            <p className="text-[11px] font-mono text-slate-500 mt-1.5">Calibration curve placeholder</p>
            <p className="text-[10px] font-mono text-slate-700 mt-1">
              No calibration data measured
            </p>
          </div>
        </div>
      </RoadmapSectionCard>

      <RoadmapSectionCard title="Calibration Metrics" subtitle="Placeholder metrics" icon="query_stats">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ResearchMetricCard label="ECE" state="Awaiting run" />
          <ResearchMetricCard label="Brier score" state="Awaiting run" />
          <ResearchMetricCard label="Reliability" state="Awaiting run" />
        </div>
      </RoadmapSectionCard>

      <PrototypeDisclaimer message="Calibration analysis is planned. No curve or metric on this screen represents a measured value." />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Bias / Fairness Analysis
// ---------------------------------------------------------------------------

const COHORTS = ['All patients', 'Age group', 'Sex', 'Device type'];

const FairnessPanel: React.FC = () => {
  const [cohort, setCohort] = useState<string>('All patients');

  return (
    <div className="space-y-5">
      <RoadmapSectionCard
        title="Cohort Selector"
        subtitle="Comparison groups"
        icon="groups"
        right={<FeatureStatusBadge status="research-preview" />}
      >
        <div className="flex flex-wrap gap-2">
          {COHORTS.map((c) => (
            <button
              key={c}
              id={`fairness-cohort-${c.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setCohort(c)}
              aria-pressed={cohort === c}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                cohort === c
                  ? 'bg-[#ffe8e8] border-[#bc000a]/25 text-[#bc000a]'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-slate-400 mt-3">
          Group comparison rows for “{cohort}” render as layout placeholders below.
        </p>
      </RoadmapSectionCard>

      <RoadmapSectionCard
        title="Demographic Group Comparison"
        subtitle="Placeholder table"
        icon="balance"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-3 font-mono text-[10px] uppercase text-slate-400 font-bold">Group</th>
                <th className="py-2 pr-3 font-mono text-[10px] uppercase text-slate-400 font-bold">Selection rate</th>
                <th className="py-2 pr-3 font-mono text-[10px] uppercase text-slate-400 font-bold">Equalized odds</th>
                <th className="py-2 font-mono text-[10px] uppercase text-slate-400 font-bold">Disparity</th>
              </tr>
            </thead>
            <tbody>
              {['Group A', 'Group B', 'Group C'].map((g) => (
                <tr key={g} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-bold text-slate-600">{g}</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-400">—</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-400">—</td>
                  <td className="py-2.5 font-mono text-slate-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <EmptyAnalysisState
            title="Fairness analysis not available"
            message="Fairness metrics require a validated model, a labeled cohort, and an approved research protocol. None are connected in this prototype."
          />
        </div>
      </RoadmapSectionCard>

      <PrototypeDisclaimer message="Research-only. The comparison table is a framework illustration — demographic placeholders, not real populations, and no disparity values are measured." />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. Clinical Workflow Evaluation
// ---------------------------------------------------------------------------

const WorkflowPanel: React.FC = () => (
  <div className="space-y-5">
    <RoadmapSectionCard
      title="Workflow Diagram"
      subtitle="Clinician-in-the-loop evaluation loop"
      icon="account_tree"
      right={<FeatureStatusBadge status="coming-soon" label="Planned" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {[
          { step: '1', name: 'Clinical Review', desc: 'Clinician reviews case context', icon: 'medical_information' },
          { step: '2', name: 'Model Output Review', desc: 'AI decision-support output is inspected', icon: 'psychology' },
          { step: '3', name: 'Feedback', desc: 'Agreement / correction captured', icon: 'rate_review' },
          { step: '4', name: 'Documentation & Audit', desc: 'Encrypted audit trail retained', icon: 'history_edu' },
        ].map((s) => (
          <div
            key={s.step}
            className={`rounded-xl border p-3.5 text-center ${
              s.step === '1'
                ? 'bg-[#ffe8e8] border-[#bc000a]/20'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[9px] font-mono text-slate-400 block font-bold">STEP {s.step}</span>
            <span
              className={`material-symbols-outlined text-[22px] mt-1 block ${
                s.step === '1' ? 'text-[#bc000a]' : 'text-slate-400'
              }`}
            >
              {s.icon}
            </span>
            <span className="text-xs font-bold text-slate-700 block mt-1">{s.name}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">{s.desc}</span>
          </div>
        ))}
      </div>
    </RoadmapSectionCard>

    <RoadmapSectionCard
      title="Evaluation & Audit Placeholders"
      subtitle="Documentation area"
      icon="history_edu"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Review log', value: 'No reviews recorded' },
          { label: 'Feedback capture', value: 'Not instrumented' },
          { label: 'Audit export', value: 'Planned' },
          { label: 'Time-to-decision tracking', value: 'Planned' },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3"
          >
            <span className="text-xs font-bold text-slate-700">{row.label}</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">{row.value}</span>
          </div>
        ))}
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="Workflow evaluation is planned. The four-step loop describes the intended clinician-in-the-loop study design." />
  </div>
);

export const ResearchScreen: React.FC<ResearchScreenProps> = ({
  initialModule = 'research-overview',
  onNavigate,
}) => {
  return (
    <ResearchSubShell
      title={
        initialModule === 'research-overview'
          ? 'Clinical Research'
          : (SUB_NAV.find((s) => s.id === initialModule)?.label ?? 'Clinical Research')
      }
      subtitle={
        initialModule === 'research-overview'
          ? 'Research & validation frameworks for Dr. Radar models — external validation, prospective evaluation, explainability, calibration, fairness, and workflow evaluation.'
          : 'Part of the Clinical Research roadmap area — research preview UI.'
      }
      activeTab={initialModule}
      onNavigate={onNavigate}
    >
      {initialModule === 'research-overview' && <OverviewPanel onNavigate={onNavigate} />}
      {initialModule === 'research-validation' && <ValidationPanel />}
      {initialModule === 'research-prospective' && <ProspectivePanel />}
      {initialModule === 'research-explainability' && (
        <ExplainabilityPanel onNavigate={onNavigate} />
      )}
      {initialModule === 'research-calibration' && <CalibrationPanel />}
      {initialModule === 'research-fairness' && <FairnessPanel />}
      {initialModule === 'research-workflow' && <WorkflowPanel />}
    </ResearchSubShell>
  );
};
