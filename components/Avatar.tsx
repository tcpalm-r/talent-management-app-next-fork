'use client';

import { useMemo } from 'react';

interface AvatarProps {
  name?: string;
  picture?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
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
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
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
      <img
        src={picture}
        alt={name}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
        title={name}
      />
    );
  }

  // Fall back to initials in blue circle
  return (
    <div
      className={`rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold ${sizeClasses[size]} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
