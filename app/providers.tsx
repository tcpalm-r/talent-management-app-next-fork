'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import { UserProvider } from '@/context/UserContext';

const AUTH_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

export function Providers({ children }: { children: React.ReactNode }) {
  // If auth is disabled, wrap with UserProvider only
  if (AUTH_DISABLED) {
    return <UserProvider>{children}</UserProvider>;
  }

  // Otherwise, wrap with both Auth0Provider and UserProvider
  return (
    <Auth0Provider>
      <UserProvider>{children}</UserProvider>
    </Auth0Provider>
  );
}
