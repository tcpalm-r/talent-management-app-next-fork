import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Send, CheckCircle, Clock, Users, X, AlertTriangle, Sparkles, ChevronLeft, ArrowDownCircle, Download, Eye, Trash2, FileText, TrendingUp, Target, Lightbulb, BarChart3, GitCompare, UserPlus, UserMinus, Check, User } from 'lucide-react';
import type { Employee, Department, ParticipantRelationship } from '../types';
import Survey360Wizard from './Survey360Wizard';
import CreateWithAIModal, { type ParsedSurveyData } from './CreateWithAIModal';
import Avatar from './Avatar';
import { useToast, Tooltip, TooltipProvider } from './unified';
import NavigationTabs from './unified/NavigationTabs';
import { exportReportAsPDF } from '../lib/exportReport';
import { fetchWithFallback, fetchWithValidation } from '@/lib/api-client';
import {
  SurveyListResponseSchema,
  Report360ResponseSchema,
  SendRemindersResponseSchema,
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
  reviewers_count?: number;
  completed_count?: number;
  created_by?: string;
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
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingDraftSurvey, setEditingDraftSurvey] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'in_progress' | 'completed' | 'needs_review' | 'needs_reanalysis' | 'finalized'>('all');
  const [reviewerFilterStatus, setReviewerFilterStatus] = useState<'all' | 'required' | 'optional'>('all');
  // Regular users can't sponsor surveys, so default to 'reviewer' for them
  const [filterRole, setFilterRole] = useState<'sponsor' | 'reviewer' | 'subject'>(
    currentUser?.app_role === 'user' ? 'reviewer' : 'sponsor'
  );
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
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
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
  const [activeReportTab, setActiveReportTab] = useState<string>('themes');
  const [editingRecommendationIndex, setEditingRecommendationIndex] = useState<number | null>(null);
  const [editingRecommendationText, setEditingRecommendationText] = useState<string>('');
  const [finalNarrative, setFinalNarrative] = useState<string>('');
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeOutdated, setNarrativeOutdated] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, [organizationId, currentUser?.id, currentUser?.app_role]);

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

  const sendReminders = async (surveyId: string) => {
    try {
      const data = await fetchWithValidation(
        SendRemindersResponseSchema,
        `/api/surveys/${surveyId}/send-reminders`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!data || !data.results) {
        throw new Error('Failed to send reminders - invalid response');
      }

      if (data.results.failed > 0) {
        notify({
          title: `Reminders sent with errors`,
          description: `${data.results.sent} sent successfully, ${data.results.failed} failed.`,
          variant: 'error',
        });
      } else {
        notify({
          title: 'Reminders sent',
          description: `Reminder emails sent to ${data.results.sent} reviewers.`,
          variant: 'success',
        });
      }
    } catch (error: any) {
      console.error('Error sending reminders:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to send reminders',
        variant: 'error',
      });
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

      notify({
        title: 'Draft deleted',
        description: 'Your draft survey has been deleted.',
        variant: 'success',
      });

      // Reload surveys
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
    // Verify user is the sponsor or an admin
    const survey = surveys.find(s => s.id === surveyId);
    const isSponsor = survey?.created_by === currentUser?.id || survey?.created_by === currentUser?.email;
    const isAdmin = currentUser?.app_role === 'admin';

    if (!isSponsor && !isAdmin) {
      notify({
        title: 'Error',
        description: 'Only the sponsor or an admin can delete this review.',
        variant: 'error',
      });
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

    setIsGeneratingAnalysis(true);
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
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate AI analysis');
      }

      // Store the generated report and open results modal
      setSurveyResults(data.report);

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
      console.error('Error completing survey:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to generate AI analysis',
        variant: 'error',
      });
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const finalizeSurvey = async (surveyId: string) => {
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

  const adjustItem = async (
    itemIndex: number,
    adjustmentType: 'specificity' | 'tone' | 'length',
    direction: 'more' | 'less' | 'harsher' | 'softer' | 'longer' | 'shorter',
    sectionType: 'themes' | 'strengths' | 'development_areas' | 'key_insights'
  ) => {
    if (!selectedSurvey || !surveyResults) return;

    setIsAdjustingItem(true);
    try {
      let item: any;
      let sectionKey: string;
      let sectionLabel: string;

      switch (sectionType) {
        case 'themes':
          item = surveyResults.themes[itemIndex];
          sectionKey = 'themes';
          sectionLabel = 'theme';
          break;
        case 'strengths':
          item = surveyResults.overall_strengths[itemIndex];
          sectionKey = 'overall_strengths';
          sectionLabel = 'strength';
          break;
        case 'development_areas':
          item = surveyResults.development_areas[itemIndex];
          sectionKey = 'development_areas';
          sectionLabel = 'development area';
          break;
        case 'key_insights':
          item = surveyResults.key_insights[itemIndex];
          sectionKey = 'key_insights';
          sectionLabel = 'insight';
          break;
      }

      const response = await fetch('/api/ai/adjust-item-specificity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: selectedSurvey.id,
          item: item,
          section_type: sectionType,
          adjustment_type: adjustmentType,
          direction: direction,
          raw_responses: rawSurveyData?.responses || []
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to adjust ${sectionLabel}`);
      }

      const data = await response.json();

      // Update the item in the results
      const updatedSection = [...surveyResults[sectionKey]];
      updatedSection[itemIndex] = data.adjusted_item;

      setSurveyResults({
        ...surveyResults,
        [sectionKey]: updatedSection
      });

      // Create appropriate success message based on adjustment type
      let adjustmentMessage = '';
      switch (adjustmentType) {
        case 'specificity':
          adjustmentMessage = `made ${direction} specific`;
          break;
        case 'tone':
          adjustmentMessage = `made ${direction}`;
          break;
        case 'length':
          adjustmentMessage = `made ${direction}`;
          break;
      }

      notify({
        title: `${sectionLabel.charAt(0).toUpperCase() + sectionLabel.slice(1)} Adjusted`,
        description: `The ${sectionLabel} has been ${adjustmentMessage}.`,
        variant: 'success',
      });

      // Deselect item after adjustment
      setSelectedThemeIndex(null);
      setSelectedStrengthIndex(null);
      setSelectedDevelopmentIndex(null);
      setSelectedInsightIndex(null);

      // Mark narrative as outdated if it exists
      if (finalNarrative) {
        setNarrativeOutdated(true);
      }
    } catch (error: any) {
      console.error('Error adjusting item:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to adjust item',
        variant: 'error',
      });
    } finally {
      setIsAdjustingItem(false);
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
        body: JSON.stringify({ flagged_for_reanalysis: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve review');
      }

      // Update selectedSurvey to remove the tag immediately
      if (selectedSurvey) {
        const updatedSurvey = {
          ...selectedSurvey,
          flagged_for_reanalysis: false
        };
        setSelectedSurvey(updatedSurvey);

        // Also update the surveys list
        setSurveys(surveys.map(s => s.id === surveyId ? updatedSurvey : s));
      }

      notify({
        title: 'Review Resolved',
        description: 'The "Needs Reanalysis" tag has been removed.',
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
    setIsGeneratingAnalysis(true);
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
      setIsGeneratingAnalysis(false);
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
    const isSponsor = survey.created_by === currentUser?.id || survey.created_by === currentUser?.email;
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
        return survey.status === 'in_progress' && !isSubject;
      }
      return isReviewer && survey.status === 'in_progress';
    }

    // Subject tab: only show finalized surveys where user is the subject
    if (filterRole === 'subject') {
      return isSubject && survey.status === 'finalized';
    }

    // Sponsor tab:
    // - Admin sees ALL surveys (full oversight)
    // - Others see only surveys they created
    if (filterRole === 'sponsor') {
      if (isAdmin) {
        return true; // Admin sees ALL surveys
      }
      return isSponsor;
    }

    return false;
  });

  // Calculate counts for tab badges - must match the roleFilteredSurveys logic exactly
  const sponsorCount = surveys.filter(s => {
    // Check if current user is the creator (sponsor) of this survey
    const isCreator = (s.created_by === currentUser?.id || s.created_by === currentUser?.email);

    // Admin sees ALL surveys
    if (currentUser?.app_role === 'admin') {
      return true;
    }

    // Everyone else (SLT, Leader, User) ONLY sees surveys they personally created
    return isCreator;
  }).length;

  const reviewerCount = surveys.filter(s => {
    const isReviewer = s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
    const isSLT = currentUser?.app_role === 'slt';
    const isAdmin = currentUser?.app_role === 'admin';
    const isSubject = s.employee_id === currentUser?.id;

    // SLT/Admin sees all in_progress (can opt in), but NOT surveys where they are the subject
    if (isSLT || isAdmin) {
      return s.status === 'in_progress' && !isSubject;
    }
    return s.status === 'in_progress' && isReviewer;
  }).length;

  const subjectCount = surveys.filter(s =>
    s.status === 'finalized' &&
    s.employee_id === currentUser?.id
  ).length;

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

  // Apply reviewer filter (only for SLT on Reviewer tab)
  if (filterRole === 'reviewer' && currentUser?.app_role === 'slt') {
    filteredSurveys = reviewerFilterStatus === 'all'
      ? roleFilteredSurveys
      : reviewerFilterStatus === 'required'
      ? roleFilteredSurveys.filter(s => s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email))
      : roleFilteredSurveys.filter(s => !s.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email));
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

  const getStatusBadge = (status: string, flaggedForAdmin?: boolean, flaggedForReanalysis?: boolean) => {
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
    if (flaggedForReanalysis && (selectedSurvey?.created_by === currentUser?.id || selectedSurvey?.created_by === currentUser?.email)) {
      return (
        <Tooltip content="This survey has been flagged and requires admin review">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-100 text-red-700 border-red-300 cursor-help">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Reanalysis
          </span>
        </Tooltip>
      );
    }

    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      completed: 'bg-green-100 text-green-700 border-green-300',
      finalized: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    const icons = {
      draft: Clock,
      in_progress: MessageSquare,
      completed: CheckCircle,
      finalized: ArrowDownCircle
    };
    const labels = {
      draft: 'Draft',
      in_progress: 'In Progress',
      completed: 'Completed',
      finalized: 'Finalized'
    };
    const tooltips = {
      draft: 'Survey is not yet sent to reviewers',
      in_progress: 'Survey is active and awaiting responses',
      completed: 'All responses received and analyzed',
      finalized: 'Survey is archived and final'
    };
    const Icon = icons[status as keyof typeof icons] || Clock;
    const tooltipText = tooltips[status as keyof typeof tooltips] || 'Survey status';

    return (
      <Tooltip content={tooltipText}>
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border cursor-help ${styles[status as keyof typeof styles]}`}>
          <Icon className="w-3 h-3 mr-1" />
          {labels[status as keyof typeof labels] || status}
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
      {/* Role Navigation Tabs - Primary sub-navigation for 360 Review section */}
      <div className="mb-6 flex items-center justify-between">
        <NavigationTabs
          tabs={[
            // Only show Sponsor tab for Admin, SLT, and Leader roles
            ...(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || currentUser?.app_role === 'leader' ? [{
              id: 'sponsor',
              label: 'Sponsoring',
              tooltip: '360 reviews you created. Launch reviews, manage reviewers, track progress, and finalize the report',
              count: sponsorCount
            }] : []),
            {
              id: 'reviewer',
              label: 'Reviewing',
              tooltip: 'Active 360 reviews awaiting your feedback. Provide anonymous feedback, aggregated with AI',
              count: reviewerCount
            },
            {
              id: 'subject',
              label: 'Your 360° Feedback',
              tooltip: 'Completed 360 reviews about you. View finalized feedback, insights, and actions',
              count: subjectCount
            }
          ]}
          activeTab={filterRole}
          onTabChange={(tabId) => {
            setFilterRole(tabId as 'sponsor' | 'reviewer' | 'subject');
            setReviewerFilterStatus('all'); // Reset reviewer filter when switching tabs
          }}
          variant="underline"
        />
        <span className="text-gray-500 italic text-sm">Hover over an element for more information</span>
      </div>

      {/* Pipeline Stats with Risk Flags - Only show on Sponsor tab */}
      {filterRole === 'sponsor' && (
      <div className={`grid gap-4 mt-6 ${
        currentUser?.app_role === 'admin'
          ? 'grid-cols-3 lg:grid-cols-6'
          : (currentUser?.app_role === 'leader' || currentUser?.app_role === 'slt')
          ? 'grid-cols-2 lg:grid-cols-5'
          : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white rounded-lg shadow p-3 border-2 transition-all text-left ${
            filterStatus === 'all' ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{roleFilteredSurveys.length}</p>
            </div>
          </div>
        </button>

        {/* Drafts - Only show for Admin, SLT, and Leader (Sponsors) */}
        {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || currentUser?.app_role === 'leader') && (
          <Tooltip content="Surveys not yet sent to reviewers">
            <button
              onClick={() => setFilterStatus('draft')}
              className={`bg-white rounded-lg shadow p-3 border-2 transition-all text-left ${
                filterStatus === 'draft' ? 'border-gray-500' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Drafts</p>
                  <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
            </button>
          </Tooltip>
        )}

        <Tooltip content="Surveys awaiting responses from reviewers">
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'in_progress'
                ? 'border-yellow-500 bg-yellow-50'
                : 'bg-white border-yellow-200 hover:bg-yellow-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.in_progress}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-yellow-400" />
            </div>
          </button>
        </Tooltip>

        {/* Completed - Available to all roles (Users see reviews where they're reviewers) */}
        <Tooltip content="Surveys with all responses received and analyzed">
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'completed'
                ? 'border-green-500 bg-green-50'
                : 'bg-white border-green-200 hover:bg-green-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Completed</p>
                <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </button>
        </Tooltip>

        {/* Needs Reanalysis - Admin Only */}
        {currentUser?.app_role === 'admin' && (
          <Tooltip content="Surveys flagged for admin review and reanalysis">
            <button
              onClick={() => setFilterStatus('needs_reanalysis')}
              className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
                filterStatus === 'needs_reanalysis'
                  ? 'border-red-500 bg-red-50'
                  : 'bg-white border-red-200 hover:bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Needs Reanalysis</p>
                  <p className="text-2xl font-bold text-red-900">{stats.needs_reanalysis}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </button>
          </Tooltip>
        )}

        {/* Finalized - Available to all users (they see only their own finalized reviews) */}
        <Tooltip content="Surveys marked as final and archived">
          <button
            onClick={() => setFilterStatus('finalized')}
            className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
              filterStatus === 'finalized'
                ? 'border-purple-500 bg-purple-50'
                : 'bg-white border-purple-200 hover:bg-purple-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Finalized</p>
                <p className="text-2xl font-bold text-purple-900">{stats.finalized}</p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-purple-400" />
            </div>
          </button>
        </Tooltip>
      </div>
      )}

      {/* Launch Review Button - Only show for Admin, SLT, and Leader (Sponsors) on Sponsor tab */}
      {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || currentUser?.app_role === 'leader') && filterRole === 'sponsor' && (
        <div className="relative mt-6 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPreselectedEmployee(undefined);
                setIsWizardOpen(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Launch 360° Review
            </button>
            {/* AI-assisted review wizard button - disabled and hidden */}
            {false && (
              <button
                onClick={() => {
                  setIsAIModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium flex items-center gap-2"
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
      <div className="grid gap-4 mt-6 grid-cols-2 lg:grid-cols-3">
        {/* Total */}
        <button
          onClick={() => setReviewerFilterStatus('all')}
          className={`bg-white rounded-lg shadow p-3 border-2 transition-all text-left ${
            reviewerFilterStatus === 'all' ? 'border-cyan-500' : 'border-cyan-200 hover:border-cyan-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyan-700">Total</p>
              <p className="text-2xl font-bold text-cyan-900">{reviewerStats.total}</p>
            </div>
          </div>
        </button>

        {/* Required (Assigned Reviewer) */}
        <Tooltip content="360 reviews where you are an assigned reviewer">
          <button
            onClick={() => setReviewerFilterStatus('required')}
            className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
              reviewerFilterStatus === 'required'
                ? 'border-green-700 bg-green-50'
                : 'bg-white border-green-400 hover:bg-green-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800">Required</p>
                <p className="text-2xl font-bold text-green-900">{reviewerStats.required}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </button>
        </Tooltip>

        {/* Optional (Can Opt In) */}
        <Tooltip content="360 reviews you can opt into as an SLT or Admin member">
          <button
            onClick={() => setReviewerFilterStatus('optional')}
            className={`rounded-lg shadow p-3 border-2 transition-all text-left ${
              reviewerFilterStatus === 'optional'
                ? 'border-lime-500 bg-lime-50'
                : 'bg-white border-lime-200 hover:bg-lime-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-lime-700">Optional</p>
                <p className="text-2xl font-bold text-lime-900">{reviewerStats.optional}</p>
              </div>
              <UserPlus className="w-8 h-8 text-lime-400" />
            </div>
          </button>
        </Tooltip>
      </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-12 mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading reviews...</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 mt-6">
          <div className="text-center mb-8">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filterRole === 'reviewer'
                ? 'No 360° reviews require your feedback'
                : filterRole === 'subject'
                ? 'Your 360° review has not been finalized'
                : filterStatus === 'all'
                ? 'No reviews yet'
                : filterStatus === 'draft'
                ? 'No review drafts'
                : filterStatus === 'needs_review'
                ? 'No reviews need admin review'
                : `No reviews ${filterStatus === 'in_progress' ? 'in progress' : filterStatus}`}
            </h3>
            {filterRole === 'sponsor' && filterStatus === 'all' && (currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || currentUser?.app_role === 'leader') && (
              <>
                <p className="text-gray-600 mb-6">
                  Create your first 360° feedback review to gather multi-source feedback
                </p>
                {/* Create First Review button - disabled and hidden */}
                {false && (
                  <button
                    onClick={() => setIsWizardOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-2"
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
            const isSponsor = survey.created_by === currentUser?.id || survey.created_by === currentUser?.email;

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
                className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer relative"
                onClick={() => {
                  // If it's a draft and user is the sponsor, open wizard to edit/launch
                  if (survey.status === 'draft' && isSponsor) {
                    setEditingDraftSurvey(survey);
                    // Pre-select the employee being reviewed
                    const employee = employees.find(e => e.id === survey.employee_id);
                    if (employee) {
                      setPreselectedEmployee(employee);
                    }
                    setIsWizardOpen(true);
                  } else if (survey.status === 'finalized' && hasSurveyBeenViewed(survey.id)) {
                    // If it's a finalized survey that has been viewed before, go straight to results
                    // But only if user is sponsor, admin, or subject - leaders who are reviewers should not see results
                    const isSurveySponsor = survey.created_by === currentUser?.id || survey.created_by === currentUser?.email;
                    const isSurveySubject = survey.employee_id === currentUser?.id;
                    const isSurveyAdmin = currentUser?.app_role === 'admin';
                    const isSurveyReviewer = survey.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
                    const isLeaderReviewer = currentUser?.app_role === 'leader' && isSurveyReviewer && !isSurveySponsor;
                    
                    // Only allow viewing results if user is sponsor, admin, or subject (not leader reviewers)
                    if (isSurveySponsor || isSurveyAdmin || (isSurveySubject && !isLeaderReviewer)) {
                      loadAndShowResults(survey);
                    } else {
                      // For leader reviewers, open details modal instead (which will show completion message)
                      setSelectedSurvey(survey);
                      setIsDetailsModalOpen(true);
                    }
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
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 leading-tight">
                        360° Review -
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
                          <span className="text-xs font-medium text-indigo-700 cursor-help">
                            Sponsor
                          </span>
                        </Tooltip>
                      )}
                      {isReviewee && (
                        <Tooltip content="You are being reviewed">
                          <span className="text-xs font-medium text-orange-700 cursor-help">
                            Subject
                          </span>
                        </Tooltip>
                      )}
                      {isReviewer && (
                        <Tooltip content="You were invited to provide feedback">
                          <span className="text-xs font-medium text-cyan-700 cursor-help">
                            Reviewer
                          </span>
                        </Tooltip>
                      )}
                    </div>

                  <div className="flex items-center space-x-4 text-sm">
                    {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                    {(currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || isSponsor) && (
                      <div className="flex items-center">
                        <span className="text-gray-500">Reviewers:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {survey.completed_count ?? 0}/{survey.reviewers_count ?? 0}
                        </span>
                        <span className="ml-1 text-gray-500">completed</span>
                      </div>
                    )}
                    {survey.due_date && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-gray-400" />
                        <span className="text-gray-500">Due: {new Date(survey.due_date).toLocaleDateString()}</span>
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
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg"
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
                                className="inline-flex items-center px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-all font-medium shadow-md hover:shadow-lg"
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
                            className="inline-flex items-center px-4 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 transition-all font-medium shadow-md hover:shadow-lg mt-4"
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
                        <span className="text-xs text-gray-600">
                          Response Rate: {Math.round(((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100)}% (70% required)
                        </span>
                        {(() => {
                          const completedCount = survey.completed_count ?? 0;
                          const reviewersCount = survey.reviewers_count ?? 1;
                          const responseRate = reviewersCount > 0 ? completedCount / reviewersCount : 0;
                          const daysUntilDue = survey.due_date ? Math.ceil((new Date(survey.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
                          const isAtRisk = responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;

                          return isAtRisk && (
                            <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              At Risk
                            </span>
                          );
                        })()}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 relative">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            ((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) < 0.7 ? 'bg-orange-500' : 'bg-green-600'
                          }`}
                          style={{ width: `${((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100}%` }}
                        />
                        {/* Show 70% requirement marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
                          style={{ left: '70%' }}
                          title="70% completion required"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Status badge and actions */}
                <div className="ml-4 flex flex-col items-end gap-2">
                  {/* Status badge - Only show on Sponsor tab */}
                  {filterRole === 'sponsor' && getStatusBadge(survey.status || 'unknown', survey.flagged_for_admin ?? undefined, survey.flagged_for_reanalysis ?? undefined)}

                  {/* Remind button */}
                  {survey.status === 'active' && (survey.completed_count ?? 0) !== (survey.reviewers_count ?? 0) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReminders(survey.id);
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium flex items-center whitespace-nowrap"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Remind
                    </button>
                  )}

                </div>

                {/* Delete button - bottom right of card */}
                {(currentUser?.app_role === 'admin' || isSponsor) && (
                  <Tooltip content="Permanently delete this survey for everyone involved" side="bottom">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInProgressSurvey(survey.id);
                      }}
                      className="absolute bottom-6 right-6 mt-4 text-red-600 hover:text-red-700 transition-colors text-sm font-medium"
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
        const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
        const isAdmin = currentUser?.app_role === 'admin';
        const isSLT = currentUser?.app_role === 'slt';
        const isLeader = currentUser?.app_role === 'leader';
        const isSubject = selectedSurvey.employee_id === currentUser?.id;
        const isReviewer = selectedSurvey.reviewers?.some((r: any) => r.reviewer_email === currentUser?.email);
        const userCompletedReview = isReviewer && selectedSurvey.reviewers?.find((r: any) => r.reviewer_email === currentUser?.email)?.status === 'completed';

        // Only sponsors and admins can manage surveys
        // Leaders can only manage if they are the sponsor
        const canManage = isSponsor || isAdmin;

        // For finalized surveys, only non-sponsor admins can see read-only view
        // Leaders who are reviewers should see the completion message, not results
        const isFinalizedNonSponsorAdmin = !isSponsor && isAdmin && selectedSurvey.status === 'finalized';
        
        // Leaders who are reviewers on finalized surveys should see read-only view, not sponsor view
        const isLeaderReviewerOnFinalized = isLeader && isReviewer && !isSponsor && selectedSurvey.status === 'finalized';

        // Leaders who are reviewers (not sponsors) should always see read-only view
        const isLeaderReviewer = isLeader && isReviewer && !isSponsor;

        if (!canManage || isFinalizedNonSponsorAdmin || isLeaderReviewerOnFinalized || isLeaderReviewer) {
          // Read-only view for reviewers and subject
          // If finalized, only subject or admin (not leaders) can see the complete review results
          const canSeeResults = (isSubject || isFinalizedNonSponsorAdmin) && selectedSurvey.status === 'finalized';
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 sticky top-0 bg-white flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-600">Employee:</span>
                      <span className="ml-2 text-sm font-semibold text-gray-900">
                        {selectedSurvey.employee?.name || 'Unknown'}
                      </span>
                      {selectedSurvey.employee?.title && (
                        <span className="ml-2 text-sm text-gray-600">• {selectedSurvey.employee.title}</span>
                      )}
                    </div>
                    <div className="mt-2">
                      {getStatusBadge(selectedSurvey.status || 'unknown', selectedSurvey.flagged_for_admin ?? undefined, selectedSurvey.flagged_for_reanalysis ?? undefined)}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 ml-4"
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
                          <Clock className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="text-sm text-gray-600">Due Date:</span>
                          <span className="ml-2 text-sm font-semibold text-gray-900">
                            {new Date(selectedSurvey.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="ml-2 text-sm text-gray-900">
                          {selectedSurvey.created_at ? new Date(selectedSurvey.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                {/* View Results Button - For finalized reviews */}
                {canSeeResults && (
                  <button
                    onClick={() => loadAndShowResults(selectedSurvey)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Eye className="w-4 h-4" />
                    View Complete Review
                  </button>
                )}

                {/* Reviewers Progress */}
                {!canSeeResults && (
                  <div>
                    {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                    {(isAdmin || currentUser?.app_role === 'slt' || isSponsor) && (
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Reviewers ({selectedSurvey.completed_count}/{selectedSurvey.reviewers_count} completed)
                      </h4>
                    )}
                    {/* Only show reviewers list to admin, sponsor, or SLT (for in-progress surveys) */}
                    {(isAdmin || isSponsor || (isSLT && selectedSurvey.status === 'in_progress')) && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-[240px] overflow-y-auto">
                        {surveyReviewers.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-2">No reviewers added yet</p>
                        ) : (
                          surveyReviewers.map((reviewer) => (
                            <div
                              key={reviewer.id}
                              className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    name={reviewer.reviewer_name ?? undefined}
                                    picture={undefined}
                                    size="sm"
                                  />
                                  <span className="font-medium text-gray-900 text-sm">{reviewer.reviewer_name}</span>
                                  <span className={`px-2 py-0.5 text-xs rounded ${
                                    reviewer.status === 'completed'
                                      ? 'bg-green-100 text-green-700'
                                      : reviewer.status === 'in_progress'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {reviewer.status === 'completed' ? 'Completed' : reviewer.status === 'in_progress' ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
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
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-green-900">
                          Your input towards the review is already complete. Thank you!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => window.open(`/survey/complete/${selectedSurvey.reviewers?.find((r: any) => r.reviewer_email === currentUser?.email)?.access_token}`, '_blank')}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg mt-4"
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
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 leading-tight">
                  360° Review -
                  <Avatar
                    name={selectedSurvey.employee?.name}
                    picture={selectedSurvey.employee?.picture ?? undefined}
                    size="xs"
                  />
                  {selectedSurvey.employee?.name || 'Unknown'}
                </h2>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Metadata line */}
              <div className="flex items-center justify-between text-sm text-gray-600 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-gray-600">Created: </span>
                    <span className="text-gray-900">
                      {selectedSurvey.created_at ? new Date(selectedSurvey.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {selectedSurvey.due_date && (
                    <div>
                      <span className="text-gray-600">Due Date: </span>
                      <span className="font-semibold text-gray-900">
                        {new Date(selectedSurvey.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                {getStatusBadge(selectedSurvey.status ?? 'draft', selectedSurvey.flagged_for_admin ?? undefined, selectedSurvey.flagged_for_reanalysis ?? undefined)}
              </div>

              {/* Reviewers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Reviewers ({selectedSurvey.completed_count}/{selectedSurvey.reviewers_count} completed)
                  </h4>
                  {isSponsor && (
                  <button
                    onClick={() => setIsAddingReviewer(!isAddingReviewer)}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Reviewer
                  </button>
                  )}
                </div>

                {isAddingReviewer && (
                  <div className="mb-3 relative">
                    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
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
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                              className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                            <Avatar
                              name={(selectedReviewerEmployee as any).full_name || selectedReviewerEmployee.name}
                              picture={selectedReviewerEmployee.picture ?? undefined}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900">{(selectedReviewerEmployee as any).full_name || selectedReviewerEmployee.name}</div>
                              <div className="text-xs text-gray-600 truncate">{selectedReviewerEmployee.email}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {selectedReviewerEmployee ? (
                        <button
                          onClick={addReviewer}
                          className="px-3 py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
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
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                          <div className="p-2">
                            {isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-gray-500">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                                    className={`w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2 ${
                                      isAlreadyAdded
                                        ? 'opacity-60 cursor-not-allowed bg-gray-50'
                                        : 'hover:bg-blue-50 cursor-pointer'
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
                                        <div className="font-semibold text-sm text-gray-900">{emp.full_name || emp.name}</div>
                                        {isAlreadyAdded && (
                                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-600">
                                            Already Added
                                          </span>
                                        )}
                                        {empWithRel.detected_relationship && !isAlreadyAdded && (
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                            empWithRel.detected_relationship === 'manager' ? 'bg-purple-100 text-purple-700' :
                                            empWithRel.detected_relationship === 'slt' ? 'bg-blue-100 text-blue-700' :
                                            empWithRel.detected_relationship === 'direct_report' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {empWithRel.detected_relationship === 'manager' ? 'Manager' :
                                             empWithRel.detected_relationship === 'slt' ? 'SLT' :
                                             empWithRel.detected_relationship === 'direct_report' ? 'Direct Report' :
                                             'Cross-Functional'}
                                          </span>
                                        )}
                                      </div>
                                      {emp.title && <div className="text-xs text-gray-600">{emp.title}</div>}
                                    </div>
                                  </button>
                                );
                              })
                            ) : newReviewerRelationship && employeesWithRelationships.length === 0 && !isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg m-2">
                                {selectedSurvey?.employee?.name} has no{' '}
                                {newReviewerRelationship === 'manager' ? 'manager' :
                                 newReviewerRelationship === 'slt' ? 'SLT' :
                                 newReviewerRelationship === 'direct_report' ? 'direct reports' :
                                 'cross-functional colleagues'} in the system
                              </div>
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500">No employees found</div>
                            )}
                            <button
                              onClick={() => {
                                setShowReviewerPicker(false);
                                setReviewerSearch('');
                              }}
                              className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-[240px] overflow-y-auto">
                    {surveyReviewers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No reviewers added yet</p>
                    ) : (
                      surveyReviewers.map((reviewer) => (
                        <div
                          key={reviewer.id}
                          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={reviewer.reviewer_name ?? undefined}
                                picture={undefined}
                                size="sm"
                              />
                              <span className="font-medium text-gray-900 text-sm">{reviewer.reviewer_name}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                reviewer.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : reviewer.status === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {reviewer.status === 'completed' ? 'Completed' : reviewer.status === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {reviewer.reviewer_email} • {formatRelationship(reviewer.relationship)}
                            </div>
                          </div>
                          {(isSponsor || isAdmin) && (
                          <div className="flex items-center gap-6">
                            {reviewer.status !== 'completed' && (
                              remindedReviewers.has(reviewer.id) ? (
                                <span className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Reminded
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendReminderToReviewer(reviewer.id, reviewer.reviewer_email)}
                                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 font-medium"
                                  title="Send reminder email"
                                >
                                  <Send className="w-3 h-3" />
                                  Remind
                                </button>
                              )
                            )}
                            <button
                              onClick={() => removeReviewer(reviewer.id)}
                              className="text-red-600 hover:text-red-700 transition-colors"
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
                  <p className="text-sm text-gray-500 text-center py-2">Reviewer details are only visible to admins and the review sponsor.</p>
                )}
              </div>

              {/* Actions - Only visible to sponsor */}
              {isSponsor && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  {/* Send Backward - Always on left, always grey */}
                  {(selectedSurvey.status === 'in_progress' || selectedSurvey.status === 'completed' || selectedSurvey.status === 'finalized') && (
                    <button
                      onClick={() => sendBackward(selectedSurvey.id, selectedSurvey.status ?? undefined)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Send Backward
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Complete with AI for in_progress - disabled if below 70% completion threshold */}
                  {selectedSurvey.status === 'in_progress' && (() => {
                    const completionPercent = (selectedSurvey.completed_count ?? 0) / (selectedSurvey.reviewers_count ?? 1);
                    const isAdmin = currentUser?.app_role === 'admin';
                    const meetsThreshold = completionPercent >= 0.7;
                    const canComplete = isAdmin || meetsThreshold;

                    return (
                      <button
                        onClick={() => {
                          completeSurveyWithAI();
                        }}
                        disabled={isGeneratingAnalysis || !canComplete}
                        className={`px-4 py-2 bg-gradient-to-r rounded-lg font-medium flex items-center ${
                          canComplete
                            ? 'from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800'
                            : 'from-gray-400 to-gray-500 text-gray-200 cursor-not-allowed'
                        } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                        title={!canComplete ? 'At least 70% of reviewers must submit their feedback before completing the review.' : ''}
                      >
                        {isGeneratingAnalysis ? (
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
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium flex items-center"
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
        const isSponsor = selectedSurvey?.created_by === currentUser?.id || selectedSurvey?.created_by === currentUser?.email;
        const isAdmin = currentUser?.app_role === 'admin';
        const isSLT = currentUser?.app_role === 'slt';
        const canSeeAdvanced = !isSubject || isAdmin || isSponsor;

        // Check if we have sentiment/consensus data
        const hasSentimentData = surveyResults.sentiment_by_relationship &&
          (surveyResults.sentiment_by_relationship.manager !== undefined ||
           surveyResults.sentiment_by_relationship.peer !== undefined ||
           surveyResults.sentiment_by_relationship.direct_report !== undefined ||
           surveyResults.sentiment_by_relationship.cross_functional !== undefined);

        const hasConsensusData = (surveyResults.consensus_areas?.length > 0 || surveyResults.outlier_opinions?.length > 0);

        // Define tabs
        const reportTabs = [
          { id: 'themes', label: 'Themes' },
          { id: 'strengths', label: 'Strengths' },
          { id: 'development', label: 'Development Areas' },
          ...(surveyResults.key_insights && surveyResults.key_insights.length > 0 ? [{ id: 'insights', label: 'Insights' }] : []),
          { id: 'recommendations', label: 'Recommended Actions' },
          ...(canSeeAdvanced && hasSentimentData ? [{ id: 'sentiment', label: 'Sentiment Analysis' }] : []),
          ...(canSeeAdvanced && hasConsensusData ? [{ id: 'consensus', label: 'Consensus & Outliers' }] : []),
          { id: 'narrative', label: 'Narrative' }
        ];

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900">{selectedSurvey.survey_name}</h2>
                      {/* Only show reviewer count to Admin, SLT, and survey sponsor */}
                      {(isAdmin || isSLT || isSponsor) && (
                        <span className="text-sm text-gray-600">
                          Reviewers: <span className="font-medium">{selectedSurvey.completed_count} of {selectedSurvey.reviewers_count} completed</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Generated by {surveyResults.generated_by || 'Claude AI'} on {new Date(surveyResults.generated_at || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        // Determine if current user is subject viewing their own report
                        const isSubject = currentUser?.id === selectedSurvey?.employee_id;
                        const isSponsor = selectedSurvey?.created_by === currentUser?.id || selectedSurvey?.created_by === currentUser?.email;
                        const isAdmin = currentUser?.app_role === 'admin';
                        const isPureSubject = isSubject && !isAdmin && !isSponsor;

                        // Filter data for subjects (they should not see relationship-specific details)
                        let sentimentData = surveyResults.sentiment_by_relationship;
                        let consensusData = surveyResults.consensus_areas;
                        let outlierData = surveyResults.outlier_opinions;

                        if (isPureSubject) {
                          // Subject viewing their own report - filter sensitive data
                          sentimentData = {
                            overall: surveyResults.sentiment_by_relationship?.overall || 0
                          };
                          // Remove consensus and outlier sections as they may reveal relationship patterns
                          consensusData = [];
                          outlierData = [];
                        }

                        const reportData = {
                          survey_name: selectedSurvey.survey_name || 'Untitled Survey',
                          employee_name: selectedSurvey.employee?.full_name || selectedSurvey.employee?.name || selectedSurvey.employee_name || '',
                          generated_by: surveyResults.generated_by,
                          generated_at: surveyResults.generated_at,
                          executive_summary: surveyResults.executive_summary,
                          final_narrative: finalNarrative,
                          themes: surveyResults.themes,
                          overall_strengths: surveyResults.overall_strengths,
                          development_areas: surveyResults.development_areas,
                          recommendations: surveyResults.recommendations,
                          key_insights: surveyResults.key_insights,
                          sentiment_by_relationship: sentimentData,
                          consensus_areas: consensusData,
                          outlier_opinions: outlierData
                        };

                        const filename = await exportReportAsPDF(reportData);
                        notify({
                          title: 'Success',
                          description: `Report exported as ${filename}`,
                          variant: 'success',
                        });
                      } catch (error) {
                        console.error('Error exporting PDF:', error);
                        notify({
                          title: 'Error',
                          description: 'Failed to export PDF',
                          variant: 'error',
                        });
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </button>
                  {(currentUser?.app_role === 'admin' || ((selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email) && (currentUser?.app_role === 'admin' || currentUser?.app_role === 'slt' || currentUser?.app_role === 'leader'))) && selectedSurvey.status !== 'completed' && selectedSurvey.status !== 'finalized' && (
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
                      setActiveReportTab('themes'); // Reset to first tab when closing
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

            <div className="h-[500px] overflow-y-auto p-6 space-y-6">
              {/* Key Themes Tab */}
              {activeReportTab === 'themes' && surveyResults.themes && surveyResults.themes.length > 0 && (() => {
                const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                const canAdjustThemes = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    {canAdjustThemes && (
                      <div className="mb-4">
                        <span className="text-sm text-gray-600 font-semibold italic">Click to adjust</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      {surveyResults.themes.map((theme: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => canAdjustThemes && setSelectedThemeIndex(idx === selectedThemeIndex ? null : idx)}
                          className={`border rounded-lg p-4 transition-colors ${
                            canAdjustThemes ? 'cursor-pointer hover:border-purple-400' : ''
                          } ${
                            selectedThemeIndex === idx
                              ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900">{theme.theme}</h5>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              theme.sentiment === 'very_positive' ? 'bg-emerald-100 text-emerald-700' :
                              theme.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                              theme.sentiment === 'mixed' ? 'bg-yellow-100 text-yellow-700' :
                              theme.sentiment === 'needs_work' ? 'bg-orange-100 text-orange-700' :
                              theme.sentiment === 'critical' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {theme.sentiment === 'very_positive' ? 'Very Positive' :
                               theme.sentiment === 'positive' ? 'Positive' :
                               theme.sentiment === 'mixed' ? 'Mixed' :
                               theme.sentiment === 'needs_work' ? 'Needs Work' :
                               theme.sentiment === 'critical' ? 'Critical' :
                               theme.sentiment}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            Mentioned by {theme.frequency} reviewer{theme.frequency !== 1 ? 's' : ''}
                            {theme.relationships_mentioned && theme.relationships_mentioned.length > 0 && (
                              <span> ({theme.relationships_mentioned.join(', ')})</span>
                            )}
                          </p>
                          {theme.supporting_evidence && theme.supporting_evidence.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {theme.supporting_evidence.map((evidence: string, qIdx: number) => (
                                <p key={qIdx} className="text-sm text-gray-600 pl-3 border-l-2 border-gray-300">
                                  {evidence}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Adjustment buttons - only show when this theme is selected */}
                          {canAdjustThemes && selectedThemeIndex === idx && (
                            <div className="mt-2 pt-2 border-t border-purple-200 flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'specificity', 'more', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                More Specific
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'specificity', 'less', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Less Specific
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'tone', 'harsher', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Harsher
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'tone', 'softer', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Softer
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'length', 'longer', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Longer
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustItem(idx, 'length', 'shorter', 'themes');
                                }}
                                disabled={isAdjustingItem}
                                className="flex-1 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Shorter
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Strengths Tab */}
              {activeReportTab === 'strengths' && surveyResults.overall_strengths && surveyResults.overall_strengths.length > 0 && (() => {
                const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                const canAdjustItems = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    {canAdjustItems && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-600 font-semibold italic">Click to adjust</span>
                      </div>
                    )}
                    <ul className="space-y-1">
                      {surveyResults.overall_strengths.map((strength: string, idx: number) => (
                        <li
                          key={idx}
                          onClick={() => canAdjustItems && setSelectedStrengthIndex(idx === selectedStrengthIndex ? null : idx)}
                          className={`flex items-start gap-2 rounded-lg p-2 transition-colors ${
                            canAdjustItems ? 'cursor-pointer hover:bg-green-50' : ''
                          } ${
                            selectedStrengthIndex === idx
                              ? 'bg-green-50 ring-2 ring-green-200'
                              : ''
                          }`}
                        >
                          <span className="text-green-600 mt-1">•</span>
                          <div className="flex-1">
                            <span className="text-gray-700">{strength}</span>

                            {/* Adjustment buttons */}
                            {canAdjustItems && selectedStrengthIndex === idx && (
                              <div className="mt-2 pt-2 border-t border-green-200 flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'more', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  More Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'less', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Less Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'harsher', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Harsher
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'softer', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Softer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'longer', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Longer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'shorter', 'strengths');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Shorter
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Development Areas Tab */}
              {activeReportTab === 'development' && surveyResults.development_areas && surveyResults.development_areas.length > 0 && (() => {
                const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                const canAdjustItems = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    {canAdjustItems && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-600 font-semibold italic">Click to adjust</span>
                      </div>
                    )}
                    <ul className="space-y-1">
                      {surveyResults.development_areas.map((area: string, idx: number) => (
                        <li
                          key={idx}
                          onClick={() => canAdjustItems && setSelectedDevelopmentIndex(idx === selectedDevelopmentIndex ? null : idx)}
                          className={`flex items-start gap-2 rounded-lg p-2 transition-colors ${
                            canAdjustItems ? 'cursor-pointer hover:bg-amber-50' : ''
                          } ${
                            selectedDevelopmentIndex === idx
                              ? 'bg-amber-50 ring-2 ring-amber-200'
                              : ''
                          }`}
                        >
                          <span className="text-amber-600 mt-1">•</span>
                          <div className="flex-1">
                            <span className="text-gray-700">{area}</span>

                            {/* Adjustment buttons */}
                            {canAdjustItems && selectedDevelopmentIndex === idx && (
                              <div className="mt-2 pt-2 border-t border-amber-200 flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'more', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  More Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'less', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Less Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'harsher', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Harsher
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'softer', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Softer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'longer', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Longer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'shorter', 'development_areas');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Shorter
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Key Insights Tab - Visible to All */}
              {activeReportTab === 'insights' && surveyResults.key_insights && surveyResults.key_insights.length > 0 && (() => {
                // Check if user is sponsor or admin for adjustment capabilities
                const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                const canAdjustItems = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    {canAdjustItems && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-600 font-semibold italic">Click to adjust</span>
                      </div>
                    )}
                    <ul className="space-y-1">
                      {surveyResults.key_insights.map((insight: string, idx: number) => (
                        <li
                          key={idx}
                          onClick={() => canAdjustItems && setSelectedInsightIndex(idx === selectedInsightIndex ? null : idx)}
                          className={`flex items-start gap-2 rounded-lg p-2 transition-colors ${
                            canAdjustItems ? 'cursor-pointer hover:bg-purple-50' : ''
                          } ${
                            selectedInsightIndex === idx
                              ? 'bg-purple-50 ring-2 ring-purple-200'
                              : ''
                          }`}
                        >
                          <span className="text-purple-600 mt-1">•</span>
                          <div className="flex-1">
                            <span className="text-gray-700">{insight}</span>

                            {/* Adjustment buttons */}
                            {canAdjustItems && selectedInsightIndex === idx && (
                              <div className="mt-2 pt-2 border-t border-purple-200 flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'more', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  More Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'specificity', 'less', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Less Specific
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'harsher', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Harsher
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'tone', 'softer', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Softer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'longer', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Longer
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    adjustItem(idx, 'length', 'shorter', 'key_insights');
                                  }}
                                  disabled={isAdjustingItem}
                                  className="flex-1 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Shorter
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Recommendations Tab */}
              {activeReportTab === 'recommendations' && (() => {
                const isSponsor = selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                const canEdit = (isSponsor || isAdmin) && selectedSurvey.status === 'completed';

                return (
                  <div>
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">
                        Recommended Actions
                        {canEdit && (
                          <span className="text-xs text-gray-600 font-semibold ml-2">(Click to edit)</span>
                        )}
                      </h4>
                    </div>
                    <ul className="space-y-3">
                      {surveyResults.recommendations && surveyResults.recommendations.length > 0 && surveyResults.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 group">
                          <span className="text-gray-400 font-medium text-sm flex-shrink-0 mt-0.5">{idx + 1}.</span>
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
                              className="flex-1 px-2 py-1 border-b-2 border-blue-500 text-gray-700 text-sm focus:outline-none bg-transparent"
                              autoFocus
                            />
                          ) : (
                            <div className="flex-1 flex items-start justify-between group">
                              <span
                                onClick={() => canEdit && startEditingRecommendation(idx, rec)}
                                className={`text-gray-700 text-sm flex-1 ${
                                  canEdit ? 'cursor-pointer hover:text-gray-900' : ''
                                }`}
                              >
                                {rec}
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
                      ))}

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
                              className="flex-1 px-2 py-1 border-b-2 border-blue-500 text-gray-700 text-sm focus:outline-none bg-transparent"
                              placeholder="Type to add new action..."
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEditingRecommendation(-1, '')}
                              className="flex-1 text-gray-400 text-sm cursor-pointer hover:text-gray-600 italic"
                            >
                              Add new action...
                            </span>
                          )}
                        </li>
                      )}

                      {!canEdit && (!surveyResults.recommendations || surveyResults.recommendations.length === 0) && (
                        <li className="text-gray-500 text-sm italic">No recommendations available.</li>
                      )}
                    </ul>

                    {/* Save button */}
                    {canEdit && (
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={saveRecommendationsToDB}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sentiment Analysis Tab - Sponsor/Admin Only */}
              {activeReportTab === 'sentiment' && (() => {
                // Check if current user is the subject (employee being reviewed)
                const isSubject = currentUser?.id === selectedSurvey?.employee_id;
                // Check if user is sponsor or admin
                const isSponsor = selectedSurvey?.created_by === currentUser?.id || selectedSurvey?.created_by === currentUser?.email;
                const isAdmin = currentUser?.app_role === 'admin';
                // Only show relationship breakdown if NOT a pure subject (subjects who are also sponsors/admins can see it)
                const canSeeRelationshipBreakdown = !isSubject || isAdmin || isSponsor;

                const hasRelationshipData = surveyResults.sentiment_by_relationship &&
                       (surveyResults.sentiment_by_relationship.manager !== undefined ||
                        surveyResults.sentiment_by_relationship.peer !== undefined ||
                        surveyResults.sentiment_by_relationship.direct_report !== undefined ||
                        surveyResults.sentiment_by_relationship.cross_functional !== undefined);

                return canSeeRelationshipBreakdown && hasRelationshipData;
              })() && (
                <>
                  {/* Privacy Notice Banner */}
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Sponsor/Admin Only Section
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          This sentiment breakdown by relationship type is <strong>not visible to {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'}</strong>.
                          Only survey sponsors and administrators can see this data to maintain reviewer confidentiality.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Sentiment by Relationship Type
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Sentiment scores (0-100%) from each reviewer group based on feedback tone and constructiveness.
                  </p>
                  <div className="space-y-4">
                    {surveyResults.sentiment_by_relationship.manager !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Manager</span>
                          <span className="text-sm font-semibold text-blue-700">
                            {Math.round(surveyResults.sentiment_by_relationship.manager * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${surveyResults.sentiment_by_relationship.manager * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {surveyResults.sentiment_by_relationship.peer !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Peers</span>
                          <span className="text-sm font-semibold text-green-700">
                            {Math.round(surveyResults.sentiment_by_relationship.peer * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${surveyResults.sentiment_by_relationship.peer * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {surveyResults.sentiment_by_relationship.direct_report !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Direct Reports</span>
                          <span className="text-sm font-semibold text-purple-700">
                            {Math.round(surveyResults.sentiment_by_relationship.direct_report * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${surveyResults.sentiment_by_relationship.direct_report * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {surveyResults.sentiment_by_relationship.cross_functional !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Cross-Functional</span>
                          <span className="text-sm font-semibold text-amber-700">
                            {Math.round(surveyResults.sentiment_by_relationship.cross_functional * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-amber-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${surveyResults.sentiment_by_relationship.cross_functional * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </>
              )}

              {/* Consensus & Outliers Tab - Sponsor/Admin Only */}
              {activeReportTab === 'consensus' && (surveyResults.consensus_areas?.length > 0 || surveyResults.outlier_opinions?.length > 0) && (
                <>
                  {/* Privacy Notice Banner */}
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Sponsor/Admin Only Section
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          This consensus and outlier analysis is <strong>not visible to {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'}</strong>.
                          Only survey sponsors and administrators can see this data to maintain reviewer confidentiality.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveyResults.consensus_areas && surveyResults.consensus_areas.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          Strong Consensus
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {surveyResults.consensus_areas.map((area: string, idx: number) => (
                            <li key={idx} className="text-gray-700">• {area}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {surveyResults.outlier_opinions && surveyResults.outlier_opinions.length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          Unique Perspectives
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {surveyResults.outlier_opinions.map((opinion: string, idx: number) => (
                            <li key={idx} className="text-gray-700">• {opinion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Narrative Tab - Final tab for generating one-page summary */}
              {activeReportTab === 'narrative' && (
                <div className="space-y-6">
                  {/* Warning if narrative is outdated */}
                  {narrativeOutdated && finalNarrative && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-800 mb-1">Narrative Outdated</h4>
                          <p className="text-sm text-amber-700">
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
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-8">
                        <div className="mb-6">
                          <h4 className="text-xl font-semibold text-gray-900">Final Narrative</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            This one-page narrative will be the first page of the final 360 report that{' '}
                            {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'} sees.
                          </p>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {finalNarrative.replace(/^\*\*360-Degree Feedback Report:.*?\*\*\s*/i, '').trim()}
                          </p>
                        </div>
                      </div>

                      {/* Regenerate button */}
                      {(isSponsor || isAdmin) && selectedSurvey.status === 'completed' && (
                        <div className="flex justify-center">
                          <button
                            onClick={generateNarrative}
                            disabled={isGeneratingNarrative}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">No Narrative Generated Yet</h4>
                      <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                        Generate a comprehensive one-page narrative that synthesizes all the feedback and insights from this 360 review.
                        This narrative will be the first page of the final report that{' '}
                        {selectedSurvey.employee?.name?.split(' ')[0] || 'the subject'} sees.
                      </p>

                      {(isSponsor || isAdmin) && selectedSurvey.status === 'completed' && (
                        <button
                          onClick={generateNarrative}
                          disabled={isGeneratingNarrative}
                          className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <p className="text-sm text-gray-500 mt-4">
                          Only the survey sponsor or an admin can generate the narrative.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Footer - Anchored at bottom */}
            <div className="border-t border-gray-200 bg-white p-6">
              {/* Admin viewing flagged survey - special controls */}
              {currentUser?.app_role === 'admin' && (selectedSurvey.flagged_for_admin || selectedSurvey.flagged_for_reanalysis) ? (
                <div className="space-y-4">
                  {/* Top row: Admin tools */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => loadRawSurveyData(selectedSurvey.id)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        View Raw Data
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => reanalyzeSurvey(selectedSurvey.id, 'standard')}
                          disabled={isGeneratingAnalysis}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {isGeneratingAnalysis ? 'Analyzing...' : 'Reanalyze'}
                        </button>
                        <button
                          onClick={() => reanalyzeSurvey(selectedSurvey.id, 'softer')}
                          disabled={isGeneratingAnalysis}
                          className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors font-medium flex items-center disabled:opacity-50"
                        >
                          Reanalyze (Softer Tone)
                        </button>
                        <button
                          onClick={() => resolveNeedsReview(selectedSurvey.id)}
                          className="px-4 py-2 bg-green-100 text-green-700 border border-green-300 rounded-lg hover:bg-green-200 transition-colors font-medium flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Resolve Review
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Bottom row: Standard actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => sendBackward(selectedSurvey.id)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Send Backward
                    </button>
                    <div className="flex items-center gap-3">
                      {selectedSurvey.status === 'completed' && currentUser?.app_role === 'admin' && (
                        <button
                          onClick={() => sendToHRForReanalysis(selectedSurvey.id)}
                          disabled={!!selectedSurvey.flagged_for_reanalysis}
                          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                            selectedSurvey.flagged_for_reanalysis
                              ? 'bg-green-600 text-white cursor-not-allowed opacity-75'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {selectedSurvey.flagged_for_reanalysis ? 'Sent to HR' : 'Send to HR for Reanalysis'}
                        </button>
                      )}
                      <button
                        onClick={() => setIsResultsModalOpen(false)}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Close
                      </button>
                      {selectedSurvey.status !== 'finalized' && (
                        <button
                          onClick={() => finalizeSurvey(selectedSurvey.id)}
                          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center"
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-2" />
                          Finalize
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Normal footer for non-admin or non-flagged surveys */
                <div className="flex items-center justify-between">
                  {/* Send Backward - Only visible to sponsor or admin */}
                  {(currentUser?.app_role === 'admin' || selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email) && (
                    <button
                      onClick={() => sendBackward(selectedSurvey.id)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Send Backward
                    </button>
                  )}

                  <div className={`flex items-center gap-3 ${!(currentUser?.app_role === 'admin' || selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email) ? 'ml-auto' : ''}`}>
                    {/* Workflow controls - Only visible to sponsor or admin */}
                    {(currentUser?.app_role === 'admin' || selectedSurvey.created_by === currentUser?.id || selectedSurvey.created_by === currentUser?.email) && (
                      <>
                        {selectedSurvey.status === 'completed' && (
                          <button
                            onClick={() => sendToHRForReanalysis(selectedSurvey.id)}
                            disabled={!!selectedSurvey.flagged_for_reanalysis}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                              selectedSurvey.flagged_for_reanalysis
                                ? 'bg-green-600 text-white cursor-not-allowed opacity-75'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {selectedSurvey.flagged_for_reanalysis ? 'Sent to HR' : 'Send to HR for Reanalysis'}
                          </button>
                        )}
                        {selectedSurvey.status !== 'finalized' && (
                          <button
                            onClick={() => finalizeSurvey(selectedSurvey.id)}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center"
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
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
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
              <div className="bg-gray-50 rounded-lg p-4">
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
                    <div key={reviewer.id} className="bg-white border border-gray-200 rounded-lg p-3">
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
                        <div key={email} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
            <div className="border-t border-gray-200 bg-white p-6">
              <button
                onClick={() => {
                  setShowRawData(false);
                  setRawSurveyData(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
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
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Minimum Completion Not Met</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedSurvey.completed_count}/{selectedSurvey.reviewers_count} reviewers completed ({Math.round((selectedSurvey.completed_count ?? 0) / (selectedSurvey.reviewers_count ?? 1) * 100)}%)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-gray-700 font-medium mb-2">70% completion required</p>
                <p className="text-sm text-gray-600">
                  A minimum of 70% of reviewers must complete their feedback before the review can be closed. You currently have {Math.round((selectedSurvey.completed_count ?? 0) / (selectedSurvey.reviewers_count ?? 1) * 100)}% completion.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={() => setShowIncompleteWarning(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => completeSurveyWithAI(true)}
                disabled={isGeneratingAnalysis}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingAnalysis ? 'Generating...' : 'Proceed & Generate Analysis'}
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
