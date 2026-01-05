'use client';

import { useEffect } from 'react';
import { UserProvider } from '@/context/UserContext';
import { TeamsProvider, useTeams } from '@/context/TeamsContext';
import { ThemeProvider, useTheme } from 'next-themes';

/**
 * TeamThemeSync
 *
 * Inner component that synchronizes Teams theme with next-themes.
 * Maps Teams themes to next-themes:
 * - Teams 'default' -> 'light'
 * - Teams 'dark' -> 'dark'
 * - Teams 'contrast' -> 'dark' + high-contrast class
 */
function TeamThemeSync({ children }: { children: React.ReactNode }) {
  const { isInTeams, theme: teamsTheme, isInitialized } = useTeams();
  const { setTheme } = useTheme();

  useEffect(() => {
    // Only sync theme if we're in Teams and initialized
    if (!isInTeams || !isInitialized) return;

    // Map Teams theme to next-themes
    switch (teamsTheme) {
      case 'dark':
      case 'contrast':
        setTheme('dark');
        break;
      case 'default':
      default:
        setTheme('light');
        break;
    }
  }, [isInTeams, isInitialized, teamsTheme, setTheme]);

  // Handle high-contrast mode class
  useEffect(() => {
    if (isInTeams && teamsTheme === 'contrast') {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isInTeams, teamsTheme]);

  return <>{children}</>;
}

/**
 * Application Providers
 *
 * Wraps the app with authentication and other global providers.
 * Uses AI Intranet authentication via UserContext.
 * Includes Teams integration for Microsoft Teams tab support.
 *
 * Provider hierarchy (outer to inner):
 * 1. ThemeProvider (next-themes) - Theme management
 * 2. TeamsProvider - Microsoft Teams SDK integration
 * 3. TeamThemeSync - Syncs Teams theme to next-themes
 * 4. UserProvider - Authentication state
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TeamsProvider>
        <TeamThemeSync>
          <UserProvider>{children}</UserProvider>
        </TeamThemeSync>
      </TeamsProvider>
    </ThemeProvider>
  );
}
