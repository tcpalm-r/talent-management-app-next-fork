import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Send, CheckCircle, Clock, Users, X, AlertTriangle, Sparkles, ChevronLeft, ArrowDownCircle, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Employee, Department } from '../types';
import Survey360Wizard from './Survey360Wizard';
import { useToast } from './unified';
import { exportReportAsPDF } from '../lib/exportReport';

interface Feedback360DashboardProps {
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  currentUserName: string;
  currentUser?: Employee; // Current logged-in user for role-based filtering
}

interface Survey {
  id: string;
  survey_name: string;
  status: string;
  due_date: string | null;
  created_at: string;
  employee_id: string;
  employee?: Employee;
  reviewers_count?: number;
  completed_count?: number;
  created_by?: string;
  reviewers?: any[];
}

interface Reviewer {
  id: string;
  reviewer_name: string;
  reviewer_email: string;
  relationship: string;
  status: string;
  email_sent_at?: string;
}

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'in_progress' | 'completed' | 'needs_review' | 'finalized'>('all');
  const [preselectedEmployee, setPreselectedEmployee] = useState<Employee | undefined>(undefined);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [surveyReviewers, setSurveyReviewers] = useState<Reviewer[]>([]);
  const [isAddingReviewer, setIsAddingReviewer] = useState(false);
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [newReviewerRelationship, setNewReviewerRelationship] = useState('peer');
  const [remindedReviewers, setRemindedReviewers] = useState<Set<string>>(new Set());
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [surveyResults, setSurveyResults] = useState<any>(null);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [rawSurveyData, setRawSurveyData] = useState<any>(null);

  useEffect(() => {
    loadSurveys();
  }, [organizationId, currentUser?.id]);

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
      const response = await fetch(`/api/360-generate-report?survey_id=${survey.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load report');
      }

      setSelectedSurvey(survey);
      setSurveyResults(data.report);
      setIsResultsModalOpen(true);
      markSurveyAsViewed(survey.id);
    } catch (error: any) {
      console.error('Error loading survey results:', error);
      notify({
        title: 'Error',
        description: error.message || 'Failed to load review results',
        variant: 'error',
      });
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback_360_surveys')
        .select(`
          *,
          reviewers:feedback_360_survey_reviewers(id, status, reviewer_email, access_token)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance surveys with employee data and reviewer counts
      let enhancedSurveys = data?.map((survey: any) => {
        const employee = employees.find(e => e.id === survey.employee_id);
        const reviewers = survey.reviewers || [];
        return {
          ...survey,
          employee,
          reviewers_count: reviewers.length,
          completed_count: reviewers.filter((r: any) => r.status === 'completed').length
        };
      }) || [];

      // Filter surveys based on user role
      if (currentUser) {
        const userRole = currentUser.role || 'user';

        if (userRole === 'admin') {
          // Admin can see all surveys
          // No filtering needed
        } else if (userRole === 'leader') {
          // Leaders can see:
          // 1. Surveys they created
          // 2. Surveys where they are the subject (employee_id matches)
          // 3. Surveys where they are a reviewer
          // 4. Surveys for their direct reports
          const directReportIds = employees
            .filter(e => e.reports_to_id === currentUser.id)
            .map(e => e.id);

          enhancedSurveys = enhancedSurveys.filter((survey: any) => {
            // Survey created by the leader (must match exactly)
            const isCreator = survey.created_by && (
              survey.created_by === currentUser.id ||
              survey.created_by === currentUser.email
            );
            if (isCreator) return true;

            // Survey about the leader themselves
            if (survey.employee_id && survey.employee_id === currentUser.id) return true;

            // Survey where leader is a reviewer
            const isReviewer = currentUser.email && survey.reviewers?.some((r: any) =>
              r.reviewer_email && r.reviewer_email.toLowerCase() === currentUser.email.toLowerCase()
            );
            if (isReviewer) return true;

            // Survey about a direct report
            if (survey.employee_id && directReportIds.includes(survey.employee_id)) return true;

            return false;
          });
        } else {
          // Regular users can see ONLY:
          // 1. Surveys they created
          // 2. Surveys where they are the subject (employee_id matches)
          // 3. Surveys where they are a reviewer
          enhancedSurveys = enhancedSurveys.filter((survey: any) => {
            // Survey created by the user (must match exactly)
            const isCreator = survey.created_by && (
              survey.created_by === currentUser.id ||
              survey.created_by === currentUser.email
            );
            if (isCreator) return true;

            // Survey about the user themselves
            const isReviewee = survey.employee_id && survey.employee_id === currentUser.id;
            if (isReviewee) return true;

            // Survey where user is a reviewer (check email match)
            const isReviewer = currentUser.email && survey.reviewers?.some((r: any) =>
              r.reviewer_email && r.reviewer_email.toLowerCase() === currentUser.email.toLowerCase()
            );
            if (isReviewer) return true;

            // If none of the above, explicitly exclude
            return false;
          });
        }
      } else {
        // If no currentUser, show nothing for safety
        enhancedSurveys = [];
      }

      setSurveys(enhancedSurveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminders = async (surveyId: string) => {
    try {
      // Get incomplete reviewers
      const { data: reviewers, error } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('survey_id', surveyId)
        .neq('status', 'completed');

      if (error) throw error;

      // Send reminder emails to all incomplete reviewers
      const emailPromises = (reviewers || []).map(async (reviewer) => {
        try {
          await fetch('/api/send-survey-invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surveyId,
              reviewerId: reviewer.id,
              isReminder: true,
            }),
          });
        } catch (error) {
          console.error(`Failed to send reminder to ${reviewer.reviewer_email}:`, error);
        }
      });

      await Promise.allSettled(emailPromises);

      notify({
        title: 'Reminders sent',
        description: `Reminder emails sent to ${reviewers?.length || 0} reviewers.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error sending reminders:', error);
      notify({
        title: 'Error',
        description: 'Failed to send reminders',
        variant: 'error',
      });
    }
  };

  const sendReminderToReviewer = async (reviewerId: string, reviewerEmail: string) => {
    if (!selectedSurvey) return;

    try {
      await fetch('/api/send-survey-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: selectedSurvey.id,
          reviewerId,
          isReminder: true,
        }),
      });

      // Add to reminded set
      setRemindedReviewers(prev => new Set(prev).add(reviewerId));

      notify({
        title: 'Reminder sent',
        description: `Reminder email sent to ${reviewerEmail}`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error sending reminder:', error);
      notify({
        title: 'Error',
        description: 'Failed to send reminder',
        variant: 'error',
      });
    }
  };

  const completeSurveyWithAI = async () => {
    if (!selectedSurvey) return;

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
      setIsResultsModalOpen(true);

      // Reload surveys to update status
      await loadSurveys();

      notify({
        title: 'Success',
        description: 'AI analysis generated successfully',
        variant: 'success',
      });
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
    try {
      // Update survey status to finalized
      const { error } = await supabase
        .from('feedback_360_surveys')
        .update({ status: 'finalized' })
        .eq('id', surveyId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      notify({
        title: 'Review finalized',
        description: 'The review has been finalized and archived.',
        variant: 'success',
      });

      setIsResultsModalOpen(false);
      loadSurveys();
    } catch (error) {
      console.error('Error finalizing survey:', error);
      notify({
        title: 'Error',
        description: 'Failed to finalize review',
        variant: 'error',
      });
    }
  };

  const sendToHR = async (surveyId: string) => {
    try {
      // Flag the survey for admin review and keep status as completed
      const { error } = await supabase
        .from('feedback_360_surveys')
        .update({ flagged_for_admin: true })
        .eq('id', surveyId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      notify({
        title: 'Flagged for Admin Review',
        description: 'This review has been flagged for admin attention.',
        variant: 'success',
      });

      setIsResultsModalOpen(false);
      loadSurveys();
    } catch (error) {
      console.error('Error flagging for admin:', error);
      notify({
        title: 'Error',
        description: 'Failed to flag review for admin',
        variant: 'error',
      });
    }
  };

  const loadRawSurveyData = async (surveyId: string) => {
    try {
      // Fetch survey data
      const { data: survey, error: surveyError } = await supabase
        .from('feedback_360_surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // Fetch employee data separately
      const { data: employee } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, title')
        .eq('id', survey.employee_id)
        .single();

      // Fetch reviewers separately
      const { data: reviewers } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('id, reviewer_name, reviewer_email, relationship, status')
        .eq('survey_id', surveyId);

      // Fetch survey questions separately
      const { data: surveyQuestions } = await supabase
        .from('feedback_360_survey_questions')
        .select('id, question_id, question_text')
        .eq('survey_id', surveyId)
        .order('question_order');

      // Fetch question details for each survey question
      const questionIds = (surveyQuestions || []).map((q: any) => q.question_id);
      const { data: questionDetails } = questionIds.length > 0
        ? await supabase
            .from('feedback_360_questions')
            .select('id, question, category')
            .in('id', questionIds)
        : { data: [] };

      // Fetch responses separately
      const { data: responses } = await supabase
        .from('feedback_360_responses')
        .select('id, reviewer_email, question_id, response_text, rating')
        .eq('survey_id', surveyId);

      // Combine the data
      const rawData = {
        ...survey,
        employee: employee || null,
        reviewers: reviewers || [],
        questions: (surveyQuestions || []).map((sq: any) => ({
          ...sq,
          question: (questionDetails || []).find((qd: any) => qd.id === sq.question_id),
        })),
        responses: (responses || []).map((r: any) => ({
          ...r,
          reviewer: (reviewers || []).find((rev: any) => rev.reviewer_email === r.reviewer_email),
        })),
      };

      setRawSurveyData(rawData);
      setShowRawData(true);
    } catch (error) {
      console.error('Error loading raw survey data:', error);
      notify({
        title: 'Error',
        description: 'Failed to load raw survey data',
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
    let deleteParticipants = false;

    if (status === 'finalized') {
      targetStatus = 'completed';
      confirmMessage = 'Are you sure you want to reopen this finalized review? It will be moved back to Completed status.';
      successMessage = 'The review has been moved back to Completed status.';
    } else if (status === 'completed') {
      targetStatus = 'in_progress';
      confirmMessage = 'Are you sure you want to send this review back to In Progress? This will discard the current AI analysis.';
      successMessage = 'The review has been moved back to In Progress status.';
    } else if (status === 'in_progress') {
      targetStatus = 'draft';
      confirmMessage = 'Are you sure you want to send this review back to Draft? Reviewers who click their survey links will see a message that this survey has been scrapped.';
      successMessage = 'The review has been moved back to Draft status. Survey links will show a cancellation message.';
      deleteParticipants = false;
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
      // If going back to draft, delete all participants first (this breaks their survey links)
      if (deleteParticipants) {
        const { error: deleteError } = await supabase
          .from('feedback_360_reviewers')
          .delete()
          .eq('survey_id', surveyId);

        if (deleteError) {
          console.error('Error deleting participants:', deleteError);
          throw deleteError;
        }
      }

      // Update survey status
      const { error } = await supabase
        .from('feedback_360_surveys')
        .update({ status: targetStatus })
        .eq('id', surveyId);

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      notify({
        title: 'Review sent backward',
        description: successMessage,
        variant: 'success',
      });

      setIsDetailsModalOpen(false);
      loadSurveys();
    } catch (error) {
      console.error('Error sending survey backward:', error);
      notify({
        title: 'Error',
        description: 'Failed to send review backward',
        variant: 'error',
      });
    }
  };

  const loadReviewers = async (surveyId: string) => {
    try {
      const { data, error } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSurveyReviewers(data || []);
    } catch (error) {
      console.error('Error loading reviewers:', error);
    }
  };

  const removeReviewer = async (reviewerId: string) => {
    if (!confirm('Are you sure you want to remove this reviewer?')) return;

    try {
      const { error } = await supabase
        .from('feedback_360_survey_reviewers')
        .delete()
        .eq('id', reviewerId);

      if (error) throw error;

      // Recalculate survey status after removing reviewer
      if (selectedSurvey) {
        const { data: allReviewers } = await supabase
          .from('feedback_360_survey_reviewers')
          .select('status')
          .eq('survey_id', selectedSurvey.id);

        if (allReviewers) {
          const completedCount = allReviewers.filter(r => r.status === 'completed').length;
          const totalCount = allReviewers.length;

          let newStatus = selectedSurvey.status;
          if (totalCount === 0) {
            // No reviewers left - back to draft
            newStatus = 'draft';
          } else if (completedCount > 0) {
            // At least one completed - stays in progress until manual completion
            newStatus = 'in_progress';
          } else {
            // None completed yet
            newStatus = 'in_progress';
          }

          if (newStatus !== selectedSurvey.status) {
            await supabase
              .from('feedback_360_surveys')
              .update({ status: newStatus })
              .eq('id', selectedSurvey.id);
          }
        }
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
    } catch (error) {
      console.error('Error removing reviewer:', error);
      notify({
        title: 'Error',
        description: 'Failed to remove reviewer',
        variant: 'error',
      });
    }
  };

  const addReviewer = async () => {
    if (!newReviewerName || !newReviewerEmail || !selectedSurvey) {
      notify({
        title: 'Missing information',
        description: 'Please provide reviewer name and email.',
        variant: 'error',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('feedback_360_survey_reviewers')
        .insert({
          survey_id: selectedSurvey.id,
          reviewer_name: newReviewerName,
          reviewer_email: newReviewerEmail,
          relationship: newReviewerRelationship,
          status: 'pending',
          access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })
        .select()
        .single();

      if (error) throw error;

      // Send invitation email
      if (data) {
        try {
          await fetch('/api/send-survey-invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surveyId: selectedSurvey.id,
              reviewerId: data.id,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
        }
      }

      // Recalculate survey status after adding reviewer
      const { data: allReviewers } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('status')
        .eq('survey_id', selectedSurvey.id);

      if (allReviewers) {
        const completedCount = allReviewers.filter(r => r.status === 'completed').length;
        const totalCount = allReviewers.length;

        let newStatus = selectedSurvey.status;
        if (completedCount === totalCount && completedCount > 0) {
          // All reviewers completed (but we just added one, so back to in_progress)
          newStatus = 'in_progress';
        } else if (completedCount > 0) {
          // Some completed
          newStatus = 'in_progress';
        } else if (totalCount > 0) {
          // None completed yet, at least one reviewer exists
          newStatus = 'in_progress';
        }

        if (newStatus !== selectedSurvey.status) {
          await supabase
            .from('feedback_360_surveys')
            .update({ status: newStatus })
            .eq('id', selectedSurvey.id);
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
      setNewReviewerRelationship('peer');
      setIsAddingReviewer(false);

      // Refresh data
      loadReviewers(selectedSurvey.id);
      loadSurveys();
    } catch (error) {
      console.error('Error adding reviewer:', error);
      notify({
        title: 'Error',
        description: 'Failed to add reviewer',
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

  const filteredSurveys = filterStatus === 'all'
    ? surveys
    : filterStatus === 'needs_review'
    ? surveys.filter(s => s.flagged_for_admin === true)
    : surveys.filter(s => s.status === filterStatus);

  const stats = {
    draft: surveys.filter(s => s.status === 'draft').length,
    in_progress: surveys.filter(s => s.status === 'in_progress').length,
    completed: surveys.filter(s => s.status === 'completed').length,
    needs_review: surveys.filter(s => s.flagged_for_admin === true).length,
    finalized: surveys.filter(s => s.status === 'finalized').length,
  };

  // Calculate risk flags (below 50% response rate with < 3 days to deadline)
  const atRiskSurveys = surveys.filter(s => {
    if (s.status !== 'in_progress' || !s.due_date || !s.reviewers_count) return false;
    const responseRate = s.reviewers_count > 0 ? (s.completed_count || 0) / s.reviewers_count : 0;
    const daysUntilDue = Math.ceil((new Date(s.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;
  });

  const getStatusBadge = (status: string, flaggedForAdmin?: boolean) => {
    // Show "Needs Review" badge for flagged surveys (admin only)
    if (flaggedForAdmin && currentUser?.role === 'admin') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-100 text-red-700 border-red-300">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Needs Review
        </span>
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
    const Icon = icons[status as keyof typeof icons] || Clock;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        <Icon className="w-3 h-3 mr-1" />
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-7 h-7 mr-2 text-blue-600" />
            Welcome, {currentUser?.name || currentUserName}!
          </h2>
          <p className="text-gray-600 mt-1">Create and manage multi-source feedback reviews</p>
        </div>
        <button
          onClick={() => {
            setPreselectedEmployee(undefined);
            setIsWizardOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Create 360° Review
        </button>
      </div>

      {/* Pipeline Stats with Risk Flags */}
      <div className={`grid gap-4 mt-6 ${
        currentUser?.role === 'admin'
          ? 'grid-cols-3 lg:grid-cols-6'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
      }`}>
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'all' ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('draft')}
          className={`bg-white rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'draft' ? 'border-gray-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('in_progress')}
          className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'in_progress'
              ? 'border-yellow-500 bg-yellow-50'
              : 'bg-white border-yellow-200 hover:bg-yellow-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-yellow-700">In Progress</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.in_progress}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-yellow-400" />
          </div>
          {atRiskSurveys.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <AlertTriangle className="w-3 h-3" />
              <span>{atRiskSurveys.length} at risk</span>
            </div>
          )}
        </button>

        <button
          onClick={() => setFilterStatus('completed')}
          className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
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

        {/* Needs Review - Admin Only */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setFilterStatus('needs_review')}
            className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
              filterStatus === 'needs_review'
                ? 'border-red-500 bg-red-50'
                : 'bg-white border-red-200 hover:bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Needs Review</p>
                <p className="text-2xl font-bold text-red-900">{stats.needs_review}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </button>
        )}

        <button
          onClick={() => setFilterStatus('finalized')}
          className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
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
      </div>

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
              {filterStatus === 'all'
                ? 'No reviews yet'
                : filterStatus === 'draft'
                ? 'No review drafts'
                : filterStatus === 'needs_review'
                ? 'No reviews need admin review'
                : `No reviews ${filterStatus === 'in_progress' ? 'in progress' : filterStatus}`}
            </h3>
            {filterStatus === 'all' && (
              <>
                <p className="text-gray-600 mb-6">
                  Create your first 360° feedback review to gather multi-source feedback
                </p>
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Create First Review
                </button>
              </>
            )}
          </div>

        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {filteredSurveys.map((survey) => {
            // Determine user's relationship to this survey
            const isCreator = survey.created_by === currentUser?.id || survey.created_by === currentUser?.email;
            const isReviewee = survey.employee_id === currentUser?.id;
            const isReviewer = survey.reviewers?.some((r: any) =>
              r.reviewer_email === currentUser?.email
            );

            return (
              <div
                key={survey.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // If it's a completed survey that has been viewed before, go straight to results
                  if (survey.status === 'completed' && hasSurveyBeenViewed(survey.id)) {
                    loadAndShowResults(survey);
                  } else {
                    setSelectedSurvey(survey);
                    setIsDetailsModalOpen(true);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        360° Review - {survey.employee?.name || 'Unknown Employee'}
                      </h3>

                      {/* Relationship badges */}
                      {isCreator && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300 rounded">
                          Creator
                        </span>
                      )}
                      {isReviewee && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 border border-purple-300 rounded">
                          Reviewee
                        </span>
                      )}
                      {isReviewer && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 border border-green-300 rounded">
                          Reviewer
                        </span>
                      )}
                    </div>

                    {/* Complete Review Button for Reviewers */}
                    {isReviewer && (() => {
                      const myReviewerRecord = survey.reviewers?.find((r: any) =>
                        r.reviewer_email === currentUser?.email
                      );
                      const isCompleted = myReviewerRecord?.status === 'completed';

                      return !isCompleted && myReviewerRecord?.access_token ? (
                        <a
                          href={`/survey/complete/${myReviewerRecord.access_token}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg mb-3"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete Individual Review
                        </a>
                      ) : null;
                    })()}

                  <div className="flex items-center text-sm text-gray-600 mb-3">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="font-medium">{survey.employee?.name || 'Unknown Employee'}</span>
                    {survey.employee?.title && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{survey.employee.title}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-500">Reviewers:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {survey.completed_count ?? 0}/{survey.reviewers_count ?? 0}
                      </span>
                      <span className="ml-1 text-gray-500">completed</span>
                    </div>
                    {survey.due_date && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-gray-400" />
                        <span className="text-gray-500">Due: {new Date(survey.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {survey.status === 'active' && (survey.reviewers_count ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">
                          Response Rate: {Math.round(((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100)}%
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
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            ((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) < 0.5 ? 'bg-orange-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${((survey.completed_count ?? 0) / (survey.reviewers_count ?? 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Status badge and actions */}
                <div className="ml-4 flex flex-col items-end gap-2">
                  {/* Status badge */}
                  {getStatusBadge(survey.status, survey.flagged_for_admin)}

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
        }}
        organizationId={organizationId}
        preselectedEmployee={preselectedEmployee}
        onSurveyCreated={() => {
          loadSurveys();
          setIsWizardOpen(false);
          setPreselectedEmployee(undefined);
        }}
        employees={employees}
        currentUser={currentUser}
      />

      {/* Review Details Modal */}
      {isDetailsModalOpen && selectedSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">360° Review</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
                        try {
                          const { error } = await supabase
                            .from('feedback_360_surveys')
                            .delete()
                            .eq('id', selectedSurvey.id);

                          if (error) throw error;

                          notify({
                            title: 'Review deleted',
                            description: 'The review has been permanently deleted.',
                            variant: 'success',
                          });

                          setIsDetailsModalOpen(false);
                          loadSurveys();
                        } catch (error) {
                          console.error('Error deleting survey:', error);
                          notify({
                            title: 'Error',
                            description: 'Failed to delete review',
                            variant: 'error',
                          });
                        }
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Review Overview */}
              <div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
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
                    {getStatusBadge(selectedSurvey.status, selectedSurvey.flagged_for_admin)}
                  </div>
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
                        {new Date(selectedSurvey.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reviewers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Reviewers ({selectedSurvey.completed_count}/{selectedSurvey.reviewers_count} completed)
                  </h4>
                  <button
                    onClick={() => setIsAddingReviewer(!isAddingReviewer)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Reviewer
                  </button>
                </div>

                {isAddingReviewer && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Reviewer name"
                        value={newReviewerName}
                        onChange={(e) => setNewReviewerName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="email"
                        placeholder="Reviewer email"
                        value={newReviewerEmail}
                        onChange={(e) => setNewReviewerEmail(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <select
                      value={newReviewerRelationship}
                      onChange={(e) => setNewReviewerRelationship(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="manager">Manager</option>
                      <option value="peer">Peer</option>
                      <option value="direct_report">Direct Report</option>
                      <option value="cross_functional">Cross-Functional</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={addReviewer}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add & Send Invitation
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingReviewer(false);
                          setNewReviewerName('');
                          setNewReviewerEmail('');
                          setNewReviewerRelationship('peer');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

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
                            {reviewer.reviewer_email} • {reviewer.relationship}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {reviewer.status !== 'completed' && (
                            remindedReviewers.has(reviewer.id) ? (
                              <span className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Reminded
                              </span>
                            ) : (
                              <button
                                onClick={() => sendReminderToReviewer(reviewer.id, reviewer.reviewer_email)}
                                className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors flex items-center gap-1"
                                title="Send reminder email"
                              >
                                <Send className="w-3 h-3" />
                                Remind
                              </button>
                            )
                          )}
                          <button
                            onClick={() => removeReviewer(reviewer.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove reviewer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  {/* Send Backward - Always on left, always grey */}
                  {(selectedSurvey.status === 'in_progress' || selectedSurvey.status === 'completed' || selectedSurvey.status === 'finalized') && (
                    <button
                      onClick={() => sendBackward(selectedSurvey.id, selectedSurvey.status)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Send Backward
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Send Reminders for in_progress when not all completed */}
                  {selectedSurvey.status === 'in_progress' &&
                   (selectedSurvey.completed_count ?? 0) !== (selectedSurvey.reviewers_count ?? 0) && (
                    <button
                      onClick={() => sendReminders(selectedSurvey.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Reminders
                    </button>
                  )}
                  {/* Complete with AI for in_progress when all completed */}
                  {selectedSurvey.status === 'in_progress' &&
                   (selectedSurvey.completed_count ?? 0) === (selectedSurvey.reviewers_count ?? 0) &&
                   (selectedSurvey.reviewers_count ?? 0) > 0 && (
                    <button
                      onClick={completeSurveyWithAI}
                      disabled={isGeneratingAnalysis}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium flex items-center disabled:opacity-50"
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
                  )}
                  {/* View Completed Review for completed status */}
                  {selectedSurvey.status === 'completed' && (
                    <button
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        loadAndShowResults(selectedSurvey);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium flex items-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      View Completed Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Results Modal */}
      {isResultsModalOpen && surveyResults && selectedSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">360° Review Results & AI Analysis</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated by {surveyResults.generated_by || 'Claude AI'} on {new Date(surveyResults.generated_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const reportData = {
                          survey_name: selectedSurvey.survey_name || 'Untitled Survey',
                          employee_name: selectedSurvey.employee?.name || 'Unknown',
                          generated_by: surveyResults.generated_by,
                          generated_at: surveyResults.generated_at,
                          themes: surveyResults.themes,
                          overall_strengths: surveyResults.overall_strengths,
                          development_areas: surveyResults.development_areas,
                          recommendations: surveyResults.recommendations,
                          key_insights: surveyResults.key_insights,
                          sentiment_by_relationship: surveyResults.sentiment_by_relationship,
                          consensus_areas: surveyResults.consensus_areas,
                          outlier_opinions: surveyResults.outlier_opinions
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
                  <button
                    onClick={() => setIsResultsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Review Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedSurvey.survey_name}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Employee:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSurvey.employee?.name || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Reviewers:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {selectedSurvey.completed_count} of {selectedSurvey.reviewers_count} completed
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Themes */}
              {surveyResults.themes && surveyResults.themes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Key Themes</h4>
                  </div>
                  <div className="space-y-3">
                    {surveyResults.themes.map((theme: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {surveyResults.overall_strengths && surveyResults.overall_strengths.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Key Strengths
                  </h4>
                  <ul className="space-y-2">
                    {surveyResults.overall_strengths.map((strength: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Development Areas */}
              {surveyResults.development_areas && surveyResults.development_areas.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Development Areas
                  </h4>
                  <ul className="space-y-2">
                    {surveyResults.development_areas.map((area: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span className="text-gray-700">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {surveyResults.recommendations && surveyResults.recommendations.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Recommended Actions
                  </h4>
                  <ul className="space-y-2">
                    {surveyResults.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">{idx + 1}.</span>
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Insights */}
              {surveyResults.key_insights && surveyResults.key_insights.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    Key Insights
                  </h4>
                  <ul className="space-y-2">
                    {surveyResults.key_insights.map((insight: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-600 mt-1">💡</span>
                        <span className="text-gray-700">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sentiment by Relationship */}
              {surveyResults.sentiment_by_relationship && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Sentiment by Relationship</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const validRelationships = ['manager', 'peer', 'direct_report', 'cross_functional'];
                      const relationshipLabels: Record<string, string> = {
                        manager: 'Manager',
                        peer: 'Peer',
                        direct_report: 'Direct Report',
                        cross_functional: 'Cross-Functional'
                      };

                      return validRelationships.map((relationship) => {
                        const score = surveyResults.sentiment_by_relationship[relationship];
                        const hasReviewers = score !== undefined && score !== null;

                        return (
                          <div key={relationship} className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-600 mb-1">{relationshipLabels[relationship]}</p>
                            {hasReviewers ? (
                              <>
                                <p className="text-2xl font-bold text-gray-900">{(score * 100).toFixed(0)}%</p>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                                    style={{ width: `${score * 100}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-gray-500 mt-2">No reviewers</p>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2"></div>
                              </>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Consensus & Outliers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {surveyResults.consensus_areas && surveyResults.consensus_areas.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
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
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
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
            </div>

            {/* Actions Footer - Anchored at bottom */}
            <div className="border-t border-gray-200 bg-white p-6">
              {/* Admin viewing flagged survey - special controls */}
              {currentUser?.role === 'admin' && selectedSurvey.flagged_for_admin ? (
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
                      </div>
                    </div>
                  </div>
                  {/* Bottom row: Standard actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => sendBackward(selectedSurvey.id, 'completed')}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Send Backward
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsResultsModalOpen(false)}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => finalizeSurvey(selectedSurvey.id)}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Finalize
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Normal footer for non-admin or non-flagged surveys */
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => sendBackward(selectedSurvey.id, 'completed')}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Send Backward
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsResultsModalOpen(false)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => sendToHR(selectedSurvey.id)}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send to HR for Review
                    </button>
                    <button
                      onClick={() => finalizeSurvey(selectedSurvey.id)}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Finalize
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                            {reviewer.relationship}
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

              {/* Raw Responses */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">All Responses</h3>
                <div className="space-y-4">
                  {rawSurveyData.responses?.map((response: any) => (
                    <div key={response.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {response.reviewer?.reviewer_name || 'Anonymous'}
                          </p>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {response.reviewer?.relationship || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 mb-1">Question:</p>
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {rawSurveyData.questions?.find((q: any) => q.id === response.question_id)?.question_text || 'Question not found'}
                        </p>
                        <p className="text-sm text-gray-600 mb-1">Response:</p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                          {response.response_text}
                        </p>
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}
