import React, { useState } from 'react';
import { UserAccountState } from '../../types';
import { resolveUserAvatarUrl, NEUTRAL_DEFAULT_AVATAR_URL } from '../../data/avatarsData';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'huge';

interface ProfileAvatarProps {
  user?: Partial<UserAccountState> | null;
  src?: string;
  alt?: string;
  size?: AvatarSize;
  className?: string;
  showIndicator?: boolean;
  indicatorColor?: 'green' | 'red' | 'blue';
  borderStyle?: 'none' | 'subtle' | 'brand' | 'ring';
  fallbackInitials?: string;
  onClick?: () => void;
  title?: string;
  id?: string;
}

const SIZE_MAP: Record<AvatarSize, { container: string; text: string; indicator: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', indicator: 'w-2 h-2' },
  sm: { container: 'w-8 h-8', text: 'text-xs', indicator: 'w-2.5 h-2.5' },
  md: { container: 'w-10 h-10', text: 'text-sm', indicator: 'w-3 h-3' },
  lg: { container: 'w-12 h-12', text: 'text-base', indicator: 'w-3 h-3' },
  xl: { container: 'w-16 h-16', text: 'text-xl', indicator: 'w-3.5 h-3.5' },
  '2xl': { container: 'w-20 h-20', text: 'text-2xl', indicator: 'w-4 h-4' },
  '3xl': { container: 'w-24 h-24', text: 'text-3xl', indicator: 'w-5 h-5' },
  huge: { container: 'w-28 h-28 sm:w-32 sm:h-32', text: 'text-4xl', indicator: 'w-6 h-6' },
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user,
  src,
  alt,
  size = 'md',
  className = '',
  showIndicator = false,
  indicatorColor = 'green',
  borderStyle = 'subtle',
  fallbackInitials,
  onClick,
  title,
  id,
}) => {
  const [hasError, setHasError] = useState(false);

  // Resolved URL priority: explicit prop > resolved from user state > neutral default
  const effectiveUrl = src || resolveUserAvatarUrl(user);

  const displayName = user?.displayName || user?.firstName || 'User';
  const computedAlt = alt || `${displayName}'s profile picture`;

  const borderClass = {
    none: '',
    subtle: 'border border-slate-200/90 shadow-2xs',
    brand: 'border-2 border-[#bc000a]/40 shadow-xs',
    ring: 'ring-2 ring-white border-2 border-[#bc000a] shadow-xs',
  }[borderStyle];

  const indicatorBg = {
    green: 'bg-emerald-500',
    red: 'bg-[#bc000a]',
    blue: 'bg-sky-500',
  }[indicatorColor];

  const { container, text, indicator } = SIZE_MAP[size];

  const initials =
    fallbackInitials ||
    (user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] || ''}` : 'DR');

  return (
    <div
      id={id}
      onClick={onClick}
      title={title || computedAlt}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      <div
        className={`${container} rounded-full overflow-hidden bg-slate-100 flex items-center justify-center ${borderClass}`}
      >
        {!hasError && effectiveUrl ? (
          <img
            src={effectiveUrl}
            alt={computedAlt}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#f0f7ff] text-[#bc000a] font-black flex items-center justify-center">
            <span className={`${text} tracking-tight`}>{initials}</span>
          </div>
        )}
      </div>

      {showIndicator && (
        <span
          className={`absolute bottom-0 right-0 ${indicator} rounded-full ${indicatorBg} ring-2 ring-white shadow-xs`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
