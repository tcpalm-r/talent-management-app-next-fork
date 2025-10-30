import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  User,
  CheckSquare,
  Users,
  Calendar,
  Shield,
  Eye,
  Send,
  Sparkles,
  Search,
  Trash2,
} from 'lucide-react';
import type { Employee, Survey360, ParticipantRelationship } from '../types';
import { useToast } from './unified';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import {
  QUESTION_LIBRARY,
  DEFAULT_QUESTION_IDS,
  getQuestionById,
  getQuestionsByCategory,
} from '../lib/feedback360QuestionBank';
import CreateWithAIModal, { type ParsedSurveyData } from './CreateWithAIModal';

interface Survey360WizardProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  preselectedEmployee?: Employee;
  preselectedEmployees?: Employee[]; // Batch mode
  onSurveyCreated: () => void;
  employees: Employee[];
  currentUser?: Employee; // Current logged-in user for tracking who created the survey
  draftSurvey?: any; // Optional: Draft survey to edit
}

type WizardStep = 'who' | 'competencies' | 'raters' | 'timeline' | 'preview';

interface Rater {
  name: string;
  email: string;
  relationship: ParticipantRelationship;
}

const SURVEY_TEMPLATES = [
  {
    id: 'new-hire-60',
    name: 'New Hire 60-Day Check-in',
    description: '6 questions focused on onboarding experience and early integration',
    questionIds: DEFAULT_QUESTION_IDS.slice(0, 6),
    suggestedRaters: { manager: 1, peer: 2, cross_functional: 1 },
  },
  {
    id: 'role-change',
    name: 'Role Change Assessment',
    description: '8 questions covering transition effectiveness and skill fit',
    questionIds: DEFAULT_QUESTION_IDS.slice(0, 8),
    suggestedRaters: { manager: 1, peer: 3, direct_report: 1 },
  },
  {
    id: 'performance-support',
    name: 'Performance Review Support',
    description: '10 comprehensive questions for annual review insights',
    questionIds: DEFAULT_QUESTION_IDS,
    suggestedRaters: { manager: 1, peer: 3, direct_report: 2, cross_functional: 1 },
  },
];

export default function Survey360Wizard({
  isOpen,
  onClose,
  organizationId,
  preselectedEmployee,
  preselectedEmployees,
  onSurveyCreated,
  employees,
  currentUser,
  draftSurvey,
}: Survey360WizardProps) {
  const { notify } = useToast();
  const isBatchMode = !!preselectedEmployees && preselectedEmployees.length > 0;
  const initialStep: WizardStep = draftSurvey
    ? 'preview'
    : (isBatchMode || preselectedEmployee)
      ? 'competencies'
      : 'who';

  console.log('Survey360Wizard initialized:', {
    preselectedEmployee,
    isBatchMode,
    initialStep,
    draftSurvey: !!draftSurvey
  });

  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(preselectedEmployee);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [shouldAutoLaunch, setShouldAutoLaunch] = useState(false);

  // Required questions (admin-only editable)
  const [requiredQuestions, setRequiredQuestions] = useState<string[]>([
    "What are this employee's key strengths?",
    'What areas could this employee improve?',
    'How effectively does this employee collaborate with others?'
  ]);

  // Custom questions (any creator can add)
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newCustomQuestion, setNewCustomQuestion] = useState('');

  const [raters, setRaters] = useState<Rater[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [raterSearch, setRaterSearch] = useState('');
  const [showRaterPicker, setShowRaterPicker] = useState<number | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const steps: WizardStep[] = ['who', 'competencies', 'raters', 'timeline', 'preview'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Reset wizard state
  const resetWizard = () => {
    const resetStep: WizardStep = draftSurvey ? 'preview' : (isBatchMode || preselectedEmployee) ? 'competencies' : 'who';
    console.log('resetWizard called, setting step to:', resetStep);
    setCurrentStep(resetStep);
    setSelectedEmployee(preselectedEmployee);
    setSelectedTemplate(null);
    // Don't reset requiredQuestions - they are loaded from API and should persist
    setCustomQuestions([]);
    setNewCustomQuestion('');
    setRaters([]);
    setDueDate('');
    setIsAnonymous(true);
    setSurveyTitle('');
    setEmployeeSearch('');
    setRaterSearch('');
    setShowRaterPicker(null);
  };

  // Handle AI modal completion
  const handleAIModalComplete = (data: ParsedSurveyData) => {
    console.log('[Survey360Wizard.handleAIModalComplete] Called with data:', data);

    // Find employee by name if the AI-parsed name differs from current selection
    if (data.employeeName) {
      console.log('[Survey360Wizard.handleAIModalComplete] Looking for employee:', data.employeeName);
      const matchedEmployee = employees.find(
        emp => emp.name.toLowerCase() === data.employeeName.toLowerCase()
      );
      if (matchedEmployee) {
        console.log('[Survey360Wizard.handleAIModalComplete] Found matching employee:', matchedEmployee);
        setSelectedEmployee(matchedEmployee);
      } else {
        console.log('[Survey360Wizard.handleAIModalComplete] No matching employee found');
      }
    }

    // Apply questions - combine with existing required questions if user hasn't changed them
    // or replace if AI provided custom questions
    if (data.questions && data.questions.length > 0) {
      console.log('[Survey360Wizard.handleAIModalComplete] Setting custom questions:', data.questions);
      setCustomQuestions(data.questions);
    }

    // Apply raters
    if (data.raters && data.raters.length > 0) {
      console.log('[Survey360Wizard.handleAIModalComplete] Setting raters:', data.raters);
      setRaters(data.raters);
    }

    // Apply due date
    if (data.dueDate) {
      console.log('[Survey360Wizard.handleAIModalComplete] Setting due date:', data.dueDate);
      setDueDate(data.dueDate);
    }

    // Apply survey title if provided
    if (data.surveyTitle) {
      console.log('[Survey360Wizard.handleAIModalComplete] Setting survey title:', data.surveyTitle);
      setSurveyTitle(data.surveyTitle);
    }

    // Move to preview step and flag for auto-launch
    console.log('[Survey360Wizard.handleAIModalComplete] Moving to preview step and setting auto-launch flag');
    setCurrentStep('preview');
    setShouldAutoLaunch(true);

    // Close AI modal
    setIsAIModalOpen(false);
    console.log('[Survey360Wizard.handleAIModalComplete] Closed AI modal');
  };

  // Load default questions from API
  useEffect(() => {
    const loadDefaultQuestions = async () => {
      try {
        const response = await fetch('/api/360-default-questions');
        if (response.ok) {
          const data = await response.json();
          // Load the 3 default questions
          // Use customQuestions if allQuestions is not available
          const questionBank = data.allQuestions || [];
          const customQuestions = data.customQuestions || {};

          const defaultQuestionTexts = data.defaultQuestionIds
            .map((id: string) => {
              // Try to find in question bank first
              const question = questionBank.find((q: any) => q.id === id);
              if (question?.question) return question.question;

              // Otherwise check custom questions
              if (customQuestions[id]) return customQuestions[id];

              return '';
            })
            .filter((q: string) => q.trim().length > 0)
            .slice(0, 3);

          if (defaultQuestionTexts.length === 3) {
            setRequiredQuestions(defaultQuestionTexts);
          }
        }
      } catch (error) {
        console.error('Error loading default questions:', error);
      }
    };

    loadDefaultQuestions();
  }, []);

  // Reset wizard state when opened (but not if editing a draft)
  useEffect(() => {
    if (isOpen && !draftSurvey) {
      resetWizard();
    }
  }, [isOpen, draftSurvey]);

  // Load draft survey data when editing an existing draft
  useEffect(() => {
    const loadDraftSurveyData = async () => {
      if (!isOpen || !draftSurvey) return;

      try {
        // Set the employee
        const employee = employees.find(e => e.id === draftSurvey.employee_id);
        if (employee) {
          setSelectedEmployee(employee);
        }

        // Load survey questions
        const { data: surveyQuestions } = await supabase
          .from('feedback_360_survey_questions')
          .select('*, feedback_360_questions(question_text, category)')
          .eq('survey_id', draftSurvey.id)
          .order('question_order', { ascending: true });

        if (surveyQuestions && surveyQuestions.length > 0) {
          const allQuestions: string[] = surveyQuestions
            .map((sq: any) => sq.feedback_360_questions?.question_text || '')
            .filter((text: string) => text.trim().length > 0);

          if (allQuestions.length > 0) {
            // First 3 questions are required, rest are custom
            const required = allQuestions.slice(0, 3);
            const custom = allQuestions.slice(3);

            if (required.length > 0) {
              setRequiredQuestions(required);
            }
            if (custom.length > 0) {
              setCustomQuestions(custom);
            }
          }
        }

        // Load reviewers
        const { data: reviewers } = await supabase
          .from('feedback_360_survey_reviewers')
          .select('*')
          .eq('survey_id', draftSurvey.id);

        if (reviewers) {
          setRaters(reviewers.map((r: any) => ({
            name: r.reviewer_name,
            email: r.reviewer_email,
            relationship: r.relationship,
          })));
        }

        // Set other fields
        setSurveyTitle(draftSurvey.survey_name || '');
        if (draftSurvey.due_date) {
          // Format date to yyyy-MM-dd for the input field
          const dateObj = new Date(draftSurvey.due_date);
          const formattedDate = dateObj.toISOString().split('T')[0];
          setDueDate(formattedDate);
        }
        setIsAnonymous(draftSurvey.is_anonymous !== false);

        // Note: currentStep is already set to 'preview' in useState initialization
        // No need to set it here - the useEffect for loadDraftSurveyData loads the data
        // and the preview step will display it
      } catch (error) {
        console.error('Error loading draft survey data:', error);
      }
    };

    loadDraftSurveyData();
  }, [isOpen, draftSurvey, employees]);

  // Auto-launch survey when AI modal completes
  useEffect(() => {
    if (shouldAutoLaunch && currentStep === 'preview' && selectedEmployee) {
      // Small delay to ensure state updates are complete
      const timer = setTimeout(() => {
        // Trigger the launch by calling handleCreateSurveys directly
        // This is a workaround to auto-launch after AI modal completes
        const launchBtn = document.querySelector('[data-launch-button]') as HTMLButtonElement;
        if (launchBtn) {
          launchBtn.click();
        }
        setShouldAutoLaunch(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoLaunch, currentStep, selectedEmployee]);

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.title?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.email?.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // Filter employees for rater selection
  const filteredRaterEmployees = employees.filter(emp => {
    // Don't show the selected employee as a rater option
    if (selectedEmployee && emp.id === selectedEmployee.id) return false;
    // Apply search filter
    if (raterSearch) {
      return emp.name.toLowerCase().includes(raterSearch.toLowerCase()) ||
             emp.title?.toLowerCase().includes(raterSearch.toLowerCase()) ||
             emp.email?.toLowerCase().includes(raterSearch.toLowerCase());
    }
    return true;
  });

  const selectEmployeeAsRater = (employee: Employee, index: number) => {
    const updated = [...raters];
    updated[index].name = employee.name;
    updated[index].email = employee.email || '';
    setRaters(updated);
    setShowRaterPicker(null);
    setRaterSearch('');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'who':
        return isBatchMode || !!selectedEmployee;
      case 'competencies':
        return requiredQuestions.length === 3 && requiredQuestions.every(q => q.trim().length > 0);
      case 'raters':
        return raters.length >= 1;
      case 'timeline':
        return !!dueDate;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  const handleClose = async () => {
    // Skip auto-save if we're editing an existing draft (user will click "Launch" to save changes)
    if (draftSurvey) {
      onClose();
      return;
    }

    // Only save draft if there's meaningful progress and we're not on the last step
    const hasProgress = selectedEmployee && currentStepIndex < steps.length - 1;

    if (hasProgress) {
      try {
        // Create draft survey
        const { data: survey, error: surveyError } = await supabase
          .from('feedback_360_surveys')
          .insert({
            employee_id: selectedEmployee.id,
            survey_name: surveyTitle || `360° Feedback - ${selectedEmployee.name}`,
            status: 'draft',
            due_date: dueDate || null,
            created_by: currentUser?.id || currentUser?.email || 'unknown',
          })
          .select()
          .single();

        if (surveyError) throw surveyError;

        // Save questions if any are filled
        const allQuestions = [...requiredQuestions.filter(q => q.trim()), ...customQuestions];
        if (allQuestions.length > 0) {
          const questionUUIDs: string[] = [];

          for (const questionText of allQuestions) {
            let { data: existingQuestion } = await supabase
              .from('feedback_360_questions')
              .select('id')
              .eq('question_text', questionText)
              .single();

            if (!existingQuestion) {
              const { data: newQuestion } = await supabase
                .from('feedback_360_questions')
                .insert({
                  question_text: questionText,
                  category: 'general',
                  is_default: false,
                  is_active: true,
                })
                .select('id')
                .single();

              if (newQuestion) questionUUIDs.push(newQuestion.id);
            } else {
              questionUUIDs.push(existingQuestion.id);
            }
          }

          if (questionUUIDs.length > 0) {
            const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
              survey_id: survey.id,
              question_id: questionUUID,
              question_order: index,
            }));

            await supabase
              .from('feedback_360_survey_questions')
              .insert(questionsToInsert);
          }
        }

        // Save raters if any are added
        const validRaters = raters.filter(r => r.name && r.email);
        if (validRaters.length > 0) {
          const reviewersToInsert = validRaters.map(r => ({
            survey_id: survey.id,
            reviewer_name: r.name,
            reviewer_email: r.email,
            relationship: r.relationship,
            status: 'pending',
            access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          }));

          await supabase
            .from('feedback_360_survey_reviewers')
            .insert(reviewersToInsert);
        }

        notify({
          title: 'Draft saved',
          description: 'Your review has been saved as a draft.',
          variant: 'success',
        });

        // Refresh the survey list to show the new draft
        onSurveyCreated();
      } catch (error) {
        console.error('Error saving draft:', error);
        // Don't show error notification, just close silently
      }
    }

    onClose();
  };

  const handleDeleteDraft = async () => {
    if (!draftSurvey) return;

    if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete survey questions
      await supabase
        .from('feedback_360_survey_questions')
        .delete()
        .eq('survey_id', draftSurvey.id);

      // Delete survey reviewers
      await supabase
        .from('feedback_360_survey_reviewers')
        .delete()
        .eq('survey_id', draftSurvey.id);

      // Delete survey responses if any
      await supabase
        .from('feedback_360_responses')
        .delete()
        .eq('survey_id', draftSurvey.id);

      // Delete the survey itself
      const { error } = await supabase
        .from('feedback_360_surveys')
        .delete()
        .eq('id', draftSurvey.id);

      if (error) throw error;

      notify({
        title: 'Draft deleted',
        description: 'The review draft has been permanently deleted.',
        variant: 'success',
      });

      onSurveyCreated();
      onClose();
    } catch (error) {
      console.error('Error deleting draft:', error);
      notify({
        title: 'Error',
        description: 'Failed to delete the draft.',
        variant: 'error',
      });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = SURVEY_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setSelectedQuestionIds(template.questionIds);
    
    // Auto-add suggested raters
    const newRaters: Rater[] = [];
    Object.entries(template.suggestedRaters).forEach(([relationship, count]) => {
      for (let i = 0; i < count; i++) {
        newRaters.push({
          name: '',
          email: '',
          relationship: relationship as ParticipantRelationship,
        });
      }
    });
    setRaters(newRaters);

    // Set default title
    setSurveyTitle(`${template.name} - ${selectedEmployee?.name}`);
  };

  const handleCreate = async () => {
    const employeesToProcess = isBatchMode ? preselectedEmployees : (selectedEmployee ? [selectedEmployee] : []);
    if (employeesToProcess.length === 0) return;

    setIsCreating(true);
    try {
      let successCount = 0;
      let failCount = 0;

      // If editing a draft, work with just that draft
      if (draftSurvey) {
        try {
          console.log('[DRAFT UPDATE] Starting draft update for survey:', draftSurvey.id);

          // Delete existing questions (but keep reviewers so they can be re-launched)
          console.log('[DRAFT UPDATE] Deleting existing questions...');
          const { error: deleteQuestionsError } = await supabase
            .from('feedback_360_survey_questions')
            .delete()
            .eq('survey_id', draftSurvey.id);

          if (deleteQuestionsError) {
            console.error('[DRAFT UPDATE] Error deleting questions:', deleteQuestionsError);
            throw deleteQuestionsError;
          }
          console.log('[DRAFT UPDATE] Questions deleted successfully');

          // Update survey with new data
          console.log('[DRAFT UPDATE] Updating survey with new data:', { surveyTitle, dueDate });
          const { error: updateError } = await supabase
            .from('feedback_360_surveys')
            .update({
              survey_name: surveyTitle || `360° Feedback - ${selectedEmployee?.name}`,
              due_date: dueDate,
            })
            .eq('id', draftSurvey.id);

          if (updateError) {
            console.error('[DRAFT UPDATE] Error updating survey:', updateError);
            throw updateError;
          }
          console.log('[DRAFT UPDATE] Survey updated successfully');

          // Use the draft survey ID
          const survey = draftSurvey;

          // Combine required and custom questions
          const allQuestions = [...requiredQuestions, ...customQuestions];
          console.log('[DRAFT UPDATE] All questions to add:', allQuestions);
          const questionUUIDs: string[] = [];

          for (const questionText of allQuestions) {
            // Check if question exists, if not create it
            let { data: existingQuestion, error: checkError } = await supabase
              .from('feedback_360_questions')
              .select('id')
              .eq('question_text', questionText)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              // PGRST116 = no rows returned, which is fine
              console.error('[DRAFT UPDATE] Error checking question:', checkError);
              throw checkError;
            }

            if (!existingQuestion) {
              // Create the question
              console.log('[DRAFT UPDATE] Creating new question:', questionText);
              const { data: newQuestion, error: createError } = await supabase
                .from('feedback_360_questions')
                .insert({
                  question_text: questionText,
                  category: 'general',
                  is_default: false,
                  is_active: true,
                })
                .select('id')
                .single();

              if (createError) {
                console.error('[DRAFT UPDATE] Error creating question:', createError);
                throw createError;
              }
              questionUUIDs.push(newQuestion.id);
            } else {
              console.log('[DRAFT UPDATE] Question already exists:', existingQuestion.id);
              questionUUIDs.push(existingQuestion.id);
            }
          }

          console.log('[DRAFT UPDATE] Question UUIDs:', questionUUIDs);

          // Create survey questions with UUIDs
          const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
            survey_id: survey.id,
            question_id: questionUUID,
            question_order: index,
          }));

          if (questionsToInsert.length > 0) {
            console.log('[DRAFT UPDATE] Inserting survey questions:', questionsToInsert);
            const { error: questionsError } = await supabase
              .from('feedback_360_survey_questions')
              .insert(questionsToInsert);

            if (questionsError) {
              console.error('[DRAFT UPDATE] Error inserting survey questions:', questionsError);
              throw questionsError;
            }
            console.log('[DRAFT UPDATE] Survey questions inserted successfully');
          }

          // Delete existing reviewers before inserting new ones
          console.log('[DRAFT UPDATE] Deleting existing reviewers...');
          const { error: deleteReviewersError } = await supabase
            .from('feedback_360_survey_reviewers')
            .delete()
            .eq('survey_id', survey.id);

          if (deleteReviewersError) {
            console.error('[DRAFT UPDATE] Error deleting existing reviewers:', deleteReviewersError);
            throw deleteReviewersError;
          }
          console.log('[DRAFT UPDATE] Existing reviewers deleted successfully');

          // Create reviewers
          const reviewersToInsert = raters
            .filter(r => r.name && r.email)
            .map(r => ({
              survey_id: survey.id,
              reviewer_name: r.name,
              reviewer_email: r.email,
              relationship: r.relationship,
              status: 'pending',
              access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            }));

          console.log('[DRAFT UPDATE] Reviewers to insert:', reviewersToInsert);

          if (reviewersToInsert.length > 0) {
            console.log('[DRAFT UPDATE] Attempting to insert reviewers...');
            const { data: insertedReviewers, error: reviewersError } = await supabase
              .from('feedback_360_survey_reviewers')
              .insert(reviewersToInsert)
              .select();

            if (reviewersError) {
              console.error('[DRAFT UPDATE] ERROR inserting reviewers (409 likely):', {
                error: reviewersError,
                status: reviewersError.status,
                code: reviewersError.code,
                message: reviewersError.message,
                details: reviewersError.details,
              });
              throw reviewersError;
            }
            console.log('[DRAFT UPDATE] Reviewers inserted successfully:', insertedReviewers);

            // Send invitation emails to each reviewer (with delay to avoid rate limiting)
            if (insertedReviewers && insertedReviewers.length > 0) {
              for (let i = 0; i < insertedReviewers.length; i++) {
                const reviewer = insertedReviewers[i];
                try {
                  const response = await fetch('/api/send-survey-invitation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      surveyId: survey.id,
                      reviewerId: reviewer.id,
                    }),
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    console.error(`Failed to send email to ${reviewer.reviewer_email}:`, error);
                  }

                  // Add 600ms delay between emails to respect rate limit (2 per second)
                  if (i < insertedReviewers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                  }
                } catch (error) {
                  console.error(`Error sending email to ${reviewer.reviewer_email}:`, error);
                }
              }

              // Update survey status to 'in_progress' after emails are sent
              await supabase
                .from('feedback_360_surveys')
                .update({ status: 'in_progress' })
                .eq('id', survey.id);
            }
          }

          console.log('[DRAFT UPDATE] Draft survey update completed successfully');
          successCount++;
        } catch (error: any) {
          console.error('[DRAFT UPDATE] FINAL ERROR updating draft survey:', {
            error,
            message: error?.message,
            code: error?.code,
            status: error?.status,
            details: error?.details,
            errorMsg: error?.message,
            toString: error?.toString(),
          });
          failCount++;
        }
      } else {
        // Create new surveys (original logic)
        for (const employee of employeesToProcess) {
          try {
            // Create survey
            const { data: survey, error: surveyError } = await supabase
              .from('feedback_360_surveys')
              .insert({
                employee_id: employee.id,
                survey_name: surveyTitle || `360° Feedback - ${employee.name}`,
                status: 'draft',
                due_date: dueDate,
                created_by: currentUser?.id || currentUser?.email || 'unknown',
              })
              .select()
              .single();

            if (surveyError) throw surveyError;

            // Combine required and custom questions
            const allQuestions = [...requiredQuestions, ...customQuestions];
            const questionUUIDs: string[] = [];

            for (const questionText of allQuestions) {
              // Check if question exists, if not create it
              let { data: existingQuestion, error: checkError } = await supabase
                .from('feedback_360_questions')
                .select('id')
                .eq('question_text', questionText)
                .single();

              if (checkError && checkError.code !== 'PGRST116') {
                // PGRST116 = no rows returned, which is fine
                throw checkError;
              }

              if (!existingQuestion) {
                // Create the question
                const { data: newQuestion, error: createError } = await supabase
                  .from('feedback_360_questions')
                  .insert({
                    question_text: questionText,
                    category: 'general',
                    is_default: false,
                    is_active: true,
                  })
                  .select('id')
                  .single();

                if (createError) throw createError;
                questionUUIDs.push(newQuestion.id);
              } else {
                questionUUIDs.push(existingQuestion.id);
              }
            }

            // Create survey questions with UUIDs
            const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
              survey_id: survey.id,
              question_id: questionUUID,
              question_order: index,
            }));

            if (questionsToInsert.length > 0) {
              const { error: questionsError } = await supabase
                .from('feedback_360_survey_questions')
                .insert(questionsToInsert);

              if (questionsError) throw questionsError;
            }

            // Create reviewers
            const reviewersToInsert = raters
              .filter(r => r.name && r.email)
              .map(r => ({
                survey_id: survey.id,
                reviewer_name: r.name,
                reviewer_email: r.email,
                relationship: r.relationship,
                status: 'pending',
                access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              }));

            if (reviewersToInsert.length > 0) {
              const { data: insertedReviewers, error: reviewersError } = await supabase
                .from('feedback_360_survey_reviewers')
                .insert(reviewersToInsert)
                .select();

              if (reviewersError) throw reviewersError;

              // Send invitation emails to each reviewer (with delay to avoid rate limiting)
              if (insertedReviewers && insertedReviewers.length > 0) {
                for (let i = 0; i < insertedReviewers.length; i++) {
                  const reviewer = insertedReviewers[i];
                  try {
                    const response = await fetch('/api/send-survey-invitation', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        surveyId: survey.id,
                        reviewerId: reviewer.id,
                      }),
                    });

                    if (!response.ok) {
                      const error = await response.json();
                      console.error(`Failed to send email to ${reviewer.reviewer_email}:`, error);
                    }

                    // Add 600ms delay between emails to respect rate limit (2 per second)
                    if (i < insertedReviewers.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 600));
                    }
                  } catch (error) {
                    console.error(`Error sending email to ${reviewer.reviewer_email}:`, error);
                  }
                }

                // Update survey status to 'in_progress' after emails are sent
                await supabase
                  .from('feedback_360_surveys')
                  .update({ status: 'in_progress' })
                  .eq('id', survey.id);
              }
            }

            successCount++;
          } catch (error) {
            console.error(`Error creating survey for ${employee.name}:`, error);
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        notify({
          title: '360 Reviews Launched',
          description: isBatchMode 
            ? `Successfully created ${successCount} 360° review${successCount > 1 ? 's' : ''}. Add context while you wait for feedback!`
            : `360° review for ${employeesToProcess[0].name} created with ${raters.length} raters.`,
          variant: 'success',
          durationMs: 8000,
        });
      }

      if (failCount > 0) {
        notify({
          title: 'Some Reviews Failed',
          description: `${failCount} review${failCount > 1 ? 's' : ''} could not be created. Please try again.`,
          variant: 'warning',
        });
      }

      onSurveyCreated();
      onClose();
    } catch (error) {
      console.error('Error creating surveys:', error);
      notify({
        title: 'Creation Failed',
        description: 'Failed to create 360° reviews. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 flex items-center justify-center p-4 pb-20">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl min-h-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isBatchMode
                  ? `Create 360° Reviews for ${preselectedEmployees.length} Team Members`
                  : selectedEmployee
                    ? `360° Review - ${selectedEmployee.name}`
                    : 'Create 360° Review'}
              </h2>
              <p className="text-sm text-gray-600">
                Step {currentStepIndex + 1} of {steps.length}: {currentStep.replace('-', ' ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                console.log('[Survey360Wizard] "Create with AI" button clicked');
                setIsAIModalOpen(true);
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded hover:from-purple-700 hover:to-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Create survey with AI assistance"
            >
              <Sparkles className="w-4 h-4" />
              Create with AI
            </button>
            {draftSurvey && (
              <button
                onClick={handleDeleteDraft}
                className="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete
              </button>
            )}
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center w-full">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center" style={{ flex: index < steps.length - 1 ? '1' : '0' }}>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0 ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-3 rounded ${
                      index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Who */}
          {currentStep === 'who' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Who is this review for?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select the employee who will receive 360° feedback
                </p>
              </div>

              {/* Templates - Disabled for now */}
              {/* <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start with a Template
                </h4>
                <div className="space-y-2">
                  {SURVEY_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-purple-500 bg-white shadow-md'
                          : 'border-purple-200 bg-white/50 hover:border-purple-300 hover:bg-white'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 text-sm">{template.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div> */}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search by name, title, or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Employee Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                        selectedEmployee?.id === emp.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <Avatar
                        name={emp.name}
                        picture={emp.picture}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900">{emp.name}</div>
                        {emp.title && <div className="text-xs text-gray-600">{emp.title}</div>}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    No employees found matching &quot;{employeeSearch}&quot;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Questions */}
          {currentStep === 'competencies' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  360° Review -
                  {selectedEmployee && (
                    <Avatar
                      name={selectedEmployee.name}
                      picture={selectedEmployee.picture}
                      size="sm"
                    />
                  )}
                  {selectedEmployee ? selectedEmployee.name : 'Review Questions'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure the questions that reviewers will answer
                </p>
              </div>

              {/* Required Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Required Questions</h4>
                  {isAdmin && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Set in Admin Settings</span>
                  )}
                </div>

                {requiredQuestions.map((question, index) => (
                  <div key={index} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Question {index + 1} <span className="text-red-500">*</span>
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                      {question}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Questions */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900">Custom Questions (Optional)</h4>

                {customQuestions.length > 0 && (
                  <div className="space-y-3">
                    {customQuestions.map((question, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                          {question}
                        </div>
                        <button
                          onClick={() => {
                            setCustomQuestions(customQuestions.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <textarea
                    value={newCustomQuestion}
                    onChange={(e) => setNewCustomQuestion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Add a custom question..."
                  />
                  <button
                    onClick={() => {
                      if (newCustomQuestion.trim()) {
                        setCustomQuestions([...customQuestions, newCustomQuestion.trim()]);
                        setNewCustomQuestion('');
                      }
                    }}
                    disabled={!newCustomQuestion.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add Question
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Raters */}
          {currentStep === 'raters' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  360° Review -
                  {selectedEmployee && (
                    <Avatar
                      name={selectedEmployee.name}
                      picture={selectedEmployee.picture}
                      size="sm"
                    />
                  )}
                  {selectedEmployee ? selectedEmployee.name : 'Add Raters'}
                </h3>
              </div>

              <div className="space-y-3">
                {raters.map((rater, index) => (
                  <div key={index} className="relative">
                    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <select
                        value={rater.relationship}
                        onChange={(e) => {
                          const updated = [...raters];
                          updated[index].relationship = e.target.value as ParticipantRelationship;
                          setRaters(updated);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="manager">Manager</option>
                        <option value="peer">Peer</option>
                        <option value="direct_report">Direct Report</option>
                        <option value="cross_functional">Cross-Functional</option>
                      </select>

                      {/* Employee Selector Button or Input Fields */}
                      {!rater.name && !rater.email ? (
                        <div className="flex-1 relative">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={raterSearch}
                              onChange={(e) => setRaterSearch(e.target.value)}
                              onFocus={() => setShowRaterPicker(index)}
                              placeholder="Search employees..."
                              className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={rater.name}
                              onChange={(e) => {
                                const updated = [...raters];
                                updated[index].name = e.target.value;
                                setRaters(updated);
                              }}
                              placeholder="Name"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <input
                              type="email"
                              value={rater.email}
                              onChange={(e) => {
                                const updated = [...raters];
                                updated[index].email = e.target.value;
                                setRaters(updated);
                              }}
                              placeholder="Email"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <button
                            onClick={() => {
                              setShowRaterPicker(index);
                              setRaterSearch('');
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Select different employee"
                          >
                            <User className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setRaters(raters.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Remove rater"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Employee Picker Dropdown */}
                    {showRaterPicker === index && (
                      <>
                        {/* Backdrop to close picker */}
                        <div
                          className="fixed inset-0 z-[9]"
                          onClick={() => {
                            setShowRaterPicker(null);
                            setRaterSearch('');
                          }}
                        />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                          <div className="p-2">
                            {filteredRaterEmployees.length > 0 ? (
                              filteredRaterEmployees.slice(0, 20).map(emp => (
                                <button
                                  key={emp.id}
                                  onClick={() => selectEmployeeAsRater(emp, index)}
                                  className="w-full text-left p-2 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <Avatar
                                    name={emp.name}
                                    picture={emp.picture}
                                    size="sm"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900">{emp.name}</div>
                                    <div className="text-xs text-gray-600">
                                      {emp.title && <span>{emp.title}</span>}
                                      {emp.title && emp.email && <span> • </span>}
                                      {emp.email && <span className="truncate">{emp.email}</span>}
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500">
                                No employees found
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setShowRaterPicker(null);
                                setRaterSearch('');
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
                ))}
              </div>

              <button
                onClick={() =>
                  setRaters([...raters, { name: '', email: '', relationship: 'peer' }])
                }
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Add Rater
              </button>
            </div>
          )}

          {/* Step 4: Timeline */}
          {currentStep === 'timeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  360° Review -
                  {selectedEmployee && (
                    <Avatar
                      name={selectedEmployee.name}
                      picture={selectedEmployee.picture}
                      size="sm"
                    />
                  )}
                  {selectedEmployee ? selectedEmployee.name : 'Set Timeline'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">When should raters complete their feedback?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Recommended:</strong> Allow 7-14 days for raters to complete thoughtful feedback.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  360° Review -
                  {selectedEmployee && (
                    <Avatar
                      name={selectedEmployee.name}
                      picture={selectedEmployee.picture}
                      size="sm"
                    />
                  )}
                  {selectedEmployee ? selectedEmployee.name : 'Review & Launch'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">Confirm details before sending</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Employee</div>
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={selectedEmployee?.name}
                      picture={selectedEmployee?.picture}
                      size="md"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">{selectedEmployee?.name}</div>
                      <div className="text-sm text-gray-600">{selectedEmployee?.title}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Questions ({requiredQuestions.length + customQuestions.length})
                  </div>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {requiredQuestions.map((q, i) => (
                      <li key={`req-${i}`}>• {q}</li>
                    ))}
                    {customQuestions.map((q, i) => (
                      <li key={`custom-${i}`} className="text-blue-700">• {q}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Raters ({raters.length})</div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {raters.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Avatar
                          name={r.name}
                          picture={undefined}
                          size="sm"
                        />
                        <span>{r.name || 'Pending'} ({r.relationship})</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Due Date</div>
                  <div className="font-semibold text-gray-900">
                    {new Date(dueDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={currentStepIndex === 0 ? handleClose : handleBack}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              data-launch-button
              onClick={handleCreate}
              disabled={isCreating || !canProceed()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating ? (
                <>Creating...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Launch Review
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(
    <>
      {modalContent}
      <CreateWithAIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onComplete={handleAIModalComplete}
      />
    </>,
    document.body
  ) : null;
}

