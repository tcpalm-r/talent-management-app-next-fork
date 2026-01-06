'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Teams Context Value
 * Provides Teams SDK state and authentication methods
 */
interface TeamsContextValue {
  /** Whether the app is running inside Microsoft Teams */
  isInTeams: boolean;
  /** Whether Teams SDK has finished initializing */
  isInitialized: boolean;
  /** Whether Teams SDK is currently initializing */
  isInitializing: boolean;
  /** Teams context (user info, theme, etc.) */
  context: microsoftTeams.app.Context | null;
  /** Current Teams theme: 'default' (light), 'dark', or 'contrast' */
  theme: 'default' | 'dark' | 'contrast';
  /** Any error that occurred during initialization */
  error: string | null;
  /** Get SSO token from Teams (silent) */
  getTeamsToken: () => Promise<string | null>;
  /** Authenticate via popup (fallback when silent fails) */
  authenticateWithPopup: () => Promise<string | null>;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

/**
 * TeamsProvider
 *
 * Initializes the Microsoft Teams JavaScript SDK and provides Teams context
 * to the application. Handles:
 * - Teams environment detection
 * - SDK initialization
 * - Theme change registration
 * - SSO token acquisition
 * - Popup authentication fallback
 */
export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [isInTeams, setIsInTeams] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [context, setContext] = useState<microsoftTeams.app.Context | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<string | null>(null);

  // Initialize Teams SDK on mount
  useEffect(() => {
    initializeTeams();
  }, []);

  async function initializeTeams() {
    try {
      // Try to initialize the Teams SDK
      // This will only succeed if running inside Teams
      await microsoftTeams.app.initialize();

      // If we get here, we're running in Teams
      console.log('[TeamsProvider] Teams SDK initialized successfully');
      setIsInTeams(true);
      setIsInitialized(true);

      // Get Teams context
      const teamsContext = await microsoftTeams.app.getContext();
      setContext(teamsContext);
      console.log('[TeamsProvider] Teams context:', teamsContext.app?.theme);

      // Set initial theme from context
      const initialTheme = teamsContext.app?.theme || 'default';
      setTheme(initialTheme as 'default' | 'dark' | 'contrast');

      // Register theme change handler
      microsoftTeams.app.registerOnThemeChangeHandler((newTheme) => {
        console.log('[TeamsProvider] Theme changed to:', newTheme);
        setTheme(newTheme as 'default' | 'dark' | 'contrast');
      });

      // Notify Teams that the app loaded successfully
      microsoftTeams.app.notifySuccess();

      // Automatically authenticate with Teams SSO
      await authenticateWithTeamsSSO();

    } catch (err) {
      // Not in Teams environment - this is expected for non-Teams users
      console.log('[TeamsProvider] Not in Teams environment (this is normal for browser access)');
      setIsInTeams(false);
      setIsInitialized(true);
    } finally {
      setIsInitializing(false);
    }
  }

  /**
   * Authenticate with Teams SSO and exchange token for app session
   */
  async function authenticateWithTeamsSSO() {
    try {
      // Check if already authenticated (has session cookie)
      const existingCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('ai-intranet-user='));

      if (existingCookie) {
        console.log('[TeamsProvider] Already authenticated, skipping SSO');
        return;
      }

      console.log('[TeamsProvider] Starting Teams SSO authentication...');

      // Get SSO token from Teams
      const token = await microsoftTeams.authentication.getAuthToken();
      console.log('[TeamsProvider] Got Teams SSO token');

      // Exchange token with our backend for app session
      const response = await fetch('/api/auth/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[TeamsProvider] Teams SSO successful, user:', data.user?.email);
        // Reload to pick up the new session cookie
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error('[TeamsProvider] Teams SSO failed:', errorData.error);
        setError(errorData.error || 'Teams authentication failed');
      }
    } catch (err) {
      console.error('[TeamsProvider] Teams SSO error:', err);
      setError('Teams SSO failed');
    }
  }

  /**
   * Get SSO token from Teams (silent authentication)
   * This attempts to get an Azure AD token without user interaction
   */
  const getTeamsToken = useCallback(async (): Promise<string | null> => {
    if (!isInTeams || !isInitialized) {
      console.log('[TeamsProvider] Cannot get token - not in Teams or not initialized');
      return null;
    }

    try {
      console.log('[TeamsProvider] Attempting silent SSO token acquisition...');
      const token = await microsoftTeams.authentication.getAuthToken();
      console.log('[TeamsProvider] SSO token acquired successfully');
      return token;
    } catch (err) {
      console.error('[TeamsProvider] Silent SSO failed:', err);
      setError('Silent SSO failed - popup auth may be required');
      return null;
    }
  }, [isInTeams, isInitialized]);

  /**
   * Authenticate via popup (fallback)
   * Opens a popup window for Azure AD authentication when silent SSO fails
   */
  const authenticateWithPopup = useCallback(async (): Promise<string | null> => {
    if (!isInTeams || !isInitialized) {
      console.log('[TeamsProvider] Cannot authenticate - not in Teams or not initialized');
      return null;
    }

    try {
      console.log('[TeamsProvider] Starting popup authentication...');
      const result = await microsoftTeams.authentication.authenticate({
        url: `${window.location.origin}/auth-start`,
        width: 600,
        height: 535,
      });
      console.log('[TeamsProvider] Popup authentication successful');
      return result;
    } catch (err) {
      console.error('[TeamsProvider] Popup authentication failed:', err);
      setError('Popup authentication failed');
      return null;
    }
  }, [isInTeams, isInitialized]);

  const value: TeamsContextValue = {
    isInTeams,
    isInitialized,
    isInitializing,
    context,
    theme,
    error,
    getTeamsToken,
    authenticateWithPopup,
  };

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
}

/**
 * Hook to access Teams context
 * Must be used within a TeamsProvider
 */
export function useTeams(): TeamsContextValue {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
}
