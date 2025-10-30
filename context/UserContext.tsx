/**
 * User Context
 *
 * Provides global authentication state to the application.
 * Handles user session, loading states, and auth methods.
 */

'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getClientUser, logout as logoutUser } from '@/lib/auth';
import type { SessionUser } from '@/lib/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface UserContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

export const UserContext = createContext<UserContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user from cookie/API
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[UserContext] Starting fetchUser');

      // Try to get user from cookie first
      const cookieUser = getClientUser();
      if (cookieUser) {
        console.log('[UserContext] User found in cookie:', cookieUser.email);
        setUser(cookieUser);
        setLoading(false);
        return;
      }

      console.log('[UserContext] No cookie user, fetching from /api/auth/me');
      // Fetch from API
      const response = await fetch('/api/auth/me');
      console.log('[UserContext] /api/auth/me response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[UserContext] /api/auth/me response data:', data);
        setUser(data.user || null);
      } else {
        console.warn('[UserContext] /api/auth/me failed with status:', response.status);
        const errorText = await response.text();
        console.warn('[UserContext] /api/auth/me error response:', errorText);
        setUser(null);
      }
    } catch (err) {
      console.error('[UserContext] Error fetching user:', err);
      setError('Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Logout
  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  const value: UserContextValue = {
    user,
    loading,
    error,
    refreshUser,
    logout,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
