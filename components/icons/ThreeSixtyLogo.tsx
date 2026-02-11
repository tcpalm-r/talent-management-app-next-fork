'use client';

import React from 'react';

interface ThreeSixtyLogoProps {
  size?: number;
  className?: string;
}

export function ThreeSixtyLogo({ size = 40, className = '' }: ThreeSixtyLogoProps) {
  // All arcs use Sonance Blue with varying opacity for depth
  const cyanColor = '#00A3E1';
  const amberColor = '#00A3E1';
  const purpleColor = '#00A3E1';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="360° Feedback Logo"
    >
      <defs>
        {/* Gradients for each arc segment */}
        <linearGradient id="arc360Cyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={cyanColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={cyanColor} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="arc360Amber" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={amberColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={amberColor} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="arc360Purple" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={purpleColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={purpleColor} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Three thick arc segments forming a pinwheel rotation pattern */}
      {/* Each arc spans ~110° with ~10° gaps, creating a 360° flow */}

      {/* Arc 1: Cyan (10° to 110°) — right/bottom region */}
      <path
        d="M 91.4 57.3 A 42 42 0 0 1 35.6 89.5 L 44.5 65.0 A 16 16 0 0 0 65.8 52.8 Z"
        fill="url(#arc360Cyan)"
        style={{ mixBlendMode: 'multiply' }}
      />

      {/* Arc 2: Amber (130° to 230°) — left region */}
      <path
        d="M 23.0 82.2 A 42 42 0 0 1 23.0 17.8 L 39.7 37.7 A 16 16 0 0 0 39.7 62.3 Z"
        fill="url(#arc360Amber)"
        style={{ mixBlendMode: 'multiply' }}
      />

      {/* Arc 3: Purple (250° to 350°) — top region */}
      <path
        d="M 35.6 10.5 A 42 42 0 0 1 91.4 42.7 L 65.8 47.2 A 16 16 0 0 0 44.5 35.0 Z"
        fill="url(#arc360Purple)"
        style={{ mixBlendMode: 'multiply' }}
      />

      {/* Center highlight where arcs meet — subtle glow */}
      <circle
        cx="50"
        cy="50"
        r="10"
        fill="white"
        fillOpacity="0.3"
      />
    </svg>
  );
}

export default ThreeSixtyLogo;
