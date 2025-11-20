'use client';

import { UserProvider } from '@/context/UserContext';
import { ThemeProvider } from 'next-themes';

/**
 * Application Providers
 *
 * Wraps the app with authentication and other global providers.
 * Uses AI Intranet authentication via UserContext.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UserProvider>{children}</UserProvider>
    </ThemeProvider>
  );
}
