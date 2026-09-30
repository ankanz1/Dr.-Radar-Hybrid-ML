import React, { useState } from 'react';
import { ScreenTab } from '../../types';
import {
  FeatureStatusBadge,
  RoadmapSectionCard,
  PrototypeDisclaimer,
  EmptyAnalysisState,
  TimelinePlaceholder,
} from './RoadmapPrimitives';

/* ============================================================================
   Phase 6 — Multimodal AI (research prototype UI)
   Overview + history-labs, imaging-context, risk-profile, longitudinal.
   ========================================================================== */

interface MultimodalScreenProps {
  initialModule?: ScreenTab;
  onNavigate: (tab: ScreenTab) => void;
}

const SUB_NAV: { id: ScreenTab; label: string; icon: string }[] = [
  { id: 'multimodal', label: 'Overview', icon: 'dashboard' },
  { id: 'multimodal-history-labs', label: 'History + Labs', icon: 'timeline' },
  { id: 'multimodal-imaging-context', label: 'Imaging + Context', icon: 'image_search' },
  { id: 'multimodal-risk-profile', label: 'Risk Profile', icon: 'donut_small' },
  { id: 'multimodal-longitudinal', label: 'Longitudinal Tracking', icon: 'monitoring' },
];

const MultimodalSubShell: React.FC<{
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
          onClick={() => onNavigate('multimodal')}
          className="text-xs font-semibold text-slate-500 hover:text-[#bc000a] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Multimodal AI
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
      aria-label="Multimodal AI sections"
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

const OverviewPanel: React.FC<{ onNavigate: (tab: ScreenTab) => void }> = ({ onNavigate }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {[
        {
          id: 'multimodal-history-labs' as ScreenTab,
          name: 'Clinical History + Laboratory Data',
          desc: 'Combine structured history and lab context into a single analysis view.',
          icon: 'timeline',
          status: 'prototype' as const,
        },
        {
          id: 'multimodal-imaging-context' as ScreenTab,
          name: 'Imaging + Clinical Information',
          desc: 'Pair imaging inputs with clinical context for combined review.',
          icon: 'image_search',
          status: 'prototype' as const,
        },
        {
          id: 'multimodal-risk-profile' as ScreenTab,
          name: 'Multimodal Patient Risk Profile',
          desc: 'Cross-domain risk layout — honest placeholder states, no invented scores.',
          icon: 'donut_small',
          status: 'research-preview' as const,
        },
        {
          id: 'multimodal-longitudinal' as ScreenTab,
          name: 'Longitudinal Health Tracking',
          desc: 'Timeline of health events with future trend placeholders and date filters.',
          icon: 'monitoring',
          status: 'prototype' as const,
        },
      ].map((m) => (
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

    <PrototypeDisclaimer message="Dr. Radar does not yet operate a multimodal model. These screens communicate the intended analysis concepts without simulating outputs." />
  </div>
);

// ---------------------------------------------------------------------------
// 1. Clinical History + Laboratory Data
// ---------------------------------------------------------------------------

const HistoryLabsPanel: React.FC = () => {
  const [combined, setCombined] = useState(false);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RoadmapSectionCard
          title="Clinical History"
          subtitle="Timeline / summary card"
          icon="history"
          right={<FeatureStatusBadge status="prototype" />}
        >
          <div className="space-y-2.5">
            {[
              { date: 'Latest entry', title: 'Health assessment', msg: 'Questionnaire summary appears here when available.' },
              { date: 'Records', title: 'Uploaded records', msg: 'Documents and ECGs from your record vault.' },
              { date: 'Context', title: 'Clinical context', msg: 'Condition and medication context from My Health Information.' },
            ].map((e) => (
              <TimelinePlaceholder
                key={e.title}
                date={e.date}
                title={e.title}
                message={e.msg}
                icon="description"
              />
            ))}
          </div>
          <p className="text-[10.5px] text-slate-400 mt-2 leading-relaxed">
            Content is pulled from the existing health-information vault when present. No new data
            is created for this prototype.
          </p>
        </RoadmapSectionCard>

        <RoadmapSectionCard
          title="Laboratory Data"
          subtitle="Structured panel card"
          icon="labs"
          right={<FeatureStatusBadge status="prototype" />}
        >
          <div className="space-y-2.5">
            {['CBC', 'Lipid Profile', 'Glucose / HbA1c'].map((panel) => (
              <div
                key={panel}
                className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 flex items-center justify-between"
              >
                <span className="text-xs font-bold text-slate-700">{panel}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  No values loaded
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-slate-400 mt-3 leading-relaxed">
            Laboratory values are not ingested yet — rows remain in an empty state by design.
          </p>
        </RoadmapSectionCard>
      </div>

      <RoadmapSectionCard
        title="Combined Analysis"
        subtitle="Prototype interaction"
        icon="merge_type"
        right={<FeatureStatusBadge status="prototype" />}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            id="multimodal-combine-btn"
            onClick={() => setCombined((c) => !c)}
            aria-pressed={combined}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              combined
                ? 'bg-[#ffe8e8] border-[#bc000a]/30 text-[#bc000a]'
                : 'bg-[#bc000a] text-white border-transparent hover:bg-[#920008]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">merge_type</span>
            {combined ? 'Combined (Demo State)' : 'Combine Data'}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            This is a safe mock interaction — it toggles a demo layout state only. No model runs.
          </p>
        </div>

        <div className="mt-4">
          {combined ? (
            <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4">
              <p className="text-xs font-bold text-[#101c28] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">layers</span>
                Combined Context View (Prototype Layout)
              </p>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                History and laboratory cards would merge into one contextual summary here. The
                layout demonstrates the concept only.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['History snapshot', 'Lab snapshot', 'Context summary'].map((tile) => (
                  <div
                    key={tile}
                    className="rounded-lg bg-white border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-slate-600"
                  >
                    {tile} — placeholder
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyAnalysisState
              title="Combined view not generated"
              message="Press “Combine Data” to preview the combined-context layout. No multimodal model is involved."
            />
          )}
        </div>
      </RoadmapSectionCard>

      <PrototypeDisclaimer message="The Combine Data interaction toggles a layout state only. It never runs a model or produces clinical output." />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Imaging + Clinical Information
// ---------------------------------------------------------------------------

const ImagingContextPanel: React.FC = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <RoadmapSectionCard
        title="Imaging Input"
        subtitle="File interface placeholder"
        icon="image"
        right={<FeatureStatusBadge status="prototype" />}
      >
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/40 p-6 text-center">
          <span className="material-symbols-outlined text-[30px] text-slate-400">add_photo_alternate</span>
          <p className="text-xs font-bold text-slate-700 mt-2">Attach imaging study</p>
          <p className="text-[11px] text-slate-400 mt-1">
            DICOM / PNG mock — no file is read or stored.
          </p>
        </div>
      </RoadmapSectionCard>

      <RoadmapSectionCard
        title="Clinical Information"
        subtitle="Context card"
        icon="clinical_notes"
        right={<FeatureStatusBadge status="prototype" />}
      >
        <div className="space-y-2.5">
          {['Symptoms', 'Vitals', 'Medications', 'History notes'].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5"
            >
              <span className="text-xs font-bold text-slate-700">{row}</span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Empty</span>
            </div>
          ))}
        </div>
      </RoadmapSectionCard>
    </div>

    <RoadmapSectionCard
      title="Combined Context Visualization"
      subtitle="Analysis placeholder"
      icon="join_inner"
      right={<FeatureStatusBadge status="prototype" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950 border border-slate-800 aspect-video flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[28px] text-slate-600">image</span>
          <span className="text-[10px] font-mono text-slate-500 mt-1.5">Imaging tile — placeholder</span>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 aspect-video flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[28px] text-slate-400">summarize</span>
          <span className="text-[10px] font-mono text-slate-400 mt-1.5">Context tile — placeholder</span>
        </div>
      </div>
      <div className="mt-4">
        <EmptyAnalysisState message="Joint imaging–context analysis requires a supported multimodal model. This prototype shows the intended layout only." />
      </div>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="Imaging files are never uploaded or processed. All tiles and rows are static placeholders." />
  </div>
);

// ---------------------------------------------------------------------------
// 3. Multimodal Patient Risk Profile
// ---------------------------------------------------------------------------

const RISK_DOMAINS = [
  { name: 'Cardiovascular', icon: 'cardiology' },
  { name: 'Metabolic', icon: 'monitor_heart' },
  { name: 'Neurological', icon: 'neurology' },
  { name: 'Other', icon: 'category' },
];

const RiskProfilePanel: React.FC = () => (
  <div className="space-y-5">
    <RoadmapSectionCard
      title="Patient Summary"
      subtitle="Existing health-information context"
      icon="person"
      right={<FeatureStatusBadge status="research-preview" />}
    >
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          The patient summary reflects the existing “My Health Information” profile when completed.
          No new risk data is computed for this view.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {['Profile completeness', 'Assessment status', 'Record vault'].map((tile) => (
            <div key={tile} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {tile}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">From existing profile data</p>
            </div>
          ))}
        </div>
      </div>
    </RoadmapSectionCard>

    <RoadmapSectionCard
      title="Risk Domains"
      subtitle="Awaiting supported model — no scores displayed"
      icon="donut_small"
      right={<FeatureStatusBadge status="research-preview" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RISK_DOMAINS.map((d) => (
          <div key={d.name} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">{d.icon}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{d.name}</span>
              </div>
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded">
                Awaiting supported model
              </span>
            </div>
            {/* Visual layout placeholder — deliberately not a score */}
            <div className="mt-3 space-y-1.5" aria-hidden="true">
              <div className="h-2 rounded-full bg-slate-200/70 w-full" />
              <div className="h-2 rounded-full bg-slate-200/70 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-slate-400 mt-3 leading-relaxed">
        Numerical risk scores are intentionally not shown. Any displayed score would imply a model
        that does not exist.
      </p>
    </RoadmapSectionCard>

    <PrototypeDisclaimer message="The risk profile layout is a design concept. It does not compute, estimate, or display any risk value." />
  </div>
);

// ---------------------------------------------------------------------------
// 4. Longitudinal Health Tracking
// ---------------------------------------------------------------------------

const LongitudinalPanel: React.FC = () => {
  const [range, setRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');

  return (
    <div className="space-y-5">
      <RoadmapSectionCard
        title="Health Event Timeline"
        subtitle="Events from your existing records when available"
        icon="timeline"
        right={<FeatureStatusBadge status="prototype" />}
      >
        {/* Date range filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['3m', '6m', '1y', 'all'] as const).map((r) => (
            <button
              key={r}
              id={`longitudinal-range-${r}`}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                range === r
                  ? 'bg-[#ffe8e8] border-[#bc000a]/25 text-[#bc000a]'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {r === 'all' ? 'All time' : r.toUpperCase()}
            </button>
          ))}
          <span className="text-[10px] font-mono text-slate-400 ml-auto">
            Filter is a UI control — data set is unchanged
          </span>
        </div>

        <div className="space-y-1">
          <TimelinePlaceholder
            date="Today"
            title="ECG history"
            message="Saved ECG analyses appear here from your existing history. Empty until your first analysis."
            icon="ecg_heart"
          />
          <TimelinePlaceholder
            date="Ongoing"
            title="Laboratory trends"
            message="Lab value trends will chart here once laboratory data ingestion exists."
            icon="labs"
            tone="muted"
          />
          <TimelinePlaceholder
            date="Planned"
            title="Imaging & history entries"
            message="Imaging studies and longitudinal history entries are future data sources."
            icon="image"
            tone="muted"
          />
          <TimelinePlaceholder
            date="Future"
            title="Trend visualization"
            message="Projected trend charts across modalities will render here when supported models exist."
            icon="trending_up"
            tone="muted"
          />
        </div>
      </RoadmapSectionCard>

      <RoadmapSectionCard
        title="Future Trend Visualization"
        subtitle="Placeholder chart area"
        icon="monitoring"
      >
        <div className="rounded-xl bg-slate-950 border border-slate-800 aspect-21/9 flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[30px] text-slate-600">ssid_chart</span>
          <p className="text-[11px] font-mono text-slate-500 mt-2">Trend chart placeholder</p>
          <p className="text-[10px] font-mono text-slate-700 mt-1">
            No trend data exists to plot
          </p>
        </div>
      </RoadmapSectionCard>

      <PrototypeDisclaimer message="Timeline entries describe future data sources rather than pretending they exist. Only your real ECG history would populate this view today." />
    </div>
  );
};

export const MultimodalScreen: React.FC<MultimodalScreenProps> = ({
  initialModule = 'multimodal',
  onNavigate,
}) => {
  return (
    <MultimodalSubShell
      title={
        initialModule === 'multimodal'
          ? 'Multimodal AI'
          : (SUB_NAV.find((s) => s.id === initialModule)?.label ?? 'Multimodal AI')
      }
      subtitle={
        initialModule === 'multimodal'
          ? 'Concept screens for combining clinical history, laboratory data, imaging, and longitudinal context. No multimodal model is deployed.'
          : 'Part of the Multimodal AI roadmap area — research prototype UI.'
      }
      activeTab={initialModule}
      onNavigate={onNavigate}
    >
      {initialModule === 'multimodal' && <OverviewPanel onNavigate={onNavigate} />}
      {initialModule === 'multimodal-history-labs' && <HistoryLabsPanel />}
      {initialModule === 'multimodal-imaging-context' && <ImagingContextPanel />}
      {initialModule === 'multimodal-risk-profile' && <RiskProfilePanel />}
      {initialModule === 'multimodal-longitudinal' && <LongitudinalPanel />}
    </MultimodalSubShell>
  );
};
