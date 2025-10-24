import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Employee, EmployeePlan, Performance, Potential, PlanType } from '../types';
import { getAnthropicClient, isAnthropicConfigured } from '../lib/anthropicService';

// ============================================
// TYPES & INTERFACES
// ============================================

// Toast Types
export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastEntry extends Required<ToastOptions> {
  id: string;
  dismissAt: number;
}

// Quick Action Types
export type QuickActionType =
  | 'create-plan'
  | 'schedule-1on1'
  | 'view-notes'
  | 'start-pip'
  | 'add-to-succession'
  | 'open-calibration'
  | 'request-360'
  | 'view-360'
  | 'open-employee-detail'
  | 'bulk-action'
  | 'view-review'
  | 'create-review'
  | 'navigate'
  | 'open-plan-wizard'
  | 'open-review-modal'
  | 'open-plan-modal'
  | 'bulk-create-plans'
  | 'launch-plan-wizard';

export interface QuickActionPayload {
  type: QuickActionType;
  employeeId?: string;
  employeeIds?: string[];
  context?: {
    planType?: PlanType;
    urgent?: boolean;
    initialTab?: string;
    prefill?: any;
    mode?: string;
    [key: string]: any;
  };
}

// Employee Focus Types
interface FocusedEmployee {
  employee: Employee;
  pinnedAt: Date;
  source: string;
}

// AI Coach Types
export interface AICoachSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'action' | 'insight' | 'warning' | 'tip';
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    actionType: string;
    payload: any;
  }>;
  dismissable: boolean;
  learnMore?: string;
  context?: {
    employeeIds?: string[];
    relatedTo?: string;
  };
  createdAt: number;
}

export interface OnboardingTip {
  id: string;
  title: string;
  description: string;
  targetId?: string;
  navigateTo?: string;
  action?: () => void;
  completed: boolean;
}

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PlacementSuggestion {
  employeeId: string;
  performance: Performance;
  potential: Potential;
  reasoning: string;
  confidence?: number;
}

interface WorkflowContext {
  currentView: string;
  focusedEmployeeIds: string[];
  recentActions: string[];
  timeOnPage: number;
  selectedDepartments: string[];
  openModalType?: string;
  openModalContext?: any;
}

// Storage interface
interface AppStorageState {
  completedTips: Record<string, boolean>;
  dismissedSuggestions: Record<string, number>;
  isMinimized: boolean;
}

// ============================================
// CONTEXT VALUE INTERFACE
// ============================================

interface TalentAppContextValue {
  // Toast notifications
  notify: (options: ToastOptions) => string;
  dismissToast: (toastId: string) => void;
  toasts: ToastEntry[];

  // Quick actions
  executeAction: (payload: QuickActionPayload) => void;
  registerHandler: (type: QuickActionType, handler: (payload: QuickActionPayload) => void) => void;
  navigationHistory: QuickActionPayload[];

  // Employee focus
  focusedEmployees: FocusedEmployee[];
  pinEmployee: (employee: Employee, source: string) => void;
  unpinEmployee: (employeeId: string) => void;
  isPinned: (employeeId: string) => boolean;
  clearAllPins: () => void;
  compareMode: boolean;
  setCompareMode: (enabled: boolean) => void;

  // AI suggestions
  suggestions: AICoachSuggestion[];
  dismissSuggestion: (id: string) => void;
  addSuggestion: (suggestion: Omit<AICoachSuggestion, 'createdAt'>) => void;

  // Onboarding tips
  onboardingTips: OnboardingTip[];
  markTipComplete: (tipId: string) => void;

  // Q&A
  askQuestion: (question: string) => Promise<{ answer: string; entry: QAEntry }>;
  qaHistory: QAEntry[];
  isAsking: boolean;
  conversationHistory: ConversationMessage[];
  clearConversation: () => void;

  // Placement suggestions
  registerPlacementSuggestion: (suggestion: PlacementSuggestion) => void;

  // Workflow tracking
  trackAction: (action: string, metadata?: any) => void;
  workflowContext: WorkflowContext;
  setModalContext: (modalType: string | undefined, context?: any) => void;

  // UI state
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;

  // Navigation
  navigateToView?: (view: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'sonance-talent-app-v1';
const DEFAULT_TOAST_DURATION = 6000;

const defaultStorageState: AppStorageState = {
  completedTips: {},
  dismissedSuggestions: {},
  isMinimized: false,
};

const ONBOARDING_TIPS_CONFIG = [
  {
    id: 'ai-assist-center',
    title: 'AI Assist Center',
    description: 'Launch review imports, AI drafts, or plan builders from one ribbon. Pick a teammate to unlock shortcuts.',
    targetId: 'ai-assist-center',
    navigateTo: 'evaluate',
  },
  {
    id: 'nine-box-grid',
    title: '9-Box Talent Grid',
    description: 'Drag employees between performance and potential boxes, then open cards for reviews or development plans.',
    targetId: 'nine-box-talent-grid',
    navigateTo: 'evaluate',
  },
  {
    id: 'department-filters',
    title: 'Department focus',
    description: 'Filter talent views by department or compare teams side-by-side to see coverage and star talent.',
    targetId: 'department-focus-panel',
    navigateTo: 'evaluate',
  },
];

const KNOWLEDGE_BASE: Array<{ match: RegExp; answer: string }> = [
  {
    match: /(assess|measuring?)\s+potential|potential scale/i,
    answer:
      'Assess potential by looking for learning agility, leadership signals, and ability to take on stretch work. Use the 9-box: low = steady contribution, medium = expanding influence, high = ready for accelerated growth. Capture the rationale in the employee card so future calibrations have context.',
  },
  {
    match: /(who|show).*needs? (plans?|development)/i,
    answer:
      'Jump to the Follow Through view and filter by "Plans needed." The suggestions will list employees without plans—select one to launch the plan builder with AI suggestions.',
  },
  {
    match: /difference.*plan.*review|plan vs review/i,
    answer:
      'Reviews capture performance evidence, while plans translate that feedback into concrete action items. The Calibrate tab aligns ratings; the Follow Through tab turns them into development plans and accountability.',
  },
];

// ============================================
// CONTEXT & PROVIDER
// ============================================

const TalentAppContext = createContext<TalentAppContextValue | null>(null);

// Load state from localStorage
function loadStorageState(): AppStorageState {
  if (typeof window === 'undefined') return defaultStorageState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStorageState;
    const parsed = JSON.parse(raw) as AppStorageState;
    return { ...defaultStorageState, ...parsed };
  } catch (error) {
    console.warn('[TalentApp] Failed to load state', error);
    return defaultStorageState;
  }
}

export function TalentAppProvider({
  children,
  employees = [],
  employeePlans = {},
  performanceReviews = {},
  currentView = '',
  selectedDepartments = [],
  onNavigateToView,
}: {
  children: ReactNode;
  employees?: Employee[];
  employeePlans?: Record<string, EmployeePlan>;
  performanceReviews?: Record<string, any>;
  currentView?: string;
  selectedDepartments?: string[];
  onNavigateToView?: (view: string) => void;
}) {
  // ============ Toast State ============
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // ============ Quick Action State ============
  const [actionHandlers, setActionHandlers] = useState<Map<QuickActionType, (payload: QuickActionPayload) => void>>(
    new Map()
  );
  const [navigationHistory, setNavigationHistory] = useState<QuickActionPayload[]>([]);

  // ============ Employee Focus State ============
  const [focusedEmployees, setFocusedEmployees] = useState<FocusedEmployee[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // ============ AI Coach State ============
  const [storageState, setStorageState] = useState<AppStorageState>(() => loadStorageState());
  const [suggestions, setSuggestions] = useState<AICoachSuggestion[]>([]);
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [workflowContext, setWorkflowContext] = useState<WorkflowContext>({
    currentView: '',
    focusedEmployeeIds: [],
    recentActions: [],
    timeOnPage: 0,
    selectedDepartments: [],
    openModalType: undefined,
    openModalContext: undefined,
  });

  // ============================================
  // EFFECTS
  // ============================================

  // Persist storage state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState));
  }, [storageState]);

  // Update workflow context with focused employees
  useEffect(() => {
    setWorkflowContext(prev => ({
      ...prev,
      focusedEmployeeIds: focusedEmployees.map(f => f.employee.id),
    }));
  }, [focusedEmployees]);

  // Update workflow context with current view
  useEffect(() => {
    setWorkflowContext(prev => ({
      ...prev,
      currentView,
      timeOnPage: 0,
    }));
  }, [currentView]);

  // Update workflow context with selected departments
  useEffect(() => {
    setWorkflowContext(prev => ({
      ...prev,
      selectedDepartments,
    }));
  }, [selectedDepartments]);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkflowContext(prev => ({
        ...prev,
        timeOnPage: prev.timeOnPage + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate suggestions
  useEffect(() => {
    const newSuggestions = generateSuggestions({
      employees,
      employeePlans,
      performanceReviews,
      focusedEmployees: focusedEmployees.map(f => f.employee),
      workflowContext,
      dismissedSuggestions: storageState.dismissedSuggestions,
    });

    setSuggestions(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newSuggestions)) {
        return prev;
      }
      return newSuggestions;
    });
  }, [employees, employeePlans, performanceReviews, focusedEmployees, workflowContext, storageState.dismissedSuggestions]);

  // ============================================
  // TOAST CALLBACKS
  // ============================================

  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const notify = useCallback(
    (options: ToastOptions) => {
      const now = Date.now();
      const id = options.id || `toast-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = options.durationMs ?? DEFAULT_TOAST_DURATION;

      const toast: ToastEntry = {
        id,
        title: options.title ?? '',
        description: options.description ?? '',
        variant: options.variant ?? 'info',
        durationMs: duration,
        actionLabel: options.actionLabel ?? '',
        onAction: options.onAction ?? (() => {}),
        dismissAt: now + duration,
      };

      setToasts(prev => [...prev, toast]);

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast]
  );

  // ============================================
  // QUICK ACTION CALLBACKS
  // ============================================

  const registerHandler = useCallback((type: QuickActionType, handler: (payload: QuickActionPayload) => void) => {
    setActionHandlers(prev => {
      const newMap = new Map(prev);
      newMap.set(type, handler);
      return newMap;
    });
  }, []);

  const executeAction = useCallback(
    (payload: QuickActionPayload) => {
      const handler = actionHandlers.get(payload.type);
      if (handler) {
        handler(payload);
        setNavigationHistory(prev => [...prev.slice(-9), payload]);
      } else {
        console.warn(`[TalentApp] No handler registered for action type: ${payload.type}`);
      }
    },
    [actionHandlers]
  );

  // ============================================
  // EMPLOYEE FOCUS CALLBACKS
  // ============================================

  const pinEmployee = useCallback((employee: Employee, source: string) => {
    setFocusedEmployees(prev => {
      if (prev.some(f => f.employee.id === employee.id)) {
        console.log(`[TalentApp] Employee ${employee.name} already pinned`);
        return prev;
      }
      const newFocused = [...prev, { employee, pinnedAt: new Date(), source }];
      const limited = newFocused.slice(-5); // Limit to 5
      console.log(`[TalentApp] Pinned ${employee.name} from ${source}. Total: ${limited.length}`);
      return limited;
    });
  }, []);

  const unpinEmployee = useCallback((employeeId: string) => {
    setFocusedEmployees(prev => {
      const filtered = prev.filter(f => f.employee.id !== employeeId);
      console.log(`[TalentApp] Unpinned employee. Remaining: ${filtered.length}`);
      return filtered;
    });
  }, []);

  const isPinned = useCallback(
    (employeeId: string) => {
      return focusedEmployees.some(f => f.employee.id === employeeId);
    },
    [focusedEmployees]
  );

  const clearAllPins = useCallback(() => {
    console.log('[TalentApp] Clearing all pinned employees');
    setFocusedEmployees([]);
    setCompareMode(false);
  }, []);

  // ============================================
  // AI COACH CALLBACKS
  // ============================================

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    setStorageState(prev => ({
      ...prev,
      dismissedSuggestions: {
        ...prev.dismissedSuggestions,
        [id]: Date.now(),
      },
    }));
  }, []);

  const addSuggestion = useCallback((suggestion: Omit<AICoachSuggestion, 'createdAt'>) => {
    setSuggestions(prev => {
      if (prev.some(s => s.id === suggestion.id)) {
        return prev;
      }
      return [...prev, { ...suggestion, createdAt: Date.now() }];
    });
  }, []);

  const markTipComplete = useCallback((tipId: string) => {
    setStorageState(prev => ({
      ...prev,
      completedTips: {
        ...prev.completedTips,
        [tipId]: true,
      },
    }));
  }, []);

  const generateFallbackAnswer = useCallback((question: string) => {
    const entry = KNOWLEDGE_BASE.find(({ match }) => match.test(question));
    if (entry) return entry.answer;
    return 'Use the suggestions above for the next best action, or explore the Evaluate, Prepare, Calibrate, and Follow Through workflows. Ask me with more detail if you need a walkthrough.';
  }, []);

  const askQuestion = useCallback(
    async (question: string): Promise<{ answer: string; entry: QAEntry }> => {
      const trimmed = question.trim();
      if (!trimmed) {
        throw new Error('Please type a question.');
      }

      setIsAsking(true);
      try {
        let answer = '';

        const userMessage: ConversationMessage = {
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
        };

        if (isAnthropicConfigured()) {
          try {
            const anthropic = getAnthropicClient();

            const systemPrompt = `You are the AI assistant inside the Sonance Talent Management platform. You help users manage talent, conduct performance reviews, create development plans, and optimize their HR workflows.

Key features to reference:
- Evaluate tab: Assess employees on the 9-box grid (performance vs potential)
- Prepare tab: Draft and import performance reviews
- Calibrate tab: Align ratings across teams
- Follow Through tab: Track development plans and action items
- People tab: View all employees and their details
- Command Center: Executive dashboard with key metrics

Be conversational, helpful, and remember the context of the conversation. Answer succinctly (150 words or fewer) with actionable guidance.`;

            const messages = conversationHistory.map(msg => ({
              role: msg.role,
              content: msg.content,
            }));

            messages.push({
              role: 'user',
              content: trimmed,
            });

            const response = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 600,
              temperature: 0.5,
              system: systemPrompt,
              messages: messages as any,
            });

            const content = response.content[0];
            if (content.type === 'text') {
              answer = content.text.trim();
            }
          } catch (error) {
            console.warn('[TalentApp] Anthropic Q&A failed, using fallback', error);
            answer = generateFallbackAnswer(trimmed);
          }
        } else {
          answer = generateFallbackAnswer(trimmed);
        }

        if (!answer) {
          answer = generateFallbackAnswer(trimmed);
        }

        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: answer,
          timestamp: Date.now(),
        };

        setConversationHistory(prev => [...prev, userMessage, assistantMessage]);

        const entry: QAEntry = {
          id: `qa-${Date.now()}`,
          question: trimmed,
          answer,
          createdAt: Date.now(),
        };
        setQaHistory(prev => [entry, ...prev].slice(0, 10));
        return { answer, entry };
      } finally {
        setIsAsking(false);
      }
    },
    [generateFallbackAnswer, conversationHistory]
  );

  const registerPlacementSuggestion = useCallback(
    (suggestion: PlacementSuggestion) => {
      const confidenceText = suggestion.confidence ? ` (${suggestion.confidence}% confidence)` : '';
      addSuggestion({
        id: `placement-${suggestion.employeeId}`,
        priority: 'medium',
        type: 'insight',
        title: `AI suggests 9-box placement${confidenceText}`,
        description: suggestion.reasoning,
        actions: [
          {
            label: 'View 9-box grid',
            actionType: 'navigate',
            payload: { view: 'evaluate' },
          },
        ],
        dismissable: true,
      });
    },
    [addSuggestion]
  );

  const trackAction = useCallback((action: string, metadata?: any) => {
    setWorkflowContext(prev => ({
      ...prev,
      recentActions: [...prev.recentActions.slice(-19), action],
    }));
    console.log('[TalentApp] Action tracked:', action, metadata);
  }, []);

  const setModalContext = useCallback((modalType: string | undefined, context?: any) => {
    setWorkflowContext(prev => ({
      ...prev,
      openModalType: modalType,
      openModalContext: context,
    }));
  }, []);

  const setIsMinimized = useCallback((minimized: boolean) => {
    setStorageState(prev => ({ ...prev, isMinimized: minimized }));
  }, []);

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setQaHistory([]);
  }, []);

  // ============================================
  // MEMOIZED VALUES
  // ============================================

  const onboardingTips = useMemo(
    () =>
      ONBOARDING_TIPS_CONFIG.map(tip => ({
        ...tip,
        completed: Boolean(storageState.completedTips[tip.id]),
      })),
    [storageState.completedTips]
  );

  const value = useMemo<TalentAppContextValue>(
    () => ({
      // Toast
      notify,
      dismissToast,
      toasts,
      // Quick actions
      executeAction,
      registerHandler,
      navigationHistory,
      // Employee focus
      focusedEmployees,
      pinEmployee,
      unpinEmployee,
      isPinned,
      clearAllPins,
      compareMode,
      setCompareMode,
      // AI suggestions
      suggestions,
      dismissSuggestion,
      addSuggestion,
      onboardingTips,
      markTipComplete,
      askQuestion,
      qaHistory,
      isAsking,
      conversationHistory,
      clearConversation,
      registerPlacementSuggestion,
      trackAction,
      workflowContext,
      isMinimized: storageState.isMinimized,
      setIsMinimized,
      setModalContext,
      navigateToView: onNavigateToView,
    }),
    [
      notify,
      dismissToast,
      toasts,
      executeAction,
      registerHandler,
      navigationHistory,
      focusedEmployees,
      pinEmployee,
      unpinEmployee,
      isPinned,
      clearAllPins,
      compareMode,
      suggestions,
      dismissSuggestion,
      addSuggestion,
      onboardingTips,
      markTipComplete,
      askQuestion,
      qaHistory,
      isAsking,
      conversationHistory,
      clearConversation,
      registerPlacementSuggestion,
      trackAction,
      workflowContext,
      storageState.isMinimized,
      setIsMinimized,
      setModalContext,
      onNavigateToView,
    ]
  );

  return (
    <TalentAppContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </TalentAppContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

export function useTalentApp() {
  const context = useContext(TalentAppContext);
  if (!context) {
    throw new Error('useTalentApp must be used within TalentAppProvider');
  }
  return context;
}

// Backwards compatibility hooks
export function useToast() {
  const { notify, dismissToast, toasts } = useTalentApp();
  return { notify, dismiss: dismissToast, toasts };
}

export function useQuickAction() {
  const { executeAction, registerHandler, navigationHistory } = useTalentApp();
  return { executeAction, registerHandler, navigationHistory, addToHistory: () => {} };
}

export function useEmployeeFocus() {
  const { focusedEmployees, pinEmployee, unpinEmployee, isPinned, clearAllPins, compareMode, setCompareMode } =
    useTalentApp();
  return { focusedEmployees, pinEmployee, unpinEmployee, isPinned, clearAll: clearAllPins, compareMode, setCompareMode };
}

export function useUnifiedAICoach() {
  const {
    suggestions,
    dismissSuggestion,
    addSuggestion,
    onboardingTips,
    markTipComplete,
    askQuestion,
    qaHistory,
    isAsking,
    conversationHistory,
    clearConversation,
    registerPlacementSuggestion,
    trackAction,
    workflowContext,
    isMinimized,
    setIsMinimized,
    setModalContext,
    navigateToView,
  } = useTalentApp();

  return {
    suggestions,
    dismissSuggestion,
    addSuggestion,
    onboardingTips,
    markTipComplete,
    askQuestion,
    qaHistory,
    isAsking,
    conversationHistory,
    clearConversation,
    registerPlacementSuggestion,
    trackAction,
    workflowContext,
    isMinimized,
    setIsMinimized,
    setModalContext,
    navigateToView,
  };
}

// ============================================
// TOAST VIEWPORT COMPONENT
// ============================================

interface ToastViewportProps {
  toasts: ToastEntry[];
  onDismiss: (toastId: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col items-end gap-3 px-6 py-6 z-[9999]">
      <div className="ml-auto w-full max-w-sm space-y-3">
        {toasts.map(toast => (
          <article
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-gray-200 shadow-lg bg-white/95 backdrop-blur-sm px-4 py-3 flex flex-col gap-1 transition-transform duration-200 ease-out translate-x-0"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                {toast.title && <p className="text-sm font-semibold text-gray-900">{toast.title}</p>}
                {toast.description && <p className="text-sm text-gray-600 whitespace-pre-line">{toast.description}</p>}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </header>
            <footer className="flex items-center justify-between text-xs">
              <span className={variantColorClass(toast.variant)}>{variantLabel(toast.variant)}</span>
              {toast.actionLabel && (
                <button
                  onClick={() => {
                    toast.onAction();
                    onDismiss(toast.id);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {toast.actionLabel}
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function variantLabel(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'Success';
    case 'warning':
      return 'Needs attention';
    case 'error':
      return 'Error';
    default:
      return 'Notice';
  }
}

function variantColorClass(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'text-green-600';
    case 'warning':
      return 'text-amber-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-blue-600';
  }
}

// ============================================
// SUGGESTION GENERATION LOGIC
// ============================================

function generateSuggestions(data: {
  employees: Employee[];
  employeePlans: Record<string, EmployeePlan>;
  performanceReviews: Record<string, any>;
  focusedEmployees: Employee[];
  workflowContext: WorkflowContext;
  dismissedSuggestions: Record<string, number>;
}): AICoachSuggestion[] {
  const suggestions: AICoachSuggestion[] = [];
  const { currentView, selectedDepartments } = data.workflowContext;

  const filteredEmployees =
    selectedDepartments.length > 0
      ? data.employees.filter(emp => emp.department_id && selectedDepartments.includes(emp.department_id))
      : data.employees;

  const isDismissedRecently = (id: string) => {
    const dismissedAt = data.dismissedSuggestions[id];
    if (!dismissedAt) return false;
    const hoursSinceDismissal = (Date.now() - dismissedAt) / (1000 * 60 * 60);
    return hoursSinceDismissal < 24;
  };

  // EVALUATE VIEW - Focus on assessment
  if (currentView === 'evaluate') {
    const unassessed = filteredEmployees.filter(emp => !emp.assessment);

    if (unassessed.length > 0 && !isDismissedRecently('evaluate-unassessed')) {
      suggestions.push({
        id: 'evaluate-unassessed',
        priority: 'high',
        type: 'action',
        title: `${unassessed.length} employee${unassessed.length !== 1 ? 's' : ''} need placement`,
        description: 'Drag them onto the 9-box grid to assess their performance and potential.',
        dismissable: true,
        context: { employeeIds: unassessed.map(e => e.id), relatedTo: 'evaluate' },
        createdAt: Date.now(),
      });
    }
  }

  // FOLLOW VIEW - Focus on development plans
  if (currentView === 'follow') {
    const employeesWithoutPlans = filteredEmployees.filter(emp => emp.assessment && !data.employeePlans[emp.id]);

    if (employeesWithoutPlans.length > 0 && !isDismissedRecently('follow-missing-plans')) {
      suggestions.push({
        id: 'follow-missing-plans',
        priority: 'high',
        type: 'action',
        title: `${employeesWithoutPlans.length} assessed employee${employeesWithoutPlans.length !== 1 ? 's' : ''} need development plans`,
        description: 'Create plans to turn assessments into actionable growth roadmaps.',
        actions: [
          {
            label: 'AI draft plans',
            actionType: 'bulk-create-plans',
            payload: { employeeIds: employeesWithoutPlans.map(e => e.id) },
          },
        ],
        dismissable: true,
        context: { employeeIds: employeesWithoutPlans.map(e => e.id), relatedTo: 'follow' },
        createdAt: Date.now(),
      });
    }
  }

  // Focused employee suggestions
  if (data.focusedEmployees.length > 0) {
    const focusedEmployee = data.focusedEmployees[0];
    const hasPlan = !!data.employeePlans[focusedEmployee.id];

    if (
      !hasPlan &&
      focusedEmployee.assessment &&
      !isDismissedRecently(`focused-needs-plan-${focusedEmployee.id}`)
    ) {
      suggestions.push({
        id: `focused-needs-plan-${focusedEmployee.id}`,
        priority: 'medium',
        type: 'tip',
        title: `${focusedEmployee.name} doesn't have a development plan`,
        description: "Since you're focused on this employee, consider creating a development plan to track their growth.",
        actions: [
          {
            label: 'Create plan',
            actionType: 'create-plan',
            payload: { employeeId: focusedEmployee.id },
          },
        ],
        dismissable: true,
        createdAt: Date.now(),
      });
    }
  }

  return suggestions;
}

