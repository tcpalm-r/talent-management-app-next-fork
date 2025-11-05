'use client';

import { UserProvider } from '../context/UserContext';

/**
 * Application Providers
 *
 * Wraps the app with authentication and other global providers.
 * Uses AI Intranet authentication via UserContext.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
