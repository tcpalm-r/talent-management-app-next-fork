import { useState, useEffect, useRef } from 'react';
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
  Pencil,
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
import { replaceNamePlaceholder } from '../lib/questionUtils';

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
  aiParsedData?: ParsedSurveyData; // Optional: Data from AI modal
}

type WizardStep = 'who' | 'competencies' | 'raters' | 'timeline' | 'preview';

interface Rater {
  name: string;
  email: string;
  relationship: ParticipantRelationship;
  autoDetected?: boolean; // Indicates if relationship was auto-detected
  relationshipFilter?: ParticipantRelationship | null; // Filter applied before search
  searchValue?: string; // Per-reviewer search term
}

// Extended employee type with detected relationship for search results
type EmployeeWithRelationship = Employee & {
  detected_relationship?: ParticipantRelationship;
};

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
    suggestedRaters: { manager: 1, cross_functional: 3, direct_report: 1 },
  },
  {
    id: 'performance-support',
    name: 'Performance Review Support',
    description: '10 comprehensive questions for annual review insights',
    questionIds: DEFAULT_QUESTION_IDS,
    suggestedRaters: { manager: 1, cross_functional: 4, direct_report: 2 },
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
  aiParsedData,
}: Survey360WizardProps) {
  const { notify } = useToast();
  const isBatchMode = !!preselectedEmployees && preselectedEmployees.length > 0;
  const initialStep: WizardStep = draftSurvey
    ? (draftSurvey.current_step as WizardStep) || 'who'
    : (isBatchMode || preselectedEmployee)
      ? 'competencies'
      : 'who';

  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(preselectedEmployee);
  const [preferredName, setPreferredName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
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
  const [autoReminderDaysBefore, setAutoReminderDaysBefore] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [raterSearch, setRaterSearch] = useState('');
  const [showRaterPicker, setShowRaterPicker] = useState<number | null>(null);
  const [employeesWithRelationships, setEmployeesWithRelationships] = useState<EmployeeWithRelationship[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [questionsConfirmed, setQuestionsConfirmed] = useState(false);
  const [newlyAddedRaterIndex, setNewlyAddedRaterIndex] = useState<number | null>(null);
  const [highlightedEmployeeIndex, setHighlightedEmployeeIndex] = useState<number>(-1);
  const [highlightedEmployeeListIndex, setHighlightedEmployeeListIndex] = useState<number>(-1);
  const raterInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const raterContainerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const employeeListRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const customQuestionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const employeeListContainerRef = useRef<HTMLDivElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const loadedDraftIdRef = useRef<string | null>(null);

  const isAdmin = currentUser?.app_role === 'admin';

  const steps: WizardStep[] = ['who', 'competencies', 'raters', 'timeline', 'preview'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Reset wizard state
  const resetWizard = () => {
    const resetStep: WizardStep = draftSurvey ? (draftSurvey.current_step as WizardStep) || 'who' : (isBatchMode || preselectedEmployee) ? 'competencies' : 'who';
    setCurrentStep(resetStep);
    setSelectedEmployee(preselectedEmployee);
    setPreferredName('');
    setIsEditingName(false);
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
    setQuestionsConfirmed(false);
  };

  // Handle AI modal completion (internal - triggered from within wizard)
  const handleAIModalComplete = (data: ParsedSurveyData) => {
    console.log('[Survey360Wizard.handleAIModalComplete] AI modal data received:', data);

    // Find employee by name if the AI-parsed name differs from current selection
    if (data.employeeName) {
      const matchedEmployee = employees.find(
        emp => emp.name.toLowerCase() === data.employeeName.toLowerCase()
      );
      if (matchedEmployee) {
        console.log('[Survey360Wizard.handleAIModalComplete] Setting employee:', matchedEmployee.name);
        setSelectedEmployee(matchedEmployee);
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
      console.log('[Survey360Wizard.handleAIModalComplete] Setting reviewers:', data.raters);
      setRaters(data.raters);
    } else {
      console.log('[Survey360Wizard.handleAIModalComplete] WARNING: No reviewers found in AI response');
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

    // Move to preview step - let user manually review and launch
    setCurrentStep('preview');
    setShouldAutoLaunch(false); // Don't auto-launch, let user review first
    setIsAIModalOpen(false);

    // Auto-confirm questions when AI provides them
    setQuestionsConfirmed(true);
  };

  // Handle AI data from external source (dashboard AI modal)
  // Just populate the data and show step 5, don't auto-launch
  const handleAIDataFromDashboard = (data: ParsedSurveyData) => {
    console.log('[Survey360Wizard.handleAIDataFromDashboard] Received data from dashboard AI modal:', data);

    // Find employee by name
    if (data.employeeName) {
      const matchedEmployee = employees.find(
        emp => emp.name.toLowerCase() === data.employeeName.toLowerCase()
      );
      if (matchedEmployee) {
        console.log('[Survey360Wizard.handleAIDataFromDashboard] Setting employee:', matchedEmployee.name);
        setSelectedEmployee(matchedEmployee);
      }
    }

    // Apply questions
    if (data.questions && data.questions.length > 0) {
      console.log('[Survey360Wizard.handleAIDataFromDashboard] Setting custom questions:', data.questions);
      setCustomQuestions(data.questions);
    }

    // Apply raters
    if (data.raters && data.raters.length > 0) {
      console.log('[Survey360Wizard.handleAIDataFromDashboard] Setting reviewers:', data.raters);
      setRaters(data.raters);
    }

    // Apply due date
    if (data.dueDate) {
      console.log('[Survey360Wizard.handleAIDataFromDashboard] Setting due date:', data.dueDate);
      setDueDate(data.dueDate);
    }

    // Apply survey title if provided
    if (data.surveyTitle) {
      console.log('[Survey360Wizard.handleAIDataFromDashboard] Setting survey title:', data.surveyTitle);
      setSurveyTitle(data.surveyTitle);
    }

    // Move to preview step only (no auto-launch for external flow)
    setCurrentStep('preview');

    // Auto-confirm questions when AI provides them
    setQuestionsConfirmed(true);
  };

  // Load default questions from API
  useEffect(() => {
    const loadDefaultQuestions = async () => {
      try {
        const response = await fetch('/api/360-default-questions');
        if (response.ok) {
          const data = await response.json();
          // Load the default questions from the new API format
          if (data.questions && Array.isArray(data.questions)) {
            const questionTexts = data.questions.map((q: any) => q.text);
            setRequiredQuestions(questionTexts);
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
      if (!isOpen || !draftSurvey) {
        loadedDraftIdRef.current = null;
        return;
      }

      // CRITICAL FIX: Prevent loading same draft multiple times (race condition fix)
      if (loadedDraftIdRef.current === draftSurvey.id) {
        console.log('[DRAFT LOAD] ⏭️ Skipping load - already loaded draft:', draftSurvey.id);
        return;
      }

      console.log('[DRAFT LOAD] 🔄 Loading draft:', draftSurvey.id);
      loadedDraftIdRef.current = draftSurvey.id;

      try {
        // Set the employee
        const employee = employees.find(e => e.id === draftSurvey.employee_id);
        if (employee) {
          setSelectedEmployee(employee);
        }

        // Load survey questions and reviewers via API
        // Add timestamp to prevent browser caching
        const response = await fetch(`/api/surveys/load-draft?surveyId=${draftSurvey.id}&t=${Date.now()}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error loading draft survey data:', errorData);
          throw new Error(errorData.error || 'Failed to load draft survey data');
        }

        const { survey: freshSurvey, surveyQuestions, reviewers } = await response.json();

        if (surveyQuestions && surveyQuestions.length > 0) {
          const allQuestions: string[] = surveyQuestions
            .map((sq: any) => sq.feedback_360_questions?.question_text || '')
            .filter((text: string) => text.trim().length > 0);

          if (allQuestions.length > 0) {
            // CRITICAL FIX: Use actual number of default questions, not hardcoded 3
            // Admin can configure any number of default questions in AdminSettings
            // Use requiredQuestions.length if loaded, otherwise fetch from API
            const defaultQuestionsCount = requiredQuestions.length > 0 ? requiredQuestions.length : 3;
            const required = allQuestions.slice(0, defaultQuestionsCount);
            const custom = allQuestions.slice(defaultQuestionsCount);

            if (required.length > 0) {
              setRequiredQuestions(required);
            }
            if (custom.length > 0) {
              setCustomQuestions(custom);
            }
          }
        }

        // Merge complete reviewers from DB with partial reviewers from draft
        const completeReviewers = (reviewers || []).map((r: any) => ({
          name: r.reviewer_name,
          email: r.reviewer_email,
          relationship: r.relationship,
        }));

        // CRITICAL FIX: Use fresh survey data from API, not stale prop
        const partialReviewers = freshSurvey?.draft_partial_reviewers || [];

        console.log('[DRAFT LOAD] ========== LOADING DRAFT ==========');
        console.log('[DRAFT LOAD] Draft survey ID:', draftSurvey.id);
        console.log('[DRAFT LOAD] Fresh survey from API:', JSON.stringify(freshSurvey, null, 2));
        console.log('[DRAFT LOAD] Complete reviewers from DB:', JSON.stringify(completeReviewers, null, 2));
        console.log('[DRAFT LOAD] Partial reviewers from API draft_partial_reviewers:', JSON.stringify(partialReviewers, null, 2));
        console.log('[DRAFT LOAD] Fresh survey current_step:', freshSurvey?.current_step);

        // Combine both arrays - partial reviewers first (they're incomplete), then complete ones
        const combinedRaters = [...partialReviewers, ...completeReviewers];
        console.log('[DRAFT LOAD] Combined raters to set:', JSON.stringify(combinedRaters, null, 2));
        setRaters(combinedRaters);

        // CRITICAL FIX: Use fresh survey data from API for all fields
        setSurveyTitle(freshSurvey?.survey_name || draftSurvey.survey_name || '');
        setPreferredName(freshSurvey?.subject_preferred_name || '');
        if (freshSurvey?.due_date) {
          // Format date to yyyy-MM-dd for the input field
          const dateObj = new Date(freshSurvey.due_date);
          const formattedDate = dateObj.toISOString().split('T')[0];
          setDueDate(formattedDate);
        }
        setAutoReminderDaysBefore(freshSurvey?.auto_reminder_days_before || null);
        setIsAnonymous(freshSurvey?.is_anonymous !== false);

        // Restore the saved wizard step if available, otherwise infer from data
        if (freshSurvey?.current_step) {
          // Use the saved step from the draft
          setCurrentStep(freshSurvey.current_step as WizardStep);
          // Mark questions as confirmed if we're past the competencies step
          if (['raters', 'timeline', 'preview'].includes(freshSurvey.current_step)) {
            setQuestionsConfirmed(true);
          }
        } else {
          // Fallback: Determine the appropriate step to show based on what's filled in
          // Step progression: who -> competencies -> raters -> timeline -> preview
          if (employee && surveyQuestions && surveyQuestions.length > 0 && reviewers && reviewers.length > 0 && freshSurvey?.due_date) {
            // All data filled → go to preview and mark questions as confirmed
            setCurrentStep('preview');
            setQuestionsConfirmed(true);
          } else if (employee && surveyQuestions && surveyQuestions.length > 0 && reviewers && reviewers.length > 0) {
            // Has employee, questions, and reviewers but no due date → go to timeline and mark questions as confirmed
            setCurrentStep('timeline');
            setQuestionsConfirmed(true);
          } else if (employee && surveyQuestions && surveyQuestions.length > 0) {
            // Has employee and questions but no reviewers → go to raters and mark questions as confirmed
            setCurrentStep('raters');
            setQuestionsConfirmed(true);
          } else if (employee) {
            // Has employee but no questions → go to competencies, questions not yet confirmed
            setCurrentStep('competencies');
            setQuestionsConfirmed(false);
          } else {
            // No employee → go back to start
            setCurrentStep('who');
            setQuestionsConfirmed(false);
          }
        }
      } catch (error) {
        console.error('Error loading draft survey data:', error);
      }
    };

    loadDraftSurveyData();
  }, [isOpen, draftSurvey, employees]);

  // Handle AI-parsed data when received from dashboard AI modal
  useEffect(() => {
    if (isOpen && aiParsedData) {
      console.log('[Survey360Wizard] Received AI parsed data from dashboard, calling handleAIDataFromDashboard');
      handleAIDataFromDashboard(aiParsedData);
    }
  }, [isOpen, aiParsedData]);

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

  // Auto-fill due date with one week from today when arriving at timeline step
  useEffect(() => {
    if (currentStep === 'timeline' && !dueDate) {
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      const formattedDate = oneWeekFromNow.toISOString().split('T')[0];
      setDueDate(formattedDate);
    }
  }, [currentStep]);

  // Auto-focus input when a new reviewer is added
  useEffect(() => {
    if (newlyAddedRaterIndex !== null && currentStep === 'raters') {
      // Don't auto-focus the search input - user must select relationship first
      // Just clear the newlyAddedRaterIndex state
      setNewlyAddedRaterIndex(null);
    }
  }, [newlyAddedRaterIndex, currentStep, raters.length]);

  // Reset highlight when picker closes
  useEffect(() => {
    if (showRaterPicker === null) {
      setHighlightedEmployeeIndex(-1);
    }
  }, [showRaterPicker]);

  // Reset employee list highlight when step changes away from 'who'
  useEffect(() => {
    if (currentStep !== 'who') {
      setHighlightedEmployeeListIndex(-1);
    }
  }, [currentStep]);

  // Auto-scroll to bottom when on step 3 (raters) to ensure bottom content is visible
  useEffect(() => {
    if (currentStep === 'raters' && modalContentRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        if (modalContentRef.current) {
          modalContentRef.current.scrollTo({
            top: modalContentRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [currentStep, raters.length]);

  // Auto-focus input when step changes
  useEffect(() => {
    // Small delay to ensure the DOM has updated
    setTimeout(() => {
      if (currentStep === 'who' && employeeSearchInputRef.current) {
        employeeSearchInputRef.current.focus();
      } else if (currentStep === 'raters') {
        // Don't auto-add or auto-focus anything - let user click "Add Reviewer" button
        // Just clear any existing search state
        setRaterSearch('');
        setShowRaterPicker(null);
        setEmployeesWithRelationships([]);
      }
    }, 0);
  }, [currentStep, raters.length, employees, raterSearch]);


  // Capture keyboard input when on relevant steps and input is not focused
  useEffect(() => {
    if (!isOpen || (currentStep !== 'who' && currentStep !== 'competencies' && currentStep !== 'raters')) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Determine which input/textarea should be focused based on current step
      let targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
      let setValue: ((value: string) => void) | null = null;
      let getValue: (() => string) | null = null;

      if (currentStep === 'who') {
        targetElement = employeeSearchInputRef.current;
        setValue = (value: string) => setEmployeeSearch(value);
        getValue = () => employeeSearch;
      } else if (currentStep === 'competencies') {
        targetElement = customQuestionTextareaRef.current;
        setValue = (value: string) => setNewCustomQuestion(value);
        getValue = () => newCustomQuestion;
      } else if (currentStep === 'raters') {
        // For raters, focus the first empty rater input (one without name/email)
        const firstEmptyRaterIndex = raters.findIndex(r => !r.name && !r.email);
        if (firstEmptyRaterIndex >= 0) {
          const firstInput = raterInputRefs.current[firstEmptyRaterIndex];
          if (firstInput) {
            targetElement = firstInput;
            setValue = (value: string) => setRaterSearch(value);
            getValue = () => raterSearch;
          }
        }
      }

      // Don't capture if target element doesn't exist
      if (!targetElement) {
        return;
      }

      // Don't capture if any input, textarea, or contenteditable element is already focused
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Don't capture special keys or modifier combinations
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key.length > 1 // Function keys, arrows, etc.
      ) {
        return;
      }

      // If it's a printable character (including Shift+letter), focus the input and append it
      if (e.key.length === 1 && setValue && getValue) {
        e.preventDefault();
        e.stopPropagation();
        targetElement.focus();
        // Append the typed character
        setValue(getValue() + e.key);
        
        // For raters step, also show the picker for the first empty rater
        if (currentStep === 'raters') {
          const firstEmptyRaterIndex = raters.findIndex(r => !r.name && !r.email);
          if (firstEmptyRaterIndex >= 0) {
            setShowRaterPicker(firstEmptyRaterIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, isOpen, employeeSearch, newCustomQuestion, raterSearch, raters]);

  // Filter employees based on role and search
  const filteredEmployees = employees
    .filter(emp => {
      // Role-based filtering: leaders only see direct reports
      if (currentUser?.app_role === 'leader') {
        return emp.reports_to_id === currentUser.id;
      }
      // Admin and SLT see all employees
      return true;
    })
    .filter(emp =>
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.title?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email?.toLowerCase().includes(employeeSearch.toLowerCase())
    );

  // Filter employees for rater selection
  // Use API results with relationships if available, otherwise fall back to local filtering
  // IMPORTANT: If a relationship filter was applied and API returned empty, don't fall back to all employees
  const currentRater = showRaterPicker !== null ? raters[showRaterPicker] : null;
  const hasRelationshipFilter = currentRater?.relationship && currentRater.relationship !== '';

  const filteredRaterEmployees: EmployeeWithRelationship[] = (
    // If we have API results OR a relationship filter was set (even if results are empty), use API results
    (employeesWithRelationships.length > 0 || hasRelationshipFilter) && selectedEmployee
      ? employeesWithRelationships
      : employees
  ).filter((emp: EmployeeWithRelationship) => {
    // Don't show the selected employee as a rater option
    if (selectedEmployee && emp.id === selectedEmployee.id) return false;

    // Don't show employees who are already selected as raters (prevent duplicates)
    const isAlreadySelected = raters.some(
      (rater, raterIndex) =>
        rater.email &&
        rater.email.toLowerCase() === emp.email?.toLowerCase() &&
        raterIndex !== showRaterPicker // Allow the current picker to show the currently selected employee
    );
    if (isAlreadySelected) return false;

    // If using local filtering (fallback), apply search filter
    if (employeesWithRelationships.length === 0 && raterSearch && !hasRelationshipFilter) {
      const name = emp.full_name || emp.name || '';
      return name.toLowerCase().includes(raterSearch.toLowerCase()) ||
             emp.title?.toLowerCase().includes(raterSearch.toLowerCase()) ||
             emp.email?.toLowerCase().includes(raterSearch.toLowerCase());
    }
    return true;
  });

  // Fetch employees with relationship detection for a specific rater slot
  const fetchEmployeesWithRelationships = async (
    raterIndex: number,
    searchTerm: string = '',
    relationshipFilter: ParticipantRelationship | null = null
  ) => {
    if (!selectedEmployee) return;

    setIsLoadingRelationships(true);
    try {
      const params = new URLSearchParams({
        subjectId: selectedEmployee.id,
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
      notify('Failed to load employees', 'error');
      setEmployeesWithRelationships([]);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  const selectEmployeeAsRater = (employee: EmployeeWithRelationship, index: number) => {
    const updated = [...raters];
    updated[index].name = employee.full_name || employee.name;
    updated[index].email = employee.email || '';

    // If relationship was auto-detected, use it and mark as auto-detected
    if (employee.detected_relationship) {
      updated[index].relationship = employee.detected_relationship;
      updated[index].autoDetected = true;
    }

    setRaters(updated);
    setShowRaterPicker(null);
    setRaterSearch('');
    setHighlightedEmployeeIndex(-1);
  };

  // Handle keyboard navigation in employee picker (Step 3)
  const handleRaterInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (showRaterPicker !== index) return;

    const filtered = filteredRaterEmployees.slice(0, 20);
    const maxIndex = filtered.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedEmployeeIndex((prev) => {
          const next = prev < maxIndex ? prev + 1 : 0;
          // Scroll into view
          setTimeout(() => {
            const buttonRef = employeeListRefs.current[next];
            if (buttonRef) {
              buttonRef.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 0);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedEmployeeIndex((prev) => {
          const next = prev > 0 ? prev - 1 : maxIndex;
          // Scroll into view
          setTimeout(() => {
            const buttonRef = employeeListRefs.current[next];
            if (buttonRef) {
              buttonRef.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 0);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation(); // Prevent global Enter handler from firing
        if (highlightedEmployeeIndex >= 0 && highlightedEmployeeIndex < filtered.length) {
          selectEmployeeAsRater(filtered[highlightedEmployeeIndex], index);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowRaterPicker(null);
        setRaterSearch('');
        setHighlightedEmployeeIndex(-1);
        break;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'who':
        return isBatchMode || !!selectedEmployee || (highlightedEmployeeListIndex >= 0 && filteredEmployees.length > 0);
      case 'competencies':
        return requiredQuestions.length >= 3 && requiredQuestions.every(q => q.trim().length > 0);
      case 'raters':
        return raters.length >= 3 && raters.slice(0, 3).every(r => r.name && r.name.trim().length > 0 && r.email && r.email.trim().length > 0);
      case 'timeline':
        return !!dueDate;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    // Auto-select highlighted employee if one is highlighted but not selected (for 'who' step)
    if (currentStep === 'who' && !selectedEmployee && highlightedEmployeeListIndex >= 0 && filteredEmployees.length > 0) {
      const highlightedEmployee = filteredEmployees[highlightedEmployeeListIndex];
      if (highlightedEmployee) {
        setSelectedEmployee(highlightedEmployee);
      }
    }

    // Auto-add any pending custom question text when leaving competencies step
    if (currentStep === 'competencies' && newCustomQuestion.trim()) {
      setCustomQuestions([...customQuestions, newCustomQuestion.trim()]);
      setNewCustomQuestion('');
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  // Global Enter key handler to advance when Next button is enabled
  useEffect(() => {
    if (!isOpen) return;

    const handleEnterKey = (e: KeyboardEvent) => {
      // Don't handle Enter if user is typing in a textarea (multi-line input)
      const activeElement = document.activeElement;
      const isTextarea = activeElement && activeElement.tagName === 'TEXTAREA' && (activeElement as HTMLTextAreaElement).rows > 1;

      // Don't handle Enter if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return;
      }

      // Don't handle Enter if we're in a textarea (multi-line input)
      if (isTextarea) {
        return;
      }

      // Only handle Enter if Next button is enabled and not on last step
      if (e.key === 'Enter' && canProceed() && currentStepIndex < steps.length - 1) {
        // Don't interfere with step 1's Enter handler (it selects employee)
        if (currentStep === 'who' && activeElement === employeeSearchInputRef.current) {
          // Step 1 has its own Enter handler, so don't interfere
          return;
        }

        // Don't interfere with step 3's Enter handler when rater picker is open
        if (currentStep === 'raters' && showRaterPicker !== null && activeElement && activeElement.tagName === 'INPUT') {
          // Step 3 has its own Enter handler for selecting reviewers, so don't interfere
          return;
        }

        // For other cases, advance to next step
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleEnterKey);
    return () => {
      window.removeEventListener('keydown', handleEnterKey);
    };
  }, [isOpen, currentStep, currentStepIndex, steps, selectedEmployee, highlightedEmployeeListIndex, filteredEmployees, isBatchMode, requiredQuestions, raters, dueDate, showRaterPicker]);

  const handleClose = async () => {
    // Clear the loaded draft ref so next time we open the modal it loads fresh
    loadedDraftIdRef.current = null;

    // Save draft if there's meaningful progress (including preview step)
    const hasProgress = selectedEmployee;

    console.log('[DRAFT SAVE] ========== STARTING SAVE ==========');
    console.log('[DRAFT SAVE] Has progress?', hasProgress);
    console.log('[DRAFT SAVE] Selected employee:', selectedEmployee?.name);
    console.log('[DRAFT SAVE] Current step index:', currentStepIndex);
    console.log('[DRAFT SAVE] Total steps:', steps.length);

    if (hasProgress) {
      try {
        // If editing existing draft, update it; otherwise create new draft
        const isUpdating = !!draftSurvey;
        const apiUrl = isUpdating ? '/api/surveys/update-draft' : '/api/surveys/save-draft';

        console.log('[DRAFT SAVE] Is updating?', isUpdating);
        console.log('[DRAFT SAVE] Draft survey ID:', draftSurvey?.id);
        console.log('[DRAFT SAVE] Raters being saved:', JSON.stringify(raters, null, 2));
        console.log('[DRAFT SAVE] Current step:', currentStep);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isUpdating ? {
            surveyId: draftSurvey.id,
            surveyName: surveyTitle || `360° Feedback - ${displayName}`,
            dueDate: dueDate || null,
            autoReminderDaysBefore,
            preferredName: preferredName || null,
            requiredQuestions: requiredQuestions.filter(q => q.trim()),
            customQuestions,
            raters, // Save ALL raters, including partial ones (relationship-only)
            questionsConfirmed,
            currentStep, // Save the current wizard step
          } : {
            organizationId,
            employeeId: selectedEmployee.id,
            surveyTitle: surveyTitle || `360° Feedback - ${displayName}`,
            dueDate: dueDate || null,
            autoReminderDaysBefore,
            preferredName: preferredName || null,
            // createdBy is now handled by the API from the authenticated session
            requiredQuestions: requiredQuestions.filter(q => q.trim()),
            customQuestions,
            raters, // Save ALL raters, including partial ones (relationship-only)
            questionsConfirmed,
            currentStep, // Save the current wizard step
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[DRAFT SAVE] ❌ API error:', errorData);
          throw new Error(errorData.error || 'Failed to save draft');
        }

        const responseData = await response.json();
        console.log('[DRAFT SAVE] ✅ API response:', responseData);

        notify({
          title: 'Draft saved',
          description: 'Your review has been saved as a draft.',
          variant: 'success',
        });

        // Refresh the survey list to show the new draft
        onSurveyCreated();
      } catch (error: any) {
        console.error('[DRAFT SAVE] ❌ Error saving draft:', error);
        // Don't show error notification, just close silently
      }
    } else {
      console.log('[DRAFT SAVE] ⚠️ Skipping save - no progress or on last step');
    }

    console.log('[DRAFT SAVE] ========== CLOSING MODAL ==========');
    onClose();
  };


  const applyTemplate = (templateId: string) => {
    const template = SURVEY_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);

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

    // Validate all required fields before proceeding
    const missingFields: string[] = [];

    if (!selectedEmployee) {
      missingFields.push('Employee selection');
    }

    if (!requiredQuestions || requiredQuestions.length === 0 || requiredQuestions.some(q => !q.trim())) {
      missingFields.push('Required questions');
    }

    if (!raters || raters.length === 0) {
      missingFields.push('At least one reviewer');
    } else {
      // Check that all raters have name (emails are auto-populated from database by name)
      const reviewersWithoutName = raters.filter(r => !r.name || !r.name.trim());
      if (reviewersWithoutName.length > 0) {
        missingFields.push(`${reviewersWithoutName.length} reviewer(s) missing name`);
      }
    }

    if (!dueDate) {
      missingFields.push('Due date');
    }

    if (missingFields.length > 0) {
      notify({
        title: 'Missing Required Fields',
        description: `Please complete the following before launching: ${missingFields.join(', ')}`,
        variant: 'error',
      });
      return;
    }

    setIsCreating(true);
    try {
      let successCount = 0;
      let failCount = 0;

      // If editing a draft, work with just that draft
      if (draftSurvey) {
        try {
          // Update draft survey via API
          const updateResponse = await fetch('/api/surveys/update-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surveyId: draftSurvey.id,
              surveyName: surveyTitle || `360° Feedback - ${displayName}`,
              dueDate,
              preferredName: preferredName || null,
              requiredQuestions,
              customQuestions,
              raters: raters.filter(r => r.name && r.name.trim()),
            }),
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('[DRAFT UPDATE] API error:', errorData);
            throw new Error(errorData.error || 'Failed to update draft');
          }

          const { reviewers: insertedReviewers } = await updateResponse.json();

          // Send invitation emails to each reviewer (with delay to avoid rate limiting)
          if (insertedReviewers && insertedReviewers.length > 0) {
            const emailErrors: Array<{ email: string; error: string }> = [];

            for (let i = 0; i < insertedReviewers.length; i++) {
              const reviewer = insertedReviewers[i];
              try {
                const response = await fetch('/api/send-survey-invitation', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    surveyId: draftSurvey.id,
                    reviewerId: reviewer.id,
                  }),
                });

                if (!response.ok) {
                  let errorData;
                  try {
                    errorData = await response.json();
                  } catch (parseError) {
                    // If response isn't JSON, use status text
                    const statusText = response.statusText || 'Unknown error';
                    console.error(`Failed to send email to ${reviewer.reviewer_email}:`, {
                      status: response.status,
                      statusText,
                      parseError,
                    });
                    emailErrors.push({
                      email: reviewer.reviewer_email,
                      error: `HTTP ${response.status}: ${statusText}`,
                    });
                    continue;
                  }

                  const errorMessage = errorData.details || errorData.error || 'Unknown error';
                  const errorHint = errorData.hint || '';

                  console.error(`Failed to send email to ${reviewer.reviewer_email}:`, {
                    status: response.status,
                    error: errorData,
                    fullResponse: errorData,
                  });
                  emailErrors.push({
                    email: reviewer.reviewer_email,
                    error: errorHint ? `${errorMessage} (${errorHint})` : errorMessage,
                  });
                }

                // Add 600ms delay between emails to respect rate limit (2 per second)
                if (i < insertedReviewers.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 600));
                }
              } catch (error: any) {
                console.error(`Error sending email to ${reviewer.reviewer_email}:`, error);
                emailErrors.push({
                  email: reviewer.reviewer_email,
                  error: error.message || 'Network error occurred',
                });
              }
            }

            // Show error notification if any emails failed
            if (emailErrors.length > 0) {
              const errorCount = emailErrors.length;
              const totalCount = insertedReviewers.length;
              notify({
                title: `Failed to send ${errorCount} of ${totalCount} email${errorCount > 1 ? 's' : ''}`,
                description: emailErrors.length <= 3
                  ? emailErrors.map(e => `${e.email}: ${e.error}`).join('; ')
                  : `${errorCount} emails failed. Check console for details.`,
                variant: 'error',
              });
            }

            // Update survey status to 'in_progress' after emails are sent
            await fetch('/api/surveys/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                surveyId: draftSurvey.id,
                status: 'in_progress',
              }),
            });
          }

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
        // Create new surveys via API
        for (const employee of employeesToProcess) {
          try {
            // Create survey via API
            // Use preferred name only for the selected employee, not batch employees
            const employeeDisplayName = (employee.id === selectedEmployee?.id && preferredName) ? preferredName : employee.name;
            const createResponse = await fetch('/api/surveys/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: employee.id,
                surveyName: surveyTitle || `360° Feedback - ${employeeDisplayName}`,
                dueDate,
                autoReminderDaysBefore,
                preferredName: (employee.id === selectedEmployee?.id) ? (preferredName || null) : null,
                // createdBy is now handled by the API from the authenticated session
                requiredQuestions,
                customQuestions,
                raters: raters.filter(r => r.name && r.name.trim()),
              }),
            });

            if (!createResponse.ok) {
              const errorData = await createResponse.json();
              console.error(`Error creating survey for ${employee.name}:`, errorData);
              throw new Error(errorData.error || 'Failed to create survey');
            }

            const { survey, reviewers: insertedReviewers } = await createResponse.json();

            // Send invitation emails to each reviewer (with delay to avoid rate limiting)
            if (insertedReviewers && insertedReviewers.length > 0) {
              const emailErrors: Array<{ email: string; error: string }> = [];

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
                    let errorData;
                    try {
                      errorData = await response.json();
                    } catch (parseError) {
                      // If response isn't JSON, use status text
                      const statusText = response.statusText || 'Unknown error';
                      console.error(`Failed to send email to ${reviewer.reviewer_email}:`, {
                        status: response.status,
                        statusText,
                        parseError,
                      });
                      emailErrors.push({
                        email: reviewer.reviewer_email,
                        error: `HTTP ${response.status}: ${statusText}`,
                      });
                      continue;
                    }

                    const errorMessage = errorData.details || errorData.error || 'Unknown error';
                    const errorHint = errorData.hint || '';

                    console.error(`Failed to send email to ${reviewer.reviewer_email}:`, {
                      status: response.status,
                      error: errorData,
                      fullResponse: errorData,
                    });
                    emailErrors.push({
                      email: reviewer.reviewer_email,
                      error: errorHint ? `${errorMessage} (${errorHint})` : errorMessage,
                    });
                  }

                  // Add 600ms delay between emails to respect rate limit (2 per second)
                  if (i < insertedReviewers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                  }
                } catch (error: any) {
                  console.error(`Error sending email to ${reviewer.reviewer_email}:`, error);
                  emailErrors.push({
                    email: reviewer.reviewer_email,
                    error: error.message || 'Network error occurred',
                  });
                }
              }

              // Show error notification if any emails failed
              if (emailErrors.length > 0) {
                const errorCount = emailErrors.length;
                const totalCount = insertedReviewers.length;
                notify({
                  title: `Failed to send ${errorCount} of ${totalCount} email${errorCount > 1 ? 's' : ''}`,
                  description: emailErrors.length <= 3
                    ? emailErrors.map(e => `${e.email}: ${e.error}`).join('; ')
                    : `${errorCount} emails failed. Check console for details.`,
                  variant: 'error',
                });
              }

              // Update survey status to 'in_progress' after emails are sent
              await fetch('/api/surveys/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  surveyId: survey.id,
                  status: 'in_progress',
                }),
              });
            }

            successCount++;
          } catch (error: any) {
            console.error(`Error creating survey for ${employee.name}:`, error);
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        notify({
          title: '360 Feedback Launched',
          description: isBatchMode
            ? `Successfully created ${successCount} 360° feedback session${successCount > 1 ? 's' : ''}. Add context while you wait for feedback!`
            : `360° feedback for ${employeesToProcess[0].name} created with ${raters.length} raters.`,
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
        description: 'Failed to create 360° feedback. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  // Use preferred name if set, otherwise use employee's full name
  const displayName = preferredName || selectedEmployee?.name || '';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 pb-20">
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl min-h-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isBatchMode ? (
                `Create 360° Feedback for ${preselectedEmployees.length} Team Members`
              ) : selectedEmployee ? (
                <div className="flex items-center gap-2">
                  360° Feedback -{' '}
                  <Avatar
                    name={displayName}
                    picture={selectedEmployee.picture ?? undefined}
                    size="xs"
                  />
                  {isEditingName ? (
                    <input
                      type="text"
                      value={preferredName || selectedEmployee.name}
                      onChange={(e) => setPreferredName(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setIsEditingName(false);
                        }
                      }}
                      autoFocus
                      className="px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      placeholder={selectedEmployee.name}
                    />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      {displayName}
                      <span className="relative group">
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="p-1 hover:bg-blue-100 rounded transition-colors"
                          title="Edit preferred name"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        {/* Tooltip */}
                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-900 text-white text-xs font-normal rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[10000]">
                          Edit preferred name
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px border-4 border-transparent border-b-gray-900"></span>
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                'Create 360° Feedback'
              )}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Step {currentStepIndex + 1} of {steps.length}: {
                currentStep === 'who' ? 'Subject' :
                currentStep === 'competencies' ? 'Survey Questions' :
                currentStep === 'raters' ? 'Reviewers' :
                currentStep === 'timeline' ? 'Due Date' :
                currentStep === 'preview' ? 'Preview' :
                String(currentStep).replace('-', ' ')
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI-assisted review wizard button - disabled and hidden */}
            {false && (
              <button
                onClick={() => {
                  console.log('[Survey360Wizard] "Create with AI" button clicked');
                  setIsAIModalOpen(true);
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded hover:from-purple-700 hover:to-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                title="Create survey with AI assistance"
                disabled
              >
                <Sparkles className="w-4 h-4" />
                Create with AI
              </button>
            )}
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center w-full">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center" style={{ flex: index < steps.length - 1 ? '1' : '0' }}>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0 ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 dark:bg-blue-700 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-3 rounded ${
                      index < currentStepIndex ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div ref={modalContentRef} className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Who */}
          {currentStep === 'who' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Who is this feedback for?</h3>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  ref={employeeSearchInputRef}
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setHighlightedEmployeeListIndex(-1); // Reset highlight when typing
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (filteredEmployees.length > 0) {
                        const nextIndex = highlightedEmployeeListIndex < filteredEmployees.length - 1
                          ? highlightedEmployeeListIndex + 1
                          : 0;
                        setHighlightedEmployeeListIndex(nextIndex);
                        // Scroll into view
                        setTimeout(() => {
                          const button = employeeListRefs.current[nextIndex];
                          if (button && employeeListContainerRef.current) {
                            button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }
                        }, 0);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (filteredEmployees.length > 0) {
                        const prevIndex = highlightedEmployeeListIndex > 0
                          ? highlightedEmployeeListIndex - 1
                          : filteredEmployees.length - 1;
                        setHighlightedEmployeeListIndex(prevIndex);
                        // Scroll into view
                        setTimeout(() => {
                          const button = employeeListRefs.current[prevIndex];
                          if (button && employeeListContainerRef.current) {
                            button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }
                        }, 0);
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (highlightedEmployeeListIndex >= 0 && filteredEmployees.length > 0) {
                        // Select highlighted employee and advance
                        const highlightedEmployee = filteredEmployees[highlightedEmployeeListIndex];
                        if (highlightedEmployee) {
                          setSelectedEmployee(highlightedEmployee);
                          setCurrentStep('competencies');
                        }
                      } else if (selectedEmployee) {
                        // If an employee is already selected, just advance
                        setCurrentStep('competencies');
                      }
                    }
                  }}
                  placeholder="Search by name, title, or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              {/* Employee Selection */}
              <div ref={employeeListContainerRef} className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp, index) => (
                    <button
                      key={emp.id}
                      ref={(el) => {
                        employeeListRefs.current[index] = el;
                      }}
                      onClick={() => setSelectedEmployee(emp)}
                      onDoubleClick={() => {
                        setSelectedEmployee(emp);
                        setCurrentStep('competencies');
                      }}
                      className={`text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 cursor-pointer ${
                        selectedEmployee?.id === emp.id
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                          : highlightedEmployeeListIndex === index
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-900/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                      }`}
                    >
                      <Avatar
                        name={emp.name}
                        picture={emp.picture ?? undefined}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{emp.name}</div>
                        {emp.title && <div className="text-xs text-gray-600 dark:text-gray-400">{emp.title}</div>}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                    No employees found matching &quot;{employeeSearch}&quot;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Questions */}
          {currentStep === 'competencies' && (
            <div className="space-y-6">
              {/* Required Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Required Questions <span className="text-sm text-gray-600 dark:text-gray-400">(Set by Admin)</span></h4>
                </div>

                <div className="space-y-3">
                  {requiredQuestions.map((question, index) => (
                    <div key={index} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
                      {replaceNamePlaceholder(question, displayName)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Questions */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Custom Questions <span className="text-sm text-gray-600 dark:text-gray-400">(Optional)</span></h4>

                {customQuestions.length > 0 && (
                  <div className="space-y-3">
                    {customQuestions.map((question, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
                          {replaceNamePlaceholder(question, displayName)}
                        </div>
                        <button
                          onClick={() => {
                            setCustomQuestions(customQuestions.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <textarea
                    ref={customQuestionTextareaRef}
                    value={newCustomQuestion}
                    onChange={(e) => setNewCustomQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      // Add question on Enter (without Shift)
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newCustomQuestion.trim()) {
                          setCustomQuestions([...customQuestions, newCustomQuestion.trim()]);
                          setNewCustomQuestion('');
                          setQuestionsConfirmed(false); // Reset confirmation when new question added
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                    rows={2}
                    placeholder="Add a custom question... (Press Enter to add)"
                  />
                </div>
              </div>

            </div>
          )}

          {/* Step 3: Raters */}
          {currentStep === 'raters' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Add Reviewers</h3>
              </div>

              <div className="space-y-3">
                {raters.map((rater, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      raterContainerRefs.current[index] = el;
                    }}
                    className="relative"
                  >
                    <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50">
                      <select
                        value={rater.relationship}
                        onChange={async (e) => {
                          const updated = [...raters];
                          const newRelationship = e.target.value as ParticipantRelationship;
                          updated[index].relationship = newRelationship;
                          updated[index].relationshipFilter = newRelationship;
                          updated[index].autoDetected = false; // User explicitly selected
                          setRaters(updated);

                          // Pattern 2: Filter First - Pre-fetch employees matching this relationship
                          // Don't open picker yet - wait for user to click search field
                          if (selectedEmployee && !rater.name && newRelationship) {
                            await fetchEmployeesWithRelationships(index, raterSearch, newRelationship);
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      >
                        <option value="">Select relationship...</option>
                        <option value="manager">Manager</option>
                        <option value="slt">SLT</option>
                        <option value="direct_report">Direct Report</option>
                        <option value="cross_functional">Cross-Functional</option>
                      </select>

                      {/* Employee Selector Button or Input Fields */}
                      {!rater.name && !rater.email ? (
                        <div className="flex-1 relative">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <input
                              ref={(el) => {
                                raterInputRefs.current[index] = el;
                              }}
                              type="text"
                              value={rater.searchValue || ''}
                              onChange={async (e) => {
                                const searchValue = e.target.value;

                                // Update this specific rater's search value
                                const updated = [...raters];
                                updated[index].searchValue = searchValue;
                                setRaters(updated);

                                setHighlightedEmployeeIndex(-1); // Reset highlight when typing

                                // Pattern 1: Search First - Fetch with auto-detection
                                // Only fetch if we have a subject and search term is meaningful
                                if (selectedEmployee && searchValue.length >= 1) {
                                  setShowRaterPicker(index); // Show dropdown when user starts typing
                                  await fetchEmployeesWithRelationships(
                                    index,
                                    searchValue,
                                    rater.relationshipFilter || null
                                  );
                                } else if (searchValue.length === 0) {
                                  // Clear API results when search is cleared
                                  setEmployeesWithRelationships([]);
                                  setShowRaterPicker(-1); // Hide dropdown when search is cleared
                                }
                              }}
                              onKeyDown={(e) => handleRaterInputKeyDown(e, index)}
                              onFocus={async () => {
                                // Only show picker if there's search input (1+ chars) or relationship already selected
                                const shouldShowPicker = (rater.searchValue && rater.searchValue.length >= 1) || rater.relationship;
                                if (shouldShowPicker) {
                                  setShowRaterPicker(index);
                                }

                                // Scroll the rater container to the top of the modal
                                setTimeout(() => {
                                  const raterContainer = raterContainerRefs.current[index];
                                  if (raterContainer && modalContentRef.current) {
                                    const containerTop = raterContainer.offsetTop;
                                    modalContentRef.current.scrollTo({
                                      top: containerTop - 20, // 20px padding from top
                                      behavior: 'smooth'
                                    });
                                  }
                                }, 50);

                                // If relationship is selected but no employees loaded yet, fetch them
                                if (rater.relationship && employeesWithRelationships.length === 0) {
                                  await fetchEmployeesWithRelationships(
                                    index,
                                    rater.searchValue || '',
                                    rater.relationship
                                  );
                                }

                                // Highlight first employee if available (only if picker should be shown)
                                if (shouldShowPicker && filteredRaterEmployees.length > 0) {
                                  setHighlightedEmployeeIndex(0);
                                } else {
                                  setHighlightedEmployeeIndex(-1);
                                }
                              }}
                              placeholder="Search employees..."
                              className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
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
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
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
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setRaters(raters.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Remove reviewer"
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
                            setHighlightedEmployeeIndex(-1);
                          }}
                        />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                          <div className="p-2">
                            {isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Loading...</span>
                                </div>
                              </div>
                            ) : filteredRaterEmployees.length > 0 ? (
                              filteredRaterEmployees.slice(0, 20).map((emp, empIndex) => (
                                <button
                                  key={emp.id}
                                  ref={(el) => {
                                    employeeListRefs.current[empIndex] = el;
                                  }}
                                  onClick={() => selectEmployeeAsRater(emp, index)}
                                  onMouseEnter={() => setHighlightedEmployeeIndex(empIndex)}
                                  className={`w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2 ${
                                    highlightedEmployeeIndex === empIndex
                                      ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-500'
                                      : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                  }`}
                                >
                                  <Avatar
                                    name={emp.full_name || emp.name}
                                    picture={emp.picture ?? undefined}
                                    size="sm"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{emp.full_name || emp.name}</div>
                                      {emp.detected_relationship && (
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                          emp.detected_relationship === 'manager' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                                          emp.detected_relationship === 'slt' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                          emp.detected_relationship === 'direct_report' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}>
                                          {emp.detected_relationship === 'manager' ? 'Manager' :
                                           emp.detected_relationship === 'slt' ? 'SLT' :
                                           emp.detected_relationship === 'direct_report' ? 'Direct Report' :
                                           'Cross-Functional'}
                                        </span>
                                      )}
                                    </div>
                                    {emp.title && <div className="text-xs text-gray-600 dark:text-gray-400">{emp.title}</div>}
                                  </div>
                                </button>
                              ))
                            ) : rater.relationship && employeesWithRelationships.length === 0 && !isLoadingRelationships ? (
                              <div className="p-4 text-center text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg m-2">
                                {selectedEmployee?.name} has no{' '}
                                {rater.relationship === 'manager' ? 'manager' :
                                 rater.relationship === 'slt' ? 'SLT' :
                                 rater.relationship === 'direct_report' ? 'direct reports' :
                                 'cross-functional colleagues'} in the system
                              </div>
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                No employees found
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setShowRaterPicker(null);
                                setRaterSearch('');
                                setHighlightedEmployeeIndex(-1);
                              }}
                              className="w-full mt-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                onClick={() => {
                  const newIndex = raters.length;
                  // Start with empty relationship - user must select
                  setRaters([...raters, { name: '', email: '', relationship: '' as ParticipantRelationship }]);
                  setNewlyAddedRaterIndex(newIndex);
                  // Don't auto-open picker - wait for relationship selection
                  setShowRaterPicker(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Add Reviewer
              </button>

              {/* Reviewer count validation message */}
              {raters.length < 3 && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Add at least 3 reviewers.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Timeline */}
          {currentStep === 'timeline' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Automatic Reminder
                </label>
                <select
                  value={autoReminderDaysBefore === null ? '' : autoReminderDaysBefore}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAutoReminderDaysBefore(value === '' ? null : parseInt(value));
                  }}
                  className="pl-4 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M10.293%203.293L6%207.586%201.707%203.293A1%201%200%2000.293%204.707l5%205a1%201%200%20001.414%200l5-5a1%201%200%2010-1.414-1.414z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_1rem_center] bg-no-repeat"
                >
                  <option value="">No automatic reminders</option>
                  <option value="1">1 day before due date</option>
                  <option value="2">2 days before due date</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Recommended:</strong> Allow 7-14 days for raters to complete thoughtful feedback.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Confirm Details and Launch</h3>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Employee</div>
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={displayName}
                      picture={selectedEmployee?.picture ?? undefined}
                      size="md"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{displayName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{selectedEmployee?.title}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Questions ({requiredQuestions.length + customQuestions.length})
                  </div>
                  <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    {requiredQuestions.map((q, i) => (
                      <li key={`req-${i}`}>• {replaceNamePlaceholder(q, displayName)}</li>
                    ))}
                    {customQuestions.map((q, i) => (
                      <li key={`custom-${i}`} className="text-blue-700 dark:text-blue-400">• {replaceNamePlaceholder(q, displayName)}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reviewers ({raters.length})</div>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
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

                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Due Date</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(dueDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={currentStepIndex === 0 ? handleClose : handleBack}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              data-launch-button
              onClick={handleCreate}
              disabled={isCreating || !canProceed()}
              className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition-colors flex items-center gap-2 disabled:opacity-50"
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
        selectedEmployee={selectedEmployee}
        currentStep={currentStep}
        employees={employees}
      />
    </>,
    document.body
  ) : null;
}

