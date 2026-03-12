'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ITPAssessment, ITPVirtue } from '@/types';
import { getBehaviorsByVirtue, getAllBehaviorKeys } from '@/lib/itpBehaviors';
import { ITPVirtueSection } from './ITPVirtueSection';
import { ITPAssessmentHistory } from './ITPAssessmentHistory';
import {
  Loader2,
  Save,
  Send,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface ITPSelfAssessmentProps {
  employeeId: string;
  employeeName?: string;
  currentUserId?: string;
  isViewOnly?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * ITPSelfAssessment Component
 *
 * Main container for the ITP Self-Assessment feature.
 * Handles loading, creating, auto-saving, and submitting assessments.
 * Shows assessment history for past submissions.
 */
export function ITPSelfAssessment({
  employeeId,
  employeeName,
  currentUserId,
  isViewOnly = false,
}: ITPSelfAssessmentProps) {
  const [assessments, setAssessments] = useState<ITPAssessment[]>([]);
  const [currentAssessment, setCurrentAssessment] = useState<ITPAssessment | null>(null);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<Record<string, number>>({});

  // Behaviors grouped by virtue
  const behaviorsByVirtue = getBehaviorsByVirtue();
  const allBehaviorKeys = getAllBehaviorKeys();

  // Check if user is viewing their own assessment
  const isOwnAssessment = currentUserId === employeeId;

  // Load assessments
  const loadAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/itp/assessments?employee_id=${employeeId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load assessments');
      }

      setAssessments(data.assessments || []);

      // Find current draft or most recent submitted
      const draft = data.assessments?.find((a: ITPAssessment) => a.status === 'draft');
      const submitted = data.assessments?.find((a: ITPAssessment) => a.status === 'submitted');

      if (draft) {
        setCurrentAssessment(draft);
        // Load responses from draft
        const responseMap: Record<string, number> = {};
        draft.responses?.forEach((r: any) => {
          responseMap[r.behaviorKey || r.behavior_key] = r.rating;
        });
        setResponses(responseMap);
      } else if (submitted) {
        setCurrentAssessment(submitted);
        // Load responses from submitted
        const responseMap: Record<string, number> = {};
        submitted.responses?.forEach((r: any) => {
          responseMap[r.behaviorKey || r.behavior_key] = r.rating;
        });
        setResponses(responseMap);
      }
    } catch (err) {
      console.error('Error loading ITP assessments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Create new assessment
  const createAssessment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/itp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existingId) {
          // Draft already exists, load it
          await loadAssessments();
          return;
        }
        throw new Error(data.error || 'Failed to create assessment');
      }

      setCurrentAssessment(data.assessment);
      setResponses({});
      await loadAssessments();
    } catch (err) {
      console.error('Error creating ITP assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save handler
  const saveDraft = useCallback(async (changesToSave: Record<string, number>) => {
    if (!currentAssessment || currentAssessment.status !== 'draft') return;

    const responseArray = Object.entries(changesToSave).map(([behaviorKey, rating]) => ({
      behaviorKey,
      rating,
    }));

    if (responseArray.length === 0) return;

    try {
      setSaveStatus('saving');

      const response = await fetch(`/api/itp/assessments/${currentAssessment.id}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: responseArray }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save draft');
      }

      setSaveStatus('saved');
      pendingChangesRef.current = {};

      // Reset to idle after showing "saved" for a moment
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving draft:', err);
      setSaveStatus('error');
    }
  }, [currentAssessment]);

  // Handle response change with debounced auto-save
  const handleResponseChange = useCallback((behaviorKey: string, rating: number) => {
    setResponses(prev => {
      const updated = { ...prev, [behaviorKey]: rating };

      // Track pending changes
      pendingChangesRef.current[behaviorKey] = rating;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save (2 seconds debounce)
      if (currentAssessment?.status === 'draft' && !isViewOnly) {
        saveTimeoutRef.current = setTimeout(() => {
          saveDraft(pendingChangesRef.current);
        }, 2000);
      }

      return updated;
    });
  }, [currentAssessment, isViewOnly, saveDraft]);

  // Save immediately on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && Object.keys(pendingChangesRef.current).length > 0) {
        saveDraft(pendingChangesRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveDraft]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Submit assessment
  const submitAssessment = async () => {
    if (!currentAssessment) return;

    // First, save any pending changes
    if (Object.keys(pendingChangesRef.current).length > 0) {
      await saveDraft(pendingChangesRef.current);
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/itp/assessments/${currentAssessment.id}/submit`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.missingBehaviors) {
          throw new Error(`Please rate all behaviors before submitting. Missing: ${data.missingBehaviors.join(', ')}`);
        }
        throw new Error(data.error || 'Failed to submit assessment');
      }

      // Reload to get updated state
      await loadAssessments();
    } catch (err) {
      console.error('Error submitting ITP assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset draft (delete and start fresh)
  const resetDraft = async () => {
    if (!currentAssessment || currentAssessment.status !== 'draft') return;

    if (!confirm('Are you sure you want to reset? This will clear all your current responses.')) {
      return;
    }

    try {
      setResetting(true);
      setError(null);

      const response = await fetch(`/api/itp/assessments/${currentAssessment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset assessment');
      }

      // Clear local state and reload
      setResponses({});
      setCurrentAssessment(null);
      pendingChangesRef.current = {};
      await loadAssessments();
    } catch (err) {
      console.error('Error resetting ITP assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset assessment');
    } finally {
      setResetting(false);
    }
  };

  // Calculate completion stats
  const completedCount = Object.keys(responses).length;
  const totalCount = allBehaviorKeys.length;
  const isComplete = completedCount === totalCount;

  // Determine display state
  const isDraft = currentAssessment?.status === 'draft';
  const isSubmitted = currentAssessment?.status === 'submitted';
  const canEdit = isDraft && isOwnAssessment && !isViewOnly;

  // Get archived assessments
  const archivedAssessments = assessments.filter(a => a.status === 'archived');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">Loading assessment...</span>
      </div>
    );
  }

  // No assessment exists - show create button
  if (!currentAssessment && isOwnAssessment && !isViewOnly) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No ITP Self-Assessment Yet
        </h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Take the Ideal Team Player self-assessment to evaluate yourself across
          12 core behaviors in three virtues: Humble, Hungry, and People Smart.
        </p>
        <button
          onClick={createAssessment}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Start Self-Assessment
        </button>

        {/* Show history if available */}
        {archivedAssessments.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center mx-auto"
            >
              {showHistory ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              View Past Assessments ({archivedAssessments.length})
            </button>
            {showHistory && (
              <ITPAssessmentHistory assessments={archivedAssessments} />
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-600 text-sm">{error}</div>
        )}
      </div>
    );
  }

  // No assessment and can't create (viewing someone else's)
  if (!currentAssessment) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Assessment Available
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          {employeeName || 'This employee'} has not completed an ITP self-assessment yet.
        </p>

        {/* Show history if available */}
        {archivedAssessments.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center mx-auto"
            >
              {showHistory ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              View Past Assessments ({archivedAssessments.length})
            </button>
            {showHistory && (
              <ITPAssessmentHistory assessments={archivedAssessments} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            ITP Self-Assessment
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Rate yourself on each behavior from 1 (Not Living) to 5 (Role Modeling)
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          {isDraft && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              <Clock className="w-4 h-4 mr-1" />
              Draft
            </span>
          )}
          {isSubmitted && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-4 h-4 mr-1" />
              Submitted
            </span>
          )}

          {/* Save Status */}
          {canEdit && (
            <div className="flex items-center text-sm">
              {saveStatus === 'saving' && (
                <span className="text-gray-500 flex items-center">
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Save failed
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm text-gray-500">
            {completedCount}/{totalCount} behaviors rated
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        </div>
      )}

      {/* Virtue Sections */}
      {(['humble', 'hungry', 'people_smart'] as ITPVirtue[]).map((virtue) => (
        <ITPVirtueSection
          key={virtue}
          virtue={virtue}
          behaviors={behaviorsByVirtue[virtue]}
          responses={responses}
          onResponseChange={handleResponseChange}
          disabled={!canEdit}
        />
      ))}

      {/* Action Buttons */}
      {canEdit && (
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <button
            onClick={resetDraft}
            disabled={resetting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Reset
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => saveDraft(responses)}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </button>
            <button
              onClick={submitAssessment}
              disabled={!isComplete || submitting}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Assessment
            </button>
          </div>
        </div>
      )}

      {/* New Assessment Button (for submitted) */}
      {isSubmitted && isOwnAssessment && !isViewOnly && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={createAssessment}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Start New Assessment
          </button>
        </div>
      )}

      {/* History Section */}
      {archivedAssessments.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center"
          >
            {showHistory ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            Past Assessments ({archivedAssessments.length})
          </button>
          {showHistory && (
            <ITPAssessmentHistory assessments={archivedAssessments} />
          )}
        </div>
      )}
    </div>
  );
}

export default ITPSelfAssessment;
