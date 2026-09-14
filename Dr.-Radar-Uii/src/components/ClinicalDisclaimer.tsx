import React from 'react';

export const CLINICAL_DISCLAIMER_TEXT =
  'Dr. Radar is an experimental biomedical research and clinical decision-support platform, not a standalone diagnostic device.';

export type PrototypeLabelType = 'demo' | 'sample' | 'prototype' | 'verified';

interface PrototypeResultBadgeProps {
  type?: PrototypeLabelType;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Standardized badge to label research validation samples and telemetry records.
 */
export const PrototypeResultBadge: React.FC<PrototypeResultBadgeProps> = ({
  type = 'sample',
  label,
  size = 'sm',
  className = '',
}) => {
  const text =
    label ||
    (type === 'demo'
      ? 'Validation Data'
      : type === 'prototype'
      ? 'Research Inference'
      : type === 'verified'
      ? 'QML Verified'
      : 'Research Sample');

  const sizeClasses =
    size === 'xs'
      ? 'text-[9.5px] px-1.5 py-0.5'
      : size === 'md'
      ? 'text-xs px-2.5 py-1'
      : 'text-[10px] px-2 py-0.5';

  const typeStyles =
    type === 'verified'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200/90';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-mono font-semibold uppercase tracking-wider shadow-2xs select-none ${sizeClasses} ${typeStyles} ${className}`}
      title="Biomedical research and decision-support record. For clinical investigation."
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${type === 'verified' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      <span>{text}</span>
    </span>
  );
};

interface ClinicalDisclaimerProps {
  className?: string;
  compact?: boolean;
  borderless?: boolean;
}

/**
 * Subtle and professional clinical non-diagnostic disclaimer.
 * Keeps notice modest, calm, and readable without visual dominance.
 */
export const ClinicalDisclaimer: React.FC<ClinicalDisclaimerProps> = ({
  className = '',
  compact = false,
  borderless = false,
}) => {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 text-[10.5px] text-slate-500 font-normal leading-normal ${className}`}
      >
        <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0 select-none">
          info
        </span>
        <p>{CLINICAL_DISCLAIMER_TEXT}</p>
      </div>
    );
  }

  return (
    <aside
      aria-label="Clinical Decision-Support Disclaimer"
      className={`rounded-xl text-[11px] text-slate-500 leading-relaxed flex items-start gap-2.5 select-text ${
        borderless
          ? 'py-2 px-1'
          : 'p-3 bg-slate-50/90 border border-slate-200/80 shadow-2xs'
      } ${className}`}
    >
      <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0 mt-0.5 select-none">
        shield
      </span>
      <div>
        <p className="text-slate-600 font-normal">
          <strong className="font-semibold text-slate-700 mr-1">Decision-Support Notice:</strong>
          {CLINICAL_DISCLAIMER_TEXT}
        </p>
      </div>
    </aside>
  );
};
