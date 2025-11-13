/**
 * User Context
 *
 * Provides global authentication state to the application.
 * Handles user session, loading states, and auth methods.
 */

'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getClientUser, logout as logoutUser, clearStaleDevCookies } from '@/lib/auth';
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
      console.log('[UserContext] ===== Starting fetchUser =====');
      console.log('[UserContext] Current cookies:', document.cookie);

      // Try to get user from cookie first
      console.log('[UserContext] Attempting to get user from client-side cookies...');
      const cookieUser = getClientUser();

      if (cookieUser) {
        console.log('[UserContext] ✓ User found in cookie:', {
          email: cookieUser.email,
          id: cookieUser.id,
          role: cookieUser.app_role
        });
        setUser(cookieUser);
        setLoading(false);
        console.log('[UserContext] ===== fetchUser complete (via cookie) =====');
        return;
      }

      console.log('[UserContext] ✗ No cookie user found, falling back to API...');
      console.log('[UserContext] Fetching from /api/auth/me...');

      // Fetch from API
      const response = await fetch('/api/auth/me', {
        credentials: 'include' // Ensure cookies are sent
      });
      console.log('[UserContext] /api/auth/me response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[UserContext] ✓ /api/auth/me successful:', {
          hasUser: !!data.user,
          userEmail: data.user?.email,
          userId: data.user?.id
        });
        setUser(data.user || null);

        if (data.user) {
          console.log('[UserContext] ===== fetchUser complete (via API) =====');
        } else {
          console.warn('[UserContext] ⚠ API returned no user data');
          console.log('[UserContext] ===== fetchUser complete (no user) =====');
        }
      } else {
        console.error('[UserContext] ✗ /api/auth/me failed with status:', response.status);
        const errorText = await response.text();
        console.error('[UserContext] /api/auth/me error response:', errorText);
        setUser(null);
        console.log('[UserContext] ===== fetchUser complete (API error) =====');
      }
    } catch (err) {
      console.error('[UserContext] ✗✗✗ Exception during fetchUser:', err);
      setError('Failed to load user');
      setUser(null);
      console.log('[UserContext] ===== fetchUser complete (exception) =====');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    console.log('[UserContext] ===== UserProvider mounted =====');
    console.log('[UserContext] Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server'
    });

    // Clear stale dev cookies in production to prevent interference
    // Force production mode check based on hostname (not localhost = production)
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      (typeof window !== 'undefined' && !window.location.hostname.includes('localhost'));

    console.log('[UserContext] Is production mode:', isProduction);

    if (isProduction) {
      console.log('[UserContext] Clearing stale dev cookies...');
      clearStaleDevCookies();
    } else {
      console.log('[UserContext] Development mode - keeping dev cookies');
    }

    console.log('[UserContext] Initiating initial user fetch...');
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
