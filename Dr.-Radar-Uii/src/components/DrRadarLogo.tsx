import React from 'react';

interface DrRadarLogoProps {
  className?: string;
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  alt?: string;
}

const sizeMap = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

export const DrRadarLogo: React.FC<DrRadarLogoProps> = ({
  className = '',
  size = 'md',
  animated = false,
  alt = 'Dr. Radar Logo',
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 36;
  const uniqueId = React.useId().replace(/:/g, '');
  const clipId = `radar-clip-${uniqueId}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      role="img"
      aria-label={alt}
    >
      <svg
        viewBox="0 0 500 500"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          {/* Clip path inside outer ring */}
          <clipPath id={clipId}>
            <circle cx="250" cy="250" r="213" />
          </clipPath>
        </defs>

        {/* Circular canvas background */}
        <circle cx="250" cy="250" r="213" fill="#f8fafc" />

        {/* Top Radar Scan Wedge / Cone */}
        <g clipPath={`url(#${clipId})`}>
          <polygon
            points="250,250 192,30 308,30"
            fill="#f87171"
            fillOpacity="0.22"
            className={animated ? 'origin-center animate-pulse' : ''}
          />

          {/* Vertical Radar Beam Line */}
          <line
            x1="250"
            y1="252"
            x2="250"
            y2="94"
            stroke="#bc000a"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </g>

        {/* Inner Concentric Circle (Radar Scope Grid) */}
        <circle
          cx="250"
          cy="250"
          r="166"
          stroke="#94a3b8"
          strokeWidth="3.5"
          fill="none"
          opacity="0.85"
        />

        {/* Outer Circular Rim */}
        <circle
          cx="250"
          cy="250"
          r="213"
          stroke="#1e2329"
          strokeWidth="12"
          fill="none"
        />

        {/* Radar Blip Target Halo & Core */}
        <g id="radar-target-blip">
          {/* Outer Translucent Pink Halo */}
          <circle
            cx="250"
            cy="116"
            r="22"
            fill="#ef4444"
            fillOpacity="0.28"
            className={animated ? 'animate-ping origin-[250px_116px] duration-1000' : ''}
          />
          {/* White Circular Gap */}
          <circle cx="250" cy="116" r="9.5" fill="#ffffff" />
          {/* Red Central Blip Target */}
          <circle cx="250" cy="116" r="6.5" fill="#bc000a" />
        </g>

        {/* ECG Lead Waveform (P-QRS-T with elevated R-peak meeting the radar target) */}
        <path
          d="M 104 250
             L 156 250
             L 174 238
             L 190 250
             L 214 250
             L 223 268
             L 250 128
             L 277 268
             L 286 250
             L 310 250
             L 332 230
             L 352 250
             L 396 250"
          stroke="#181b20"
          strokeWidth="10.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
};
