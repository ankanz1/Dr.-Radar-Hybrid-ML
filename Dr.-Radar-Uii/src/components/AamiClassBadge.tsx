import React from 'react';
import { AamiClassCode, getAamiClass, AAMI_SYSTEM_DISCLAIMER, AAMI_ORDERED_CODES } from '../data/aamiClassSystem';

interface AamiClassBadgeProps {
  code: string | AamiClassCode;
  variant?: 'compact' | 'full' | 'both' | 'pill' | 'outline' | 'solid-compact';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Standardized AAMI Class Badge Component
 * Enforces uniform typography, icons, colors, and accessible contrast across the entire app.
 */
export const AamiClassBadge: React.FC<AamiClassBadgeProps> = ({
  code,
  variant = 'both',
  size = 'md',
  showIcon = false,
  isActive = false,
  className = '',
  onClick,
}) => {
  const meta = getAamiClass(code);

  // Size styling maps
  const sizeStyles = {
    xs: {
      badge: 'w-4 h-4 text-[9px]',
      container: 'text-[10px] gap-1 px-1.5 py-0.5',
      icon: 'text-[11px]',
    },
    sm: {
      badge: 'w-5 h-5 text-[10px]',
      container: 'text-xs gap-1.5 px-2 py-0.5',
      icon: 'text-[13px]',
    },
    md: {
      badge: 'w-6 h-6 text-xs',
      container: 'text-xs gap-2 px-2.5 py-1',
      icon: 'text-[15px]',
    },
    lg: {
      badge: 'w-8 h-8 text-sm',
      container: 'text-sm gap-2.5 px-3.5 py-1.5',
      icon: 'text-[18px]',
    },
  }[size];

  // 1. Compact Variant: Just the single letter abbreviation in standard container
  if (variant === 'compact' || variant === 'solid-compact') {
    return (
      <span
        title={`${meta.abbreviation} — ${meta.name}`}
        style={{
          backgroundColor: variant === 'solid-compact' ? meta.color : meta.bgLight,
          color: variant === 'solid-compact' ? meta.textOnSolid : meta.textDark,
          borderColor: meta.borderLight,
        }}
        className={`inline-flex items-center justify-center font-mono font-bold rounded-lg border shadow-2xs shrink-0 select-none ${sizeStyles.badge} ${
          onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''
        } ${className}`}
        onClick={onClick}
      >
        {meta.abbreviation}
      </span>
    );
  }

  // 2. Pill Variant: Rounded-full chip
  if (variant === 'pill') {
    return (
      <span
        style={{
          backgroundColor: meta.bgLight,
          color: meta.textDark,
          borderColor: meta.borderLight,
        }}
        className={`inline-flex items-center rounded-full border font-medium shadow-2xs select-none ${sizeStyles.container} ${
          isActive ? 'ring-2' : ''
        } ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''} ${className}`}
        onClick={onClick}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        {showIcon && (
          <span className={`material-symbols-outlined shrink-0 ${sizeStyles.icon}`} style={{ color: meta.color }}>
            {meta.iconName}
          </span>
        )}
        <span className="font-mono font-bold tracking-tight">{meta.abbreviation}</span>
        <span className="text-slate-400 font-normal">|</span>
        <span className="truncate">{meta.name}</span>
      </span>
    );
  }

  // 3. Full name only
  if (variant === 'full') {
    return (
      <span
        className={`inline-flex items-center font-semibold select-none ${sizeStyles.container} ${className}`}
        style={{ color: meta.textDark }}
        onClick={onClick}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 mr-1.5"
          style={{ backgroundColor: meta.color }}
        />
        <span>{meta.name}</span>
      </span>
    );
  }

  // 4. Outline Variant
  if (variant === 'outline') {
    return (
      <span
        style={{
          borderColor: meta.color,
          color: meta.textDark,
          backgroundColor: 'transparent',
        }}
        className={`inline-flex items-center rounded-lg border font-medium shadow-2xs select-none ${sizeStyles.container} ${className}`}
        onClick={onClick}
      >
        <span
          className={`font-mono font-bold rounded flex items-center justify-center ${sizeStyles.badge}`}
          style={{ backgroundColor: meta.color, color: meta.textOnSolid }}
        >
          {meta.abbreviation}
        </span>
        <span className="font-semibold">{meta.name}</span>
      </span>
    );
  }

  // 5. Default 'both': Abbreviation badge + Full Name
  return (
    <span
      style={{
        backgroundColor: meta.bgLight,
        borderColor: meta.borderLight,
      }}
      className={`inline-flex items-center rounded-xl border font-medium shadow-2xs select-none ${sizeStyles.container} ${
        isActive ? 'ring-2' : ''
      } ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      <span
        className={`font-mono font-bold rounded-lg flex items-center justify-center shrink-0 shadow-xs ${sizeStyles.badge}`}
        style={{ backgroundColor: meta.color, color: meta.textOnSolid }}
      >
        {meta.abbreviation}
      </span>
      <span className="font-semibold text-[#101c28] tracking-tight">{meta.name}</span>
    </span>
  );
};

interface AamiClassDistributionBarProps {
  code: string | AamiClassCode;
  probability: number; // 0 to 100
  isDominant?: boolean;
  showPercent?: boolean;
  compact?: boolean;
}

/**
 * Standardized AAMI Probability Row with class-accurate color accent & accessible typography
 */
export const AamiClassDistributionBar: React.FC<AamiClassDistributionBarProps> = ({
  code,
  probability,
  isDominant = false,
  showPercent = true,
  compact = false,
}) => {
  const meta = getAamiClass(code);

  return (
    <div className={`space-y-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Uniform square abbreviation badge */}
          <span
            style={{
              backgroundColor: isDominant ? meta.color : meta.bgLight,
              color: isDominant ? meta.textOnSolid : meta.textDark,
              borderColor: meta.borderLight,
            }}
            className="w-5 h-5 rounded-md text-[11px] font-mono font-bold flex items-center justify-center border shadow-2xs shrink-0"
          >
            {meta.abbreviation}
          </span>
          {/* Full Name in Detailed context */}
          <span
            className={`${
              isDominant ? 'font-bold text-[#101c28]' : 'text-slate-600 font-medium'
            }`}
          >
            {meta.name}
          </span>
        </div>

        {showPercent && (
          <span
            className={`font-mono ${
              isDominant
                ? 'font-bold text-sm'
                : 'font-semibold text-slate-600'
            }`}
            style={{ color: isDominant ? meta.color : undefined }}
          >
            {probability.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Probability Progress Track */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(probability, 1)}%`,
            backgroundColor: isDominant ? meta.color : `${meta.color}90`,
          }}
        />
      </div>
    </div>
  );
};

/**
 * Visual System Reference Legend Card
 * Clarifies categorical color presentation vs severity
 */
export const AamiClassSystemLegend: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="bg-[#f8fbfe] p-3 rounded-xl border border-slate-200/80 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-[#101c28] uppercase tracking-wider text-[11px]">
          <span className="material-symbols-outlined text-[16px] text-[#bc000a]">
            palette
          </span>
          <span>AAMI EC57 Class System</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          WCAG AA Compliant &bull; 5 Taxonomic Categories
        </span>
      </div>

      {/* 5 Class Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {AAMI_ORDERED_CODES.map((code) => {
          const m = getAamiClass(code);
          return (
            <div
              key={code}
              style={{ backgroundColor: m.bgLight, borderColor: m.borderLight }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
            >
              <span
                style={{ backgroundColor: m.color, color: m.textOnSolid }}
                className="w-4 h-4 rounded text-[9.5px] font-mono font-bold flex items-center justify-center shrink-0"
              >
                {m.abbreviation}
              </span>
              <span
                style={{ color: m.textDark }}
                className="font-medium text-[11px] truncate"
                title={m.name}
              >
                {m.name}
              </span>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="text-[10.5px] text-slate-500 leading-normal pt-1 border-t border-slate-200/60 font-sans">
          <strong>Categorical presentation rule:</strong> {AAMI_SYSTEM_DISCLAIMER}
        </p>
      )}
    </div>
  );
};
