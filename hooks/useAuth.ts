/**
 * useAuth Hook
 *
 * Provides authentication state and methods to components.
 * Integrates with UserContext for global auth state.
 */

'use client';

import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import type { SessionUser } from '../lib/schema';

export function useAuth() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useAuth must be used within a UserProvider');
  }

  return context;
}

// Type-safe exports
export type { SessionUser };
