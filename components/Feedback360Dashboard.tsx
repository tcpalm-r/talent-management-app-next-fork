import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { MessageSquare, Plus, Send, CheckCircle, Clock, Users, X, AlertTriangle, Sparkles, ChevronLeft, ArrowDownCircle, Download, Eye, Trash2, FileText, TrendingUp, Target, Lightbulb, BarChart3, GitCompare, UserPlus, UserMinus, Check, User, Search, ChevronDown, Info, Loader2 } from 'lucide-react';
import type { Employee, Department, ParticipantRelationship } from '../types';
import Survey360Wizard from './Survey360Wizard';
import CreateWithAIModal, { type ParsedSurveyData } from './CreateWithAIModal';
import Avatar from './Avatar';
import { useToast, Tooltip, TooltipProvider } from './unified';
import NavigationTabs from './unified/NavigationTabs';
import { exportReportAsPDF } from '../lib/exportReport';
import { AuditModeToggle } from './AuditModeToggle';
import { InlineCitation } from './InlineCitation';
import { fetchWithFallback, fetchWithValidation } from '@/lib/api-client';
import {
  SurveyListResponseSchema,
  Report360ResponseSchema,
  GenericSuccessResponseSchema,
  SurveyDetailResponseSchema,
  SurveyUpdateResponseSchema,
  SurveyDeleteResponseSchema,
  ReviewersListResponseSchema
} from '@/lib/api-schemas';

interface Feedback360DashboardProps {
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  currentUserName: string;
  currentUser?: Employee; // Current logged-in user for role-based filtering
}

interface Survey {
  id: string;
  survey_name: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
  employee_id: string;
  employee?: Employee;
  employee_name?: string; // Computed/joined field for subject name
  reviewers_count?: number;
  completed_count?: number;
  created_by?: string;
  created_by_email?: string | null;
  reviewers?: any[];
  flagged_for_admin?: boolean | null;
  flagged_for_reanalysis?: boolean | null;
  sent_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

interface Reviewer {
  id: string;
  reviewer_name: string | null;
  reviewer_email: string;
  relationship: string;
  status: string;
  email_sent_at?: string | null;
  assigned_by_sponsor?: boolean;
}

// Helper function to format relationship display
const formatRelationship = (relationship: string): string => {
  return relationship.replace(/_/g, '-');
};

// Helper function to check if current user is the sponsor/creator of a survey
// Only checks against Supabase UUID and email - no AI Intranet ID (they never match)
const isUserSponsor = (
  survey: Survey | null | undefined,
  user: Employee | null | undefined,
  userDbId?: string | null,
  logSurveyName?: boolean // Optional: only log for first few surveys to avoid spam
): boolean => {
  if (!survey || !user) return false;

  // Primary: Supabase UUID match (created_by is always Supabase user_profiles.id)
  const uuidMatch = userDbId && survey.created_by === userDbId;
  
  // Fallback: Email match (case-insensitive) for older surveys or edge cases
  const userEmailLower = user.email?.toLowerCase();
  const emailMatch = userEmailLower && survey.created_by_email?.toLowerCase() === userEmailLower;
  
  const isSponsor = uuidMatch || emailMatch;

  return isSponsor;
};

// Helper function to check if a user has permission to view survey results
const canUserViewResults = (
  survey: any,
  user: any,
  userDbId?: string | null
): boolean => {
  if (!survey || !user) return false;

  const isSponsor = isUserSponsor(survey, user, userDbId);
  const isAdmin = user.app_role === 'admin';
  const isSubject = survey.employee_id === user.id;
  const isLeader = user.app_role === 'leader';
  const isReviewer = survey.reviewers?.some((r: any) => r.reviewer_email === user.email);

  // Leader reviewers who are NOT sponsor and NOT subject cannot view results
  const isLeaderReviewerOnly = isLeader && isReviewer && !isSponsor && !isSubject;

  return (isSponsor || isAdmin || isSubject) && !isLeaderReviewerOnly;
};

// Helper function to extract text from either a plain string or CitedStatement object
// This handles backward compatibility with old reports (plain strings) and new reports (CitedStatement objects)
// Type for citation data
interface CitationData {
  response_id?: string;
  snippet: string;
}

// Type for items that may have citations
type CitedItem = string | { text: string; citations?: CitationData[] };

/**
 * Extract text from a statement that may be:
 * - A plain string
 * - A CitedStatement object { text, citations }
 * - A JSON string that needs parsing
 */
const getStatementText = (item: CitedItem): string => {
  if (typeof item === 'string') {
    // Check if it's a JSON string that needs parsing
    if (item.startsWith('{') && item.includes('"text"')) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          return parsed.text;
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return item;
  }
  if (item && typeof item === 'object' && 'text' in item) {
    return item.text;
  }
  return String(item);
};

/**
 * Extract citations from a statement item.
 * Returns empty array if no citations exist.
 */
const getCitations = (item: CitedItem): CitationData[] => {
  if (typeof item === 'string') {
    // Check if it's a JSON string that needs parsing
    if (item.startsWith('{') && item.includes('"citations"')) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.citations)) {
          return parsed.citations;
        }
      } catch {
        // Not valid JSON
      }
    }
    return [];
  }
  if (item && typeof item === 'object' && Array.isArray(item.citations)) {
    return item.citations;
  }
  return [];
};

/**
 * Format a relationship group name for display
 * Uses subject's first name for personalized labels
 * @param group - The group identifier (manager, direct_report, cross_functional, slt)
 * @param subjectFirstName - The subject's first name for personalized labels
 * @returns Formatted display label
 */
const formatGroupLabel = (group: string, subjectFirstName: string): string => {
  const name = subjectFirstName || 'Subject';
  const normalizedGroup = group?.toLowerCase()?.trim() || '';

  // Handle exact matches first
  switch (normalizedGroup) {
    case 'manager':
      return `${name}'s Manager`;
    case 'direct_report':
    case 'direct_reports':
      return `${name}'s Direct Reports`;
    case 'cross_functional':
    case 'cross-functional':
    case 'cross-functional colleagues':
      return 'Cross-functional Colleagues';
    case 'slt':
      return 'SLT';
    case 'peer':
    case 'peers':
      return 'Peers';
  }

  // Handle AI-generated labels that contain "Subject's" - replace with actual name
  if (normalizedGroup.includes("subject's")) {
    return group.replace(/subject's/gi, `${name}'s`);
  }

  // Handle partial matches for common group types
  if (normalizedGroup.includes('direct report')) {
    return `${name}'s Direct Reports`;
  }
  if (normalizedGroup.includes('manager')) {
    return `${name}'s Manager`;
  }
  if (normalizedGroup.includes('cross') && normalizedGroup.includes('functional')) {
    return 'Cross-functional Colleagues';
  }

  return group || 'Unknown';
};

/**
 * Get a short badge-friendly version of the group label
 * @param group - The group identifier
 * @returns Short label for badge display
 */
const getShortGroupLabel = (group: string): string => {
  switch (group?.toLowerCase()) {
    case 'manager':
      return 'Manager';
    case 'direct_report':
    case 'direct_reports':
      return 'Direct Reports';
    case 'cross_functional':
      return 'Cross-func';
    case 'slt':
      return 'SLT';
    case 'peer':
    case 'peers':
      return 'Peers';
    default:
      return group || '?';
  }
};

// Extended employee type with detected relationship for search results
type EmployeeWithRelationship = Employee & {
  detected_relationship?: ParticipantRelationship;
};

export default function Feedback360Dashboard({
  employees,
  departments,
  organizationId,
  currentUserName,
  currentUser
}: Feedback360DashboardProps) {
  const { notify } = useToast();
  
  // IMPORTANT: Get the current user's database ID from the employees list
  // This is needed because currentUser.id (from AI Intranet cookie) may differ from
  // the Supabase user_profiles ID that's stored in survey.created_by
  // Uses case-insensitive email comparison to handle email case mismatches between systems
  const currentUserDbId = useMemo(() => {
    if (!currentUser?.email || !employees) return null;
    const emailLower = currentUser.email.toLowerCase();
    const userRecord = employees.find(e => e.email?.toLowerCase() === emailLower);

    return userRecord?.id || null;
  }, [currentUser?.email, employees]);
  
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingDraftSurvey, setEditingDraftSurvey] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'in_progress' | 'completed' | 'needs_review' | 'needs_reanalysis' | 'finalized'>('all');
  const [reviewerFilterStatus, setReviewerFilterStatus] = useState<'all' | 'required' | 'optional'>('all');
  // Only Admin and SLT can sponsor surveys, everyone else defaults to 'reviewer'
  const [filterRole, setFilterRole] = useState<'all' | 'sponsor' | 'reviewer' | 'needs_reanalysis'>(
    currentUser?.app_role === 'admin' ? 'all' : (currentUser?.app_role === 'slt') ? 'sponsor' : 'reviewer'
  );
  const [reviewerSearchQuery, setReviewerSearchQuery] = useState('');
  const [sponsorSearchQuery, setSponsorSearchQuery] = useState('');
  const [allSurveysSearchQuery, setAllSurveysSearchQuery] = useState('');
  const [preselectedEmployee, setPreselectedEmployee] = useState<Employee | undefined>(undefined);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [surveyReviewers, setSurveyReviewers] = useState<Reviewer[]>([]);
  const [isAddingReviewer, setIsAddingReviewer] = useState(false);
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [newReviewerRelationship, setNewReviewerRelationship] = useState<ParticipantRelationship | ''>('');
  const [selectedReviewerEmployee, setSelectedReviewerEmployee] = useState<Employee | null>(null);
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [showReviewerPicker, setShowReviewerPicker] = useState(false);
  const [employeesWithRelationships, setEmployeesWithRelationships] = useState<EmployeeWithRelationship[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [remindedReviewers, setRemindedReviewers] = useState<Set<string>>(new Set());
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [surveyResults, setSurveyResults] = useState<any>(null);
  const [generatingSurveyId, setGeneratingSurveyId] = useState<string | null>(null);
  const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
  const generateAbortControllerRef = useRef<AbortController | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [streamingCharCount, setStreamingCharCount] = useState(0);
  const [showRawData, setShowRawData] = useState(false);
  const [rawSurveyData, setRawSurveyData] = useState<any>(null);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiParsedData, setAiParsedData] = useState<ParsedSurveyData | null>(null);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);
  const [selectedStrengthIndex, setSelectedStrengthIndex] = useState<number | null>(null);
  const [selectedDevelopmentIndex, setSelectedDevelopmentIndex] = useState<number | null>(null);
  const [selectedInsightIndex, setSelectedInsightIndex] = useState<number | null>(null);
  const [isAdjustingItem, setIsAdjustingItem] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>('narrative');
  const [auditModeEnabled, setAuditModeEnabled] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  // Ref for selected reviewer display to enable auto-focus
  const selectedReviewerDisplayRef = useRef<HTMLDivElement>(null);

  // Auto-focus the selected reviewer display when a reviewer is selected
  useEffect(() => {
    if (selectedReviewerEmployee && selectedReviewerDisplayRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        selectedReviewerDisplayRef.current?.focus();
      }, 100);
    }
  }, [selectedReviewerEmployee]);
  const [editingRecommendationIndex, setEditingRecommendationIndex] = useState<number | null>(null);
  const [editingRecommendationText, setEditingRecommendationText] = useState<string>('');
  const [finalNarrative, setFinalNarrative] = useState<string>('');
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeOutdated, setNarrativeOutdated] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Computed: Audit mode is only effective for admins
  // This ensures citations are never visible to sponsors or subjects
  const effectiveAuditMode = auditModeEnabled && currentUser?.app_role === 'admin';

  // API version notice for survey analyzer (local testing only)
  const [analyzerApiNotice, setAnalyzerApiNotice] = useState<{ type: 'success' | 'fallback'; message: string } | null>(null);

  // Only show API notices in local testing mode
  const isLocalTesting = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  useEffect(() => {
    loadSurveys();
  }, [organizationId, currentUser?.id, currentUser?.app_role]);

  // Poll for survey status when a survey is in 'generating' state
  // This handles the case where user refreshes page during report generation
  useEffect(() => {
    // Only poll if we have a selected survey that's generating
    if (!selectedSurvey || selectedSurvey.status !== 'generating') {
      return;
    }

    // Show the loading state immediately when detecting 'generating' status
    setGeneratingSurveyId(selectedSurvey.id);
    setIsDetailsModalOpen(true); // Ensure modal is open to show loading

    console.log('[Polling] Detected generating status, starting poll for survey:', selectedSurvey.id);

    // Poll every 3 seconds to check if generation completed
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/surveys/${selectedSurvey.id}/details`);
        if (response.ok) {
          const data = await response.json();
          const updatedStatus = data.survey?.status;

          console.log('[Polling] Survey status:', updatedStatus);

          if (updatedStatus === 'completed') {
            console.log('[Polling] Generation completed, loading results');
            clearInterval(pollInterval);
            setGeneratingSurveyId(null);

            // Update selected survey and surveys list with new status
            const updatedSurvey = { ...selectedSurvey, ...data.survey, status: 'completed' };
            setSelectedSurvey(updatedSurvey);
            setSurveys(prev => prev.map(s => s.id === selectedSurvey.id ? { ...s, status: 'completed' } : s));

            // Load and show the results
            await loadAndShowResults(updatedSurvey);
          } else if (updatedStatus !== 'generating') {
            // Status changed to something unexpected (e.g., 'active' on error)
            console.log('[Polling] Generation failed or was reset, status:', updatedStatus);
            clearInterval(pollInterval);
            setGeneratingSurveyId(null);
            setSelectedSurvey({ ...selectedSurvey, status: updatedStatus });
            notify({
              title: 'Generation Failed',
              description: 'Report generation was interrupted. Please try again.',
              variant: 'error',
            });
          }
        }
      } catch (error) {
        console.error('[Polling] Error checking survey status:', error);
        // Don't stop polling on network error, just log it
      }
    }, 3000);

    // Cleanup interval on unmount or when dependencies change
    return () => {
      console.log('[Polling] Cleaning up poll interval');
      clearInterval(pollInterval);
    };
  }, [selectedSurvey?.id, selectedSurvey?.status]);

  // Helper functions to track viewed surveys in localStorage
  const getViewedSurveys = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(`viewed_360_surveys_${currentUser?.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  const markSurveyAsViewed = (surveyId: string) => {
    if (typeof window === 'undefined') return;
    const viewed = getViewedSurveys();
    viewed.add(surveyId);
    localStorage.setItem(`viewed_360_surveys_${currentUser?.id}`, JSON.stringify([...viewed]));
  };

  const hasSurveyBeenViewed = (surveyId: string): boolean => {
    return getViewedSurveys().has(surveyId);
  };

  // Helper function to generate export report data
  const generateReportData = (filterForSubject: boolean) => {
    let consensusData = surveyResults.consensus_areas;
    let outlierData = surveyResults.outlier_opinions;

    if (filterForSubject) {
      consensusData = [];
      outlierData = [];
    }

    return {
      survey_name: selectedSurvey.survey_name || 'Untitled Survey',
      employee_name: selectedSurvey.employee?.name || selectedSurvey.employee_name || '',
      generated_by: surveyResults.generated_by,
      generated_at: surveyResults.generated_at,
      executive_summary: surveyResults.executive_summary,
      final_narrative: finalNarrative,
      themes: surveyResults.themes,
      overall_strengths: surveyResults.overall_strengths,
      development_areas: surveyResults.development_areas,
      recommendations: surveyResults.recommendations,
      key_insights: surveyResults.key_insights,
      consensus_areas: consensusData,
      outlier_opinions: outlierData
    };
  };

  // Handle full export with confirmation
  const handleFullExport = async () => {
    const confirmMessage =
      '⚠️ SENSITIVE DATA WARNING\n\n' +
      'This export includes consensus areas and outlier opinions ' +
      'that reveal individual reviewer patterns.\n\n' +
      'This data is NOT visible to the employee being reviewed.\n\n' +
      'Are you sure you want to export the full report?';

    if (!window.confirm(confirmMessage)) return;

    try {
      const reportData = generateReportData(false);
      const filename = await exportReportAsPDF(reportData, 'FULL');
      notify({ title: 'Success', description: `Full report exported as ${filename}`, variant: 'success' });
    } catch (error) {
      console.error('Error exporting full PDF:', error);
      notify({ title: 'Error', description: 'Failed to export PDF', variant: 'error' });
    } finally {
      setIsExportDropdownOpen(false);
    }
  };

  // Handle subject-filtered export
  const handleSubjectExport = async () => {
    try {
      const reportData = generateReportData(true);
      const filename = await exportReportAsPDF(reportData, 'SUBJECT');
      notify({ title: 'Success', description: `Subject report exported as ${filename}`, variant: 'success' });
    } catch (error) {
      console.error('Error exporting subject PDF:', error);
      notify({ title: 'Error', description: 'Failed to export PDF', variant: 'error' });
    } finally {
      setIsExportDropdownOpen(false);
    }
  };

  // Handle simple export (for non-sponsors/non-admins)
  const handleSimpleExport = async () => {
    try {
      const isSubject = currentUser?.id === selectedSurvey?.employee_id;
      const isSponsor = isUserSponsor(selectedSurvey, currentUser, currentUserDbId);
      const isAdmin = currentUser?.app_role === 'admin';
      const isPureSubject = isSubject && !isAdmin && !isSponsor;

      const reportData = generateReportData(isPureSubject);
      const filename = await exportReportAsPDF(reportData);
      notify({ title: 'Success', description: `Report exported as ${filename}`, variant: 'success' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      notify({ title: 'Error', description: 'Failed to export PDF', variant: 'error' });
    }
  };

  // Function to load and display survey results
  const loadAndShowResults = async (survey: Survey) => {
    try {
      // Fetch report with validation
      const data = await fetchWithValidation(
        Report360ResponseSchema,
        `/api/360-generate-report?survey_id=${survey.id}`
      );

      if (!data) {
        throw new Error('Failed to load report - no data returned');
      }

      // Fetch full survey details to get narrative
      const detailsResponse = await fetch(`/api/surveys/${survey.id}/details`);
      let fullSurvey = survey;
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        fullSurvey = detailsData.survey || survey;
      }

      setSelectedSurvey(fullSurvey);
      setSurveyResults(data.report);
      setReportId(data.report?.id || null);
      setAuditModeEnabled(false); // Reset audit mode when loading a new report

      // Load narrative if it exists
      if ((fullSurvey as any).final_narrative) {
        setFinalNarrative((fullSurvey as any).final_narrative);
        setNarrativeOutdated(false);
      } else {
        setFinalNarrative('');
        setNarrativeOutdated(false);
      }

      setIsResultsModalOpen(true);
      markSurveyAsViewed(survey.id);
    } catch (error: any) {
      console.error('Error loading survey results:', error);

      // If report not found, offer to regenerate
      const isReportNotFound = error.message?.includes('No report found');
      notify({
        title: isReportNotFound ? 'Report Not Found' : 'Error',
        description: isReportNotFound
          ? 'The analysis report could not be found. Please regenerate the analysis by opening the survey and clicking "Complete Review with AI Analysis".'
          : error.message || 'Failed to load review results',
        variant: 'error',
      });
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      // Fetch with validation and automatic fallback
      const data = await fetchWithFallback(
        SurveyListResponseSchema,
        `/api/surveys/list?organization_id=${organizationId}`,
        { surveys: [], count: 0, role: 'user' } // Safe fallback
      );

      // Enhance surveys with employee data and reviewer counts
      let enhancedSurveys = data.surveys.map((survey) => {
        const employee = employees.find(e => e.id === survey.employee_id);
        const reviewers = survey.reviewers || [];
        return {
          ...survey,
          employee,
          reviewers_count: reviewers.length,
          completed_count: reviewers.filter((r) => r.status === 'completed').length
        };
      });

      // NOTE: Role-based filtering is now handled entirely by the API (/api/surveys/list)
      // The API uses the authenticated user's profile.id from getAuthenticatedUser()
      // and applies correct role-based filtering on the server side.
      //
      // Client-side filtering was causing issues where:
      // - Draft surveys saved with authData.profile.id
      // - But client-side currentUser.id might be different (email vs UUID mismatch)
      // - Result: drafts appeared "saved" but were immediately filtered out client-side
      //
      // Solution: Trust the API filtering and only do UI enhancements here.

      setSurveys(enhancedSurveys);
    } catch (error) {
      console.error('[loadSurveys] Error loading surveys:', error);

      // Show user-friendly error notification
      notify({
        title: 'Error loading surveys',
        description: error instanceof Error ? error.message : 'Failed to load surveys',
        variant: 'error',
      });

      // Set empty surveys array as fallback
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const sendReminderToReviewer = async (reviewerId: string, reviewerEmail: string) => {
    if (!selectedSurvey) return;

    try {
      const response = await fetch('/api/send-survey-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: selectedSurvey.id,
          reviewerId,
          isReminder: true,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          const statusText = response.statusText || 'Unknown error';
          console.error('Failed to send reminder - invalid JSON response:', {
            status: response.status,
            statusText,
            parseError,
          });
          notify({
            title: 'Failed to send reminder',
            description: `HTTP ${response.status}: ${statusText}`,
            variant: 'error',
          });
          return;
        }
        
        const errorMessage = errorData.details || errorData.error || 'Failed to send email';
        const errorHint = errorData.hint || '';
        
        console.error('Failed to send reminder:', {
          status: response.status,
          error: errorData,
          fullResponse: errorData,
        });
        
        notify({
          title: 'Failed to send reminder',
          description: errorHint ? `${errorMessage} (${errorHint})` : errorMessage,
          variant: 'error',
        });
        return;
      }

      // Add to reminded set
      setRemindedReviewers(prev => new Set(prev).add(reviewerId));

      notify({
        title: 'Reminder sent',
        description: `Reminder email sent to ${reviewerEmail}`,
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      notify({
        title: 'Failed to send reminder',
        description: error.message || 'Network error occurred',
        variant: 'error',
      });
    }
  };

  const deleteDraftSurvey = async (surveyId: string) => {
    try {
      const data = await fetchWithValidation(
        SurveyDeleteResponseSchema,
        `/api/surveys/${surveyId}?status=draft`,
        { method: 'DELETE' }
      );

      if (!data) {
        throw new Error('Failed to delete draft survey');
      }

      // Reload surveys (no notification for draft deletion)
      await loadSurveys();
    } catch (error: any) {
      console.error('Error deleting draft survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to delete draft survey',
        variant: 'error',
      });
    }
  };

  const deleteInProgressSurvey = async (surveyId: string) => {
    // Verify user has permission to delete
    // - Admin sponsors can delete their surveys in any status
    // - SLT sponsors can only delete their draft or in_progress surveys
    const survey = surveys.find(s => s.id === surveyId);
    const isSponsor = isUserSponsor(survey, currentUser, currentUserDbId);
    const isAdmin = currentUser?.app_role === 'admin';
    const isSLT = currentUser?.app_role === 'slt';
    const isDraftOrInProgress = survey?.status === 'draft' || survey?.status === 'in_progress';

    const canDelete = isSponsor && (isAdmin || (isSLT && isDraftOrInProgress));

    if (!canDelete) {
      if (isSLT && isSponsor && !isDraftOrInProgress) {
        notify({
          title: 'Cannot Delete',
          description: 'SLT can only delete draft or in-progress surveys. Contact an Admin to delete completed or finalized surveys.',
          variant: 'error',
        });
      } else {
        notify({
          title: 'Error',
          description: 'Only the survey sponsor (Admin or SLT for draft/in-progress) can delete their own surveys.',
          variant: 'error',
        });
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      const data = await fetchWithValidation(
        SurveyDeleteResponseSchema,
        `/api/surveys/${surveyId}`,
        { method: 'DELETE' }
      );

      if (!data) {
        throw new Error('Failed to delete review');
      }

      notify({
        title: 'Review deleted',
        description: 'Your review has been deleted successfully.',
        variant: 'success',
      });

      // Close any open modals and reload
      setIsDetailsModalOpen(false);
      await loadSurveys();
    } catch (error: any) {
      console.error('Error deleting in-progress survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to delete review',
        variant: 'error',
      });
    }
  };

  const sendToHRForReanalysis = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged_for_reanalysis: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send review to HR for reanalysis');
      }

      console.log('✅ Successfully flagged survey for reanalysis');

      // Update the selected survey state immediately to reflect the change
      if (selectedSurvey) {
        const updatedSurvey = {
          ...selectedSurvey,
          flagged_for_reanalysis: true
        };
        setSelectedSurvey(updatedSurvey);

        // Also update the survey in the surveys list
        setSurveys(surveys.map(s => s.id === surveyId ? updatedSurvey : s));
      }

      notify({
        title: 'Sent to HR for Reanalysis',
        description: 'Review has been sent to HR for Reanalysis.',
        variant: 'success',
      });

      // Reload surveys to update all views
      await loadSurveys();
    } catch (error: any) {
      console.error('Error sending review to HR for Reanalysis:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to send review to HR for Reanalysis',
        variant: 'error',
      });
    }
  };

  const completeSurveyWithAI = async (proceedWithIncomplete: boolean = false) => {
    if (!selectedSurvey) return;

    // Check if 70% of reviewers have completed (minimum completion requirement)
    const completionPercent = selectedSurvey.reviewers_count ? (selectedSurvey.completed_count ?? 0) / selectedSurvey.reviewers_count : 0;
    const minCompletionMet = completionPercent >= 0.7;
    const isAdmin = currentUser?.app_role === 'admin';

    // If minimum completion not met and user hasn't confirmed, show warning
    // Admins can bypass the warning and proceed directly
    if (!minCompletionMet && !proceedWithIncomplete && !isAdmin) {
      setShowIncompleteWarning(true);
      return;
    }

    setGeneratingSurveyId(selectedSurvey.id);
    setIsCancellingGeneration(false);
    setAnalyzerApiNotice(null); // Clear previous API notice

    // Create new AbortController for this request
    const abortController = new AbortController();
    generateAbortControllerRef.current = abortController;

    try {
      // Call the API to generate AI analysis report
      const response = await fetch('/api/360-generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: selectedSurvey.id,
        }),
        signal: abortController.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 409 Conflict - report generation already in progress
        if (response.status === 409 && data.status === 'generating') {
          // Keep the loading state and show informative message
          notify({
            title: 'Generation In Progress',
            description: 'A report is already being generated for this survey. Please wait.',
            variant: 'warning',
          });
          // Update the survey status locally to trigger polling
          setSelectedSurvey(prev => prev ? { ...prev, status: 'generating' } : prev);
          return; // Don't throw, let the polling take over
        }
        throw new Error(data.error || 'Failed to generate AI analysis');
      }

      // Store the generated report and open results modal
      setSurveyResults(data.report);
      setReportId(data.report?.id || null);
      setAuditModeEnabled(false); // Reset audit mode for new report

      // Show API version notice (only in local testing mode)
      if (isLocalTesting && data.meta) {
        if (data.meta.fallbackUsed) {
          setAnalyzerApiNotice({ type: 'fallback', message: `Used v1 (fallback): ${data.meta.fallbackReason}` });
        } else if (data.meta.version === 'v2-skill') {
          setAnalyzerApiNotice({ type: 'success', message: `Used v2 skill API (${data.meta.elapsedMs}ms)` });
        } else {
          setAnalyzerApiNotice({ type: 'success', message: `Used v1 prompt API (${data.meta.elapsedMs}ms)` });
        }
      }

      setIsDetailsModalOpen(false);

      // Reload surveys to update status
      await loadSurveys();

      // Fetch the updated survey data to ensure modal shows correct state
      const updatedSurveyResponse = await fetch(`/api/surveys/${selectedSurvey.id}/details`);
      if (updatedSurveyResponse.ok) {
        const updatedSurveyData = await updatedSurveyResponse.json();
        // Enhance with computed counts for display
        const reviewers = updatedSurveyData.survey.reviewers || [];
        setSelectedSurvey({
          ...updatedSurveyData.survey,
          reviewers_count: reviewers.length,
          completed_count: reviewers.filter((r: any) => r.status === 'completed').length
        });
      }

      setIsResultsModalOpen(true);

      notify({
        title: 'Success',
        description: 'AI analysis generated successfully',
        variant: 'success',
      });

      setShowIncompleteWarning(false);
    } catch (error: any) {
      // Don't show error notification if user cancelled
      if (error.name === 'AbortError') {
        console.log('Report generation cancelled by user');
        return; // State is already reset by cancelReportGeneration
      }
      console.error('Error completing survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to generate AI analysis',
        variant: 'error',
      });
    } finally {
      setGeneratingSurveyId(null);
      setIsCancellingGeneration(false);
      generateAbortControllerRef.current = null;
    }
  };

  /**
   * Cancel an in-progress report generation
   * This aborts the fetch request and resets the survey status
   */
  const cancelReportGeneration = async () => {
    if (!selectedSurvey) return;

    setIsCancellingGeneration(true);

    // Abort the fetch request
    if (generateAbortControllerRef.current) {
      generateAbortControllerRef.current.abort();
      generateAbortControllerRef.current = null;
    }

    // Reset the survey status back to in_progress
    try {
      const response = await fetch(`/api/surveys/${selectedSurvey.id}/cancel-generation`, {
        method: 'POST',
      });

      if (response.ok) {
        // Update local state
        setSelectedSurvey(prev => prev ? { ...prev, status: 'in_progress' } : prev);
        setSurveys(prev => prev.map(s =>
          s.id === selectedSurvey.id ? { ...s, status: 'in_progress' } : s
        ));
        notify({
          title: 'Cancelled',
          description: 'Report generation has been cancelled',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error cancelling generation:', error);
    } finally {
      setGeneratingSurveyId(null);
      setIsCancellingGeneration(false);
    }
  };

  const finalizeSurvey = async (surveyId: string) => {
    // Block finalization if flagged for reanalysis
    if (selectedSurvey?.flagged_for_reanalysis) {
      notify({
        title: 'Cannot Finalize',
        description: 'This survey has been flagged for reanalysis. An admin must resolve this before it can be finalized.',
        variant: 'error',
      });
      return;
    }

    // Check if narrative has been generated
    if (!finalNarrative) {
      notify({
        title: 'Narrative Required',
        description: 'You must generate a narrative before finalizing the report. Please go to the Narrative tab and click "Generate Narrative".',
        variant: 'error',
      });
      // Automatically switch to narrative tab
      setActiveReportTab('narrative');
      return;
    }

    // Block finalization if narrative is outdated (analysis was regenerated)
    if (narrativeOutdated) {
      notify({
        title: 'Narrative Outdated',
        description: 'The analysis has been updated since the narrative was generated. Please regenerate the narrative before finalizing.',
        variant: 'error',
      });
      // Automatically switch to narrative tab and scroll to regenerate button
      setActiveReportTab('narrative');
      setTimeout(() => {
        document.getElementById('regenerate-narrative-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    try {
      const data = await fetchWithValidation(
        SurveyUpdateResponseSchema,
        `/api/surveys/${surveyId}/finalize`,
        { method: 'POST' }
      );

      if (!data) {
        throw new Error('Failed to finalize review');
      }

      notify({
        title: 'Review finalized',
        description: 'The review has been finalized and the review flag has been cleared.',
        variant: 'success',
      });

      setIsResultsModalOpen(false);
      loadSurveys();
    } catch (error: any) {
      console.error('Error finalizing survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to finalize review',
        variant: 'error',
      });
    }
  };

  const addRecommendation = () => {
    if (!surveyResults) return;

    const updatedRecommendations = [...(surveyResults.recommendations || []), ''];
    setSurveyResults({
      ...surveyResults,
      recommendations: updatedRecommendations
    });

    // Start editing the new recommendation
    setEditingRecommendationIndex(updatedRecommendations.length - 1);
    setEditingRecommendationText('');
  };

  const deleteRecommendation = (index: number) => {
    if (!surveyResults) return;

    const updatedRecommendations = surveyResults.recommendations.filter((_: any, idx: number) => idx !== index);
    setSurveyResults({
      ...surveyResults,
      recommendations: updatedRecommendations
    });

    notify({
      title: 'Recommendation Deleted',
      description: 'The recommendation has been removed.',
      variant: 'success',
    });
  };

  const startEditingRecommendation = (index: number, text: string) => {
    setEditingRecommendationIndex(index);
    setEditingRecommendationText(text);
  };

  const saveRecommendation = (index: number) => {
    if (!surveyResults || !editingRecommendationText.trim()) return;

    const updatedRecommendations = [...(surveyResults.recommendations || [])];

    if (index === -1) {
      // Adding new recommendation
      updatedRecommendations.push(editingRecommendationText.trim());
    } else {
      // Updating existing recommendation
      updatedRecommendations[index] = editingRecommendationText.trim();
    }

    setSurveyResults({
      ...surveyResults,
      recommendations: updatedRecommendations
    });

    setEditingRecommendationIndex(null);
    setEditingRecommendationText('');

    // Mark narrative as outdated if it exists
    if (finalNarrative) {
      setNarrativeOutdated(true);
    }
  };

  const cancelEditingRecommendation = () => {
    setEditingRecommendationIndex(null);
    setEditingRecommendationText('');
  };

  const saveRecommendationsToDB = async () => {
    if (!surveyResults || !selectedSurvey) return;

    try {
      const response = await fetch('/api/360-generate-report', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: selectedSurvey.id,
          recommendations: surveyResults.recommendations,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save recommendations');
      }

      notify({
        title: 'Saved',
        description: 'Recommendations have been saved successfully.',
        variant: 'success',
      });

      // Mark narrative as outdated if it exists
      if (finalNarrative) {
        setNarrativeOutdated(true);
      }
    } catch (error: any) {
      console.error('Error saving recommendations:', error);
      notify({
        title: 'Save Failed',
        description: error.message || 'Failed to save recommendations. Please try again.',
        variant: 'error',
      });
    }
  };

  const generateNarrative = async () => {
    if (!selectedSurvey || !surveyResults) {
      notify({
        title: 'Missing Data',
        description: 'Unable to generate narrative. Please ensure the survey has been analyzed.',
        variant: 'error',
      });
      return;
    }

    setIsGeneratingNarrative(true);
    try {
      // Fetch raw survey data if not already loaded
      let surveyData = rawSurveyData;
      if (!surveyData) {
        console.log('[generateNarrative] Fetching raw survey data...');
        const rawDataResponse = await fetch(`/api/surveys/${selectedSurvey.id}/details`);
        if (!rawDataResponse.ok) {
          throw new Error('Failed to fetch survey data');
        }
        const rawData = await rawDataResponse.json();

        // Transform the data to match expected structure
        surveyData = {
          survey: rawData.survey,
          employee: rawData.employee,
          questions: rawData.questions.map((sq: any) => ({
            id: sq.id,
            question_id: sq.question_id,
            question_text: sq.question?.question_text || '',
            category: sq.question?.category || '',
            responses: rawData.responses
              .filter((r: any) => r.question_id === sq.question_id)
              .map((r: any) => ({
                reviewer_email: r.reviewer_email,
                response_text: r.response_text,
                rating: r.rating,
              }))
          }))
        };
      }

      // Prepare raw responses data
      const rawResponses = surveyData.questions.map((q: any) => ({
        question: q.question_text,
        responses: q.responses.map((r: any) => r.response_text).filter((text: string) => text && text.trim())
      }));

      const response = await fetch('/api/ai/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: selectedSurvey.id,
          subjectName: selectedSurvey.employee?.name || 'the subject',
          rawResponses,
          reportData: {
            executive_summary: surveyResults.executive_summary,
            themes: surveyResults.themes,
            strengths: surveyResults.strengths,
            development_areas: surveyResults.development_areas,
            key_insights: surveyResults.key_insights,
            recommendations: surveyResults.recommendations,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate narrative');
      }

      const data = await response.json();
      setFinalNarrative(data.narrative);
      setNarrativeOutdated(false);

      // Save narrative to database
      const saveResponse = await fetch(`/api/surveys/${selectedSurvey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_narrative: data.narrative,
          narrative_generated_at: new Date().toISOString(),
        }),
      });

      if (!saveResponse.ok) {
        console.error('Failed to save narrative to database');
      }

      notify({
        title: 'Narrative Generated',
        description: 'The final narrative has been successfully created.',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error generating narrative:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to generate narrative',
        variant: 'error',
      });
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  const sendToHR = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged_for_admin: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to flag review for admin');
      }

      notify({
        title: 'Flagged for Admin Review',
        description: 'This review has been flagged for admin attention.',
        variant: 'success',
      });

      setIsResultsModalOpen(false);
      loadSurveys();
    } catch (error: any) {
      console.error('Error flagging for admin:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to flag review for admin',
        variant: 'error',
      });
    }
  };

  const resolveNeedsReview = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged_for_reanalysis: false, resolved_by_admin: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve review');
      }

      // Update selectedSurvey to remove the tag and mark as resolved by admin
      if (selectedSurvey) {
        const updatedSurvey = {
          ...selectedSurvey,
          flagged_for_reanalysis: false,
          resolved_by_admin: true
        };
        setSelectedSurvey(updatedSurvey);

        // Also update the surveys list
        setSurveys(surveys.map(s => s.id === surveyId ? updatedSurvey : s));
      }

      notify({
        title: 'Review Resolved',
        description: 'The review has been marked as resolved by admin.',
        variant: 'success',
      });

      setIsResultsModalOpen(false);
    } catch (error: any) {
      console.error('Error resolving review:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to resolve review',
        variant: 'error',
      });
    }
  };

  const loadRawSurveyData = async (surveyId: string) => {
    try {
      const data = await fetchWithValidation(
        SurveyDetailResponseSchema,
        `/api/surveys/${surveyId}/details`
      );

      if (!data) {
        throw new Error('Failed to load raw survey data');
      }

      // Transform API response to UI-expected format using utility
      // This enriches responses with full question and reviewer data
      const { transformSurveyDetailsForUI } = await import('@/lib/survey-data-transformer');
      const transformedData = transformSurveyDetailsForUI(data);

      setRawSurveyData(transformedData);
      setShowRawData(true);
    } catch (error: any) {
      console.error('Error loading raw survey data:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to load raw survey data',
        variant: 'error',
      });
    }
  };

  const reanalyzeSurvey = async (surveyId: string, tone: 'standard' | 'softer' = 'standard') => {
    setGeneratingSurveyId(surveyId);
    try {
      const response = await fetch('/api/360-generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_id: surveyId, tone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reanalyze survey');
      }

      setSurveyResults(data.report);
      setReportId(data.report?.id || null);
      setAuditModeEnabled(false); // Reset audit mode for reanalyzed report

      notify({
        title: 'Analysis Complete',
        description: tone === 'softer'
          ? 'Survey has been reanalyzed with a softer tone'
          : 'Survey has been reanalyzed',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error reanalyzing survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to reanalyze survey',
        variant: 'error',
      });
    } finally {
      setGeneratingSurveyId(null);
    }
  };

  const sendBackward = async (surveyId: string, currentStatus?: string) => {
    const status = currentStatus || selectedSurvey?.status;

    // Determine target status and confirmation message based on current status
    let targetStatus: string;
    let confirmMessage: string;
    let successMessage: string;

    if (status === 'finalized') {
      targetStatus = 'completed';
      confirmMessage = 'Are you sure you want to reopen this finalized review? It will be moved back to Completed status.';
      successMessage = 'The review has been moved back to Completed status.';
    } else if (status === 'completed') {
      targetStatus = 'in_progress';
      confirmMessage = 'Are you sure you want to send this review back to In Progress? This will discard the current AI analysis and clear the reanalysis flag.';
      successMessage = 'The review has been moved back to In Progress status and the reanalysis flag has been cleared.';
    } else if (status === 'in_progress') {
      targetStatus = 'draft';
      confirmMessage = 'Are you sure you want to send this review back to Draft? All reviewers will be kept, but the survey will no longer be active.';
      successMessage = 'The review has been moved back to Draft status. Reviewers have been preserved.';
    } else {
      notify({
        title: 'Error',
        description: 'Cannot send backward from this status',
        variant: 'error',
      });
      return;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/surveys/${surveyId}/revert-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus: status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send review backward');
      }

      const data = await response.json();

      notify({
        title: 'Review sent backward',
        description: successMessage,
        variant: 'success',
      });

      // Update selectedSurvey immediately to reflect the new status
      // This ensures the modal re-renders with the correct view (editable vs read-only)
      if (selectedSurvey) {
        setSelectedSurvey({
          ...selectedSurvey,
          status: data.survey.status,
          flagged_for_reanalysis: false
        });
      }

      // Reload surveys in the background to ensure data consistency
      await loadSurveys();

      // After surveys are reloaded, update selectedSurvey with fresh data
      if (selectedSurvey) {
        const response = await fetch(`/api/surveys/list?organization_id=${organizationId}`);
        if (response.ok) {
          const listData = await response.json();
          const updatedSurveyData = listData.surveys?.find((s: any) => s.id === selectedSurvey.id);

          if (updatedSurveyData) {
            const updatedSurvey = {
              ...updatedSurveyData,
              employee: selectedSurvey.employee,
              reviewers_count: updatedSurveyData.reviewers?.length || 0,
              completed_count: updatedSurveyData.reviewers?.filter((r: any) => r.status === 'completed').length || 0
            };
            setSelectedSurvey(updatedSurvey);

            // Reload reviewers data
            await loadReviewers(selectedSurvey.id);

            // If the results modal was open, close it and reopen the details modal
            // This ensures the correct modal content is shown for the new status
            if (isResultsModalOpen) {
              setIsResultsModalOpen(false);
              setIsDetailsModalOpen(true);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending survey backward:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to send review backward',
        variant: 'error',
      });
    }
  };

  const loadReviewers = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/reviewers`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load reviewers');
      }

      const data = await response.json();
      setSurveyReviewers(data.reviewers || []);
    } catch (error) {
      console.error('Error loading reviewers:', error);
    }
  };

  const removeReviewer = async (reviewerId: string) => {
    if (!confirm('Are you sure you want to remove this reviewer?')) return;

    try {
      if (!selectedSurvey) return;

      const response = await fetch(`/api/surveys/${selectedSurvey.id}/reviewers/${reviewerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove reviewer');
      }

      notify({
        title: 'Reviewer removed',
        description: 'The reviewer has been removed from the review.',
        variant: 'success',
      });

      if (selectedSurvey) {
        loadReviewers(selectedSurvey.id);
        loadSurveys(); // Refresh to update counts
      }
    } catch (error: any) {
      console.error('Error removing reviewer:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to remove reviewer',
        variant: 'error',
      });
    }
  };

  // Filter employees for reviewer picker (exclude the survey subject)
  // Fetch employees with detected relationships from API
  const fetchEmployeesWithRelationships = async (
    searchTerm: string = '',
    relationshipFilter: ParticipantRelationship | null = null
  ) => {
    if (!selectedSurvey?.employee_id) return;

    setIsLoadingRelationships(true);
    try {
      const params = new URLSearchParams({
        subjectId: selectedSurvey.employee_id,
      });

      if (relationshipFilter) {
        params.append('relationship', relationshipFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/employees/search-by-relationship?${params}`);
      if (!response.ok) throw new Error('Failed to fetch employees');

      const data = await response.json();
      setEmployeesWithRelationships(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees with relationships:', error);
      notify({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'error',
      });
      setEmployeesWithRelationships([]);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  // Use API results when available, otherwise fallback to local filtering
  const filteredReviewerEmployees: EmployeeWithRelationship[] = (
    employeesWithRelationships.length > 0 ? employeesWithRelationships : employees
  )
    .filter(emp => emp.id !== selectedSurvey?.employee_id) // Exclude the survey subject
    .filter(emp => {
      const searchLower = reviewerSearch.toLowerCase();
      return (
        emp.name?.toLowerCase().includes(searchLower) ||
        emp.title?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      );
    });

  const addReviewer = async () => {
    if (!selectedReviewerEmployee || !selectedSurvey) {
      notify({
        title: 'Missing information',
        description: 'Please select an employee as a reviewer.',
        variant: 'error',
      });
      return;
    }

    // Use auto-detected relationship if available and no manual override
    const employeeWithRel = selectedReviewerEmployee as EmployeeWithRelationship;
    const finalRelationship = newReviewerRelationship || employeeWithRel.detected_relationship || 'cross_functional';

    // Get name and email - use full_name if available (matching wizard behavior)
    const reviewerName = (selectedReviewerEmployee as any).full_name || selectedReviewerEmployee.name || '';
    const reviewerEmail = selectedReviewerEmployee.email || '';

    // Validate we have required fields before making the request
    if (!reviewerName || !reviewerEmail || !finalRelationship) {
      notify({
        title: 'Missing information',
        description: 'Please ensure name, email, and relationship are selected.',
        variant: 'error',
      });
      return;
    }

    try {
      const response = await fetch(`/api/surveys/${selectedSurvey.id}/reviewers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: reviewerName,
          reviewer_email: reviewerEmail,
          relationship: finalRelationship,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reviewer');
      }

      const data = await response.json();

      // Send invitation email
      if (data.reviewer) {
        try {
          await fetch('/api/send-survey-invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surveyId: selectedSurvey.id,
              reviewerId: data.reviewer.id,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
        }
      }

      notify({
        title: 'Reviewer added',
        description: 'Invitation email has been sent to the reviewer.',
        variant: 'success',
      });

      // Reset form
      setNewReviewerName('');
      setNewReviewerEmail('');
      setNewReviewerRelationship('');
      setSelectedReviewerEmployee(null);
      setReviewerSearch('');
      setShowReviewerPicker(false);
      setIsAddingReviewer(false);
      setEmployeesWithRelationships([]);

      // Refresh data
      loadReviewers(selectedSurvey.id);
      loadSurveys();
    } catch (error: any) {
      console.error('Error adding reviewer:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to add reviewer',
        variant: 'error',
      });
    }
  };

  // Load reviewers when modal opens
  useEffect(() => {
    if (isDetailsModalOpen && selectedSurvey) {
      loadReviewers(selectedSurvey.id);
      setRemindedReviewers(new Set()); // Reset reminded state when opening modal
    }
  }, [isDetailsModalOpen, selectedSurvey]);

  // Filter by role first (always applied since we removed "all" option)
  // For Reviewer and Subject tabs, automatically apply status filters
  const roleFilteredSurveys = surveys.filter(survey => {
    const isSponsor = isUserSponsor(survey, currentUser, currentUserDbId);
    const isSubject = survey.employee_id === currentUser?.id;
    const isReviewer = survey.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
    const isSLT = currentUser?.app_role === 'slt';
    const isAdmin = currentUser?.app_role === 'admin';

    // Reviewer tab: show in_progress surveys where user is a reviewer
    // For SLT and Admin: also show in_progress surveys where they can opt in (not yet a reviewer)
    // BUT exclude surveys where they are the subject (cannot review themselves)
    if (filterRole === 'reviewer') {
      if (isSLT || isAdmin) {
        // SLT/Admin sees in_progress surveys where they can participate as reviewer (not the subject)
        // ALSO: If admin is explicitly a reviewer on a flagged survey, show it here too
        if (isAdmin && isReviewer && survey.flagged_for_reanalysis) {
          return !isSubject;
        }
        return survey.status === 'in_progress' && !isSubject;
      }
      return isReviewer && survey.status === 'in_progress';
    }

    // Subject tab removed - users can view their finalized reports in the "My Report" page

    // Sponsor tab:
    // - All users (including admins) see only surveys they created
    if (filterRole === 'sponsor') {
      return isSponsor;
    }

    // Needs Reanalysis tab (Admin only): ALL flagged surveys
    if (filterRole === 'needs_reanalysis') {
      return survey.flagged_for_reanalysis === true;
    }

    // All 360°s tab (Admin only): Show ALL surveys EXCEPT drafts
    if (filterRole === 'all') {
      return survey.status !== 'draft';
    }

    return false;
  });

  // Calculate counts for tab badges - must match the roleFilteredSurveys logic exactly
  const sponsorCount = surveys.filter(s => {
    // All users (including admins) count only surveys they personally created
    const isCreator = isUserSponsor(s, currentUser, currentUserDbId);
    return isCreator;
  }).length;

  const reviewerCount = surveys.filter(s => {
    const isReviewer = s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
    const isSLT = currentUser?.app_role === 'slt';
    const isAdmin = currentUser?.app_role === 'admin';
    const isSubject = s.employee_id === currentUser?.id;

    // SLT/Admin sees all in_progress (can opt in), but NOT surveys where they are the subject
    // ALSO: If admin is explicitly a reviewer on a flagged survey, count it
    if (isSLT || isAdmin) {
      if (isAdmin && isReviewer && s.flagged_for_reanalysis) {
        return !isSubject;
      }
      return s.status === 'in_progress' && !isSubject;
    }
    return s.status === 'in_progress' && isReviewer;
  }).length;

  const subjectCount = surveys.filter(s =>
    s.status === 'finalized' &&
    s.employee_id === currentUser?.id
  ).length;

  // Count for Needs Reanalysis tab (Admin only) - ALL flagged surveys
  const needsReanalysisCount = surveys.filter(s =>
    s.flagged_for_reanalysis === true
  ).length;

  // Count for All 360°s tab (Admin only) - ALL surveys except drafts
  const allSurveysCount = surveys.filter(s => s.status !== 'draft').length;

  // Then filter by status (only applies to Sponsor tab now)
  // Reviewer and Subject tabs ignore manual status filter (automatic filtering above)
  let filteredSurveys = roleFilteredSurveys;

  if (filterRole === 'sponsor') {
    filteredSurveys = filterStatus === 'all'
      ? roleFilteredSurveys
      : filterStatus === 'needs_review'
      ? roleFilteredSurveys.filter(s => s.flagged_for_admin === true)
      : filterStatus === 'needs_reanalysis'
      ? roleFilteredSurveys.filter(s => s.flagged_for_reanalysis === true)
      : roleFilteredSurveys.filter(s => s.status === filterStatus);
  }

  // Apply reviewer filter (for SLT and Admin on Reviewer tab)
  if (filterRole === 'reviewer' && (currentUser?.app_role === 'slt' || currentUser?.app_role === 'admin')) {
    filteredSurveys = reviewerFilterStatus === 'all'
      ? roleFilteredSurveys
      : reviewerFilterStatus === 'required'
      ? roleFilteredSurveys.filter(s => s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email))
      : roleFilteredSurveys.filter(s => !s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email));
  }

  // Apply search filter on Reviewer tab
  if (filterRole === 'reviewer' && reviewerSearchQuery.trim()) {
    const query = reviewerSearchQuery.toLowerCase().trim();
    filteredSurveys = filteredSurveys.filter(survey => {
      const employeeName = survey.employee?.name?.toLowerCase() || survey.employee?.full_name?.toLowerCase() || '';

      // Check if query matches start of first name or last name ONLY
      const nameParts = employeeName.split(/\s+/).filter(part => part.length > 0); // Split by whitespace and remove empty strings
      return nameParts.some(part => part.startsWith(query));
    });
  }

  // Apply search filter on Sponsor tab
  if (filterRole === 'sponsor' && sponsorSearchQuery.trim()) {
    const query = sponsorSearchQuery.toLowerCase().trim();
    filteredSurveys = filteredSurveys.filter(survey => {
      const employeeName = survey.employee?.name?.toLowerCase() || survey.employee?.full_name?.toLowerCase() || '';

      // Check if query matches start of first name or last name ONLY
      const nameParts = employeeName.split(/\s+/).filter(part => part.length > 0); // Split by whitespace and remove empty strings
      return nameParts.some(part => part.startsWith(query));
    });
  }

  // Apply search filter on Needs Reanalysis tab
  if (filterRole === 'needs_reanalysis' && sponsorSearchQuery.trim()) {
    const query = sponsorSearchQuery.toLowerCase().trim();
    filteredSurveys = filteredSurveys.filter(survey => {
      const employeeName = survey.employee?.name?.toLowerCase() || survey.employee?.full_name?.toLowerCase() || '';
      const nameParts = employeeName.split(/\s+/).filter(part => part.length > 0);
      return nameParts.some(part => part.startsWith(query));
    });
  }

  // Apply search filter on All 360°s tab
  if (filterRole === 'all' && allSurveysSearchQuery.trim()) {
    const query = allSurveysSearchQuery.toLowerCase().trim();
    filteredSurveys = filteredSurveys.filter(survey => {
      const employeeName = survey.employee?.name?.toLowerCase() || survey.employee?.full_name?.toLowerCase() || '';
      const nameParts = employeeName.split(/\s+/).filter(part => part.length > 0);
      return nameParts.some(part => part.startsWith(query));
    });
  }

  // Calculate stats based on role-filtered surveys
  const stats = {
    draft: roleFilteredSurveys.filter(s => s.status === 'draft').length,
    in_progress: roleFilteredSurveys.filter(s => s.status === 'in_progress').length,
    completed: roleFilteredSurveys.filter(s => s.status === 'completed').length,
    needs_review: roleFilteredSurveys.filter(s => s.flagged_for_admin === true).length,
    needs_reanalysis: roleFilteredSurveys.filter(s => s.flagged_for_reanalysis === true).length,
    finalized: roleFilteredSurveys.filter(s => s.status === 'finalized').length,
  };

  // Calculate reviewer stats for SLT users (Reviewer tab filter boxes)
  const reviewerStats = {
    total: roleFilteredSurveys.length, // All surveys shown on Reviewer tab (already filtered by role)
    required: roleFilteredSurveys.filter(s =>
      s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email)
    ).length,
    optional: roleFilteredSurveys.filter(s =>
      !s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email)
    ).length,
  };

  // Calculate risk flags (below 50% response rate with < 3 days to deadline)
  const atRiskSurveys = surveys.filter(s => {
    if (s.status !== 'in_progress' || !s.due_date || !s.reviewers_count) return false;
    const responseRate = s.reviewers_count > 0 ? (s.completed_count || 0) / s.reviewers_count : 0;
    const daysUntilDue = Math.ceil((new Date(s.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;
  });

  const getStatusBadge = (status: string, flaggedForAdmin?: boolean, flaggedForReanalysis?: boolean, resolvedByAdmin?: boolean, surveyId?: string) => {
    // Override status to 'generating' if this survey is currently generating
    const effectiveStatus = (surveyId && generatingSurveyId === surveyId) ? 'generating' : status;
    // Show "Needs Reanalysis" badge for flagged surveys
    if ((flaggedForAdmin || flaggedForReanalysis) && currentUser?.app_role === 'admin') {
      return (
        <Tooltip content="This survey has been flagged and requires admin review">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-100 text-red-700 border-red-300 cursor-help">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Reanalysis
          </span>
        </Tooltip>
      );
    }

    // Show "Needs Reanalysis" for sponsors when flagged for reanalysis
    if (flaggedForReanalysis && (isUserSponsor(selectedSurvey, currentUser, currentUserDbId))) {
      return (
        <Tooltip content="This survey has been flagged and requires admin review">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-100 text-red-700 border-red-300 cursor-help">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Reanalysis
          </span>
        </Tooltip>
      );
    }

    // Show "Resolved By Admin" badge when admin has resolved a flagged survey
    if (resolvedByAdmin && effectiveStatus === 'completed') {
      return (
        <Tooltip content="This survey was reviewed and resolved by an admin">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-green-100 text-green-700 border-green-300 cursor-help">
            <CheckCircle className="w-3 h-3 mr-1" />
            Resolved By Admin
          </span>
        </Tooltip>
      );
    }

    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      generating: 'bg-purple-100 text-purple-700 border-purple-300 animate-pulse',
      completed: 'bg-green-100 text-green-700 border-green-300',
      finalized: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    const icons = {
      draft: Clock,
      in_progress: MessageSquare,
      generating: Loader2,
      completed: CheckCircle,
      finalized: ArrowDownCircle
    };
    const labels = {
      draft: 'Draft',
      in_progress: 'In Progress',
      generating: 'Generating Report...',
      completed: 'Completed',
      finalized: 'Finalized'
    };
    const tooltips = {
      draft: 'Survey is not yet sent to reviewers',
      in_progress: 'Survey is active and awaiting responses',
      generating: 'AI is analyzing responses and generating the report',
      completed: 'All responses received and analyzed',
      finalized: 'Survey is archived and final'
    };
    const Icon = icons[effectiveStatus as keyof typeof icons] || Clock;
    const tooltipText = tooltips[effectiveStatus as keyof typeof tooltips] || 'Survey status';

    return (
      <Tooltip content={tooltipText}>
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border cursor-help ${styles[effectiveStatus as keyof typeof styles]}`}>
          <Icon className="w-3 h-3 mr-1" />
          {labels[effectiveStatus as keyof typeof labels] || effectiveStatus}
        </span>
      </Tooltip>
    );
  };

  // Handle SLT member opting into a survey
  const handleSLTOptIn = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/opt-in`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to opt into survey');
      }

      const data = await response.json();
      console.log('✅ Successfully opted into survey:', data);

      // Show success notification
      notify({
        title: 'Opted In',
        description: 'You have been added as a reviewer for this survey.',
        variant: 'success',
      });

      // Refresh surveys to update button state
      await loadSurveys();

    } catch (error) {
      console.error('Error opting into survey:', error);
      notify({
        title: 'Failed to Opt In',
        description: error instanceof Error ? error.message : 'Failed to opt into survey',
        variant: 'error',
      });
    }
  };

  const handleSLTOptOut = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/opt-out`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to opt out of survey');
      }

      const data = await response.json();
      console.log('✅ Successfully opted out of survey:', data);

      // Show success notification
      notify({
        title: 'Opted Out',
        description: 'You have been removed as a reviewer for this survey.',
        variant: 'success',
      });

      // Refresh surveys to update button state
      await loadSurveys();

    } catch (error) {
      console.error('Error opting out of survey:', error);
      notify({
        title: 'Failed to Opt Out',
        description: error instanceof Error ? error.message : 'Failed to opt out of survey',
        variant: 'error',
      });
    }
  };

  // Handle AI modal completion - pass data to wizard and open it
  const handleAIModalComplete = (data: ParsedSurveyData) => {
    console.log('[Feedback360Dashboard.handleAIModalComplete] Data received from AI modal:', data);
    setAiParsedData(data);
    setIsAIModalOpen(false);
    setIsWizardOpen(true);
  };

  return (
    <TooltipProvider>
    <div>
      {/* Role Navigation Tabs */}
      <div className="mb-4">
        <NavigationTabs
          tabs={[
            // Only show All 360°s tab for Admin role (first position)
            ...(currentUser?.app_role === 'admin' ? [{
              id: 'all',
              label: 'All 360°s',
              tooltip: 'View all 360 feedback surveys across the organization',
              count: allSurveysCount
            }] : []),
            // Only show Sponsor tab for Admin and SLT roles
            ...(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' ? [{
              id: 'sponsor',
              label: 'Sponsor',
              tooltip: '360 feedback you created. Launch feedback sessions, manage reviewers, track progress, and finalize the report',
              count: sponsorCount
            }] : []),
            {
              id: 'reviewer',
              label: 'Give Feedback',
              tooltip: 'Active 360 feedback sessions awaiting your input. Provide anonymous feedback, aggregated with AI',
              count: reviewerCount
            },
            // Only show Needs Reanalysis tab for Admin role
            ...(currentUser?.app_role === 'admin' ? [{
              id: 'needs_reanalysis',
              label: 'Needs Reanalysis',
              tooltip: 'Surveys flagged for admin review and reanalysis across all sponsors',
              count: needsReanalysisCount
            }] : [])
          ]}
          activeTab={filterRole}
          onTabChange={(tabId) => {
            setFilterRole(tabId as 'all' | 'sponsor' | 'reviewer' | 'needs_reanalysis');
            setFilterStatus('all'); // Reset status filter when switching tabs
            setReviewerFilterStatus('all'); // Reset reviewer filter when switching tabs
            setReviewerSearchQuery(''); // Clear reviewer search when switching tabs
            setSponsorSearchQuery(''); // Clear sponsor search when switching tabs
            setAllSurveysSearchQuery(''); // Clear all surveys search when switching tabs
          }}
          variant="underline"
        />
      </div>

      {/* Pipeline Stats with Risk Flags - Only show on Sponsor tab */}
      {filterRole === 'sponsor' && (
      <div className={`grid gap-4 mt-6 ${
        currentUser?.app_role === 'admin'
          ? 'grid-cols-3 lg:grid-cols-5'
          : currentUser?.app_role === 'slt'
          ? 'grid-cols-2 lg:grid-cols-5'
          : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white dark:bg-gray-800 rounded-md shadow p-3 border-2 transition-all text-left ${
            filterStatus === 'all' ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{roleFilteredSurveys.length}</p>
            </div>
          </div>
        </button>

        {/* Drafts - Only show for Admin and SLT (Sponsors) */}
        {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt') && (
          <Tooltip content="Surveys not yet sent to reviewers">
            <button
              onClick={() => setFilterStatus('draft')}
              className={`bg-white dark:bg-gray-800 rounded-md shadow p-3 border-2 transition-all text-left ${
                filterStatus === 'draft' ? 'border-gray-500 dark:border-gray-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Drafts</p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.draft}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
            </button>
          </Tooltip>
        )}

        <Tooltip content="Surveys awaiting responses from reviewers">
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`rounded-md shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'in_progress'
                ? 'border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                : 'bg-white dark:bg-gray-800 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{stats.in_progress}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-yellow-400 dark:text-yellow-500" />
            </div>
          </button>
        </Tooltip>

        {/* Completed - Available to all roles (Users see reviews where they're reviewers) */}
        <Tooltip content="Surveys with all responses received and analyzed">
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-md shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'completed'
                ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-400">Completed</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 dark:text-green-500" />
            </div>
          </button>
        </Tooltip>

        {/* Finalized - Available to all users (they see only their own finalized reviews) */}
        <Tooltip content="Surveys marked as final and archived">
          <button
            onClick={() => setFilterStatus('finalized')}
            className={`rounded-md shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'finalized'
                ? 'border-purple-500 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 dark:text-purple-400">Finalized</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{stats.finalized}</p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-purple-400 dark:text-purple-500" />
            </div>
          </button>
        </Tooltip>
      </div>
      )}

      {/* Launch Review Button - Only show for Admin and SLT (Sponsors) on Sponsor tab */}
      {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt') && filterRole === 'sponsor' && (
        <div className="relative mt-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setPreselectedEmployee(undefined);
                setIsWizardOpen(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium whitespace-nowrap"
            >
              Launch 360° Review
            </button>

            {/* Search Bar */}
            <div className="relative w-[675px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={sponsorSearchQuery}
                onChange={(e) => setSponsorSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            {/* AI-assisted review wizard button - disabled and hidden */}
            {false && (
              <button
                onClick={() => {
                  setIsAIModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium flex items-center gap-2"
                title="Create survey with AI assistance"
                disabled
              >
                <Sparkles className="w-4 h-4" />
                Create with AI
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reviewer Filter Boxes - Only show for SLT and Admin on Reviewer tab */}
      {filterRole === 'reviewer' && (currentUser?.app_role === 'slt' || currentUser?.app_role === 'admin') && (
      <div className="grid gap-4 mt-6 grid-cols-2 lg:grid-cols-5">
        {/* Total */}
        <button
          onClick={() => setReviewerFilterStatus('all')}
          className={`bg-white dark:bg-gray-800 rounded-md shadow p-3 border-2 transition-all text-left ${
            reviewerFilterStatus === 'all' ? 'border-cyan-500 dark:border-cyan-400' : 'border-cyan-200 dark:border-cyan-800 hover:border-cyan-300 dark:hover:border-cyan-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyan-700 dark:text-cyan-400">Total</p>
              <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-300">{reviewerStats.total}</p>
            </div>
          </div>
        </button>

        {/* Required (Assigned Reviewer) */}
        <Tooltip content="360 feedback sessions where you are an assigned reviewer">
          <button
            onClick={() => setReviewerFilterStatus('required')}
            className={`rounded-md shadow p-3 border-2 transition-all text-left ${
              reviewerFilterStatus === 'required'
                ? 'border-green-700 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : 'bg-white dark:bg-gray-800 border-green-400 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800 dark:text-green-400">Required</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300">{reviewerStats.required}</p>
              </div>
              <Users className="w-8 h-8 text-green-600 dark:text-green-500" />
            </div>
          </button>
        </Tooltip>

        {/* Optional (Can Opt In) */}
        <Tooltip content="360 feedback sessions you can opt into as an SLT or Admin member">
          <button
            onClick={() => setReviewerFilterStatus('optional')}
            className={`rounded-md shadow p-3 border-2 transition-all text-left ${
              reviewerFilterStatus === 'optional'
                ? 'border-lime-500 dark:border-lime-600 bg-lime-50 dark:bg-lime-900/20'
                : 'bg-white dark:bg-gray-800 border-lime-200 dark:border-lime-800 hover:bg-lime-50 dark:hover:bg-lime-900/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-lime-700 dark:text-lime-400">Optional</p>
                <p className="text-2xl font-bold text-lime-900 dark:text-lime-300">{reviewerStats.optional}</p>
              </div>
              <UserPlus className="w-8 h-8 text-lime-400 dark:text-lime-500" />
            </div>
          </button>
        </Tooltip>
      </div>
      )}

      {/* Search Bar - Only show on Reviewer tab */}
      {filterRole === 'reviewer' && (
        <div className="mt-6">
          <div className="relative w-[675px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={reviewerSearchQuery}
              onChange={(e) => setReviewerSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {/* Needs Reanalysis Tab - Search Only (Admin Only) */}
      {filterRole === 'needs_reanalysis' && currentUser?.app_role === 'admin' && (
        <div className="mt-6 mb-6">
          <div className="relative w-[675px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={sponsorSearchQuery}
              onChange={(e) => setSponsorSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {/* All 360°s Tab - Search Only (Admin Only) */}
      {filterRole === 'all' && currentUser?.app_role === 'admin' && (
        <div className="mt-6 mb-6">
          <div className="relative w-[675px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={allSurveysSearchQuery}
              onChange={(e) => setAllSurveysSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-12 mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading reviews...</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700 p-12 mt-6">
          <div className="text-center mb-8">
            <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-normal text-gray-500 dark:text-gray-400 mb-2">
              {filterRole === 'reviewer'
                ? 'No 360°s require your input'
                : filterRole === 'needs_reanalysis'
                ? 'No surveys need reanalysis'
                : filterRole === 'all'
                ? 'No 360°s in the system yet'
                : filterStatus === 'all'
                ? 'No 360°s yet. Launch a 360° Review and it will show up here.'
                : filterStatus === 'draft'
                ? 'Nothing drafted'
                : filterStatus === 'in_progress'
                ? 'Nothing in progress'
                : filterStatus === 'completed'
                ? 'Nothing completed'
                : filterStatus === 'finalized'
                ? 'Nothing finalized'
                : filterStatus === 'needs_review'
                ? 'No reviews need admin review'
                : `No reviews ${filterStatus}`}
            </h3>
            {filterRole === 'sponsor' && filterStatus === 'all' && (currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt') && (
              <>
                {/* Create First Review button - disabled and hidden */}
                {false && (
                  <button
                    onClick={() => setIsWizardOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-2"
                    disabled
                  >
                    <Sparkles className="w-5 h-5" />
                    Create First Review
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {filteredSurveys.map((survey) => {
            // Determine user's relationship to this survey
            const isSponsor = isUserSponsor(survey, currentUser, currentUserDbId);

            // DEBUG: Sponsor check (commented out to reduce console noise)
            // if (survey.survey_name?.includes('Elliott') || survey.survey_name?.includes('Leader')) {
            //   console.log('[Feedback360Dashboard] Sponsor check for:', survey.survey_name);
            //   console.log('  survey.created_by:', survey.created_by);
            //   console.log('  currentUser?.id:', currentUser?.id);
            //   console.log('  currentUser?.email:', currentUser?.email);
            //   console.log('  IDs match?', survey.created_by === currentUser?.id);
            //   console.log('  Emails match?', survey.created_by === currentUser?.email);
            //   console.log('  => isSponsor:', isSponsor);
            // }

            const isReviewee = survey.employee_id === currentUser?.id;
            const isReviewer = survey.reviewers?.some((r: any) =>
              r.reviewer_email === currentUser?.email
            );

            return (
              <div
                key={survey.id}
                className="bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer relative"
                onClick={() => {
                  // Draft surveys: Open wizard for editing/launching
                  // Completed/Finalized surveys: Go directly to results for authorized users
                  // Other statuses: Open details modal for management
                  if (survey.status === 'draft' && isSponsor) {
                    setEditingDraftSurvey(survey);
                    // Pre-select the employee being reviewed
                    const employee = employees.find(e => e.id === survey.employee_id);
                    if (employee) {
                      setPreselectedEmployee(employee);
                    }
                    setIsWizardOpen(true);
                  } else if (
                    (survey.status === 'completed' || survey.status === 'finalized') &&
                    canUserViewResults(survey, currentUser, currentUserDbId)
                  ) {
                    // Go straight to results for completed/finalized surveys
                    loadAndShowResults(survey);
                  } else {
                    // Open details modal for other statuses
                    // First fetch fresh data to ensure completed_count is accurate
                    const fetchAndOpenModal = async () => {
                      try {
                        const response = await fetch(`/api/surveys/list?organization_id=${organizationId}`);
                        if (response.ok) {
                          const listData = await response.json();
                          const data = listData.surveys?.find((s: any) => s.id === survey.id);

                          if (data) {
                            const reviewers = data.reviewers || [];
                            const freshSurvey = {
                              ...data,
                              employee: survey.employee,
                              reviewers_count: reviewers.length,
                              completed_count: reviewers.filter((r: any) => r.status === 'completed').length
                            };
                            setSelectedSurvey(freshSurvey);
                            setIsDetailsModalOpen(true);
                            return;
                          }
                        }
                        // Fallback to original survey data
                        setSelectedSurvey(survey);
                        setIsDetailsModalOpen(true);
                      } catch (error) {
                        console.error('Error fetching survey data:', error);
                        // Fallback to original survey data
                        setSelectedSurvey(survey);
                        setIsDetailsModalOpen(true);
                      }
                    };
                    fetchAndOpenModal();
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 leading-tight">
                        360° Feedback -
                        <Avatar
                          name={survey.employee?.name}
                          picture={survey.employee?.picture ?? undefined}
                          size="xs"
                        />
                        {survey.employee?.name || 'Unknown Employee'}
                      </h3>

                      {/* Relationship badges */}
                      {isSponsor && (
                        <Tooltip content="You created this survey">
                          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400 cursor-help">
                            Sponsor
                          </span>
                        </Tooltip>
                      )}
                      {isReviewee && (
                        <Tooltip content="You are being reviewed">
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-400 cursor-help">
                            Subject
                          </span>
                        </Tooltip>
                      )}
                      {isReviewer && (
                        <Tooltip content="You were invited to provide feedback">
                          <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400 cursor-help">
                            Reviewer
                          </span>
                        </Tooltip>
                      )}
                    </div>

                  <div className="flex items-center space-x-4 text-sm">
                    {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                    {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || isSponsor) && (
                      <div className="flex items-center">
                        <span className="text-gray-500 dark:text-gray-400">Reviewers:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                          {survey.completed_count ?? 0}/{survey.reviewers_count ?? 0}
                        </span>
                        <span className="ml-1 text-gray-500 dark:text-gray-400">completed</span>
                      </div>
                    )}
                    {survey.due_date && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-500 dark:text-gray-400">Due: {new Date(survey.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Complete Review Button for Reviewers OR Opt-In/Opt-Out Buttons for SLT/Admin */}
                  {(() => {
                    const isSLT = currentUser?.app_role === 'slt';
                    const isAdmin = currentUser?.app_role === 'admin';
                    const canOptInOut = isSLT || isAdmin;
                    const myReviewerRecord = survey.reviewers?.find((r: any) =>
                      r.reviewer_email === currentUser?.email
                    );
                    const isCompleted = myReviewerRecord?.status === 'completed';
                    // SLT/Admin can only opt out if they opted in themselves (not assigned by sponsor)
                    const hasOptedIn = canOptInOut && isReviewer && (myReviewerRecord?.relationship === 'slt' || myReviewerRecord?.relationship === 'admin') && myReviewerRecord?.assigned_by_sponsor === false;

                    // If user is a reviewer and not completed, show complete button
                    if (isReviewer && !isCompleted && myReviewerRecord?.access_token) {
                      return (
                        <div className="flex items-center gap-2 mt-4">
                          <Tooltip content={`Complete your feedback survey for ${survey.employee?.name}`}>
                            <a
                              href={`/survey/complete/${myReviewerRecord.access_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-md hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg"
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Provide Feedback
                            </a>
                          </Tooltip>

                          {/* Show Opt Out button if SLT/Admin member opted in themselves */}
                          {hasOptedIn && (
                            <Tooltip content="Remove yourself as a reviewer">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleSLTOptOut(survey.id);
                                }}
                                className="inline-flex items-center px-4 py-2 bg-red-800 dark:bg-red-900 text-white rounded-md hover:bg-red-900 dark:hover:bg-red-950 transition-all font-medium shadow-md hover:shadow-lg"
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Opt Out
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      );
                    }

                    // If user is SLT/Admin but not a reviewer, show opt-in button (only for in_progress surveys)
                    if (canOptInOut && !isReviewer && survey.status === 'in_progress') {
                      const roleText = isAdmin ? 'Admin' : 'SLT member';
                      return (
                        <Tooltip content={`You were not selected as a reviewer of ${survey.employee?.name}, but any ${roleText} can opt in`}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleSLTOptIn(survey.id);
                            }}
                            className="inline-flex items-center px-4 py-2 bg-lime-500 dark:bg-lime-600 text-white rounded-md hover:bg-lime-600 dark:hover:bg-lime-700 transition-all font-medium shadow-md hover:shadow-lg mt-4"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Opt In?
                          </button>
                        </Tooltip>
                      );
                    }

                    return null;
                  })()}
                  {survey.status === 'active' && (survey.reviewers_count ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Response Rate: {Math.round(((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100)}% (70% required)
                        </span>
                        {(() => {
                          const completedCount = survey.completed_count ?? 0;
                          const reviewersCount = survey.reviewers_count ?? 1;
                          const responseRate = reviewersCount > 0 ? completedCount / reviewersCount : 0;
                          const daysUntilDue = survey.due_date ? Math.ceil((new Date(survey.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
                          const isAtRisk = responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;

                          return isAtRisk && (
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              At Risk
                            </span>
                          );
                        })()}
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            ((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) < 0.7 ? 'bg-orange-500 dark:bg-orange-600' : 'bg-green-600 dark:bg-green-500'
                          }`}
                          style={{ width: `${((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100}%` }}
                        />
                        {/* Show 70% requirement marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 opacity-50"
                          style={{ left: '70%' }}
                          title="70% completion required"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Status badge and actions */}
                <div className="ml-4 flex flex-col items-end gap-2">
                  {/* Status badge - Show on Sponsor and All 360°s tabs */}
                  {(filterRole === 'sponsor' || filterRole === 'all') && getStatusBadge(survey.status || 'unknown', survey.flagged_for_admin ?? undefined, survey.flagged_for_reanalysis ?? undefined, survey.resolved_by_admin ?? undefined, survey.id)}
                </div>

                {/* Delete button - bottom right of card */}
                {/* Admin sponsors can delete any survey; SLT sponsors can only delete draft/in_progress */}
                {((currentUser?.app_role === 'admin' && isSponsor) || 
                  (currentUser?.app_role === 'slt' && isSponsor && (survey.status === 'draft' || survey.status === 'in_progress'))) && (
                  <Tooltip content="Permanently delete this survey for everyone involved" side="bottom">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInProgressSurvey(survey.id);
                      }}
                      className="absolute bottom-6 right-6 mt-4 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors text-sm font-medium"
                    >
                      Delete
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Review Creation Wizard */}
      <Survey360Wizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setPreselectedEmployee(undefined);
          setEditingDraftSurvey(null);
        }}
        organizationId={organizationId}
        preselectedEmployee={preselectedEmployee}
        onSurveyCreated={() => {
          loadSurveys();
          setIsWizardOpen(false);
          setPreselectedEmployee(undefined);
          setEditingDraftSurvey(null);
        }}
        employees={employees}
        currentUser={currentUser}
        draftSurvey={editingDraftSurvey}
      />

      {/* Review Details Modal */}
      {isDetailsModalOpen && selectedSurvey && (() => {
        const isSponsor = isUserSponsor(selectedSurvey, currentUser, currentUserDbId);
        const isAdmin = currentUser?.app_role === 'admin';
        const isSLT = currentUser?.app_role === 'slt';
        const isLeader = currentUser?.app_role === 'leader';
        const isSubject = selectedSurvey.employee_id === currentUser?.id;
        const isReviewer = selectedSurvey.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
        const userCompletedReview = isReviewer && selectedSurvey.reviewers?.find((r: any) => r.reviewer_email === currentUser?.email)?.status === 'completed';

        // Only sponsors and admins can manage surveys
        // Leaders can only manage if they are the sponsor
        // IMPORTANT: Admins should ALWAYS see the full management view, regardless of
        // whether they're the sponsor or a reviewer
        const canManage = isSponsor || isAdmin;

        // Leaders who are reviewers on finalized surveys should see read-only view, not sponsor view
        const isLeaderReviewerOnFinalized = isLeader && isReviewer && !isSponsor && selectedSurvey.status === 'finalized';

        // Leaders who are reviewers (not sponsors) should always see read-only view
        const isLeaderReviewer = isLeader && isReviewer && !isSponsor;

        const willShowReadOnlyModal = !canManage || isLeaderReviewerOnFinalized || isLeaderReviewer;

        if (willShowReadOnlyModal) {
          // Read-only view for reviewers and subject (admins always go to management view above)
          // If finalized, subject can see the complete review results
          const canSeeResults = isSubject && selectedSurvey.status === 'finalized';
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Employee:</span>
                      <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {selectedSurvey.employee?.name || 'Unknown'}
                      </span>
                      {selectedSurvey.employee?.title && (
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">• {selectedSurvey.employee.title}</span>
                      )}
                    </div>
                    <div className="mt-2">
                      {getStatusBadge(selectedSurvey.status || 'unknown', selectedSurvey.flagged_for_admin ?? undefined, selectedSurvey.flagged_for_reanalysis ?? undefined, selectedSurvey.resolved_by_admin ?? undefined, selectedSurvey.id)}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Review Overview - Read Only */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      {selectedSurvey.due_date && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Due Date:</span>
                          <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {new Date(selectedSurvey.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                          {selectedSurvey.created_at ? new Date(selectedSurvey.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                {/* View Results Button - For finalized reviews */}
                {canSeeResults && (
                  <button
                    onClick={() => loadAndShowResults(selectedSurvey)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-md hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Eye className="w-4 h-4" />
                    View Complete Review
                  </button>
                )}

                {/* Reviewers Progress */}
                {!canSeeResults && (
                  <div>
                    {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                    {(isAdmin || currentUser?.app_role === 'slt' || isSponsor) && (() => {
                      const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 0;
                      const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                      return (
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Reviewers ({completedReviewers}/{totalReviewers} completed)
                        </h4>
                      );
                    })()}
                    {/* Only show reviewers list to admin, sponsor, or SLT (for in-progress surveys) */}
                    {(isAdmin || isSponsor || (isSLT && selectedSurvey.status === 'in_progress')) && (
                      <div className="bg-gray-50 dark:bg-gray-900/30 rounded-md p-4 space-y-2 max-h-[240px] overflow-y-auto">
                        {surveyReviewers.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No reviewers added yet</p>
                        ) : (
                          surveyReviewers.map((reviewer) => (
                            <div
                              key={reviewer.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    name={reviewer.reviewer_name ?? undefined}
                                    picture={undefined}
                                    size="sm"
                                  />
                                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{reviewer.reviewer_name}</span>
                                  <span className={`px-2 py-0.5 text-xs rounded ${
                                    reviewer.status === 'completed'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                      : reviewer.status === 'in_progress'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                  }`}>
                                    {reviewer.status === 'completed' ? 'Completed' : reviewer.status === 'in_progress' ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {reviewer.reviewer_email} • {formatRelationship(reviewer.relationship)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Completion Message or Button - Only for reviewers, not for subject */}
                {isReviewer && !isSubject && (
                  userCompletedReview ? (
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md p-4 mt-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-green-900 dark:text-green-200">
                          Your input towards the review is already complete. Thank you!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => window.open(`/survey/complete/${selectedSurvey.reviewers?.find((r: any) => r.reviewer_email === currentUser?.email)?.access_token}`, '_blank')}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-md hover:from-green-700 hover:to-emerald-700 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg mt-4"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Provide Feedback
                    </button>
                  )
                )}
                </div>
              </div>
            </div>
          );
        }

        // Sponsor view - full management interface
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-md max-w-3xl w-full max-h-[90vh] overflow-y-auto relative">
            {/* Loading overlay when generating AI analysis */}
            {generatingSurveyId === selectedSurvey?.id && (
              <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex flex-col items-center justify-center z-50 rounded-md">
                {/* Close button on loading overlay */}
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    // Note: Generation continues in background, polling will stop due to cleanup
                  }}
                  className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 z-50"
                >
                  <X className="w-6 h-6" />
                </button>
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Generating AI Analysis...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md px-4 mb-6">
                  Report generation may take up to 8 minutes depending on number of reviewers
                </p>
                {/* Cancel button */}
                <button
                  onClick={cancelReportGeneration}
                  disabled={isCancellingGeneration}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCancellingGeneration ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            )}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 leading-tight">
                  360° Feedback -
                  <Avatar
                    name={selectedSurvey.employee?.name}
                    picture={selectedSurvey.employee?.picture ?? undefined}
                    size="xs"
                  />
                  {selectedSurvey.employee?.name || 'Unknown'}
                </h2>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Metadata line */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Created: </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {selectedSurvey.created_at ? new Date(selectedSurvey.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {selectedSurvey.due_date && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Due Date: </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(selectedSurvey.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                {getStatusBadge(selectedSurvey.status ?? 'draft', selectedSurvey.flagged_for_admin ?? undefined, selectedSurvey.flagged_for_reanalysis ?? undefined, selectedSurvey.resolved_by_admin ?? undefined, selectedSurvey.id)}
              </div>

              {/* Reviewers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Reviewers ({(() => {
                      const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 0;
                      const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                      return `${completedReviewers}/${totalReviewers}`;
                    })()} completed)
                  </h4>
                  {(isSponsor || isAdmin) && selectedSurvey.status !== 'completed' && selectedSurvey.status !== 'finalized' && (
                  <button
                    onClick={() => setIsAddingReviewer(!isAddingReviewer)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Reviewer
                  </button>
                  )}
                </div>

                {isAddingReviewer && selectedSurvey.status !== 'completed' && selectedSurvey.status !== 'finalized' && (
                  <div className="mb-3 relative">
                    <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md">
                      <select
                        value={newReviewerRelationship}
                        onChange={async (e) => {
                          const newRelationship = e.target.value as ParticipantRelationship | '';
                          setNewReviewerRelationship(newRelationship);

                          // Pattern 2: Filter First - Pre-fetch employees matching this relationship
                          if (selectedSurvey?.employee_id && newRelationship) {
                            await fetchEmployeesWithRelationships(reviewerSearch, newRelationship);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && selectedReviewerEmployee) {
                            e.preventDefault();
                            e.stopPropagation();
                            addReviewer();
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select relationship...</option>
                        <option value="manager">Manager</option>
                        <option value="slt">SLT</option>
                        <option value="direct_report">Direct Report</option>
                        <option value="cross_functional">Cross-Functional</option>
                      </select>

                      {/* Employee Selector */}
                      {!selectedReviewerEmployee ? (
                        <div className="flex-1 relative">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <input
                              type="text"
                              value={reviewerSearch}
                              onChange={async (e) => {
                                const searchValue = e.target.value;
                                setReviewerSearch(searchValue);

                                // Pattern 1: Search First - Fetch with auto-detection
                                if (selectedSurvey?.employee_id && searchValue.length >= 1) {
                                  setShowReviewerPicker(true);
                                  await fetchEmployeesWithRelationships(
                                    searchValue,
                                    newReviewerRelationship || null
                                  );
                                } else if (searchValue.length === 0) {
                                  // Clear API results when search is cleared
                                  setEmployeesWithRelationships([]);
                                  setShowReviewerPicker(false);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && selectedReviewerEmployee) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addReviewer();
                                }
                              }}
                              onFocus={async () => {
                                // Only show picker if there's search input (1+ chars) or relationship already selected
                                const shouldShowPicker = (reviewerSearch && reviewerSearch.length >= 1) || newReviewerRelationship;
                                if (shouldShowPicker) {
                                  setShowReviewerPicker(true);

                                  // If relationship is selected but no employees loaded yet, fetch them
                                  if (newReviewerRelationship && employeesWithRelationships.length === 0) {
                                    await fetchEmployeesWithRelationships(
                                      reviewerSearch,
                                      newReviewerRelationship
                                    );
                                  }
                                }
                              }}
                              placeholder="Search employees..."
                              className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <div
                            ref={selectedReviewerDisplayRef}
                            className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none cursor-pointer"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                addReviewer();
                              }
                            }}
                            onClick={(e) => {
                              // Focus this element when clicked so Enter key works
                              (e.currentTarget as HTMLElement).focus();
                            }}
                          >
                            <Avatar
                              name={(selectedReviewerEmployee as any).full_name || selectedReviewerEmployee.name}
                              picture={selectedReviewerEmployee.picture ?? undefined}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{(selectedReviewerEmployee as any).full_name || selectedReviewerEmployee.name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{selectedReviewerEmployee.email}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {selectedReviewerEmployee ? (
                        <button
                          onClick={addReviewer}
                          className="px-3 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                          title="Add & Send Invitation"
                        >
                          Add
                        </button>
                      ) : null}

                      <button
                        onClick={() => {
                          setIsAddingReviewer(false);
                          setSelectedReviewerEmployee(null);
                          setReviewerSearch('');
                          setShowReviewerPicker(false);
                          setNewReviewerRelationship('');
                          setEmployeesWithRelationships([]);
                        }}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Employee Picker Dropdown */}
                    {showReviewerPicker && (
                      <>
                        {/* Backdrop to close picker */}
                        <div
                          className="fixed inset-0 z-[9]"
                          onClick={() => {
                            setShowReviewerPicker(false);
                            setReviewerSearch('');
                          }}
                        />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-80 overflow-y-auto">
                          <div className="p-2">
                            {isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Loading...</span>
                                </div>
                              </div>
                            ) : filteredReviewerEmployees.length > 0 ? (
                              filteredReviewerEmployees.slice(0, 20).map(emp => {
                                const empWithRel = emp as EmployeeWithRelationship;
                                const isAlreadyAdded = surveyReviewers.some(
                                  reviewer => reviewer.reviewer_email?.toLowerCase() === emp.email?.toLowerCase()
                                );
                                return (
                                  <button
                                    key={emp.id}
                                    onClick={() => {
                                      if (isAlreadyAdded) return; // Don't allow selecting already-added reviewers
                                      setSelectedReviewerEmployee(emp);
                                      // Auto-populate relationship if detected
                                      if (empWithRel.detected_relationship && !newReviewerRelationship) {
                                        setNewReviewerRelationship(empWithRel.detected_relationship);
                                      }
                                      setReviewerSearch('');
                                      setShowReviewerPicker(false);
                                    }}
                                    className={`w-full text-left p-2 rounded-md transition-colors flex items-center gap-2 ${
                                      isAlreadyAdded
                                        ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-700'
                                        : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
                                    }`}
                                    disabled={isAlreadyAdded}
                                  >
                                    <Avatar
                                      name={emp.full_name || emp.name}
                                      picture={emp.picture ?? undefined}
                                      size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{emp.full_name || emp.name}</div>
                                        {isAlreadyAdded && (
                                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            Already Added
                                          </span>
                                        )}
                                        {empWithRel.detected_relationship && !isAlreadyAdded && (
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                            empWithRel.detected_relationship === 'manager' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                            empWithRel.detected_relationship === 'slt' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            empWithRel.detected_relationship === 'direct_report' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                          }`}>
                                            {empWithRel.detected_relationship === 'manager' ? 'Manager' :
                                             empWithRel.detected_relationship === 'slt' ? 'SLT' :
                                             empWithRel.detected_relationship === 'direct_report' ? 'Direct Report' :
                                             'Cross-Functional'}
                                          </span>
                                        )}
                                      </div>
                                      {emp.title && <div className="text-xs text-gray-600 dark:text-gray-400">{emp.title}</div>}
                                    </div>
                                  </button>
                                );
                              })
                            ) : newReviewerRelationship && employeesWithRelationships.length === 0 && !isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md m-2">
                                {selectedSurvey?.employee?.name} has no{' '}
                                {newReviewerRelationship === 'manager' ? 'manager' :
                                 newReviewerRelationship === 'slt' ? 'SLT' :
                                 newReviewerRelationship === 'direct_report' ? 'direct reports' :
                                 'cross-functional colleagues'} in the system
                              </div>
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No employees found</div>
                            )}
                            <button
                              onClick={() => {
                                setShowReviewerPicker(false);
                                setReviewerSearch('');
                              }}
                              className="w-full mt-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            >
                              Enter manually instead
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Only show reviewers list to admin, sponsor, or SLT (for in-progress surveys) */}
                {(isAdmin || isSponsor || (isSLT && selectedSurvey.status === 'in_progress')) ? (
                  <div className="bg-gray-50 dark:bg-gray-900/30 rounded-md p-4 space-y-2 max-h-[240px] overflow-y-auto">
                    {surveyReviewers.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No reviewers added yet</p>
                    ) : (
                      surveyReviewers.map((reviewer) => (
                        <div
                          key={reviewer.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={reviewer.reviewer_name ?? undefined}
                                picture={undefined}
                                size="sm"
                              />
                              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{reviewer.reviewer_name}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                reviewer.status === 'completed'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : reviewer.status === 'in_progress'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              }`}>
                                {reviewer.status === 'completed' ? 'Completed' : reviewer.status === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {reviewer.reviewer_email} • {formatRelationship(reviewer.relationship)}
                            </div>
                          </div>
                          {(isSponsor || isAdmin) && (
                          <div className="flex items-center gap-6">
                            {reviewer.status !== 'completed' && (
                              remindedReviewers.has(reviewer.id) ? (
                                <span className="px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Reminded
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendReminderToReviewer(reviewer.id, reviewer.reviewer_email)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1 font-medium"
                                  title="Send reminder email"
                                >
                                  <Send className="w-3 h-3" />
                                  Remind
                                </button>
                              )
                            )}
                            <button
                              onClick={() => removeReviewer(reviewer.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                              title="Remove reviewer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">Reviewer details are only visible to admins and the review sponsor.</p>
                )}
              </div>

              {/* Actions - Visible to sponsor and admins */}
              {(isSponsor || isAdmin) && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  {/* Send Backward - Always on left, always grey */}
                  {(selectedSurvey.status === 'in_progress' || selectedSurvey.status === 'completed' || selectedSurvey.status === 'finalized') && (() => {
                    const targetStatus = selectedSurvey.status === 'finalized' ? 'Completed' :
                                        selectedSurvey.status === 'completed' ? 'In Progress' : 'Draft';
                    return (
                      <Tooltip content={`Move 360° to ${targetStatus} status`}>
                        <button
                          onClick={() => sendBackward(selectedSurvey.id, selectedSurvey.status ?? undefined)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors font-medium flex items-center"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Send Backward
                        </button>
                      </Tooltip>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  {/* Complete with AI for in_progress - disabled if below 70% completion threshold */}
                  {selectedSurvey.status === 'in_progress' && (() => {
                    const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 1;
                    const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                    const completionPercent = completedReviewers / totalReviewers;
                    const isAdmin = currentUser?.app_role === 'admin';
                    const meetsThreshold = completionPercent >= 0.7;
                    const canComplete = isAdmin || meetsThreshold;

                    return (
                      <button
                        onClick={() => {
                          if (!canComplete) {
                            notify({
                              title: '>70% Reviewer completion required to complete 360°',
                              variant: 'error',
                            });
                            return;
                          }
                          completeSurveyWithAI();
                        }}
                        disabled={generatingSurveyId === selectedSurvey?.id || !canComplete}
                        className={`px-4 py-2 bg-gradient-to-r rounded-md font-medium flex items-center ${
                          canComplete
                            ? 'from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800'
                            : 'from-gray-400 to-gray-500 text-gray-200 cursor-not-allowed'
                        } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                        title={!canComplete ? 'At least 70% of reviewers must submit their feedback before completing the review.' : ''}
                      >
                        {generatingSurveyId === selectedSurvey?.id ? (
                          <>
                            <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                            Generating Analysis...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Complete Review with AI Analysis
                          </>
                        )}
                      </button>
                    );
                  })()}
                  {/* View Completed Review for completed or finalized status */}
                  {/* Only sponsors and admins can view results - leaders who are reviewers should not see this */}
                  {(selectedSurvey.status === 'completed' || selectedSurvey.status === 'finalized') && (isSponsor || isAdmin) && (
                    <button
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        loadAndShowResults(selectedSurvey);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700 transition-colors font-medium flex items-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      View Review Results
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Review Results Modal */}
      {isResultsModalOpen && surveyResults && selectedSurvey && (() => {
        // Check permissions for advanced insights tabs
        const isSubject = currentUser?.id === selectedSurvey?.employee_id;
        const isSponsor = isUserSponsor(selectedSurvey, currentUser, currentUserDbId);
        const isAdmin = currentUser?.app_role === 'admin';
        const isSLT = currentUser?.app_role === 'slt';
        const canSeeAdvanced = !isSubject || isAdmin || isSponsor;

        const hasConsensusData = (
          surveyResults.consensus_areas?.length > 0 ||
          surveyResults.varied_by_relationship?.length > 0 ||
          surveyResults.outliers?.length > 0 ||
          surveyResults.outlier_opinions?.length > 0  // backward compatibility
        );

        // Define tabs
        const reportTabs = [
          { id: 'narrative', label: 'Narrative' },
          { id: 'themes', label: 'Themes' },
          { id: 'strengths', label: 'Strengths' },
          { id: 'development', label: 'Development Areas' },
          { id: 'recommendations', label: 'Recommended Actions' },
          ...(canSeeAdvanced && hasConsensusData ? [{ id: 'consensus', label: 'Consensus & Outliers' }] : [])
        ];

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-md max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden relative">
              {/* Loading overlay when generating/reanalyzing AI analysis */}
              {generatingSurveyId === selectedSurvey?.id && (
                <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex flex-col items-center justify-center z-50 rounded-md">
                  {/* Close button on loading overlay */}
                  <button
                    onClick={() => {
                      setIsResultsModalOpen(false);
                      // Note: Generation continues in background, polling will stop due to cleanup
                    }}
                    className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 z-50"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Regenerating AI Analysis...
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md px-4 mb-6">
                    Report generation may take up to 8 minutes depending on number of reviewers
                  </p>
                  {/* Cancel button */}
                  <button
                    onClick={cancelReportGeneration}
                    disabled={isCancellingGeneration}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCancellingGeneration ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              )}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedSurvey.survey_name}</h2>
                      {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                      {(isAdmin || isSLT || isSponsor) && (() => {
                        const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 0;
                        const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                        return (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Reviewers: <span className="font-medium">{completedReviewers} of {totalReviewers} completed</span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Generated by {surveyResults.generated_by || 'Claude AI'} on {new Date(surveyResults.generated_at || Date.now()).toLocaleDateString()}
                    </p>
                    {/* API Version Notice (local testing only) */}
                    {analyzerApiNotice && isLocalTesting && (
                      <div className={`mt-2 px-3 py-1.5 rounded-md flex gap-2 items-center text-xs w-fit ${
                        analyzerApiNotice.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-amber-50 border border-amber-200 text-amber-700'
                      }`}>
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-mono">{analyzerApiNotice.message}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                  {/* Audit Mode Toggle - Admin only (sponsors see normal report view) */}
                  {/* Citations are now always generated with reports - no validation needed */}
                  <AuditModeToggle
                    enabled={auditModeEnabled}
                    onToggle={setAuditModeEnabled}
                    isAdmin={currentUser?.app_role === 'admin'}
                  />
                  {/* Export Button - Conditional: Dropdown for sponsors/admins, simple button for others */}
                  {(() => {
                    const isSubject = currentUser?.id === selectedSurvey?.employee_id;
                    const isSponsor = isUserSponsor(selectedSurvey, currentUser, currentUserDbId);
                    const isAdmin = currentUser?.app_role === 'admin';
                    const canSeeDropdown = (isSponsor || isAdmin) && !isSubject;
                    const employeeName = selectedSurvey.employee?.full_name ||
                                         selectedSurvey.employee?.name ||
                                         selectedSurvey.employee_name ||
                                         'Employee';

                    if (canSeeDropdown) {
                      return (
                        <div className="relative">
                          <button
                            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                            className="text-blue-600 hover:text-blue-800 transition-colors font-medium flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" />
                            Export PDF
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isExportDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsExportDropdownOpen(false)}
                              />

                              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={handleFullExport}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                                >
                                  <Download className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-gray-900 mb-0.5">
                                      Full Export (SPONSOR/ADMIN ONLY!)
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Includes all sensitive relationship data
                                    </div>
                                  </div>
                                </button>

                                <div className="border-t border-gray-100 my-1" />

                                <button
                                  onClick={handleSubjectExport}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                                >
                                  <Download className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-gray-900 mb-0.5">
                                      Export for {employeeName}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Filtered version (same as subject sees)
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <button
                          onClick={handleSimpleExport}
                          className="text-blue-600 hover:text-blue-800 transition-colors font-medium flex items-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export PDF
                        </button>
                      );
                    }
                  })()}
                  {/* Delete button: Admin sponsors can delete any status; SLT sponsors can only delete draft/in_progress */}
                  {((currentUser?.app_role === 'admin' && (isUserSponsor(selectedSurvey, currentUser, currentUserDbId))) || 
                    (currentUser?.app_role === 'slt' && (isUserSponsor(selectedSurvey, currentUser, currentUserDbId)) && (selectedSurvey.status === 'draft' || selectedSurvey.status === 'in_progress'))) && (
                    <button
                      onClick={() => {
                        deleteInProgressSurvey(selectedSurvey.id);
                        setIsResultsModalOpen(false);
                      }}
                      className="text-red-600 hover:text-red-700 transition-colors"
                      title="Delete this review"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsResultsModalOpen(false);
                      setActiveReportTab('narrative'); // Reset to first tab when closing
                      setIsExportDropdownOpen(false); // Reset dropdown state
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Tabs Navigation */}
              <NavigationTabs
                tabs={reportTabs}
                activeTab={activeReportTab}
                onTabChange={setActiveReportTab}
                variant="underline"
                className="px-6"
              />
            </div>

            <div
              className="h-[500px] overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-900"
              onClick={() => {
                // Deselect all items when clicking blank space
                setSelectedThemeIndex(null);
                setSelectedStrengthIndex(null);
                setSelectedDevelopmentIndex(null);
                setSelectedInsightIndex(null);
              }}
            >
              {/* Key Themes Tab */}
              {activeReportTab === 'themes' && surveyResults.themes && surveyResults.themes.length > 0 && (
                <div className="space-y-3">
                  {surveyResults.themes.map((theme: any, idx: number) => (
                    <div
                      key={idx}
                      className="border rounded-md p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100">{theme.theme}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          theme.sentiment === 'very_positive' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                          theme.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                          theme.sentiment === 'mixed' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                          theme.sentiment === 'needs_work' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
                          theme.sentiment === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {theme.sentiment === 'very_positive' ? 'Very Positive' :
                           theme.sentiment === 'positive' ? 'Positive' :
                           theme.sentiment === 'mixed' ? 'Mixed' :
                           theme.sentiment === 'needs_work' ? 'Needs Work' :
                           theme.sentiment === 'critical' ? 'Critical' :
                           theme.sentiment}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Mentioned by {theme.frequency} reviewer{theme.frequency !== 1 ? 's' : ''}
                        {theme.relationships_mentioned && theme.relationships_mentioned.length > 0 && (
                          <span> ({theme.relationships_mentioned.join(', ')})</span>
                        )}
                      </p>
                      {theme.supporting_evidence && theme.supporting_evidence.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {theme.supporting_evidence.map((evidence: string | { text: string; citations?: any[] }, qIdx: number) => (
                            <p key={qIdx} className="text-sm text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-gray-300 dark:border-gray-600">
                              {getStatementText(evidence)}
                              <InlineCitation
                                citations={getCitations(evidence)}
                                reportId={selectedSurvey.id}
                                sectionType="themes"
                                sectionIndex={idx}
                                statementIndex={qIdx}
                                auditModeEnabled={effectiveAuditMode}
                              />
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Strengths Tab */}
              {activeReportTab === 'strengths' && surveyResults.overall_strengths && surveyResults.overall_strengths.length > 0 && (
                <ul className="space-y-1">
                  {surveyResults.overall_strengths.map((strength: string | { text: string; citations?: any[] }, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 rounded-md p-2 border border-transparent">
                      <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {getStatementText(strength)}
                        <InlineCitation
                          citations={getCitations(strength)}
                          reportId={selectedSurvey.id}
                          sectionType="strengths"
                          sectionIndex={idx}
                          auditModeEnabled={effectiveAuditMode}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Development Areas Tab */}
              {activeReportTab === 'development' && surveyResults.development_areas && surveyResults.development_areas.length > 0 && (
                <ul className="space-y-1">
                  {surveyResults.development_areas.map((area: string | { text: string; citations?: any[] }, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 rounded-md p-2 border border-transparent">
                      <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {getStatementText(area)}
                        <InlineCitation
                          citations={getCitations(area)}
                          reportId={selectedSurvey.id}
                          sectionType="development_areas"
                          sectionIndex={idx}
                          auditModeEnabled={effectiveAuditMode}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Recommendations Tab */}
              {activeReportTab === 'recommendations' && (() => {
                const isSponsor = isUserSponsor(selectedSurvey, currentUser, currentUserDbId);
                const isAdmin = currentUser?.app_role === 'admin';
                const canEdit = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Recommended Actions
                        {canEdit && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold ml-2">(Click to edit)</span>
                        )}
                      </h4>
                    </div>
                    <ul className="space-y-3">
                      {surveyResults.recommendations && surveyResults.recommendations.length > 0 && surveyResults.recommendations.map((rec: string | { text: string; citations?: any[] }, idx: number) => {
                        const recText = getStatementText(rec);
                        return (
                        <li key={idx} className="flex items-start gap-3 group">
                          <span className="text-gray-400 dark:text-gray-500 font-medium text-sm flex-shrink-0 mt-0.5">{idx + 1}.</span>
                          {editingRecommendationIndex === idx ? (
                            <input
                              type="text"
                              value={editingRecommendationText}
                              onChange={(e) => setEditingRecommendationText(e.target.value)}
                              onBlur={() => saveRecommendation(idx)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveRecommendation(idx);
                                } else if (e.key === 'Escape') {
                                  cancelEditingRecommendation();
                                }
                              }}
                              className="flex-1 px-2 py-1 border-b-2 border-blue-500 text-gray-700 dark:text-gray-300 text-sm focus:outline-none bg-transparent"
                              autoFocus
                            />
                          ) : (
                            <div className="flex-1 flex items-start justify-between group">
                              <span
                                onClick={() => canEdit && startEditingRecommendation(idx, recText)}
                                className={`text-gray-700 dark:text-gray-300 text-sm flex-1 ${
                                  canEdit ? 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-100' : ''
                                }`}
                              >
                                {recText}
                                <InlineCitation
                                  citations={getCitations(rec)}
                                  reportId={selectedSurvey.id}
                                  sectionType="recommendations"
                                  sectionIndex={idx}
                                  auditModeEnabled={effectiveAuditMode}
                                />
                              </span>
                              {canEdit && (
                                <button
                                  onClick={() => deleteRecommendation(idx)}
                                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs ml-3 transition-opacity"
                                  title="Delete"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                      })}

                      {/* Add new item inline */}
                      {canEdit && (
                        <li className="flex items-start gap-3 group">
                          <span className="text-gray-400 font-medium text-sm flex-shrink-0 mt-0.5">
                            {(surveyResults.recommendations?.length || 0) + 1}.
                          </span>
                          {editingRecommendationIndex === -1 ? (
                            <input
                              type="text"
                              value={editingRecommendationText}
                              onChange={(e) => setEditingRecommendationText(e.target.value)}
                              onBlur={() => {
                                if (editingRecommendationText.trim()) {
                                  saveRecommendation(-1);
                                } else {
                                  cancelEditingRecommendation();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editingRecommendationText.trim()) {
                                  saveRecommendation(-1);
                                } else if (e.key === 'Escape') {
                                  cancelEditingRecommendation();
                                }
                              }}
                              className="flex-1 px-2 py-1 border-b-2 border-blue-500 text-gray-700 dark:text-gray-300 text-sm focus:outline-none bg-transparent"
                              placeholder="Type to add new action..."
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEditingRecommendation(-1, '')}
                              className="flex-1 text-gray-400 dark:text-gray-500 text-sm cursor-pointer hover:text-gray-600 dark:hover:text-gray-400 italic"
                            >
                              Add new action...
                            </span>
                          )}
                        </li>
                      )}

                      {!canEdit && (!surveyResults.recommendations || surveyResults.recommendations.length === 0) && (
                        <li className="text-gray-500 dark:text-gray-400 text-sm italic">No recommendations available.</li>
                      )}
                    </ul>

                  </div>
                );
              })()}

              {/* Consensus & Outliers Tab - Sponsor/Admin Only */}
              {activeReportTab === 'consensus' && (() => {
                // Check if we have any data to show (new or old format)
                const hasConsensus = surveyResults.consensus_areas?.length > 0;
                const hasVaried = surveyResults.varied_by_relationship?.length > 0;
                const hasOutliers = surveyResults.outliers?.length > 0;
                const hasOldOutliers = surveyResults.outlier_opinions?.length > 0;
                const hasAnyData = hasConsensus || hasVaried || hasOutliers || hasOldOutliers;

                if (!hasAnyData) return null;

                // Get subject's first name for personalized labels
                const employeeFullName = selectedSurvey.employee?.name || selectedSurvey.employee?.full_name || selectedSurvey.employee_name || '';
                const subjectFirstName = employeeFullName?.split(' ')[0] || 'Subject';

                return (
                  <>
                    {/* Privacy Notice Banner */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4 mb-6">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            Sponsor/Admin Only Section
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                            This group-level analysis is <strong>not visible to {subjectFirstName}</strong>.
                            Only survey sponsors and administrators can see how different reviewer groups perceive the subject.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Section 1: Strong Consensus */}
                      {hasConsensus && (
                        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-5 border border-green-200 dark:border-green-700">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Strong Consensus
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Areas where multiple reviewer groups agree
                          </p>
                          <ul className="space-y-3">
                            {surveyResults.consensus_areas.map((area: any, idx: number) => (
                              <li key={idx} className="text-gray-700 dark:text-gray-300">
                                <div className="flex items-start gap-2">
                                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                                  <div className="flex-1">
                                    <span className="text-sm">{getStatementText(area)}</span>
                                    <InlineCitation
                                      citations={getCitations(area)}
                                      reportId={selectedSurvey.id}
                                      sectionType="consensus_areas"
                                      sectionIndex={idx}
                                      auditModeEnabled={effectiveAuditMode}
                                    />
                                    {/* Show agreeing groups as badges */}
                                    {area.groups_agreeing && area.groups_agreeing.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {area.groups_agreeing.map((group: string, gIdx: number) => (
                                          <span
                                            key={gIdx}
                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-200"
                                          >
                                            {getShortGroupLabel(group)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Section 2: Varied by Relationship */}
                      {hasVaried && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-5 border border-indigo-200 dark:border-indigo-700">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <span className="text-indigo-600 dark:text-indigo-400">⟷</span>
                            Varied by Relationship
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Topics where different groups perceive {subjectFirstName} differently
                          </p>
                          <div className="space-y-4">
                            {surveyResults.varied_by_relationship.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-gray-800/50 rounded-md p-4 border border-indigo-100 dark:border-indigo-800"
                              >
                                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3 text-sm uppercase tracking-wide">
                                  {item.topic}
                                </h5>
                                <div className="space-y-2">
                                  {item.perspectives?.map((perspective: any, pIdx: number) => (
                                    <div
                                      key={pIdx}
                                      className="flex items-start gap-3 text-sm"
                                    >
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-800/50 text-indigo-800 dark:text-indigo-200 whitespace-nowrap min-w-[100px]">
                                        {getShortGroupLabel(perspective.group)}
                                      </span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">
                                        {perspective.view}
                                        <InlineCitation
                                          citations={perspective.citations || []}
                                          reportId={selectedSurvey.id}
                                          sectionType="varied_by_relationship"
                                          sectionIndex={idx}
                                          statementIndex={pIdx}
                                          auditModeEnabled={effectiveAuditMode}
                                        />
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Outliers (Individual Perspectives) */}
                      {(hasOutliers || hasOldOutliers) && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-5 border border-amber-200 dark:border-amber-700">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <span className="text-amber-600 dark:text-amber-400">💡</span>
                            Outliers
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Unique perspectives mentioned by only one reviewer
                          </p>
                          <ul className="space-y-2">
                            {/* New format outliers */}
                            {surveyResults.outliers?.map((outlier: any, idx: number) => (
                              <li key={`new-${idx}`} className="text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                                <span className="text-sm">
                                  {getStatementText(outlier)}
                                  <InlineCitation
                                    citations={getCitations(outlier)}
                                    reportId={selectedSurvey.id}
                                    sectionType="outliers"
                                    sectionIndex={idx}
                                    auditModeEnabled={effectiveAuditMode}
                                  />
                                </span>
                              </li>
                            ))}
                            {/* Old format outlier_opinions (backward compatibility) */}
                            {!hasOutliers && surveyResults.outlier_opinions?.map((opinion: any, idx: number) => (
                              <li key={`old-${idx}`} className="text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                                <span className="text-sm">
                                  {getStatementText(opinion)}
                                  <InlineCitation
                                    citations={getCitations(opinion)}
                                    reportId={selectedSurvey.id}
                                    sectionType="outlier_opinions"
                                    sectionIndex={idx}
                                    auditModeEnabled={effectiveAuditMode}
                                  />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Empty state when no divergence detected */}
                      {!hasVaried && hasConsensus && (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          <p>All reviewer groups expressed similar views on all topics.</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Narrative Tab - Final tab for generating one-page summary */}
              {activeReportTab === 'narrative' && (
                <div className="space-y-6">
                  {/* Warning if narrative is outdated */}
                  {narrativeOutdated && finalNarrative && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Narrative Outdated</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            You have made changes to the report since the narrative was last generated.
                            Please regenerate the narrative to reflect your latest edits.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Narrative content or empty state */}
                  {finalNarrative ? (
                    <>
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700 rounded-md p-8">
                        <div className="mb-6">
                          <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Final Narrative</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            This will be the first page of the final 360 report that{' '}
                            {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'} sees.
                          </p>
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {finalNarrative.replace(/^\*\*360-Degree Feedback Report:.*?\*\*\s*/i, '').trim()}
                          </p>
                        </div>
                      </div>

                      {/* Regenerate button */}
                      {(isSponsor || isAdmin) && selectedSurvey.status === 'completed' && (
                        <div className="flex justify-center">
                          <button
                            id="regenerate-narrative-btn"
                            onClick={generateNarrative}
                            disabled={isGeneratingNarrative}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGeneratingNarrative ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Regenerate Narrative
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Empty state - no narrative generated yet */
                    <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md p-12 text-center">
                      <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Narrative Generated Yet</h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                        Generate a comprehensive narrative that synthesizes all the feedback and insights from this 360 feedback.
                        This will be the first page of the final report that{' '}
                        {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'} sees.
                      </p>

                      {(isSponsor || isAdmin) && selectedSurvey.status === 'completed' && (
                        <button
                          onClick={generateNarrative}
                          disabled={isGeneratingNarrative}
                          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium flex items-center mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingNarrative ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                              Generating Narrative...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-3" />
                              Generate Narrative
                            </>
                          )}
                        </button>
                      )}

                      {(!isSponsor && !isAdmin) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                          Only the survey sponsor or an admin can generate the narrative.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Footer - Anchored at bottom */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              {/* Admin viewing flagged survey - special controls */}
              {currentUser?.app_role === 'admin' && (selectedSurvey.flagged_for_admin || selectedSurvey.flagged_for_reanalysis) ? (
                <div className="space-y-4">
                  {/* Top row: Reanalyze tools */}
                  <div className="flex items-center justify-start">
                    <div className="flex items-center gap-2">
                      {!selectedSurvey.flagged_for_reanalysis && (
                        <>
                          <button
                            onClick={() => reanalyzeSurvey(selectedSurvey.id, 'standard')}
                            disabled={generatingSurveyId === selectedSurvey?.id}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium flex items-center disabled:opacity-50"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            {generatingSurveyId === selectedSurvey?.id ? 'Analyzing...' : 'Reanalyze'}
                          </button>
                          <button
                            onClick={() => reanalyzeSurvey(selectedSurvey.id, 'softer')}
                            disabled={generatingSurveyId === selectedSurvey?.id}
                            className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors font-medium flex items-center disabled:opacity-50"
                          >
                            Reanalyze (Softer Tone)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Bottom row: View Raw Data and Resolve Review */}
                  <div className="flex items-center justify-end pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => loadRawSurveyData(selectedSurvey.id)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium flex items-center"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        View Raw Data
                      </button>
                      <button
                        onClick={() => resolveNeedsReview(selectedSurvey.id)}
                        className="px-4 py-2 bg-green-100 text-green-700 border border-green-300 rounded-md hover:bg-green-200 transition-colors font-medium flex items-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Resolve Review
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Normal footer for non-admin or non-flagged surveys */
                <div className="flex items-center justify-between">
                  {/* Send Backward - Only visible to sponsor or admin */}
                  {(currentUser?.app_role === 'admin' || isUserSponsor(selectedSurvey, currentUser, currentUserDbId)) && (() => {
                    const targetStatus = selectedSurvey.status === 'finalized' ? 'Completed' :
                                        selectedSurvey.status === 'completed' ? 'In Progress' : 'Draft';
                    return (
                      <Tooltip content={`Move 360° to ${targetStatus} status`}>
                        <button
                          onClick={() => sendBackward(selectedSurvey.id)}
                          className="text-gray-600 hover:text-gray-800 transition-colors font-medium flex items-center"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Send Backward
                        </button>
                      </Tooltip>
                    );
                  })()}

                  <div className={`flex items-center gap-6 ${!(currentUser?.app_role === 'admin' || isUserSponsor(selectedSurvey, currentUser, currentUserDbId)) ? 'ml-auto' : ''}`}>
                    {/* Workflow controls - Only visible to sponsor or admin */}
                    {(currentUser?.app_role === 'admin' || isUserSponsor(selectedSurvey, currentUser, currentUserDbId)) && (
                      <>
                        {selectedSurvey.status === 'completed' && (
                          <button
                            onClick={() => sendToHRForReanalysis(selectedSurvey.id)}
                            disabled={!!selectedSurvey.flagged_for_reanalysis}
                            className={`font-medium transition-colors ${
                              selectedSurvey.flagged_for_reanalysis
                                ? 'text-green-600 cursor-not-allowed opacity-75'
                                : 'text-red-600 hover:text-red-800'
                            }`}
                          >
                            {selectedSurvey.flagged_for_reanalysis ? 'Sent to HR' : 'Send to HR for Reanalysis'}
                          </button>
                        )}
                        {selectedSurvey.status !== 'finalized' && (
                          <button
                            onClick={() => finalizeSurvey(selectedSurvey.id)}
                            disabled={!!selectedSurvey.flagged_for_reanalysis}
                            className={`px-6 py-3 bg-blue-600 text-white rounded-md font-medium flex items-center ${
                              selectedSurvey.flagged_for_reanalysis
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-blue-700 transition-colors'
                            }`}
                          >
                            <ArrowDownCircle className="w-4 h-4 mr-2" />
                            Finalize
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Raw Data Modal */}
      {showRawData && rawSurveyData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-md max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Raw Survey Data</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {rawSurveyData.employee?.full_name} • {rawSurveyData.responses?.length || 0} responses
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRawData(false);
                    setRawSurveyData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Survey Info */}
              <div className="bg-gray-50 rounded-md p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Survey Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Survey Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{rawSurveyData.survey_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2 font-medium text-gray-900">{rawSurveyData.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Date(rawSurveyData.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Reviewers:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {rawSurveyData.reviewers?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reviewers */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Reviewers</h3>
                <div className="space-y-2">
                  {rawSurveyData.reviewers?.map((reviewer: any) => (
                    <div key={reviewer.id} className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{reviewer.reviewer_name}</p>
                          <p className="text-sm text-gray-600">{reviewer.reviewer_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            {formatRelationship(reviewer.relationship)}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            reviewer.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {reviewer.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Responses - Grouped by Reviewer */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Responses by Reviewer</h3>
                <div className="space-y-6">
                  {(() => {
                    // Group responses by reviewer email
                    const groupedByReviewer: Record<string, any[]> = {};
                    (rawSurveyData.responses || []).forEach((response: any) => {
                      const email = response.reviewer_email;
                      if (!groupedByReviewer[email]) {
                        groupedByReviewer[email] = [];
                      }
                      groupedByReviewer[email].push(response);
                    });

                    return Object.entries(groupedByReviewer).map(([email, reviewerResponses]: [string, any[]]) => {
                      const reviewer = reviewerResponses[0]?.reviewer;
                      return (
                        <div key={email} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                          {/* Reviewer Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{reviewer?.reviewer_name || email}</p>
                                <p className="text-sm text-gray-600">{email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                  {reviewer?.relationship ? formatRelationship(reviewer.relationship) : 'Unknown'}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  reviewer?.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {reviewer?.status || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Reviewer's Responses */}
                          <div className="p-4 space-y-4">
                            {reviewerResponses.map((response: any, idx: number) => (
                              <div key={response.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                <p className="text-xs font-semibold text-gray-500 mb-1">Question {idx + 1}</p>
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  {response.question?.question_text || 'Question not found'}
                                </p>
                                {response.rating !== null && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    <span className="font-medium">Rating:</span> {response.rating}/5
                                  </p>
                                )}
                                {response.response_text && (
                                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                                    {response.response_text}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <button
                onClick={() => {
                  setShowRawData(false);
                  setRawSurveyData(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Reviewers Warning Dialog */}
      {showIncompleteWarning && selectedSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-md max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Minimum Completion Not Met</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {(() => {
                      const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 0;
                      const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                      const completionPercent = totalReviewers > 0 ? Math.round((completedReviewers / totalReviewers) * 100) : 0;
                      return `${completedReviewers}/${totalReviewers} reviewers completed (${completionPercent}%)`;
                    })()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-md p-4 border border-amber-200">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-2">70% completion required</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  A minimum of 70% of reviewers must complete their feedback before the review can be closed. You currently have {(() => {
                    const totalReviewers = selectedSurvey.reviewers?.length || selectedSurvey.reviewers_count || 1;
                    const completedReviewers = selectedSurvey.reviewers?.filter((r: any) => r.status === 'completed').length || selectedSurvey.completed_count || 0;
                    return Math.round((completedReviewers / totalReviewers) * 100);
                  })()} % completion.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={() => setShowIncompleteWarning(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => completeSurveyWithAI(true)}
                disabled={generatingSurveyId === selectedSurvey?.id}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {generatingSurveyId === selectedSurvey?.id ? 'Generating...' : 'Proceed & Generate Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create with AI Modal */}
      <CreateWithAIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onComplete={handleAIModalComplete}
        employees={employees}
      />

      {/* Survey 360 Wizard Modal */}
      <Survey360Wizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setEditingDraftSurvey(null);
          setPreselectedEmployee(undefined);
          setAiParsedData(null);
        }}
        organizationId={organizationId}
        employees={employees}
        preselectedEmployee={preselectedEmployee}
        currentUser={currentUser}
        draftSurvey={editingDraftSurvey}
        aiParsedData={aiParsedData ?? undefined}
        onSurveyCreated={() => {
          setIsWizardOpen(false);
          setEditingDraftSurvey(null);
          setPreselectedEmployee(undefined);
          setAiParsedData(null);
          loadSurveys();
        }}
      />
    </div>
    </TooltipProvider>
  );
}
