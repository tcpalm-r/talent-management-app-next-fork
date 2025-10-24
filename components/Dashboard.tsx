import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ClipboardList, Grid3X3, GitBranch, TrendingUp, LogOut, Sparkles, Award, AlertTriangle, ArrowUpRight, FileText, Users, Workflow, Target, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUnifiedAICoach } from '../context/UnifiedAICoachContext';
import { useQuickAction } from '../context/QuickActionContext';
import { useEmployeeFocus } from '../context/EmployeeFocusContext';
import UnifiedAICoach from './UnifiedAICoach';
import { supabase } from '../lib/supabase';
import type { User, Organization, Employee, Department, EmployeePlan, Performance, Potential } from '../types';
import NineBoxGrid from './NineBoxGrid';
import DepartmentSelector from './DepartmentSelector';
import ReviewParserModal from './ReviewParserModal';
import PeopleDashboard from './PeopleDashboard';
import CalibrationDashboard from './CalibrationDashboard';
import PlansDashboard from './PlansDashboard';
import OnboardingDashboard from './OnboardingDashboard';
import Feedback360Dashboard from './Feedback360Dashboard';
import { NavigationTabs, useToast } from './unified';
import type { PerformanceReview } from './PerformanceReviewModal';
import AIHelperRibbon from './AIHelperRibbon';
import AIDraftReviewModal from './AIDraftReviewModal';
import EnhancedEmployeePlanModal from './EnhancedEmployeePlanModal';
import AIGuidancePanel, { type AIGuidanceItem } from './AIGuidancePanel';
import { EmployeeContextBar } from './EmployeeContextBar';
import { BreadcrumbNav } from './BreadcrumbNav';
import EmployeeDetailModal from './EmployeeDetailModal';
import { WorkflowProvider } from '../context/WorkflowContext';
import WorkflowDashboard from './WorkflowDashboard';
import ExecutiveCommandCenter from './ExecutiveCommandCenter';
import CommandWatchlist, { type CommandWatchlistEntry } from './CommandWatchlist';
import CommandFocusedList, { type CommandFocusedEntry } from './CommandFocusedList';
import CommandTaskInbox, { type CommandTaskItem } from './CommandTaskInbox';
import { calculatePlanProgress, getOverdueActionItems } from '../lib/actionItemGenerator';
import ExecutiveWelcomeWizard from './ExecutiveWelcomeWizard';
import TeamProgressDashboard from './TeamProgressDashboard';
import Survey360Wizard from './Survey360Wizard';

interface DashboardProps {
  user: SupabaseUser;
  userProfile: User;
  organization: Organization;
  onViewChange?: (view: string) => void;
  onDepartmentsChange?: (departments: string[]) => void;
  onEmployeesChange?: (employees: any[]) => void;
  onPlansChange?: (plans: Record<string, any>) => void;
  onReviewsChange?: (reviews: Record<string, any>) => void;
  onRegisterNavigate?: (fn: ((view: string) => void) | null) => void;
}

type View = 'welcome' | 'team' | 'reviews' | 'insights' | 'settings';
type PeopleFilter = 'all' | 'assessed' | 'watchlist';
type ProgramHubView = 'development' | 'onboarding' | 'feedback360' | 'calibration' | 'workflow';
type CommandFocus = 'overview' | 'attention';

export default function Dashboard({
  user: _user,
  userProfile,
  organization,
  onViewChange,
  onDepartmentsChange,
  onEmployeesChange,
  onPlansChange,
  onReviewsChange,
  onRegisterNavigate,
}: DashboardProps) {
  const { notify } = useToast();
  const { registerHandler } = useQuickAction();
  const { focusedEmployees, pinEmployee, unpinEmployee, compareMode, setCompareMode } = useEmployeeFocus();
  const {
    addSuggestion,
    dismissSuggestion,
    registerPlacementSuggestion,
  } = useUnifiedAICoach();

  const shellClass = 'mx-auto w-full px-6 lg:px-8 xl:px-12 max-w-screen-2xl 2xl:px-16 2xl:max-w-[1700px]';
  const evaluateShellClass = 'mx-auto w-full px-6 lg:px-8 xl:px-12 max-w-screen-2xl 2xl:px-16 2xl:max-w-[1900px]';

  const [currentView, setCurrentView] = useState<View>('team');
  const [isFirstRun, setIsFirstRun] = useState<boolean>(true);
  const [checkingFirstRun, setCheckingFirstRun] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isReviewParserOpen, setIsReviewParserOpen] = useState(false);
  const [employeePlans, setEmployeePlans] = useState<Record<string, EmployeePlan>>({});
  const [performanceReviews, setPerformanceReviews] = useState<Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>>({});
  const [aiFocusEmployeeId, setAiFocusEmployeeId] = useState<string | null>(null);
  const [draftTargetEmployee, setDraftTargetEmployee] = useState<Employee | null>(null);
  const [isAIDraftModalOpen, setIsAIDraftModalOpen] = useState(false);
  const [planTargetEmployee, setPlanTargetEmployee] = useState<Employee | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [detailModalEmployee, setDetailModalEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [programsView, setProgramsView] = useState<ProgramHubView>('development');
  const [commandFocus, setCommandFocus] = useState<CommandFocus>('overview');
  const [selectedEmployeesFor360, setSelectedEmployeesFor360] = useState<Employee[]>([]);
  const [is360WizardOpen, setIs360WizardOpen] = useState(false);

  const changeView = useCallback((view: View) => {
    setCurrentView(view);
    onViewChange?.(view);
  }, [onViewChange]);

  const handleViewNavigation = useCallback((view: string) => {
    switch (view) {
      case 'command':
      case 'command-center':
        changeView('insights');
        break;
      case 'team':
        changeView('team');
        break;
      case 'reviews':
        changeView('reviews');
        break;
      case 'insights':
        changeView('insights');
        break;
      case 'settings':
        changeView('settings');
        break;
      case 'prepare':
      case 'calibrate':
        setProgramsView('calibration');
        changeView('reviews');
        break;
      case 'evaluate':
      case 'people':
        setPeopleFilter('all');
        changeView('team');
        break;
      case 'workflow':
        setProgramsView('workflow');
        changeView('reviews');
        break;
      case 'follow':
        setProgramsView('development');
        changeView('reviews');
        break;
      case '360':
      case 'feedback360':
        setProgramsView('feedback360');
        changeView('reviews');
        break;
      default:
        break;
    }
  }, [changeView, setProgramsView, setPeopleFilter]);

  useEffect(() => {
    if (!onRegisterNavigate) return;
    onRegisterNavigate(handleViewNavigation);
    return () => onRegisterNavigate(null);
  }, [onRegisterNavigate, handleViewNavigation]);

  const totalEmployees = employees.length;
  const assessedEmployees = useMemo(() => employees.filter(emp => Boolean(emp.assessment)), [employees]);
  const unassessedCount = totalEmployees - assessedEmployees.length;

  const reviewMetrics = useMemo(() => {
    let pendingSelf = 0;
    let pendingManager = 0;
    let misaligned = 0;

    const scoreForSummary: Record<string, number> = {
      excellence: 5,
      exceeds: 4,
      meets: 3,
      occasionally_meets: 2,
      not_performing: 1,
    };

    const normalizeSelfScore = (review?: PerformanceReview) => {
      if (!review) return null;
      const avg = (review.humble_score + review.hungry_score + review.smart_score) / 3;
      return Math.round(avg);
    };

    employees.forEach(emp => {
      const record = performanceReviews[emp.id] || {};
      const managerReview = record.manager;
      const selfReview = record.self;

      if (!selfReview || (selfReview.status !== 'submitted' && selfReview.status !== 'completed')) {
        pendingSelf += 1;
      }

      if (!managerReview || managerReview.status !== 'completed') {
        pendingManager += 1;
      }

      if (
        managerReview &&
        managerReview.status === 'completed' &&
        selfReview &&
        (selfReview.status === 'submitted' || selfReview.status === 'completed')
      ) {
        const managerScore = managerReview.manager_performance_summary ? scoreForSummary[managerReview.manager_performance_summary] ?? null : null;
        const selfScore = normalizeSelfScore(selfReview);

        if (managerScore !== null && selfScore !== null && Math.abs(managerScore - selfScore) >= 1) {
          misaligned += 1;
        }
      }
    });

    return {
      pendingSelf,
      pendingManager,
      misaligned,
      totalPending: pendingSelf + pendingManager,
    };
  }, [employees, performanceReviews]);

  const planMetrics = useMemo(() => {
    const assessedIds = new Set(assessedEmployees.map(emp => emp.id));
    let missingPlans = 0;
    let overdueActions = 0;

    employees.forEach(emp => {
      if (!assessedIds.has(emp.id)) return;
      const plan = employeePlans[emp.id];
      if (!plan) {
        missingPlans += 1;
        return;
      }

      const items = plan.action_items || [];
      overdueActions += items.filter(item => item.status === 'overdue').length;
    });

    const pendingAck = employees.reduce((count, emp) => {
      const notes = emp.manager_notes || [];
      return count + notes.filter(note => note.requires_acknowledgment && !note.acknowledged_at).length;
    }, 0);

    return {
      missingPlans,
      overdueActions,
      pendingAck,
      totalFollowThrough: missingPlans + overdueActions + pendingAck,
    };
  }, [employees, assessedEmployees, employeePlans]);

  const employeesNeedingManagerReview = useMemo(() => {
    return employees.filter(emp => {
      const record = performanceReviews[emp.id];
      const managerReview = record?.manager;
      return !managerReview || managerReview.status !== 'completed';
    });
  }, [employees, performanceReviews]);

  const employeesNeedingPlan = useMemo(() => {
    const assessedIds = new Set(assessedEmployees.map(emp => emp.id));
    return employees.filter(emp => assessedIds.has(emp.id) && !employeePlans[emp.id]);
  }, [employees, assessedEmployees, employeePlans]);

  const highRiskCandidates = useMemo(() => {
    return employees
      .map(emp => {
        const joinDate = new Date(emp.created_at);
        const monthsWithCompany = Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        const isNew = monthsWithCompany < 6;
        const hasPlan = Boolean(employeePlans[emp.id]);
        const perf = emp.assessment?.performance;
        const pot = emp.assessment?.potential;

        let score = 0;
        if (isNew) score += 20;
        if (!hasPlan && emp.assessment) score += 15;
        if (perf === 'high' && pot === 'high') score += 20;
        if (!emp.assessment) score += 10;

        return { employee: emp, score };
      })
      .filter(entry => entry.score >= 25)
      .sort((a, b) => b.score - a.score);
  }, [employees, employeePlans]);

  const assessedCount = assessedEmployees.length;
  const activePlansCount = Math.max(assessedCount - planMetrics.missingPlans, 0);
  const assessedCoverage = totalEmployees > 0 ? Math.round((assessedCount / totalEmployees) * 100) : 0;
  const itemsNeedingAttention = reviewMetrics.totalPending + planMetrics.totalFollowThrough + highRiskCandidates.length;

  interface HeroMetric {
    id: string;
    label: string;
    value: number;
    displayValue: string;
    icon: LucideIcon;
    helper: string;
    targetView: View;
    targetFilter?: string;
  }

  const heroStats = useMemo<HeroMetric[]>(() => (
    [
      {
        id: 'total',
        label: 'Total talent',
        value: totalEmployees,
        displayValue: totalEmployees.toLocaleString(),
        icon: Users,
        helper: 'Entire organization',
        targetView: 'people' as View,
      },
      {
        id: 'assessed',
        label: 'Assessed coverage',
        value: assessedCoverage,
        displayValue: `${assessedCoverage}%`,
        icon: Award,
        helper: `${assessedCount}/${totalEmployees || 1} assessed`,
        targetView: 'people' as View,
        targetFilter: 'assessed',
      },
      {
        id: 'plans',
        label: 'Active plans',
        value: activePlansCount,
        displayValue: activePlansCount.toLocaleString(),
        icon: ClipboardList,
        helper: `${planMetrics.missingPlans} missing plans`,
        targetView: 'programs' as View,
        targetFilter: 'development',
      },
      {
        id: 'attention',
        label: 'Items needing attention',
        value: itemsNeedingAttention,
        displayValue: itemsNeedingAttention.toLocaleString(),
        icon: AlertTriangle,
        helper: `${reviewMetrics.totalPending} reviews · ${planMetrics.totalFollowThrough} plan items`,
        targetView: 'command-center' as View,
        targetFilter: 'attention',
      },
    ]
  ), [
    totalEmployees,
    assessedCoverage,
    assessedCount,
    activePlansCount,
    planMetrics.missingPlans,
    reviewMetrics.totalPending,
    planMetrics.totalFollowThrough,
    itemsNeedingAttention,
  ]);

  const handleHeroMetricClick = useCallback((metric: HeroMetric) => {
    changeView(metric.targetView);

    if (metric.targetView === 'people') {
      setPeopleFilter(metric.targetFilter === 'assessed' ? 'assessed' : 'all');
    }

    if (metric.targetView === 'programs') {
      switch (metric.targetFilter) {
        case 'onboarding':
          setProgramsView('onboarding');
          break;
        case 'feedback360':
        case '360':
          setProgramsView('feedback360');
          break;
        case 'calibration':
          setProgramsView('calibration');
          break;
        case 'workflow':
          setProgramsView('workflow');
          break;
        default:
          setProgramsView('development');
      }
    }

    if (metric.targetView === 'command-center') {
      const nextFocus = metric.targetFilter === 'attention' ? 'attention' : 'overview';
      setCommandFocus(nextFocus);

      if (nextFocus === 'attention') {
        window.requestAnimationFrame(() => {
          const anchor = document.getElementById('what-needs-attention');
          if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    }
  }, [changeView]);

  const programTabs = useMemo(() => ([
    {
      id: 'development',
      label: 'Development Plans',
      icon: ClipboardList,
      tooltip: 'Track plan coverage, overdue actions, and coaching momentum.',
      count: activePlansCount || undefined,
    },
    {
      id: 'onboarding',
      label: 'Onboarding',
      icon: UserPlus,
      tooltip: 'Monitor 30/60/90 day ramps, buddies, and phase health.',
    },
    {
      id: 'feedback360',
      label: '360° Feedback',
      icon: Sparkles,
      tooltip: 'Collect and convert multi-rater feedback into coaching insights.',
      count: employeesNeedingManagerReview.length || undefined,
    },
    {
      id: 'calibration',
      label: 'Calibration',
      icon: GitBranch,
      tooltip: 'Resolve rating gaps and align on final outcomes.',
      count: reviewMetrics.misaligned || undefined,
    },
    {
      id: 'workflow',
      label: 'Workflow',
      icon: TrendingUp,
      tooltip: 'See who is stuck in the talent operating rhythm.',
      count: planMetrics.totalFollowThrough || undefined,
    },
  ]), [
    activePlansCount,
    employeesNeedingManagerReview.length,
    reviewMetrics.misaligned,
    planMetrics.totalFollowThrough,
  ]);

  const handleReviewSave = (review: PerformanceReview) => {
    setPerformanceReviews(prev => {
      const existing = prev[review.employee_id] || {};
      const updatedForEmployee = {
        ...existing,
        [review.review_type]: review,
      };
      
      // WORKFLOW AUTO-ADVANCEMENT: Check if we should trigger next step
      const employee = employees.find(e => e.id === review.employee_id);
      if (employee) {
        // If this was a self-review, suggest manager review
        if (review.review_type === 'self' && review.status === 'submitted') {
          setTimeout(() => {
            addSuggestion({
              id: `workflow-manager-review-${employee.id}`,
              priority: 'high',
              type: 'action',
              title: `${employee.name}'s self-review is complete`,
              description: 'Complete the manager review to advance their workflow to calibration.',
              actions: [{
                label: 'Open manager review',
                actionType: 'open-review-modal',
                payload: { employeeId: employee.id },
              }],
              dismissable: true,
            });
          }, 1000);
        }

        // If both reviews are now complete, suggest creating development plan
        const bothComplete = updatedForEmployee.self && updatedForEmployee.manager && 
          updatedForEmployee.manager.status === 'completed';
        
        if (bothComplete && !employeePlans[employee.id]) {
          setTimeout(() => {
            addSuggestion({
              id: `workflow-create-plan-${employee.id}`,
              priority: 'medium',
              type: 'action',
              title: `${employee.name} is ready for a development plan`,
              description: 'Both reviews are complete. Create a development plan to maintain workflow momentum.',
              actions: [{
                label: 'AI draft plan',
                actionType: 'open-plan-modal',
                payload: { employeeId: employee.id },
              }],
              dismissable: true,
            });
          }, 1500);
        }
      }
      
      return {
        ...prev,
        [review.employee_id]: updatedForEmployee,
      };
    });
  };

  const handleJumpToPrepare = (departmentId?: string) => {
    if (departmentId) {
      setSelectedDepartments([departmentId]);
    } else {
      setSelectedDepartments([]);
    }
    setProgramsView('calibration');
    changeView('programs');
  };

  const handleJumpToEvaluate = (departmentId?: string) => {
    if (departmentId) {
      setSelectedDepartments([departmentId]);
    } else {
      setSelectedDepartments([]);
    }
    setPeopleFilter('all');
    changeView('people');
  };

  const handleJumpToFollowThrough = (departmentId?: string) => {
    if (departmentId) {
      setSelectedDepartments([departmentId]);
    } else {
      setSelectedDepartments([]);
    }
    setProgramsView('development');
    changeView('programs');
  };

  const handleOpenTalentGrid = () => {
    setSelectedDepartments([]);
    setPeopleFilter('all');
    changeView('people');
    window.requestAnimationFrame(() => {
      const section = document.getElementById('talent-grid-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const openDraftAssistantForEmployee = useCallback((employee: Employee) => {
    setAiFocusEmployeeId(employee.id);
    setDraftTargetEmployee(employee);
    setIsAIDraftModalOpen(true);
  }, []);

  const openPlanAssistantForEmployee = useCallback((employee: Employee) => {
    setAiFocusEmployeeId(employee.id);
    setPlanTargetEmployee(employee);
    setIsPlanModalOpen(true);
  }, []);

  const handleOpenEmployeeDetail = useCallback((employee: Employee) => {
    setDetailModalEmployee(employee);
    setIsDetailModalOpen(true);
  }, []);

  const aiSuggestions = useMemo<AIGuidanceItem[]>(() => {
    const items: AIGuidanceItem[] = [];

    if (employeesNeedingManagerReview.length > 0) {
      const next = employeesNeedingManagerReview[0];
      items.push({
        id: `manager-review-${next.id}`,
        title: `Finish manager review for ${next.name}`,
        summary: 'Route managers through the assistant to capture highlights and risks before calibration.',
        severity: 'high',
        impact: 'team',
        signal: `${reviewMetrics.pendingManager} manager reviews waiting`,
        onApply: () => openDraftAssistantForEmployee(next),
        onSnooze: (duration) => notify({
          title: 'Reminder snoozed',
          description: `We will revisit ${next.name}'s review in ${duration}.`,
          variant: 'info',
        }),
        onAssign: (owner) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ai-helper-assignee', owner);
          }
          notify({
            title: 'Assigned to manager',
            description: `${owner} will take the lead on ${next.name}'s review.`,
            variant: 'success',
          });
        },
        onDismiss: (reason) => notify({
          title: 'Suggestion dismissed',
          description: reason,
          variant: 'info',
        }),
      });
    }

    if (reviewMetrics.pendingSelf > 0) {
      items.push({
        id: 'self-review-nudge',
        title: 'Send self-review prompts',
        summary: 'Share the AI prompt template so teammates can summarize wins, blockers, and support needs fast.',
        severity: 'medium',
        impact: 'team',
        signal: `${reviewMetrics.pendingSelf} self reviews still outstanding`,
        onApply: () => {
          void navigator.clipboard.writeText('Quick prompt: Share top 3 wins, toughest blocker, and what support would change the next cycle. Keep it under 150 words.');
          notify({
            title: 'Prompt copied',
            description: 'Share it in Slack or email to speed up responses.',
            variant: 'success',
          });
        },
        onSnooze: (duration) => notify({
          title: 'Reminder snoozed',
          description: `We will follow up in ${duration}.`,
          variant: 'info',
        }),
        onAssign: (owner) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ai-helper-assignee', owner);
          }
          notify({
            title: 'Delegated',
            description: `${owner} will handle the nudges.`,
            variant: 'success',
          });
        },
        onDismiss: (reason) => notify({
          title: 'Suggestion dismissed',
          description: reason,
          variant: 'info',
        }),
      });
    }

    if (employeesNeedingPlan.length > 0) {
      const next = employeesNeedingPlan[0];
      items.push({
        id: `plan-${next.id}`,
        title: `Generate plan for ${next.name}`,
        summary: 'Use the plan assistant to turn calibration feedback into SMART objectives and cadence.',
        severity: 'high',
        impact: 'individual',
        signal: `${employeesNeedingPlan.length} assessed employees lack plans`,
        onApply: () => openPlanAssistantForEmployee(next),
        onSnooze: (duration) => notify({
          title: 'Plan reminder snoozed',
          description: `We will remind you in ${duration}.`,
          variant: 'info',
        }),
        onAssign: (owner) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ai-helper-assignee', owner);
          }
          notify({
            title: 'Assigned to partner',
            description: `${owner} will draft the plan with AI.`,
            variant: 'success',
          });
        },
        onDismiss: (reason) => notify({
          title: 'Suggestion dismissed',
          description: reason,
          variant: 'info',
        }),
      });
    }

    if (reviewMetrics.misaligned > 0) {
      items.push({
        id: 'calibration-brief',
        title: 'Prep calibration talking points',
        summary: 'Summarize where self and manager ratings diverge so calibration rooms stay focused on evidence.',
        severity: 'high',
        impact: 'team',
        signal: `${reviewMetrics.misaligned} placements are misaligned`,
        onApply: () => handleJumpToEvaluate(),
        onSnooze: (duration) => notify({
          title: 'Calibration prep snoozed',
          description: `We will surface this again in ${duration}.`,
          variant: 'info',
        }),
        onAssign: (owner) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ai-helper-assignee', owner);
          }
          notify({
            title: 'Assigned for prep',
            description: `${owner} will own the calibration brief.`,
            variant: 'success',
          });
        },
        onDismiss: (reason) => notify({
          title: 'Suggestion dismissed',
          description: reason,
          variant: 'info',
        }),
      });
    }

    if (highRiskCandidates.length > 0) {
      const next = highRiskCandidates[0].employee;
      items.push({
        id: `retention-${next.id}`,
        title: `Mitigate risk for ${next.name}`,
        summary: 'Kick off a retention or mobility plan before the stay conversation.',
        severity: 'critical',
        impact: 'org',
        signal: `${highRiskCandidates.length} high-risk signals active`,
        onApply: () => openPlanAssistantForEmployee(next),
        onSnooze: (duration) => notify({
          title: 'Risk follow-up snoozed',
          description: `We will revisit in ${duration}.`,
          variant: 'info',
        }),
        onAssign: (owner) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ai-helper-assignee', owner);
          }
          notify({
            title: 'Assigned to follow-up',
            description: `${owner} will drive retention actions.`,
            variant: 'success',
          });
        },
        onDismiss: (reason) => notify({
          title: 'Suggestion dismissed',
          description: reason,
          variant: 'info',
        }),
      });
    }

    return items;
  }, [
    employeesNeedingManagerReview,
    reviewMetrics.pendingManager,
    notify,
    openDraftAssistantForEmployee,
    reviewMetrics.pendingSelf,
    employeesNeedingPlan,
    openPlanAssistantForEmployee,
    reviewMetrics.misaligned,
    handleJumpToEvaluate,
    highRiskCandidates,
  ]);

  const loadEmployees = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        department:departments(*),
        assessment:assessments(*)
      `)
      .eq('organization_id', organization.id);

    if (error) {
      console.error('Error loading employees:', error);
      notify({
        title: 'Unable to load team members',
        description: 'Check your connection or Supabase credentials and try again.',
        variant: 'error'
      });
      return;
    }

    setEmployees(data || []);
  }, [organization?.id, notify]);

  const loadDepartments = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name');

    if (error) {
      console.error('Error loading departments:', error);
      notify({
        title: 'Unable to load departments',
        description: 'Department data could not be retrieved. Please refresh.',
        variant: 'error'
      });
      return;
    }

    setDepartments(data || []);
  }, [organization?.id, notify]);

  const loadData = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      await Promise.all([loadEmployees(), loadDepartments()]);
    } catch (error) {
      console.error('Error loading data:', error);
      notify({
        title: 'Data refresh failed',
        description: 'We could not load the latest employee information. Please retry.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, loadEmployees, loadDepartments, notify]);

  // Check for first run (no 360 surveys exist)
  const checkFirstRun = useCallback(async () => {
    if (!organization?.id) return;
    
    setCheckingFirstRun(true);
    try {
      const { data, error } = await supabase
        .from('feedback_360_surveys')
        .select('id')
        .eq('organization_id', organization.id)
        .limit(1);

      if (error) throw error;

      // If no surveys exist and we have employees, show welcome wizard
      const hasAnySurveys = data && data.length > 0;
      setIsFirstRun(!hasAnySurveys && employees.length > 0);
      
      // Set view based on first run status
      if (!hasAnySurveys && employees.length > 0) {
        setCurrentView('welcome');
      }
    } catch (error) {
      console.error('Error checking first run:', error);
      setIsFirstRun(false);
    } finally {
      setCheckingFirstRun(false);
    }
  }, [organization?.id, employees.length]);

  useEffect(() => {
    if (!organization?.id) return;
    loadData();
  }, [organization?.id, loadData]);

  // Check first run after employees are loaded
  useEffect(() => {
    if (employees.length > 0) {
      checkFirstRun();
    }
  }, [employees.length, checkFirstRun]);

  // Notify parent of state changes for AICoachProvider
  useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);

  useEffect(() => {
    onDepartmentsChange?.(selectedDepartments);
  }, [selectedDepartments, onDepartmentsChange]);

  useEffect(() => {
    onEmployeesChange?.(employees);
  }, [employees, onEmployeesChange]);

  useEffect(() => {
    onPlansChange?.(employeePlans);
  }, [employeePlans, onPlansChange]);

  useEffect(() => {
    onReviewsChange?.(performanceReviews);
  }, [performanceReviews, onReviewsChange]);

  useEffect(() => {
    if (employees.length === 0) {
      setAiFocusEmployeeId(null);
      return;
    }

    const storedId = typeof window !== 'undefined' ? window.localStorage.getItem('ai-helper-last-person') : null;

    setAiFocusEmployeeId(prev => {
      if (storedId && employees.some(emp => emp.id === storedId)) {
        return storedId;
      }
      if (prev && employees.some(emp => emp.id === prev)) {
        return prev;
      }
      return employees[0]?.id ?? null;
    });
  }, [employees]);

  // Register quick action handlers
  useEffect(() => {
    // Handler for opening employee detail modal
    registerHandler('open-employee-detail', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
      }
    });

    // Handler for creating development plan
    registerHandler('create-plan', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setPlanTargetEmployee(employee);
        setIsPlanModalOpen(true);
      }
    });

    // Handler for scheduling 1:1
    registerHandler('schedule-1on1', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
        // Will open with one-on-one tab - could pass initialTab in context
      }
    });

    // Handler for viewing notes
    registerHandler('view-notes', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
      }
    });

    // Handler for creating review
    registerHandler('create-review', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
      }
    });

    // Handler for viewing review
    registerHandler('view-review', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
      }
    });

    // Handler for navigation
    registerHandler('navigate', (payload) => {
      const view = payload.context?.view;
      if (!view) return;
      handleViewNavigation(view);
    });

    // Handler for opening plan wizard
    registerHandler('open-plan-wizard', (payload) => {
      setProgramsView('development');
      changeView('programs');
      if (aiFocusEmployeeId) {
        const employee = employees.find(e => e.id === aiFocusEmployeeId);
        if (employee) {
          setPlanTargetEmployee(employee);
          setIsPlanModalOpen(true);
        }
      }
    });

    // Handler for opening plan modal
    registerHandler('open-plan-modal', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setPlanTargetEmployee(employee);
        setIsPlanModalOpen(true);
      }
    });

    // Handler for opening review modal
    registerHandler('open-review-modal', (payload) => {
      const employee = employees.find(e => e.id === payload.employeeId);
      if (employee) {
        setDetailModalEmployee(employee);
        setIsDetailModalOpen(true);
      }
    });

    // Handler for bulk creating plans or launching plan wizard
    registerHandler('bulk-create-plans', (payload) => {
      const employeeIds = payload.employeeIds || payload.context?.employeeIds;
      if (employeeIds && employeeIds.length > 0) {
        const firstEmployee = employees.find(e => e.id === employeeIds[0]);
        if (firstEmployee) {
          setPlanTargetEmployee(firstEmployee);
          setIsPlanModalOpen(true);
          
          notify({
            title: 'Creating Plans',
            description: `Starting with ${firstEmployee.name}. ${employeeIds.length - 1} more to go.`,
            variant: 'info',
          });
        }
      }
    });

    // Alias for launch-plan-wizard
    registerHandler('launch-plan-wizard', (payload) => {
      setProgramsView('development');
      changeView('programs');

      const employeesWithoutPlans = employees.filter(emp => emp.assessment && !employeePlans[emp.id]);
      if (employeesWithoutPlans.length > 0) {
        setPlanTargetEmployee(employeesWithoutPlans[0]);
        setIsPlanModalOpen(true);
        
        notify({
          title: 'Plan Creation Workflow',
          description: `Creating plan for ${employeesWithoutPlans[0].name}. ${employeesWithoutPlans.length - 1} more need plans.`,
          variant: 'info',
        });
      }
    });
  }, [employees, registerHandler, aiFocusEmployeeId, employeePlans, notify, changeView, setProgramsView, setPeopleFilter, handleViewNavigation]);

  const handleSignOut = () => {
    // Reload page to reset to database mode
    window.location.reload();
  };

  const handleEmployeeFromReview = async (
    employeeData: Pick<Employee, 'name' | 'email' | 'department_id' | 'title'>,
    suggestedPlacement: { performance: Performance; potential: Potential },
    plan: EmployeePlan
  ): Promise<void> => {
    // Calculate box_key from performance and potential
    const box_key = `${suggestedPlacement.performance === 'high' ? 3 : suggestedPlacement.performance === 'medium' ? 2 : 1}-${suggestedPlacement.potential === 'high' ? 3 : suggestedPlacement.potential === 'medium' ? 2 : 1}`;

    try {
      // Insert employee
      const { data: insertedEmployee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          organization_id: organization.id,
          employee_id: `E${String(employees.length + 1).padStart(3, '0')}`,
          name: employeeData.name,
          email: employeeData.email || null,
          department_id: employeeData.department_id || null,
          title: employeeData.title || null
        })
        .select()
        .single();

      if (employeeError) throw employeeError;

      // Insert assessment
      const { error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          organization_id: organization.id,
          employee_id: insertedEmployee.id,
          performance: suggestedPlacement.performance,
          potential: suggestedPlacement.potential,
          box_key: box_key
        });

      if (assessmentError) throw assessmentError;

      // Store the AI-generated plan using the real employee ID
      setEmployeePlans(prev => ({
        ...prev,
        [insertedEmployee.id]: {
          ...plan,
          id: `plan-${insertedEmployee.id}`,
          employee_id: insertedEmployee.id,
          created_by: userProfile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }));

      // Reload employees to get the new one with all relationships
      await loadEmployees();

      // Show success message
      notify({
        title: `${employeeData.name} added to the grid`,
        description: [
          'Personalized ' + plan.plan_type.replace('_', ' ') + ' plan generated.',
          `${plan.objectives.length} objectives · ${plan.action_items.length} actions · ${plan.success_metrics.length} success metrics.`,
          'Open their card to review next steps.'
        ].join('\n'),
        variant: 'success',
      });

    } catch (error) {
      console.error('Error creating employee:', error);
      notify({
        title: 'Employee creation failed',
        description: 'We could not save this employee. Please try again.',
        variant: 'error',
      });
      return;
    }

      handleOpenTalentGrid();
  };

  const employeesInScope = useMemo(() => {
    if (selectedDepartments.length === 0) return employees;
    return employees.filter(emp => emp.department_id && selectedDepartments.includes(emp.department_id));
  }, [employees, selectedDepartments]);

  const scopedDepartments = useMemo(() => {
    if (selectedDepartments.length === 0) return departments;
    return departments.filter(dept => selectedDepartments.includes(dept.id));
  }, [departments, selectedDepartments]);

  const filteredEmployees = selectedDepartments.length > 0 
    ? employees.filter(emp => emp.department_id && selectedDepartments.includes(emp.department_id))
    : employees;

  const watchlistEmployeeIds = useMemo(() => new Set(highRiskCandidates.map(entry => entry.employee.id)), [highRiskCandidates]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(emp => {
      if (emp.location) {
        set.add(emp.location);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const peopleViewEmployees = useMemo(() => {
    let scoped = employeesInScope;

    if (peopleFilter === 'watchlist') {
      scoped = scoped.filter(emp => watchlistEmployeeIds.has(emp.id));
    } else if (peopleFilter === 'assessed') {
      scoped = scoped.filter(emp => Boolean(emp.assessment));
    }

    if (locationFilter !== 'all') {
      scoped = scoped.filter(emp => (emp.location || '').toLowerCase() === locationFilter.toLowerCase());
    }

    return scoped;
  }, [employeesInScope, peopleFilter, watchlistEmployeeIds, locationFilter]);

  const peopleGridEmployees = useMemo(() => {
    let scoped = filteredEmployees;

    if (peopleFilter === 'watchlist') {
      scoped = scoped.filter(emp => watchlistEmployeeIds.has(emp.id));
    } else if (peopleFilter === 'assessed') {
      scoped = scoped.filter(emp => Boolean(emp.assessment));
    }

    if (locationFilter !== 'all') {
      scoped = scoped.filter(emp => (emp.location || '').toLowerCase() === locationFilter.toLowerCase());
    }

    return scoped;
  }, [filteredEmployees, peopleFilter, watchlistEmployeeIds, locationFilter]);

  const buildReasonTags = useCallback((employee: Employee) => {
    const reasons: string[] = [];
    const plan = employeePlans[employee.id];
    const joinDate = new Date(employee.created_at);
    const tenureMonths = Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    if (tenureMonths < 6) {
      reasons.push('New hire (<6 months)');
    }

    if (!plan) {
      reasons.push('No plan');
    } else {
      const overdue = getOverdueActionItems(plan.action_items || []);
      if (overdue.length > 0) {
        reasons.push(`${overdue.length} overdue ${overdue.length === 1 ? 'action' : 'actions'}`);
      }
      const progress = calculatePlanProgress(plan.action_items || []);
      if (progress < 40) {
        reasons.push('Plan behind');
      }
    }

    const reviewRecord = performanceReviews[employee.id];
    if (!employee.assessment) {
      reasons.push('No 9-box placement');
    } else if (employee.assessment.performance === 'high' && employee.assessment.potential === 'high') {
      reasons.push('High performer');
    }

    if (!reviewRecord?.manager || reviewRecord.manager.status !== 'completed') {
      reasons.push('Manager review pending');
    }

    if (!reviewRecord?.self || (reviewRecord.self.status !== 'completed' && reviewRecord.self.status !== 'submitted')) {
      reasons.push('Self review pending');
    }

    return Array.from(new Set(reasons));
  }, [employeePlans, performanceReviews]);

  const watchlistEntries = useMemo<CommandWatchlistEntry[]>(() => {
    return highRiskCandidates.map(({ employee, score }) => {
      const severity: CommandWatchlistEntry['severity'] = score >= 60 ? 'critical' : score >= 40 ? 'high' : 'attention';
      const reasons = buildReasonTags(employee);
      if (!reasons.some(reason => reason.toLowerCase().includes('watchlist'))) {
        reasons.unshift('Watchlist signal active');
      }

      return {
        employee,
        riskScore: score,
        severity,
        reasons,
      };
    });
  }, [highRiskCandidates, buildReasonTags]);

  const focusedEntries = useMemo<CommandFocusedEntry[]>(() => {
    if (focusedEmployees.length === 0) {
      return [];
    }

    return focusedEmployees.map(({ employee, pinnedAt }) => {
      const plan = employeePlans[employee.id];
      const overdue = plan ? getOverdueActionItems(plan.action_items || []).length : 0;
      const progress = plan ? calculatePlanProgress(plan.action_items || []) : 0;

      let status: CommandFocusedEntry['status'];
      if (!plan || overdue > 0 || progress < 40) {
        status = 'needs-checkin';
      } else if (progress === 100) {
        status = 'unpinned';
      } else {
        status = 'on-track';
      }

      const reasonSet = new Set(buildReasonTags(employee));
      if (watchlistEmployeeIds.has(employee.id)) {
        reasonSet.add('Watchlist signal active');
      }

      let urgency = 0;
      if (status === 'needs-checkin') {
        urgency += 200;
      }
      if (watchlistEmployeeIds.has(employee.id)) {
        urgency += 150;
      }
      urgency += overdue * 25;
      urgency += plan ? Math.max(0, 100 - progress) : 80;
      urgency += Math.min(60, Math.floor((Date.now() - pinnedAt.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        employee,
        pinnedAt,
        status,
        reasons: Array.from(reasonSet),
        planProgress: plan ? progress : null,
        overdueCount: overdue,
        urgency,
        highlight: watchlistEmployeeIds.has(employee.id),
      };
    }).sort((a, b) => b.urgency - a.urgency);
  }, [focusedEmployees, employeePlans, buildReasonTags, watchlistEmployeeIds]);

  const commandTasks = useMemo<CommandTaskItem[]>(() => {
    return [
      {
        id: 'manager-reviews',
        label: 'Manager reviews waiting',
        count: reviewMetrics.pendingManager,
        description: 'Managers still need to finalize reviews.',
        severity: reviewMetrics.pendingManager >= 10 ? 'critical' : reviewMetrics.pendingManager > 0 ? 'high' : 'low',
        actionLabel: 'Open reviews',
        onAction: () => handleJumpToPrepare(),
      },
      {
        id: 'self-reviews',
        label: 'Self reviews missing',
        count: reviewMetrics.pendingSelf,
        description: 'Send nudges so people can summarize wins and blockers.',
        severity: reviewMetrics.pendingSelf > 0 ? 'medium' : 'low',
        actionLabel: 'Send nudges',
        onAction: () => handleJumpToPrepare(),
      },
      {
        id: 'calibration-misaligned',
        label: 'Calibration misalignments',
        count: reviewMetrics.misaligned,
        description: 'Prep talking points where self and manager ratings diverge.',
        severity: reviewMetrics.misaligned > 0 ? 'high' : 'low',
        actionLabel: 'Open calibration',
        onAction: () => handleJumpToEvaluate(),
      },
      {
        id: 'missing-plans',
        label: 'Assessments missing plans',
        count: planMetrics.missingPlans,
        description: 'Convert feedback into development plans to keep momentum.',
        severity: planMetrics.missingPlans > 0 ? 'high' : 'low',
        actionLabel: 'Launch plan builder',
        onAction: () => handleJumpToFollowThrough(),
      },
      {
        id: 'overdue-actions',
        label: 'Overdue plan actions',
        count: planMetrics.overdueActions,
        description: 'Nudge owners on overdue action items.',
        severity: planMetrics.overdueActions > 0 ? 'medium' : 'low',
        actionLabel: 'Review action items',
        onAction: () => handleJumpToFollowThrough(),
      },
      {
        id: 'pending-ack',
        label: 'Notes needing acknowledgment',
        count: planMetrics.pendingAck,
        description: 'Remind teammates to acknowledge critical manager notes.',
        severity: planMetrics.pendingAck > 0 ? 'medium' : 'low',
        actionLabel: 'Open follow-through',
        onAction: () => handleJumpToFollowThrough(),
      },
      {
        id: 'watchlist-count',
        label: 'Watchlist signals',
        count: watchlistEntries.length,
        description: 'High-signal employees that need retention or onboarding focus.',
        severity: watchlistEntries.length > 0 ? 'high' : 'low',
        actionLabel: 'Review watchlist',
        onAction: () => handleOpenTalentGrid(),
      },
    ];
  }, [reviewMetrics.pendingManager, reviewMetrics.pendingSelf, reviewMetrics.misaligned, planMetrics.missingPlans, planMetrics.overdueActions, planMetrics.pendingAck, watchlistEntries.length, handleJumpToPrepare, handleJumpToEvaluate, handleJumpToFollowThrough, handleOpenTalentGrid]);

  const aiFocusEmployee = useMemo(() => {
    if (!aiFocusEmployeeId) return null;
    return employees.find(emp => emp.id === aiFocusEmployeeId) ?? null;
  }, [aiFocusEmployeeId, employees]);

  const getReviewArray = (employeeId: string): PerformanceReview[] => {
    const record = performanceReviews[employeeId];
    if (!record) return [];

    const reviews: PerformanceReview[] = [];
    if (record.manager) reviews.push(record.manager);
    if (record.self) reviews.push(record.self);
    return reviews;
  };

  const handleLaunchDraftReview = useCallback(() => {
    if (!aiFocusEmployee) {
      notify({
        title: 'Pick someone to help',
        description: 'Choose an employee in the AI Assist Center so we know whose review to draft.',
        variant: 'info',
      });
      return;
    }

    openDraftAssistantForEmployee(aiFocusEmployee);
  }, [aiFocusEmployee, notify, openDraftAssistantForEmployee]);

  const handleLaunchPlanWizard = useCallback((template: string = 'performance') => {
    setProgramsView('development');
    changeView('programs');

    if (aiFocusEmployee) {
      let riskScore = 0;

      if (aiFocusEmployee.assessment?.performance === 'high' && aiFocusEmployee.assessment?.potential === 'high') {
        riskScore += 40;
      } else if (aiFocusEmployee.assessment?.performance === 'high') {
        riskScore += 20;
      }

      const joinDate = new Date(aiFocusEmployee.created_at);
      const monthsWithCompany = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (monthsWithCompany < 12) riskScore += 15;
      if (monthsWithCompany > 48) riskScore += 10;

      if (aiFocusEmployee.assessment && !employeePlans[aiFocusEmployee.id]) riskScore += 20;

      const isHighRisk = riskScore >= 50;

      setPlanTargetEmployee(aiFocusEmployee);
      setIsPlanModalOpen(true);

      notify({
        title: `Launching ${template} plan`,
        description: `Prepping objectives and cadence for ${aiFocusEmployee.name}.`,
        variant: 'info',
      });

      if (isHighRisk) {
        notify({
          title: 'High Flight Risk Detected',
          description: `${aiFocusEmployee.name} has a risk score of ${riskScore}. Consider creating a retention plan.`,
          variant: 'warning',
        });
      }
    }
  }, [aiFocusEmployee, employeePlans, notify, changeView]);

  const handleFocusEmployeeChange = useCallback((employeeId: string | null) => {
    setAiFocusEmployeeId(employeeId);

    if (typeof window !== 'undefined') {
      if (employeeId) {
        window.localStorage.setItem('ai-helper-last-person', employeeId);
      } else {
        window.localStorage.removeItem('ai-helper-last-person');
      }
    }

    if (!employeeId) {
      dismissSuggestion('focus-plan');
      return;
    }

    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    addSuggestion({
      id: 'focus-plan',
      priority: 'medium',
      type: 'tip',
      title: `Keep ${employee.name}'s cycle moving`,
      description: 'Draft a review or build a development plan now while the context is fresh.',
      actions: [{
        label: 'Build a plan',
        actionType: 'open-plan-wizard',
        payload: {},
      }],
      dismissable: true,
    });
  }, [employees, handleLaunchPlanWizard, addSuggestion, dismissSuggestion]);

  const handlePlanSave = (plan: Partial<EmployeePlan>) => {
    if (!planTargetEmployee) return;

    const existingPlan = employeePlans[planTargetEmployee.id];
    const nowIso = new Date().toISOString();
    const isNewPlan = !existingPlan;

    const normalizedPlan: EmployeePlan = {
      id: existingPlan?.id ?? `plan-${planTargetEmployee.id}`,
      employee_id: planTargetEmployee.id,
      plan_type: plan.plan_type ?? existingPlan?.plan_type ?? 'development',
      title: plan.title ?? existingPlan?.title ?? `Development plan for ${planTargetEmployee.name}`,
      objectives: plan.objectives ?? existingPlan?.objectives ?? [],
      action_items: plan.action_items ?? existingPlan?.action_items ?? [],
      milestones: existingPlan?.milestones,
      timeline: plan.timeline ?? existingPlan?.timeline ?? '90 days',
      success_metrics: plan.success_metrics ?? existingPlan?.success_metrics ?? [],
      notes: plan.notes ?? existingPlan?.notes ?? '',
      created_by: existingPlan?.created_by ?? userProfile.id,
      created_at: plan.created_at ?? existingPlan?.created_at ?? nowIso,
      updated_at: plan.updated_at ?? nowIso,
      last_reviewed: plan.last_reviewed ?? existingPlan?.last_reviewed,
      next_review_date: plan.next_review_date ?? existingPlan?.next_review_date,
      status: plan.status ?? existingPlan?.status ?? 'active',
      progress_percentage: plan.progress_percentage ?? existingPlan?.progress_percentage,
      budget_allocated: plan.budget_allocated ?? existingPlan?.budget_allocated,
      budget_spent: plan.budget_spent ?? existingPlan?.budget_spent,
    };

    setEmployeePlans(prev => ({
      ...prev,
      [planTargetEmployee.id]: normalizedPlan,
    }));

    notify({
      title: 'Plan saved',
      description: `${planTargetEmployee.name}'s development plan has been refreshed with the AI suggestions.`,
      variant: 'success',
    });

    // WORKFLOW AUTO-ADVANCEMENT: Trigger 30-day check-in reminder
    if (isNewPlan) {
      setTimeout(() => {
        addSuggestion({
          id: `workflow-30day-checkin-${planTargetEmployee.id}`,
          priority: 'low',
          type: 'tip',
          title: `Schedule 30-day check-in for ${planTargetEmployee.name}`,
          description: 'Development plan is active. Schedule a check-in 30 days from now to review progress.',
          dismissable: true,
        });
      }, 2000);
    }
  };

  const handleReviewDrafted = (draft: string) => {
    if (!draftTargetEmployee) return;

    const employeeName = draftTargetEmployee.name;

    const announceResult = (copied: boolean) => {
      notify({
        title: 'AI draft ready',
        description: copied
          ? `We copied the review draft for ${employeeName} to your clipboard.`
          : `The review draft for ${employeeName} is ready. Paste it into the review wizard when you are ready.`,
        variant: 'success',
      });
    };

    if (draft.trim()) {
      void (async () => {
        try {
          await navigator.clipboard.writeText(draft);
          announceResult(true);
        } catch (error) {
          console.warn('Clipboard write failed', error);
          announceResult(false);
        }
      })();
    } else {
      announceResult(false);
    }

    setIsAIDraftModalOpen(false);
    setDraftTargetEmployee(null);
  };

  const handlePlacementSuggestion = useCallback((payload: {
    employeeId: string;
    performance: Performance;
    potential: Potential;
    reasoning: string;
    confidence?: number;
  }) => {
    registerPlacementSuggestion(payload);
  }, [registerPlacementSuggestion]);

  const hasAISuggestions = aiSuggestions.length > 0;

  const aiHelperRibbon = (
    <AIHelperRibbon
      employees={employees}
      selectedEmployeeId={aiFocusEmployeeId}
      onSelectedEmployeeChange={handleFocusEmployeeChange}
      onLaunchReviewParser={() => setIsReviewParserOpen(true)}
      onLaunchDraftReview={handleLaunchDraftReview}
      onLaunchPlanWizard={handleLaunchPlanWizard}
      employeePlans={employeePlans}
      performanceReviews={performanceReviews}
      watchlistIds={watchlistEmployeeIds}
      currentUserName={userProfile.full_name || userProfile.email}
    />
  );


  return (
    <WorkflowProvider
      employees={employees}
      performanceReviews={performanceReviews as any}
      employeePlans={employeePlans}
    >
      <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#111827] via-[#1c2430] to-[#121a23]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(900px at 15% 0%, rgba(255,194,125,0.25) 0%, transparent 60%)' }}
        />
        <div className={`${shellClass} relative py-12 lg:py-14`}>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-6 text-white">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Live workspace
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  AI guided decisions
                </span>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-[2.75rem]">
                  Sonance Talent Management
                </h1>
                <p className="text-sm leading-relaxed text-white/80">
                  A composed workspace for balancing performance, potential, and development plans. Stay grounded in the next right move for every teammate.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsReviewParserOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#f4b860] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm transition hover:bg-[#f0a94d]"
                >
                  <Sparkles className="h-4 w-4" />
                  Add talent via AI
                </button>
                <button
                  onClick={handleOpenTalentGrid}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/70 hover:bg-white/10"
                >
                  <Grid3X3 className="h-4 w-4" />
                  Open talent grid
                </button>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-5 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <div className="space-y-1 text-white">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">AI shortcuts</h2>
                <p className="text-sm text-white/80">Jump into assistants that keep momentum without context switching.</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleLaunchDraftReview}
                  className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-white/80" />
                    AI review draft
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/60" />
                </button>
                <button
                  onClick={handleLaunchPlanWizard}
                  className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-white/80" />
                    Development plans
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/60" />
                </button>
                <button
                  onClick={() => handleJumpToFollowThrough()}
                  className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25"
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-white/80" />
                    Monitor follow through
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/60" />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/15 px-3 py-2 text-sm text-white">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Signed in</p>
                  <p className="font-medium text-white">{userProfile.full_name || userProfile.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white/80 transition hover:text-white"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Employee Context Bar - shows pinned employees */}
      <EmployeeContextBar />

      {/* Breadcrumb Navigation - shows recent actions */}
      <BreadcrumbNav />

      {/* Stats Snapshot */}
      <section className={`${shellClass} grid grid-cols-2 gap-4 py-6 sm:grid-cols-4`}>
        {heroStats.map((stat, index) => {
          const StatIcon = stat.icon;
          const background = index % 2 === 0 ? 'bg-[#f8f5f0]' : 'bg-[#f1f5f9]';

          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => handleHeroMetricClick(stat)}
              className={`group flex flex-col justify-between rounded-xl border border-slate-200/60 px-4 py-3 text-left text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${background}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">
                  {stat.label}
                </div>
                <StatIcon className="h-4 w-4 text-slate-400 group-hover:text-slate-500" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-900 group-hover:text-slate-950">
                {stat.displayValue}
              </div>
              <div className="mt-2 text-xs text-slate-500 group-hover:text-slate-600">
                {stat.helper}
              </div>
            </button>
          );
        })}
      </section>

      {/* Navigation */}
      {!isFirstRun && !checkingFirstRun && (
        <nav className="border-b border-slate-200 bg-white">
          <div className={shellClass}>
            <div className="flex flex-wrap gap-2 py-3">
              <NavigationTabs
                tabs={[
                  {
                    id: 'team',
                    label: 'My Team',
                    icon: Users,
                    domId: 'tab-team',
                    tooltip: 'Track team member profiles and progress',
                  },
                  {
                    id: 'reviews',
                    label: 'Reviews & Plans',
                    icon: FileText,
                    domId: 'tab-reviews',
                    tooltip: 'Performance reviews, development plans, and programs',
                    count: planMetrics.totalFollowThrough || undefined,
                    badge: planMetrics.totalFollowThrough > 0 ? (
                      <span className="ml-1 text-[10px] text-blue-600">
                        {planMetrics.missingPlans} plans · {planMetrics.pendingAck} acks
                      </span>
                    ) : undefined,
                  },
                  {
                    id: 'insights',
                    label: 'Insights',
                    icon: TrendingUp,
                    domId: 'tab-insights',
                    tooltip: 'Analytics, 9-box grid, and talent portfolio',
                  },
                ]}
                activeTab={currentView}
                onTabChange={(tabId) => changeView(tabId as View)}
                variant="pills"
                className="flex-wrap"
              />
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="py-8">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-600">Loading...</p>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">
            {currentView === 'welcome' && (
              <ExecutiveWelcomeWizard
                employees={employees}
                departments={departments}
                currentUserName={userProfile.full_name || userProfile.email || 'there'}
                onLaunch360s={(selectedEmployees) => {
                  setSelectedEmployeesFor360(selectedEmployees);
                  setIs360WizardOpen(true);
                }}
                onSkip={() => {
                  setIsFirstRun(false);
                  changeView('team');
                }}
              />
            )}

            {currentView === 'team' && (
              <TeamProgressDashboard
                employees={employees}
                departments={departments}
                organizationId={organization.id}
                employeePlans={employeePlans}
                performanceReviews={performanceReviews}
                onOpenReviewModal={(employee) => {
                  setDraftTargetEmployee(employee);
                  setIsAIDraftModalOpen(true);
                }}
                onOpenPlanModal={(employee) => {
                  setPlanTargetEmployee(employee);
                  setIsPlanModalOpen(true);
                }}
                onOpen360Modal={(employee) => {
                  setSelectedEmployeesFor360([employee]);
                  setIs360WizardOpen(true);
                }}
                onOpenDetailModal={(employee) => {
                  setDetailModalEmployee(employee);
                  setIsDetailModalOpen(true);
                }}
              />
            )}

            {currentView === 'reviews' && (
              <div className={`${shellClass} space-y-6`}>
                <NavigationTabs
                  tabs={[
                    { id: 'development', label: 'Development Plans', icon: ClipboardList },
                    { id: 'feedback360', label: '360 Feedback', icon: Users },
                    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
                    { id: 'calibration', label: 'Calibration', icon: GitBranch },
                  ]}
                  activeTab={programsView}
                  onTabChange={(id) => setProgramsView(id as ProgramHubView)}
                  variant="underline"
                />

                {programsView === 'development' && (
                  <PlansDashboard
                    employees={employees}
                    departments={departments}
                    employeePlans={employeePlans}
                    performanceReviews={performanceReviews}
                    onOpenPlan={(employee) => {
                      setPlanTargetEmployee(employee);
                      setIsPlanModalOpen(true);
                    }}
                  />
                )}

                {programsView === 'feedback360' && (
                  <Feedback360Dashboard
                    employees={employees}
                    departments={departments}
                    organizationId={organization.id}
                    currentUserName={userProfile.full_name || userProfile.email || 'User'}
                  />
                )}

                {programsView === 'onboarding' && (
                  <OnboardingDashboard
                    organizationId={organization.id}
                    employees={employees}
                    departments={departments}
                  />
                )}

                {programsView === 'calibration' && (
                  <CalibrationDashboard
                    employees={employees}
                    departments={departments}
                    performanceReviews={performanceReviews}
                    onEmployeeUpdate={loadEmployees}
                  />
                )}
              </div>
            )}

            {currentView === 'insights' && (
              <div className={`${shellClass} space-y-6`}>
                <ExecutiveCommandCenter
                  employees={employees}
                  performanceReviews={performanceReviews}
                  employeePlans={employeePlans}
                  departments={departments}
                  onNavigate={handleViewNavigation}
                  onCreateRetentionPlans={(employeeIds) => {
                    employeeIds.forEach(empId => {
                      const employee = employees.find(e => e.id === empId);
                      if (!employee) return;

                      const retentionPlan: EmployeePlan = {
                        id: `retention-${empId}-${Date.now()}`,
                        employee_id: empId,
                        plan_type: 'retention',
                        title: `Retention Plan for ${employee.name}`,
                        objectives: [
                          'Clarify career growth path and promotion timeline',
                          'Address compensation and recognition concerns',
                          'Identify stretch assignments to maintain engagement',
                          'Schedule regular skip-level 1:1s for visibility'
                        ],
                        action_items: [
                          {
                            id: `action-${Date.now()}-1`,
                            description: 'Schedule skip-level 1:1 to discuss career goals',
                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: userProfile.full_name || 'Manager',
                            priority: 'high',
                            status: 'not_started',
                          },
                          {
                            id: `action-${Date.now()}-2`,
                            description: 'Review compensation against market rates',
                            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: 'HR',
                            priority: 'high',
                            status: 'not_started',
                          },
                          {
                            id: `action-${Date.now()}-3`,
                            description: 'Identify and assign high-visibility stretch project',
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: userProfile.full_name || 'Manager',
                            priority: 'medium',
                            status: 'not_started',
                          },
                        ],
                        timeline: '60 days',
                        success_metrics: [
                          'Employee expresses increased confidence in growth path',
                          'Compensation concerns addressed',
                          'Engaged in meaningful stretch assignment'
                        ],
                        notes: 'Auto-generated retention plan - customize based on individual needs and 1:1 conversations.',
                        created_by: userProfile.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'active',
                        progress_percentage: 0,
                      };

                      setEmployeePlans(prev => ({
                        ...prev,
                        [empId]: retentionPlan,
                      }));
                    });

                    notify({
                      title: 'Retention Plans Created',
                      description: `Created ${employeeIds.length} retention plan${employeeIds.length !== 1 ? 's' : ''} with AI-assisted action items.`,
                      variant: 'success',
                    });
                  }}
                  onViewEmployees={(highlightedEmployees) => {
                    if (highlightedEmployees.length > 0) {
                      setProgramsView('development');
                      changeView('reviews');
                    }
                  }}
                />
              </div>
            )}

            {currentView === 'command-center' && (
              <div className={`${shellClass} space-y-6`}>
                <ExecutiveCommandCenter
                  employees={employees}
                  performanceReviews={performanceReviews}
                  employeePlans={employeePlans}
                  departments={departments}
                  onNavigate={handleViewNavigation}
                  onCreateRetentionPlans={(employeeIds) => {
                    employeeIds.forEach(empId => {
                      const employee = employees.find(e => e.id === empId);
                      if (!employee) return;

                      const retentionPlan: EmployeePlan = {
                        id: `retention-${empId}-${Date.now()}`,
                        employee_id: empId,
                        plan_type: 'retention',
                        title: `Retention Plan for ${employee.name}`,
                        objectives: [
                          'Clarify career growth path and promotion timeline',
                          'Address compensation and recognition concerns',
                          'Identify stretch assignments to maintain engagement',
                          'Schedule regular skip-level 1:1s for visibility'
                        ],
                        action_items: [
                          {
                            id: `action-${Date.now()}-1`,
                            description: 'Schedule skip-level 1:1 to discuss career goals',
                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: userProfile.full_name || 'Manager',
                            priority: 'high',
                            status: 'not_started',
                          },
                          {
                            id: `action-${Date.now()}-2`,
                            description: 'Review compensation against market rates',
                            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: 'HR',
                            priority: 'high',
                            status: 'not_started',
                          },
                          {
                            id: `action-${Date.now()}-3`,
                            description: 'Identify and assign high-visibility stretch project',
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            completed: false,
                            owner: userProfile.full_name || 'Manager',
                            priority: 'medium',
                            status: 'not_started',
                          },
                        ],
                        timeline: '60 days',
                        success_metrics: [
                          'Employee expresses increased confidence in growth path',
                          'Compensation concerns addressed',
                          'Engaged in meaningful stretch assignment'
                        ],
                        notes: 'Auto-generated retention plan - customize based on individual needs and 1:1 conversations.',
                        created_by: userProfile.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'active',
                        progress_percentage: 0,
                      };

                      setEmployeePlans(prev => ({
                        ...prev,
                        [empId]: retentionPlan,
                      }));
                    });

                    notify({
                      title: 'Retention Plans Created',
                      description: `Created ${employeeIds.length} retention plan${employeeIds.length !== 1 ? 's' : ''} with AI-assisted action items.`,
                      variant: 'success',
                    });
                  }}
                  onViewEmployees={(highlightedEmployees) => {
                    if (highlightedEmployees.length > 0) {
                      setProgramsView('development');
                      changeView('programs');
                    }
                  }}
                />

                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <CommandTaskInbox
                    items={commandTasks}
                    focus={commandFocus}
                    onFocusChange={setCommandFocus}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm"
                  />

                  <div className="space-y-6">
                    <CommandWatchlist
                      entries={watchlistEntries}
                      onOpenDetails={handleOpenEmployeeDetail}
                      onCreatePlan={openPlanAssistantForEmployee}
                      onPin={(employee) => pinEmployee(employee, 'command-watchlist')}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm"
                    />

                    <CommandFocusedList
                      entries={focusedEntries}
                      compareMode={compareMode}
                      onToggleCompareMode={() => setCompareMode(!compareMode)}
                      onOpenDetails={handleOpenEmployeeDetail}
                      onTogglePin={(employee) => unpinEmployee(employee.id)}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                </div>

                {hasAISuggestions && (
                  <AIGuidancePanel
                    heading="AI Suggestions"
                    description="We scan your data to highlight the next best action."
                    items={aiSuggestions}
                  />
                )}
              </div>
            )}

            {currentView === 'people' && (
              <div className={`${evaluateShellClass} space-y-6`}>
                {aiHelperRibbon}

                {departments.length > 0 && (
                  <DepartmentSelector
                    departments={departments}
                    employees={employees}
                    selectedDepartments={selectedDepartments}
                    onSelectionChange={setSelectedDepartments}
                  />
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'all', label: 'All people' },
                      { id: 'assessed', label: 'Assessed' },
                      { id: 'watchlist', label: 'Watchlist' },
                    ] as const).map(option => {
                      const isActive = peopleFilter === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setPeopleFilter(option.id as PeopleFilter)}
                          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                            isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {option.label}
                          {option.id === 'watchlist' && watchlistEmployeeIds.size > 0 && (
                            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              {watchlistEmployeeIds.size}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {availableLocations.length > 0 && (
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      Location
                      <select
                        value={locationFilter}
                        onChange={(event) => setLocationFilter(event.target.value)}
                        className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="all">All</option>
                        {availableLocations.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <section id="talent-grid-section" className="space-y-4">
                  <NineBoxGrid
                    employees={peopleGridEmployees}
                    departments={departments}
                    onEmployeeUpdate={loadEmployees}
                    userRole={userProfile.role}
                    selectedDepartments={selectedDepartments}
                    initialPlans={employeePlans}
                    onPlansUpdate={setEmployeePlans}
                    organizationId={organization.id}
                    performanceReviews={performanceReviews}
                    onReviewSave={handleReviewSave}
                    onPlacementSuggestion={handlePlacementSuggestion}
                  />
                </section>

                <PeopleDashboard
                  employees={peopleViewEmployees}
                  departments={scopedDepartments}
                  onEmployeeUpdate={loadEmployees}
                  userRole={userProfile.role}
                  employeePlans={employeePlans}
                  onPlansUpdate={setEmployeePlans}
                  currentUserName={userProfile.full_name || userProfile.email}
                  performanceReviews={performanceReviews}
                  onReviewSave={handleReviewSave}
                  organizationId={organization.id}
                  activeDepartmentIds={selectedDepartments}
                />
              </div>
            )}

            {currentView === 'programs' && (
              <div className={`${shellClass} space-y-6`}>
                {aiHelperRibbon}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <NavigationTabs
                    tabs={programTabs}
                    activeTab={programsView}
                    onTabChange={(tabId) => setProgramsView(tabId as ProgramHubView)}
                    variant="underline"
                  />

                  <div className="p-6 space-y-6">
                    {programsView === 'development' && (
                      <PlansDashboard
                        employees={employeesInScope}
                        departments={scopedDepartments}
                        employeePlans={employeePlans}
                        onEmployeeClick={(employee) => {
                          setDetailModalEmployee(employee);
                          setIsDetailModalOpen(true);
                        }}
                        onOpenPlanModal={(employee) => {
                          setPlanTargetEmployee(employee);
                          setIsPlanModalOpen(true);
                        }}
                      />
                    )}

                    {programsView === 'onboarding' && (
                      <OnboardingDashboard
                        employees={employeesInScope}
                        departments={scopedDepartments}
                        onEmployeeClick={(employee) => {
                          setDetailModalEmployee(employee);
                          setIsDetailModalOpen(true);
                        }}
                      />
                    )}

                    {programsView === 'feedback360' && (
                      <Feedback360Dashboard
                        employees={employeesInScope}
                        departments={scopedDepartments}
                        organizationId={organization.id}
                        currentUserName={userProfile.full_name || userProfile.email}
                      />
                    )}

                    {programsView === 'calibration' && (
                      <CalibrationDashboard
                        employees={employees}
                        departments={departments}
                        employeePlans={employeePlans}
                        performanceReviews={performanceReviews}
                        reviewMetrics={reviewMetrics}
                        planMetrics={planMetrics}
                        unassessedCount={unassessedCount}
                        onJumpToPrepare={handleJumpToPrepare}
                        onJumpToEvaluate={handleJumpToEvaluate}
                        onJumpToFollowThrough={handleJumpToFollowThrough}
                      />
                    )}

                    {programsView === 'workflow' && (
                      <WorkflowDashboard />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <UnifiedAICoach />

      {draftTargetEmployee && (
        <AIDraftReviewModal
          isOpen={isAIDraftModalOpen}
          onClose={() => {
            setIsAIDraftModalOpen(false);
            setDraftTargetEmployee(null);
          }}
          employee={draftTargetEmployee}
          managerName={userProfile.full_name || userProfile.email}
          onReviewDrafted={handleReviewDrafted}
        />
      )}

      {planTargetEmployee && (
        <EnhancedEmployeePlanModal
          isOpen={isPlanModalOpen}
          onClose={() => {
            setIsPlanModalOpen(false);
            setPlanTargetEmployee(null);
          }}
          employee={planTargetEmployee}
          department={departments.find(dept => dept.id === planTargetEmployee.department_id)}
          existingPlan={employeePlans[planTargetEmployee.id]}
          onSave={handlePlanSave}
          performanceReviews={getReviewArray(planTargetEmployee.id)}
        />
      )}

      {/* Review Parser Modal */}
      <ReviewParserModal
        isOpen={isReviewParserOpen}
        onClose={() => setIsReviewParserOpen(false)}
        departments={departments}
        onEmployeeCreated={handleEmployeeFromReview}
      />

      {/* Employee Detail Modal - for quick actions */}
      {detailModalEmployee && (
        <EmployeeDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailModalEmployee(null);
          }}
          employee={detailModalEmployee}
          department={departments.find(dept => dept.id === detailModalEmployee.department_id)}
          employeePlan={employeePlans[detailModalEmployee.id]}
          onSavePlan={(plan) => {
            setEmployeePlans(prev => ({
              ...prev,
              [detailModalEmployee.id]: plan,
            }));
          }}
          onUpdateEmployee={async (updatedEmployee) => {
            await loadEmployees();
          }}
          performanceReviewRecord={performanceReviews[detailModalEmployee.id]}
          onReviewSave={handleReviewSave}
          availableEmployees={employees}
        />
      )}

      {/* 360 Survey Wizard - for batch creating surveys */}
      <Survey360Wizard
        isOpen={is360WizardOpen}
        onClose={() => {
          setIs360WizardOpen(false);
          setSelectedEmployeesFor360([]);
        }}
        organizationId={organization.id}
        preselectedEmployees={selectedEmployeesFor360.length > 0 ? selectedEmployeesFor360 : undefined}
        preselectedEmployee={selectedEmployeesFor360.length === 1 ? selectedEmployeesFor360[0] : undefined}
        onSurveyCreated={() => {
          setIsFirstRun(false);
          changeView('team');
          setIs360WizardOpen(false);
          setSelectedEmployeesFor360([]);
          loadData();
        }}
        employees={employees}
      />

      {/* Unified AI Coach is rendered above after </main> */}
    </div>
    </WorkflowProvider>
  );
}
