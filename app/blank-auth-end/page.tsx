'use client';

import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Blank Auth End Page
 *
 * This is a minimal page used for silent token refresh.
 * It's loaded in a hidden iframe by Teams for background token renewal.
 *
 * Flow:
 * 1. Parse token from URL hash fragment
 * 2. Notify Teams of the new token
 * 3. Teams caches the refreshed token
 */
export default function BlankAuthEndPage() {
  useEffect(() => {
    handleSilentAuth();
  }, []);

  async function handleSilentAuth() {
    try {
      // Parse the hash fragment
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const error = params.get('error');

      // Initialize Teams SDK
      await microsoftTeams.app.initialize();

      if (error) {
        microsoftTeams.authentication.notifyFailure(error);
        return;
      }

      if (token) {
        // Notify Teams of the refreshed token
        microsoftTeams.authentication.notifySuccess(token);
      } else {
        microsoftTeams.authentication.notifyFailure('No token received');
      }
    } catch (error) {
      console.error('[blank-auth-end] Error:', error);
      // Try to notify Teams even if something went wrong
      try {
        await microsoftTeams.app.initialize();
        microsoftTeams.authentication.notifyFailure('Silent auth failed');
      } catch {
        // Can't do anything more
      }
    }
  }

  // Render nothing - this is a blank page for background use
  return null;
}
