'use client';

import { useEffect, useState } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Tab Configuration Page
 *
 * This page is displayed when users add the app as a tab to a channel or chat.
 * It allows configuration of the tab before adding.
 *
 * Flow:
 * 1. Initialize Teams SDK
 * 2. Register save handler
 * 3. Enable save button
 * 4. User clicks Save in Teams
 * 5. Save handler sets tab configuration
 */
export default function ConfigPage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initConfig();
  }, []);

  async function initConfig() {
    try {
      // Initialize Teams SDK
      await microsoftTeams.app.initialize();
      setIsInitialized(true);

      console.log('[Config] Teams SDK initialized');

      // Register the save handler - called when user clicks Save in Teams
      microsoftTeams.pages.config.registerOnSaveHandler((saveEvent) => {
        console.log('[Config] Save handler triggered');

        // Set the tab configuration
        microsoftTeams.pages.config.setConfig({
          contentUrl: `${window.location.origin}/?inTeams=true`,
          websiteUrl: window.location.origin,
          suggestedDisplayName: 'Reviews',
          entityId: 'sonance-360-reviews-tab',
        });

        // Notify Teams that save was successful
        saveEvent.notifySuccess();
      });

      // Enable the save button in Teams
      microsoftTeams.pages.config.setValidityState(true);

      console.log('[Config] Configuration ready');

    } catch (err) {
      console.error('[Config] Error initializing:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    }
  }

  // Loading state
  if (!isInitialized && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-red-600">{error}</p>
          <p className="mt-2 text-sm text-gray-500">
            Please try again or contact support.
          </p>
        </div>
      </div>
    );
  }

  // Configuration UI
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-lg mx-auto">
        {/* Header with logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Sonance 360 Reviews
            </h1>
            <p className="text-sm text-gray-500">
              Talent Management Platform
            </p>
          </div>
        </div>

        {/* Description card */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="font-medium text-gray-900 mb-2">
            About this tab
          </h2>
          <p className="text-sm text-gray-600">
            Access your organization&apos;s 360-degree feedback reviews, talent insights,
            and employee management tools directly within Microsoft Teams.
          </p>
        </div>

        {/* Features list */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
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
            <span className="text-sm text-gray-600">
              Create and manage 360 feedback surveys
            </span>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
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
            <span className="text-sm text-gray-600">
              View employee profiles and talent insights
            </span>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
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
            <span className="text-sm text-gray-600">
              AI-powered analysis and recommendations
            </span>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
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
            <span className="text-sm text-gray-600">
              Seamless integration with Teams SSO
            </span>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center">
          Click <strong>Save</strong> to add this tab to your channel.
        </p>
      </div>
    </div>
  );
}
