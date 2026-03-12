'use client';

import { useEffect, useState } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Auth End Page
 *
 * This page handles the Azure AD OAuth callback in the popup window.
 * It receives the access token in the URL hash fragment and notifies Teams.
 *
 * Flow:
 * 1. Parse token from URL hash fragment
 * 2. Validate CSRF state
 * 3. Exchange token with backend for app session
 * 4. Notify Teams of success/failure
 */
export default function AuthEndPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleAuthCallback();
  }, []);

  async function handleAuthCallback() {
    try {
      // Initialize Teams SDK
      await microsoftTeams.app.initialize();

      // Parse the hash fragment (Azure AD returns token in fragment)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const state = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Check for OAuth errors
      if (error) {
        throw new Error(errorDescription || error);
      }

      // Validate state (CSRF protection)
      const savedState = sessionStorage.getItem('teams_auth_state');
      if (state !== savedState) {
        throw new Error('State mismatch - authentication may have been tampered with');
      }

      if (!accessToken) {
        throw new Error('No access token received from Azure AD');
      }

      // Clear the saved state
      sessionStorage.removeItem('teams_auth_state');

      console.log('[auth-end] Token received, exchanging with backend...');

      // Exchange token with our backend
      const response = await fetch('/api/auth/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to authenticate with backend');
      }

      // Success!
      setStatus('success');
      setMessage('Authentication successful! Closing...');

      console.log('[auth-end] Authentication successful, notifying Teams');

      // Notify Teams that authentication succeeded
      // Pass the token back so Teams can cache it
      microsoftTeams.authentication.notifySuccess(accessToken);

    } catch (error) {
      console.error('[auth-end] Authentication error:', error);

      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Authentication failed');

      // Notify Teams that authentication failed
      try {
        microsoftTeams.authentication.notifyFailure(
          error instanceof Error ? error.message : 'Authentication failed'
        );
      } catch {
        // Teams SDK might not be initialized
        console.error('[auth-end] Failed to notify Teams of error');
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-6">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="mt-4 text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="mt-4 text-red-600">{message}</p>
            <p className="mt-2 text-sm text-gray-500">
              This window will close automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
