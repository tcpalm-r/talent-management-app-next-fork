'use client';

import React from 'react';

interface ThreeSixtyLogoProps {
  size?: number;
  className?: string;
}

export function ThreeSixtyLogo({ size = 40, className = '' }: ThreeSixtyLogoProps) {
  const uid = React.useId().replace(/:/g, '');
  const color = '#00A3E1';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="360° Feedback Logo"
    >
      {/* Thick stroked arc: ~300° sweep */}
      <path
        d="M 71.2 28.8 A 30 30 0 1 1 42.2 21"
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Arrowhead triangle, pointing clockwise */}
      <polygon
        points="38.6,7.5 63.5,15.3 45.8,34.5"
        fill={color}
      />
    </svg>
  );
}

export default ThreeSixtyLogo;
