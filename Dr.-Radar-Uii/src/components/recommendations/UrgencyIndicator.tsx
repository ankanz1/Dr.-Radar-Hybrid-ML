import React from 'react';
import { CareUrgencyLevel } from '../../types/recommendations';

interface UrgencyIndicatorProps {
  level: CareUrgencyLevel;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export const UrgencyIndicator: React.FC<UrgencyIndicatorProps> = ({
  level,
  label,
  className = '',
  showIcon = true,
}) => {
  const config = getUrgencyConfig(level);
  const displayLabel = label || config.defaultLabel;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.containerClasses} ${className}`}
    >
      {showIcon && (
        <span className={`material-symbols-outlined text-[15px] ${config.iconClasses}`}>
          {config.icon}
        </span>
      )}
      <span className="tracking-tight">{displayLabel}</span>
    </div>
  );
};

function getUrgencyConfig(level: CareUrgencyLevel) {
  switch (level) {
    case 'routine':
      return {
        defaultLabel: 'Routine Follow-Up',
        icon: 'check_circle',
        containerClasses: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        iconClasses: 'text-emerald-600',
      };
    case 'soon':
      return {
        defaultLabel: 'Follow-Up Recommended',
        icon: 'info',
        containerClasses: 'bg-blue-50 text-blue-800 border-blue-200/80',
        iconClasses: 'text-blue-600',
      };
    case 'priority':
      return {
        defaultLabel: 'Priority Follow-Up',
        icon: 'notifications_active',
        containerClasses: 'bg-amber-50 text-amber-900 border-amber-300',
        iconClasses: 'text-amber-700',
      };
    case 'urgent':
      return {
        defaultLabel: 'Urgent Medical Attention',
        icon: 'emergency',
        containerClasses: 'bg-rose-50 text-rose-900 border-rose-300 font-bold',
        iconClasses: 'text-rose-700',
      };
    case 'emergency':
      return {
        defaultLabel: 'Emergency Medical Care',
        icon: 'warning',
        containerClasses: 'bg-[#ffe8e8] text-[#bc000a] border-[#bc000a]/40 font-bold animate-pulse',
        iconClasses: 'text-[#bc000a]',
      };
    default:
      return {
        defaultLabel: 'Care Guidance',
        icon: 'health_and_safety',
        containerClasses: 'bg-slate-50 text-slate-700 border-slate-200',
        iconClasses: 'text-slate-600',
      };
  }
}
