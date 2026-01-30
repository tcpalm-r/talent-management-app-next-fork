'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface IdentifyHarshFeedbackButtonProps {
  onClick: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  surveyStatus: string | null;
}

/**
 * Button to trigger harsh feedback analysis in 360 reports.
 *
 * ADMIN-ONLY FEATURE:
 * - Only admins see this component
 * - Only appears for completed or finalized surveys
 * - Triggers sentiment analysis to identify harsh feedback that may have been softened
 * - Shows elapsed time while analyzing
 */
export function IdentifyHarshFeedbackButton({
  onClick,
  isLoading,
  isAdmin,
  surveyStatus,
}: IdentifyHarshFeedbackButtonProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track elapsed time while loading
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Only show to admins for completed/finalized surveys
  if (!isAdmin || !['completed', 'finalized'].includes(surveyStatus || '')) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
        transition-all duration-200 ease-in-out
        bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title="Analyze raw feedback for harsh or critical content"
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          <span>Analyzing... {formatTime(elapsedSeconds)}</span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-4 h-4" />
          <span>Identify Harsh Feedback</span>
        </>
      )}
    </button>
  );
}

export default IdentifyHarshFeedbackButton;
