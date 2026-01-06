'use client';

import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Auth Start Page
 *
 * This page initiates the Azure AD OAuth flow in a popup window.
 * It's opened by Teams when popup authentication is required
 * (when silent SSO fails).
 *
 * Flow:
 * 1. Initialize Teams SDK in popup context
 * 2. Generate CSRF protection state
 * 3. Build Azure AD authorization URL
 * 4. Redirect to Azure AD login
 */
export default function AuthStartPage() {
  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      // Initialize Teams SDK in the popup context
      await microsoftTeams.app.initialize();

      // Get Azure AD configuration from environment
      const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID;
      const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
      const redirectUri = `${window.location.origin}/auth-end`;

      if (!clientId || !tenantId) {
        console.error('[auth-start] Missing Azure AD configuration');
        microsoftTeams.authentication.notifyFailure('Missing Azure AD configuration');
        return;
      }

      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('teams_auth_state', state);

      // Build Azure AD authorization URL
      const authUrl = new URL(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
      );
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'openid profile email User.Read');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', crypto.randomUUID());
      authUrl.searchParams.set('response_mode', 'fragment');

      console.log('[auth-start] Redirecting to Azure AD...');

      // Redirect to Azure AD login
      window.location.href = authUrl.toString();

    } catch (error) {
      console.error('[auth-start] Error initializing auth:', error);
      try {
        await microsoftTeams.app.initialize();
        microsoftTeams.authentication.notifyFailure(
          error instanceof Error ? error.message : 'Failed to initialize authentication'
        );
      } catch {
        // Can't notify Teams - just log
        console.error('[auth-start] Failed to notify Teams of error');
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Redirecting to sign in...
        </p>
      </div>
    </div>
  );
}
