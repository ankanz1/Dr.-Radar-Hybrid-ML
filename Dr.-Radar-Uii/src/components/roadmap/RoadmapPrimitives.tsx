import React from 'react';
import { MODULE_STATUS_META, ModuleStatus } from '../../data/roadmapModules';

/* ===========================================================================
   Shared roadmap UI primitives (Phase 5 / 6 / 7)
   Small, focused components reused across the prototype screens.
   ======================================================================== */

/**
 * Consistent status badge for module states: Available / Prototype /
 * Coming Soon / Research Preview.
 */
export const FeatureStatusBadge: React.FC<{
  status: ModuleStatus;
  label?: string;
  size?: 'sm' | 'md';
}> = ({ status, label, size = 'sm' }) => {
  const meta = MODULE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider rounded border ${
        meta.className
      } ${size === 'sm' ? 'text-[9.5px] px-2 py-0.5' : 'text-[10.5px] px-2.5 py-1'}`}
      title={meta.description}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClassName}`} />
      {label ?? meta.label}
    </span>
  );
};

/** Standard card shell used by all roadmap screens. */
export const RoadmapSectionCard: React.FC<{
  title?: string;
  subtitle?: string;
  icon?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, right, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs ${className}`}>
    {(title || right) && (
      <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="material-symbols-outlined text-[18px] text-[#bc000a] shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

/** Selectable module card used in module grids. */
export const ModuleCard: React.FC<{
  name: string;
  description: string;
  category: string;
  icon: string;
  status: ModuleStatus;
  onSelect?: () => void;
  selected?: boolean;
  footer?: React.ReactNode;
}> = ({ name, description, category, icon, status, onSelect, selected, footer }) => {
  const interactive = typeof onSelect === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive
        ? {
            onClick: onSelect,
            type: 'button' as const,
            'aria-pressed': selected,
          }
        : {})}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
        interactive ? 'cursor-pointer group ' : 'cursor-default '
      }${
        selected
          ? 'bg-white border-[#bc000a] shadow-sm ring-2 ring-[#bc000a]/10'
          : 'bg-white/80 hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
            selected ? 'bg-[#bc000a] text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <FeatureStatusBadge status={status} />
      </div>
      <h3
        className={`text-sm font-extrabold tracking-tight ${
          selected ? 'text-[#bc000a]' : 'text-[#101c28]'
        }`}
      >
        {name}
      </h3>
      <p className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase">{category}</p>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
      {footer && <div className="mt-3 pt-2.5 border-t border-slate-100">{footer}</div>}
    </Tag>
  );
};

/** Upload dropzone placeholder — never stores or analyzes anything. */
export const UploadPlaceholder: React.FC<{
  label: string;
  hint: string;
  icon?: string;
  previewState?: 'empty' | 'ready';
  previewLabel?: string;
  disabled?: boolean;
}> = ({
  label,
  hint,
  icon = 'upload_file',
  previewState = 'empty',
  previewLabel,
  disabled = false,
}) => (
  <div className="space-y-3">
    <div
      className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        disabled
          ? 'border-slate-200 bg-slate-50/60'
          : 'border-slate-300 bg-slate-50/40 hover:border-[#bc000a]/40'
      }`}
    >
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </div>
      <p className="text-xs font-bold text-slate-700 mt-2.5">{label}</p>
      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">{hint}</p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-200/70 text-slate-500 text-[11px] font-semibold cursor-not-allowed inline-flex items-center gap-1.5"
        title="Upload is disabled in this prototype"
      >
        <span className="material-symbols-outlined text-[14px]">lock</span>
        Disabled in prototype
      </button>
    </div>
    {/* Image/file preview state */}
    <div className="relative rounded-xl bg-slate-950 border border-slate-800 aspect-16/9 flex flex-col items-center justify-center text-center p-4 select-none overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] rounded-xl pointer-events-none" />
      <span className="material-symbols-outlined text-[30px] text-slate-600 relative z-10">
        {previewState === 'empty' ? 'image' : 'check_circle'}
      </span>
      <p className="text-[11px] font-mono text-slate-500 mt-1.5 relative z-10">
        {previewState === 'empty'
          ? 'Image preview placeholder'
          : previewLabel ?? 'File attached (prototype)'}
      </p>
      <p className="text-[10px] font-mono text-slate-700 mt-1 relative z-10">
        No file is stored or processed
      </p>
    </div>
  </div>
);

/** Honest empty/placeholder analysis state with no fabricated output. */
export const EmptyAnalysisState: React.FC<{
  title?: string;
  message: string;
  icon?: string;
}> = ({
  title = 'Awaiting supported analysis model',
  message,
  icon = 'model_training',
}) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-center">
    <div className="w-10 h-10 mx-auto rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
    </div>
    <p className="text-xs font-bold text-slate-700 mt-2.5">{title}</p>
    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">{message}</p>
    <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-wider">
      No clinical prediction available
    </p>
  </div>
);

/** Placeholder for disabled CTA rows / panels. */
export const DisabledActionRow: React.FC<{
  label: string;
  hint?: string;
  icon?: string;
}> = ({ label, hint, icon = 'play_arrow' }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-600 truncate">{label}</p>
        {hint && <p className="text-[10.5px] text-slate-400 truncate">{hint}</p>}
      </div>
    </div>
    <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded shrink-0">
      Coming Soon
    </span>
  </div>
);

/** Generic timeline placeholder row (Phase 6 longitudinal). */
export const TimelinePlaceholder: React.FC<{
  date: string;
  title: string;
  message: string;
  icon: string;
  tone?: 'default' | 'muted';
}> = ({ date, title, message, icon, tone = 'default' }) => (
  <div className="relative pl-8 pb-5 last:pb-0">
    {/* Vertical connector */}
    <span className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" aria-hidden="true" />
    <span
      className={`absolute left-0 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${
        tone === 'muted'
          ? 'bg-slate-50 border-slate-200 text-slate-300'
          : 'bg-white border-slate-300 text-slate-500'
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
    </span>
    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{date}</p>
    <p
      className={`text-xs font-bold mt-0.5 ${
        tone === 'muted' ? 'text-slate-400' : 'text-[#101c28]'
      }`}
    >
      {title}
    </p>
    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{message}</p>
  </div>
);

/** Research metric placeholder (no fabricated numbers). */
export const ResearchMetricCard: React.FC<{
  label: string;
  state: string;
  icon?: string;
}> = ({ label, state, icon = 'query_stats' }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="material-symbols-outlined text-[16px] text-slate-300">{icon}</span>
    </div>
    <p className="text-[11px] text-slate-400 mt-2 font-mono">{state}</p>
    <div className="mt-2.5 h-1.5 rounded-full bg-slate-200/70 overflow-hidden" aria-hidden="true">
      <div className="h-full w-1/3 bg-slate-300/70" />
    </div>
    <p className="text-[9.5px] font-mono text-slate-400 mt-1.5 uppercase">
      Placeholder — no measurement yet
    </p>
  </div>
);

/** Compact prototype disclaimer bar reused across screens. */
export const PrototypeDisclaimer: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-[#f0f7ff] border border-[#cbe2fc] rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
    <span className="material-symbols-outlined text-blue-600 text-[20px] shrink-0 mt-0.5">
      info
    </span>
    <p className="leading-relaxed">
      <span className="font-bold text-[#101c28]">Research Prototype: </span>
      {message}
    </p>
  </div>
);
