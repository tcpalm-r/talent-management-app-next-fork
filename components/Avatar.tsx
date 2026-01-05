'use client';

import { useMemo } from 'react';
import Image from 'next/image';

interface AvatarProps {
  name?: string;
  picture?: string;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({
  name = 'Unknown',
  picture,
  email,
  size = 'md',
  className = ''
}: AvatarProps) {
  const sizeClasses = {
    xs: 'w-5 h-5 text-xs leading-none',
    sm: 'w-6 h-6 text-xs leading-none',
    md: 'w-8 h-8 text-sm leading-none',
    lg: 'w-10 h-10 text-base leading-none'
  };

  const fontSizeStyles = {
    xs: { fontSize: '9px' },
    sm: { fontSize: '10px' },
    md: { fontSize: '12px' },
    lg: { fontSize: '14px' }
  };

  const initials = useMemo(() => {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }, [name]);

  // If picture exists, show it
  if (picture) {
    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClasses[size]} ${className}`}>
        <Image
          src={picture}
          alt={name}
          fill
          className="object-cover"
          style={fontSizeStyles[size]}
          title={name}
        />
      </div>
    );
  }

  // Fall back to initials in blue circle
  return (
    <div
      className={`rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold ${sizeClasses[size]} ${className}`}
      style={fontSizeStyles[size]}
      title={name}
    >
      {initials}
    </div>
  );
}
