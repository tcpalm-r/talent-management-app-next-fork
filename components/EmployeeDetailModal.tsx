import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, MapPin, Briefcase, Building2, User, Calendar, FileText, Sparkles, Loader2, CheckCircle, Circle, AlertCircle, Users as UsersIcon, Lock, AlertTriangle, TrendingUp, ClipboardList, Award, PenSquare, Upload, Shield, FileCode, Check, Minus } from 'lucide-react';
import type {
  Employee,
  Department,
  ManagerNote,
  Performance,
  Potential,
  PlanType,
  ActionItem,
} from '../types';
import { analyzePerformanceReview } from '../lib/reviewAnalyzer';
import { calculateActionItemStatus, calculatePlanProgress } from '../lib/actionItemGenerator';
import ManagerNotes from './ManagerNotes';
import OneOnOneModal from './OneOnOneModal';
import PIPModal from './PIPModal';
import SuccessionPlanningModal from './SuccessionPlanningModal';
import EnhancedEmployeePlanModal from './EnhancedEmployeePlanModal';
import RetentionPlanModal from './RetentionPlanModal';
import PerformanceReviewModal, { type PerformanceReview } from './PerformanceReviewModal';
import Survey360Wizard from './Survey360Wizard';
import ReviewParserModal from './ReviewParserModal';
import CriticalRoleSetupModal from './CriticalRoleSetupModal';
import { useToast, EmployeeNameLink } from './unified';
import JobDescriptionViewer from './JobDescriptionViewer';
import JobDescriptionEditor from './JobDescriptionEditor';
import { AICoachMicroPanel, getEmployeeModalSuggestions } from './AICoachMicroPanel';
import { useUnifiedAICoach } from '../context/UnifiedAICoachContext';

// Simplified navigation structure
type PanelKey = 'overview' | 'performance' | 'development' | 'notes' | 'advanced'
type SubPanel = 'details' | 'job-description' | 'reviews' | '360' | 'plans' | 'one-on-one' | 'manager-notes' | 'pip' | 'succession' | 'ingest'

// Remove old mapping functions - using new simplified structure

interface AnalysisNextStep {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  panel?: PanelKey;
}

interface ReviewAnalysisView {
  performance?: Performance;
  potential?: Potential;
  reasoning?: string;
  confidence?: number;
  planType?: PlanType;
  actionItems?: ActionItem[];
  objectives?: string[];
  successMetrics?: string[];
  timeline?: string;
  strengths?: string[];
  developmentAreas?: string[];
  recommendations?: AnalysisNextStep[];
}

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  department?: Department;
  employeePlan?: any;
  onSavePlan?: (plan: any) => void;
  onUpdateEmployee?: (updatedEmployee: Employee) => void;
  onPlacementSuggestion?: (suggestion: {
    employeeId: string;
    performance: Performance;
    potential: Potential;
    reasoning: string;
    confidence?: number;
    autoApply?: boolean;
  }) => void;
  initialTab?: 'details' | 'review' | 'plan' | '360' | 'notes' | 'one-on-one' | 'pip' | 'succession' | 'perf-review';
  initialReviewType?: 'manager' | 'self';
  performanceReviewRecord?: { manager?: PerformanceReview; self?: PerformanceReview };
  onReviewSave?: (review: PerformanceReview) => void;
  availableEmployees?: Employee[];
}

export default function EmployeeDetailModal({
  isOpen,
  onClose,
  employee,
  department,
  employeePlan,
  onSavePlan,
  onUpdateEmployee,
  onPlacementSuggestion,
  initialTab = 'details',
  initialReviewType = 'manager',
  performanceReviewRecord,
  onReviewSave,
  availableEmployees = [],
}: EmployeeDetailModalProps) {
  const { notify } = useToast();
  const { setModalContext } = useUnifiedAICoach();
  const [activeTab, setActiveTab] = useState<PanelKey>('overview');
  const [activeSubPanel, setActiveSubPanel] = useState<SubPanel>('details');
  const [reviewText, setReviewText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ReviewAnalysisView | null>(null);
  const analysisResultRef = useRef<ReviewAnalysisView | null>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(employeePlan ?? null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);
  const [managerNotes, setManagerNotes] = useState<ManagerNote[]>(employee.manager_notes || []);
  const [isOneOnOneModalOpen, setIsOneOnOneModalOpen] = useState(false);
  const [isEditingJobDescription, setIsEditingJobDescription] = useState(false);
  const [isPIPModalOpen, setIsPIPModalOpen] = useState(false);
  const [isSuccessionModalOpen, setIsSuccessionModalOpen] = useState(false);
  const [isPerformanceReviewModalOpen, setIsPerformanceReviewModalOpen] = useState(false);
  const [performanceReviewType, setPerformanceReviewType] = useState<'self' | 'manager'>(initialReviewType);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>(() => {
    const record = performanceReviewRecord || {};
    return Object.values(record).filter(Boolean) as PerformanceReview[];
  });
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isRetentionPlanModalOpen, setIsRetentionPlanModalOpen] = useState(false);
  const [isReviewParserModalOpen, setIsReviewParserModalOpen] = useState(false);
  const [isCriticalRoleSetupOpen, setIsCriticalRoleSetupOpen] = useState(false);
  const [guidedProgress, setGuidedProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    analysisResultRef.current = analysisResult;
  }, [analysisResult]);

  // Set modal context for AI Coach when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setModalContext('employee-detail', {
        employeeId: employee.id,
        employeeName: employee.name,
        hasPlan: Boolean(currentPlan),
        hasAssessment: Boolean(employee.assessment),
      });
    } else {
      setModalContext(undefined);
    }

    return () => {
      setModalContext(undefined);
    };
  }, [isOpen, employee.id, employee.name, currentPlan, employee.assessment, setModalContext]);
  const activatePanel = useCallback((panel: string) => {
    setActiveSubPanel(panel as SubPanel);
    setActiveTab(panel as any);

    const currentAnalysis = analysisResultRef.current;
    if (!currentAnalysis?.recommendations || currentAnalysis.recommendations.length === 0) return;

    setGuidedProgress(prev => {
      const next = { ...prev };
      currentAnalysis.recommendations.forEach((step) => {
        if (step.panel && step.panel === panel) {
          next[step.id] = true;
        }
      });
      return next;
    });
  }, []);

  const getPlanTypeMeta = (planType?: string | null) => {
    switch (planType) {
      case 'performance_improvement':
        return {
          label: 'Performance Improvement Plan',
          badgeClass: 'bg-red-100 text-red-800',
        };
      case 'succession':
        return {
          label: 'Succession Readiness Plan',
          badgeClass: 'bg-purple-100 text-purple-800',
        };
      case 'retention':
        return {
          label: 'Retention Plan',
          badgeClass: 'bg-amber-100 text-amber-800',
        };
      case 'development':
      default:
        return {
          label: 'Development Plan',
          badgeClass: 'bg-blue-100 text-blue-800',
        };
    }
  };

  const buildNextSteps = (
    performance?: Performance,
    potential?: Potential,
    planType?: PlanType,
  ): AnalysisNextStep[] => {
    const steps: AnalysisNextStep[] = [];

    if (planType) {
      steps.push({
        id: 'review-plan',
        title: 'Review the drafted plan with the employee',
        description: 'Walk through the objectives and action items together to confirm ownership, due dates, and priorities.',
        actionLabel: 'Open plan tab',
        onAction: () => activatePanel('plan'),
        panel: 'plan',
      });
    } else {
      steps.push({
        id: 'create-plan',
        title: 'Personalize and publish the plan',
        description: 'Open the plan builder to customize objectives, owners, and due dates before sharing with the employee.',
        actionLabel: 'Launch plan builder',
        onAction: () => setIsPlanModalOpen(true),
        panel: 'plan',
      });
    }

    if (planType === 'performance_improvement') {
      steps.push({
        id: 'schedule-checkins',
        title: 'Schedule weekly check-ins',
        description: 'Use the 1:1 workspace to create a cadence that keeps the improvement plan on track.',
        actionLabel: 'Open 1:1 workspace',
        onAction: () => {
          setIsOneOnOneModalOpen(true);
        },
        panel: 'one-on-one',
      });

      steps.push({
        id: 'create-pip',
        title: 'Document a formal improvement plan',
        description: 'Capture expectations, milestones, and consequences in the PIP template so everyone understands the path forward.',
        actionLabel: 'Launch PIP wizard',
        onAction: () => {
          setIsPIPModalOpen(true);
        },
        panel: 'pip',
      });
    }

    if (potential === 'high') {
      steps.push({
        id: 'launch-360',
        title: 'Kick off a 360° feedback cycle',
        description: 'Run a quick 360 survey to gather peer feedback that supports growth and succession planning.',
        actionLabel: 'Start 360 survey',
        onAction: () => setIs360ModalOpen(true),
        panel: '360',
      });
    }

    if (performance === 'high' && potential === 'high') {
      steps.push({
        id: 'succession',
        title: 'Update succession pipeline',
        description: 'Flag this person in the succession workspace and outline stretch assignments that accelerate readiness.',
        actionLabel: 'Open succession tools',
        onAction: () => setIsSuccessionModalOpen(true),
        panel: 'succession',
      });
    }

    steps.push({
      id: 'log-manager-notes',
      title: 'Capture manager coaching notes',
      description: 'Summarize this analysis in the manager notes tab so future check-ins build on the same context.',
      actionLabel: 'Add manager note',
      onAction: () => activatePanel('notes'),
      panel: 'notes',
    });

    return steps;
  };

  useEffect(() => {
    if (performanceReviewRecord) {
      const list = Object.values(performanceReviewRecord).filter(Boolean) as PerformanceReview[];
      setPerformanceReviews(list);
    }
  }, [performanceReviewRecord]);

  useEffect(() => {
    setCurrentPlan(employeePlan ?? null);
  }, [employeePlan]);

  // Reset and auto-open performance review modal if initialTab is perf-review
  useEffect(() => {
    if (isOpen) {
      activatePanel(initialTab);
      setPerformanceReviewType(initialReviewType);

      if (initialTab === 'perf-review') {
        setTimeout(() => {
          setIsPerformanceReviewModalOpen(true);
        }, 150);
      } else {
        setIsPerformanceReviewModalOpen(false);
      }
    }
  }, [initialTab, initialReviewType, isOpen, activatePanel]);

  useEffect(() => {
    if (!isOpen) {
      setAnalysisResult(null);
      setReviewText('');
      setAnalysisError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleAnalyzeReview = async () => {
    if (!reviewText.trim()) {
      setAnalysisError('Please enter a performance review to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const analysis = await analyzePerformanceReview(reviewText, employee.name);
      const { suggestedPlacement, developmentPlan, insights } = analysis;

      const performance = suggestedPlacement?.performance;
      const potential = suggestedPlacement?.potential;
      const reasoning = suggestedPlacement?.reasoning;
      const confidence = suggestedPlacement?.confidence;
      const strengths = insights?.strengths ?? [];
      const developmentAreas = insights?.developmentAreas ?? [];
      const successMetrics = insights?.successMetrics ?? [];

      if (onPlacementSuggestion && performance && potential) {
        onPlacementSuggestion({
          employeeId: employee.id,
          performance,
          potential,
          reasoning: reasoning || '',
          confidence,
          autoApply: false,
        });
      }

      if (onSavePlan && developmentPlan) {
        const normalizedActionItems = (developmentPlan.action_items ?? []).map((item, index) => ({
          id: item.id ?? `action-${Date.now()}-${index}`,
          description: item.description,
          dueDate: item.dueDate ?? new Date().toISOString(),
          completed: item.completed ?? false,
          completedDate: item.completedDate,
          owner: item.owner ?? employee.name,
          priority: item.priority ?? 'medium',
          status: item.status ?? (item.completed ? 'completed' : 'not_started'),
          notes: item.notes,
          skillArea: item.skillArea,
          estimatedHours: item.estimatedHours,
        }));

        const defaultPlanType = performance === 'low' ? 'performance_improvement' : 'development';
        const nowIso = new Date().toISOString();

        const normalizedPlan = {
          ...developmentPlan,
          id: developmentPlan.id ?? employeePlan?.id ?? `plan-${employee.id}`,
          employee_id: employee.id,
          plan_type: developmentPlan.plan_type ?? defaultPlanType,
          objectives: developmentPlan.objectives ?? [],
          action_items: normalizedActionItems,
          timeline: developmentPlan.timeline ?? '90 days',
          success_metrics: developmentPlan.success_metrics ?? [],
          notes: developmentPlan.notes ?? '',
          status: developmentPlan.status ?? 'active',
          created_at: developmentPlan.created_at ?? nowIso,
          updated_at: nowIso,
          created_by: (developmentPlan as any).created_by ?? (employeePlan as any)?.created_by ?? 'ai-assistant',
          next_review_date: developmentPlan.next_review_date ?? (employeePlan as any)?.next_review_date,
        };

        if (strengths.length > 0) {
          (normalizedPlan as any).strengths = strengths.join('\n');
        }
        if (developmentAreas.length > 0) {
          (normalizedPlan as any).development_areas = developmentAreas.join('\n');
        }

        setCurrentPlan(normalizedPlan);
        onSavePlan(normalizedPlan);

        const planMeta = getPlanTypeMeta(normalizedPlan.plan_type);

        const nextSteps = buildNextSteps(performance, potential, normalizedPlan.plan_type);

        setAnalysisResult({
          performance,
          potential,
          reasoning,
          confidence,
          planType: normalizedPlan.plan_type,
          actionItems: normalizedPlan.action_items,
          objectives: normalizedPlan.objectives,
          successMetrics: normalizedPlan.success_metrics,
          timeline: normalizedPlan.timeline,
          strengths,
          developmentAreas,
          recommendations: nextSteps,
        });

        setGuidedProgress(nextSteps.reduce<Record<string, boolean>>((acc, step) => {
          acc[step.id] = false;
          return acc;
        }, {}));

        notify({
          title: 'Plan ready',
          description: `${employee.name}'s ${planMeta.label.toLowerCase()} is ready. Review the objectives and action items to tailor next steps.`,
          variant: 'success',
        });
      } else {
        const nextSteps = buildNextSteps(performance, potential, undefined);

        setAnalysisResult({
          performance,
          potential,
          reasoning,
          confidence,
          planType: undefined,
          actionItems: [],
          objectives: [],
          successMetrics,
          timeline: undefined,
          strengths,
          developmentAreas,
          recommendations: nextSteps,
        });

        setGuidedProgress(nextSteps.reduce<Record<string, boolean>>((acc, step) => {
          acc[step.id] = false;
          return acc;
        }, {}));
      }

      activatePanel('plan');
    } catch (error) {
      console.error('Error analyzing review:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze review. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPlanProgress = () => {
    if (!currentPlan?.action_items || currentPlan.action_items.length === 0) return 0;
    return calculatePlanProgress(currentPlan.action_items as ActionItem[]);
  };

  const handleToggleActionItem = (index: number) => {
    if (!currentPlan || !Array.isArray(currentPlan.action_items)) return;

    const timestamp = new Date().toISOString();

    const updatedItems: ActionItem[] = currentPlan.action_items.map((item: ActionItem, idx: number) => {
      if (idx !== index) return item;

      const toggledCompleted = !item.completed;
      const toggledItem: ActionItem = {
        ...item,
        completed: toggledCompleted,
        completedDate: toggledCompleted ? timestamp : undefined,
      };

      if (toggledCompleted) {
        return {
          ...toggledItem,
          status: 'completed',
        };
      }

      const candidateStatus = item.status === 'completed' ? 'in_progress' : item.status || 'not_started';
      return {
        ...toggledItem,
        status: calculateActionItemStatus({ ...toggledItem, status: candidateStatus }),
      };
    });

    const progress = calculatePlanProgress(updatedItems);
    const nextPlanStatus =
      progress === 100
        ? 'completed'
        : currentPlan.status === 'completed'
          ? 'active'
          : currentPlan.status;

    const updatedPlan = {
      ...currentPlan,
      action_items: updatedItems,
      progress_percentage: progress,
      status: nextPlanStatus,
      last_reviewed: timestamp,
      updated_at: timestamp,
    };

    setCurrentPlan(updatedPlan);
    onSavePlan?.(updatedPlan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {/* Avatar */}
              <div className={`w-16 h-16 rounded-full ${getAvatarColor(employee.name)} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-xl font-bold">
                  {getInitials(employee.name)}
                </span>
              </div>

              {/* Employee Info */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  <EmployeeNameLink
                    employee={employee}
                    className="hover:text-blue-600 focus-visible:ring-blue-500"
                    onClick={(event) => event.stopPropagation()}
                  />
                </h2>
                {employee.title && (
                  <p className="text-sm text-gray-600 font-medium mt-1">{employee.title}</p>
                )}
                <div className="flex items-center space-x-4 mt-2">
                  {department && (
                    <div className="flex items-center space-x-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: department.color }}
                      />
                      <span className="text-sm text-gray-600">{department.name}</span>
                    </div>
                  )}
                  {employee.assessment && (
                    <>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        📊 {employee.assessment.performance?.charAt(0).toUpperCase() + employee.assessment.performance?.slice(1)} Performance
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        🚀 {employee.assessment.potential?.charAt(0).toUpperCase() + employee.assessment.potential?.slice(1)} Potential
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* AI Coach Micro Panel - Contextual Suggestions */}
          <div className="mt-4">
            <AICoachMicroPanel
              context="employee-detail-modal"
              suggestions={getEmployeeModalSuggestions({
                employeeId: employee.id,
                employeeName: employee.name,
                hasPlan: Boolean(currentPlan),
                hasReview: performanceReviewRecord?.manager?.status === 'completed',
                hasRecentOneOnOne: Boolean(
                  employee.one_on_one_meetings &&
                  employee.one_on_one_meetings.length > 0 &&
                  employee.one_on_one_meetings[0] &&
                  new Date(employee.one_on_one_meetings[0].created_at).getTime() >
                    Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
                ),
                hasWorkingGenius: Boolean(employee.working_genius),
              })}
              maxVisible={2}
              compact={true}
            />
          </div>
        </div>

        {/* Simplified Horizontal Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {(() => {
            // Calculate content indicators for each tab
            const hasPlan = Boolean(currentPlan);
            const hasJobDescription = Boolean(employee.job_description || (employee.key_responsibilities && employee.key_responsibilities.length > 0));
            const hasOneOnOnes = Boolean(employee.one_on_one_meetings && employee.one_on_one_meetings.length > 0);
            const has360 = false; // Would check 360 feedback when available
            const isPIP = false; // Would check if employee has active PIP
            const isInSuccession = Boolean(employee.is_critical_role || employee.critical_role_id);
            
            return [
            {
              key: 'perf-review' as NavKey,
              label: 'Review & ITP',
              icon: ClipboardList,
              activeClass: 'bg-indigo-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200',
              hasContent: performanceReviews.length > 0,
              badge: performanceReviews.length,
              badgeClass: 'bg-green-500 text-white',
            },
            {
              key: 'plan' as NavKey,
              label: 'Dev Plan',
              icon: FileText,
              activeClass: 'bg-blue-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200',
              hasContent: hasPlan,
            },
            {
              key: '360' as NavKey,
              label: '360',
              icon: UsersIcon,
              activeClass: 'bg-purple-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-200',
              hasContent: has360,
            },
            {
              key: 'one-on-one' as NavKey,
              label: '1-on-1',
              icon: Calendar,
              activeClass: 'bg-green-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200',
              hasContent: hasOneOnOnes,
              badge: employee.one_on_one_meetings?.length || 0,
              badgeClass: 'bg-green-500 text-white',
            },
            {
              key: 'notes' as NavKey,
              label: 'Notes',
              icon: Lock,
              activeClass: 'bg-amber-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-amber-50 border border-gray-200',
              hasContent: managerNotes.length > 0,
              badge: managerNotes.length,
              badgeClass: 'bg-purple-500 text-white',
            },
            {
              key: 'pip' as NavKey,
              label: 'PIP',
              icon: AlertTriangle,
              activeClass: 'bg-red-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-red-50 border border-gray-200',
              hasContent: isPIP,
            },
            {
              key: 'succession' as NavKey,
              label: 'Succession',
              icon: TrendingUp,
              activeClass: 'bg-teal-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-teal-50 border border-gray-200',
              hasContent: isInSuccession,
            },
            {
              key: 'ingest' as NavKey,
              label: 'Ingest',
              icon: Sparkles,
              activeClass: 'bg-pink-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-pink-50 border border-gray-200',
              hasContent: true, // AI tool - always available
            },
            {
              key: 'job-description' as NavKey,
              label: 'Job Description',
              icon: FileCode,
              activeClass: 'bg-indigo-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200',
              hasContent: hasJobDescription,
            },
            {
              key: 'details' as NavKey,
              label: 'Details',
              icon: User,
              activeClass: 'bg-gray-600 text-white shadow-md',
              inactiveClass: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200',
              hasContent: true, // Always has basic details
            },
          ];
          })().map((item) => {
            const Icon = item.icon;
            const isActive = activeSubPanel === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSubPanel(item.key as any);
                  // Map 'ingest' to 'review' for the content panel
                  const tabToShow = item.key === 'ingest' ? 'review' : item.key;
                  setActiveTab(tabToShow as any);
                }}
                className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive ? item.activeClass : item.inactiveClass
                } ${!item.hasContent && !isActive ? 'opacity-60' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                
                {/* Content Indicators */}
                {item.badge && item.badge > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.badgeClass ?? 'bg-gray-800 text-white'}`}>
                    {item.badge}
                  </span>
                ) : item.hasContent ? (
                  <Check className={`w-3.5 h-3.5 ${isActive ? 'text-white/80' : 'text-green-600'}`} />
                ) : (
                  <Minus className={`w-3.5 h-3.5 ${isActive ? 'text-white/40' : 'text-gray-400'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 space-y-4">
                  {(!currentPlan && !analysisResult) && (
                    <div className="bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 border border-purple-200 rounded-xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-inner">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-gray-900">Jump-start this card with a review</h3>
                          <p className="text-sm text-gray-700">
                            Paste the latest performance review and we&apos;ll auto-fill placement, strengths, growth areas, and draft a plan so you can coach with context.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              activatePanel('review');
                              setTimeout(() => {
                                const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
                                textarea?.focus();
                              }, 150);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700"
                          >
                            <Upload className="h-4 w-4" />
                            Ingest a performance review
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
                      <div className="space-y-3 text-sm text-gray-700">
                        {employee.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <span>{employee.email}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Email not captured yet.</p>
                        )}
                        {employee.location ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-500" />
                            <span>{employee.location}</span>
                          </div>
                        ) : null}
                        {employee.manager_name ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-500" />
                            <span>Reports to {employee.manager_name}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Employment Snapshot</h3>
                      <div className="space-y-3 text-sm text-gray-700">
                        {employee.title && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-indigo-500" />
                            <span>{employee.title}</span>
                          </div>
                        )}
                        {department && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-amber-500" />
                            <span>{department.name}</span>
                          </div>
                        )}
                        {employee.created_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-pink-500" />
                            <span>Added {new Date(employee.created_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {employee.assessment && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-blue-900 mb-3">Current 9-box placement</h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 font-semibold text-blue-700">
                            📊 Performance: {employee.assessment.performance?.toUpperCase()}
                          </div>
                          <div className="rounded-lg border border-green-200 bg-white px-3 py-2 font-semibold text-green-700">
                            🚀 Potential: {employee.assessment.potential?.toUpperCase()}
                          </div>
                          <div className="col-span-2 text-gray-600 text-xs">
                            Box key: {employee.assessment.box_key ?? 'Not assigned'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Critical Role Card */}
                    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Critical Role Status
                      </h3>
                      {employee.is_critical_role ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-100 px-3 py-2 rounded-lg border border-amber-300">
                            <CheckCircle className="h-4 w-4 text-amber-600" />
                            Designated Critical Role
                          </div>
                          <button
                            onClick={() => setIsSuccessionModalOpen(true)}
                            className="w-full text-xs font-semibold text-amber-700 bg-white hover:bg-amber-100 px-3 py-2 rounded-lg border border-amber-300 transition-colors flex items-center justify-center gap-2"
                          >
                            <TrendingUp className="h-4 w-4" />
                            View Succession Plan
                          </button>
                          <button
                            onClick={() => {
                              if (onUpdateEmployee) {
                                onUpdateEmployee({ ...employee, is_critical_role: false, critical_role_id: undefined });
                              }
                              notify('Removed from critical roles', 'info');
                            }}
                            className="w-full text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-300 transition-colors"
                          >
                            Remove Critical Role Status
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600 mb-3">
                            Mark this position as critical to begin succession planning and identify potential successors.
                          </p>
                          <button
                            onClick={() => setIsCriticalRoleSetupOpen(true)}
                            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Shield className="h-4 w-4" />
                            Mark as Critical Role
                          </button>
                        </div>
                      )}
                    </div>

                    {analysisResult && (
                      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-purple-900 mb-3">Latest AI insights</h3>
                        <p className="text-xs text-gray-600 mb-3">{analysisResult.reasoning || 'Review analyzed.'}</p>
                        <div className="space-y-2 text-xs text-gray-700">
                          {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                            <div>
                              <p className="font-semibold text-purple-800">Top strengths</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {analysisResult.strengths.map((item, index) => (
                                  <li key={`detail-strength-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysisResult.developmentAreas && analysisResult.developmentAreas.length > 0 && (
                            <div>
                              <p className="font-semibold text-purple-800">Focus next</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {analysisResult.developmentAreas.map((item, index) => (
                                  <li key={`detail-dev-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {currentPlan ? (
                    <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Plan status</h3>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getPlanTypeMeta(currentPlan.plan_type).badgeClass}`}>
                          {getPlanTypeMeta(currentPlan.plan_type).label}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-gray-700">
                        <div className="flex items-center justify-between">
                          <span>Progress</span>
                          <span className="font-semibold text-blue-600">{getPlanProgress()}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${getPlanProgress()}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                            <p className="text-[11px] text-gray-500">Actions</p>
                            <p className="text-sm font-semibold text-gray-900">{currentPlan.action_items?.length ?? 0}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                            <p className="text-[11px] text-gray-500">Next check-in</p>
                            <p className="text-sm font-semibold text-gray-900">{currentPlan.next_review_date ?? 'Set date'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePanel('plan')}
                          className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                          <FileText className="h-4 w-4" />
                          View full plan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/70 p-5 text-sm text-blue-800">
                      <p className="font-semibold mb-2">No plan created yet</p>
                      <p className="text-xs mb-3">Draft a plan or PIP after analyzing a review so this card always shows the latest commitments.</p>
                      <button
                        type="button"
                        onClick={() => activatePanel('plan')}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <PenSquare className="h-4 w-4" />
                        Create plan now
                      </button>
                    </div>
                  )}

                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Guided next steps</h3>
                    <div className="space-y-2">
                      {(analysisResult?.recommendations ?? buildNextSteps(
                        employee.assessment?.performance ?? undefined,
                        employee.assessment?.potential ?? undefined,
                        currentPlan?.plan_type ?? undefined,
                      )).slice(0, 3).map((step) => (
                        <div key={`detail-next-${step.id}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold text-gray-800">{step.title}</p>
                          <p className="text-[11px] text-gray-600">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Review/Ingest Tab */}
          {activeTab === 'review' && (
            <div className="space-y-6">
              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-semibold text-gray-900">AI Review Tools</div>
                    <div className="text-xs text-gray-600">Analyze reviews, generate plans, or create new content</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('perf-review');
                      setActiveSubPanel('perf-review');
                      setTimeout(() => setIsPerformanceReviewModalOpen(true), 100);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <PenSquare className="w-4 h-4" />
                    Create New Review
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Upload or Paste Review</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Paste a performance review and AI will extract ratings, strengths, development areas, and auto-generate a development plan.
                    </p>
                  </div>
                </div>

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Paste the employee's performance review here..."
                  className="w-full h-64 px-4 py-3 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />

                {analysisError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Analysis Error</p>
                      <p className="text-sm text-red-700 mt-1">{analysisError}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAnalyzeReview}
                  disabled={isAnalyzing || !reviewText.trim()}
                  className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyzing Review...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Analyze Review with AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Results */}
              {analysisResult && (
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Analysis Complete</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Performance Rating</p>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-100 text-blue-800">
                          📊 {analysisResult.performance?.charAt(0).toUpperCase() + analysisResult.performance?.slice(1)}
                        </span>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Potential Rating</p>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                          🚀 {analysisResult.potential?.charAt(0).toUpperCase() + analysisResult.potential?.slice(1)}
                        </span>
                      </div>
                    </div>

                    {analysisResult?.reasoning && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Reasoning</p>
                        <p className="text-sm text-gray-700">{analysisResult.reasoning}</p>
                      </div>
                    )}

                    {analysisResult?.strengths && analysisResult.strengths.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Key strengths spotted</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                          {analysisResult.strengths.map((item, index) => (
                            <li key={`strength-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult?.developmentAreas && analysisResult.developmentAreas.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-amber-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Growth focus areas</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                          {analysisResult.developmentAreas.map((item, index) => (
                            <li key={`dev-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult?.planType && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Recommended Plan Type</p>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${getPlanTypeMeta(analysisResult.planType).badgeClass}`}>
                          {getPlanTypeMeta(analysisResult.planType).label}
                        </span>
                        {analysisResult.timeline && (
                          <p className="text-xs text-gray-500 mt-2">Suggested timeline: {analysisResult.timeline}</p>
                        )}
                        {analysisResult.successMetrics && analysisResult.successMetrics.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Success signals</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                              {(Array.isArray(analysisResult.successMetrics)
                                ? analysisResult.successMetrics
                                : [analysisResult.successMetrics]
                              )
                                .filter(Boolean)
                                .map((metric, index) => (
                                  <li key={`metric-${index}`}>{metric}</li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <p className="text-sm text-gray-600 font-medium mb-2">✅ Development plan created with {analysisResult?.actionItems?.length || 0} action items</p>
                      <p className="text-xs text-gray-500">Switch to the "Development Plan" tab to view and manage the plan.</p>
                    </div>

                  {analysisResult?.recommendations && analysisResult.recommendations.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-gray-600 font-medium mb-3">Suggested next moves</p>
                      <div className="space-y-3">
                        {analysisResult.recommendations.map((step) => {
                          const isComplete = Boolean(guidedProgress[step.id]);
                          return (
                            <div
                              key={step.id}
                              className={`rounded-lg border p-3 transition ${
                                isComplete ? 'border-green-200 bg-green-50/70' : 'border-blue-100 bg-blue-50/70'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {isComplete ? 'Done' : 'Next up'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-600 leading-relaxed">{step.description}</p>
                              {step.actionLabel && step.onAction && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    step.onAction?.();
                                    setGuidedProgress(prev => ({ ...prev, [step.id]: true }));
                                  }}
                                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                                >
                                  {step.actionLabel}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plan Tab */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              {currentPlan ? (
                <>
                  {/* Plan Overview */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {getPlanTypeMeta(currentPlan.plan_type).label}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPlanTypeMeta(currentPlan.plan_type).badgeClass}`}>
                          {currentPlan.plan_type?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        currentPlan.status === 'active' ? 'bg-green-100 text-green-800' :
                        currentPlan.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {currentPlan.status?.toUpperCase()}
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-bold text-blue-600">{getPlanProgress()}%</span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                          style={{ width: `${getPlanProgress()}%` }}
                        />
                      </div>
                    </div>

                    {currentPlan.goals && (
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">Goals</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{currentPlan.goals}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Items */}
                  {currentPlan.action_items && currentPlan.action_items.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Items</h3>
                      <div className="space-y-3">
                        {currentPlan.action_items.map((item: ActionItem, index: number) => (
                          <div
                            key={item.id || index}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              item.completed
                                ? 'bg-green-50 border-green-200'
                                : 'bg-white border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                  item.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                                }`}>
                                  {item.description}
                                </p>
                                <div className="flex items-center space-x-4 mt-2">
                                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                    item.priority === 'high' ? 'bg-red-100 text-red-700' :
                                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.priority?.toUpperCase()}
                                  </span>
                                  {item.owner && (
                                    <span className="text-xs text-gray-600">👤 {item.owner}</span>
                                  )}
                                  {item.dueDate && (
                                    <span className="text-xs text-gray-600">
                                      📅 {new Date(item.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {item.skillArea && (
                                    <span className="text-xs text-gray-600">🎯 {item.skillArea}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleActionItem(index)}
                                className={`ml-4 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                                  item.completed
                                    ? 'border-green-500 bg-green-50 text-green-600 hover:bg-green-100'
                                    : 'border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                                }`}
                                aria-pressed={item.completed}
                                aria-label={item.completed ? 'Mark action item as incomplete' : 'Mark action item as complete'}
                              >
                                {item.completed ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths and Development Areas */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {currentPlan.strengths && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">💪 Strengths</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{currentPlan.strengths}</p>
                      </div>
                    )}
                    {currentPlan.development_areas && (
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <p className="text-sm text-gray-600 font-medium mb-2">🎯 Development Areas</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{currentPlan.development_areas}</p>
                      </div>
                    )}
                    {currentPlan.objectives && currentPlan.objectives.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-blue-200 lg:col-span-2">
                        <p className="text-sm text-gray-600 font-medium mb-2">🎯 Objectives</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                          {(Array.isArray(currentPlan.objectives) ? currentPlan.objectives : [currentPlan.objectives])
                            .filter(Boolean)
                            .map((objective: string, index: number) => (
                              <li key={`objective-${index}`}>{objective}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Success Metrics */}
                  {currentPlan.success_metrics && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-gray-600 font-medium mb-2">📊 Success Metrics</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                        {(Array.isArray(currentPlan.success_metrics)
                          ? currentPlan.success_metrics
                          : [currentPlan.success_metrics]
                        ).filter(Boolean).map((metric: string, index: number) => (
                          <li key={`metric-${index}`}>{metric}</li>
                        ))}
                      </ul>
                    </div>
                  )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsPlanModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 mt-4 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <PenSquare className="w-4 h-4" />
                  Refresh or Edit Plan
                </button>
                {currentPlan?.plan_type === 'retention' && (
                  <button
                    onClick={() => setIsRetentionPlanModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 mt-4 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    View Retention Details
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Development Plan</h3>
              <p className="text-sm text-gray-600 mb-6">
                This employee doesn't have a development plan yet.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setIsPlanModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Create Development Plan
                </button>
                <button
                  onClick={() => setIsRetentionPlanModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Create Retention Plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

          {/* 360 Feedback Tab */}
          {activeTab === '360' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <UsersIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">360-Degree Feedback</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Gather multi-perspective insights from managers, peers, and direct reports.
                </p>
                <button
                  onClick={() => setIs360ModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <UsersIcon className="w-5 h-5 inline mr-2" />
                  Launch 360 Survey
                </button>
              </div>
            </div>
          )}

          {/* One-on-One Tab */}
          {activeTab === 'one-on-one' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-6">
                <Calendar className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  One-on-One Meetings
                </h3>
                <p className="text-gray-600 mb-6">
                  Schedule and manage one-on-one meetings with{' '}
                  <EmployeeNameLink
                    employee={employee}
                    className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
                    onClick={(event) => event.stopPropagation()}
                  />
                </p>
              </div>
              <button
                onClick={() => setIsOneOnOneModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Manage One-on-One Meetings
              </button>
            </div>
          )}

          {/* PIP Tab */}
          {activeTab === 'pip' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-6">
                <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Performance Improvement Plan
                </h3>
                <p className="text-gray-600 mb-6 max-w-md">
                  Manage formal performance improvement plans with 30/60/90-day milestones, check-ins, and progress tracking
                </p>
              </div>
              <button
                onClick={() => setIsPIPModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                Manage PIP
              </button>
            </div>
          )}

          {/* Succession Planning Tab */}
          {activeTab === 'succession' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-6">
                <TrendingUp className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Succession Planning
                </h3>
                <p className="text-gray-600 mb-6 max-w-md">
                  View succession planning analytics, critical roles, and candidate readiness across your organization
                </p>
              </div>
              <button
                onClick={() => setIsSuccessionModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <TrendingUp className="w-5 h-5" />
                Open Succession Planning
              </button>
            </div>
          )}

          {/* Job Description Tab */}
          {activeTab === 'job-description' && (
            <div>
              {isEditingJobDescription ? (
                <JobDescriptionEditor
                  employee={employee}
                  onSave={async (updates) => {
                    // Update employee with job description fields
                    if (onUpdateEmployee) {
                      const updatedEmployee = { ...employee, ...updates };
                      await onUpdateEmployee(updatedEmployee);
                    }
                    setIsEditingJobDescription(false);
                  }}
                  onCancel={() => setIsEditingJobDescription(false)}
                />
              ) : (
                <JobDescriptionViewer
                  employee={employee}
                  onEdit={() => setIsEditingJobDescription(true)}
                  canEdit={true}
                />
              )}
            </div>
          )}

          {/* Manager Notes Tab */}
          {activeTab === 'notes' && (
            <ManagerNotes
              employeeId={employee.id}
              employeeName={employee.name}
              notes={managerNotes}
              currentUserName="Current Manager"
              onAddNote={(note) => {
                // In real implementation, save to Supabase
                const newNote: ManagerNote = {
                  ...note,
                  id: `note-${Date.now()}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                setManagerNotes([...managerNotes, newNote]);

                // Show alert if requires acknowledgment
                if (note.requires_acknowledgment) {
                  notify({
                    title: 'Feedback sent for acknowledgment',
                    description: `${employee.name} must acknowledge this ${note.severity ?? 'medium'} severity note.`,
                    variant: 'info',
                  });
                }

                // Update employee object if needed
                if (onUpdateEmployee) {
                  onUpdateEmployee({
                    ...employee,
                    manager_notes: [...managerNotes, newNote],
                  });
                }
              }}
              onDeleteNote={(noteId) => {
                // In real implementation, delete from Supabase
                const updatedNotes = managerNotes.filter(n => n.id !== noteId);
                setManagerNotes(updatedNotes);

                // Update employee object if needed
                if (onUpdateEmployee) {
                  onUpdateEmployee({
                    ...employee,
                    manager_notes: updatedNotes,
                  });
                }
              }}
              onAcknowledgeNote={(noteId) => {
                // Employee acknowledges the feedback
                const updatedNotes = managerNotes.map(n =>
                  n.id === noteId
                    ? {
                        ...n,
                        acknowledged_at: new Date().toISOString(),
                        acknowledged_by: employee.name,
                      }
                    : n
                );
                setManagerNotes(updatedNotes);

                // Update employee object
                if (onUpdateEmployee) {
                  onUpdateEmployee({
                    ...employee,
                    manager_notes: updatedNotes,
                  });
                }

                notify({
                  title: 'Feedback acknowledged',
                  description: `${employee.name} confirmed receipt of this feedback.`,
                  variant: 'success',
                });
              }}
            />
          )}

          {/* Performance Review & ITP Matrix Tab (Combined) */}
          {activeTab === 'perf-review' && (
            <div className="space-y-6">
              {/* Create New Review Section */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-8 border-4 border-indigo-300 shadow-xl">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <ClipboardList className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Performance Review & ITP Matrix</h3>
                    <p className="text-base text-gray-700 leading-relaxed">
                      Complete comprehensive performance reviews with the <strong>Ideal Team Player</strong> matrix (Humble, Hungry, Smart), OKRs, and development areas.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={() => {
                      setPerformanceReviewType('self');
                      setIsPerformanceReviewModalOpen(true);
                    }}
                    className="group px-6 py-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-2 border-2 border-green-400"
                  >
                    <User className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-lg">Self-Reflection</span>
                    <span className="text-xs opacity-90">Complete self-assessment</span>
                  </button>

                  <button
                    onClick={() => {
                      setPerformanceReviewType('manager');
                      setIsPerformanceReviewModalOpen(true);
                    }}
                    className="group px-6 py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-2 border-2 border-blue-400"
                  >
                    <UsersIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-lg">Manager Review</span>
                    <span className="text-xs opacity-90">Assess team member performance</span>
                  </button>

                  <button
                    onClick={() => setIsReviewParserModalOpen(true)}
                    className="group px-6 py-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-700 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-2 border-2 border-purple-400"
                  >
                    <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-lg">Ingest</span>
                    <span className="text-xs opacity-90">Import existing review</span>
                  </button>
                </div>

                <div className="mt-6 bg-white/80 rounded-lg p-4 border-2 border-indigo-200">
                  <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                    <Award className="w-4 h-4 mr-2 text-indigo-600" />
                    What's Included:
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Accomplishments, Impact & OKRs</li>
                    <li>Growth & Development Areas</li>
                    <li>Support & Feedback Needs</li>
                    <li><strong>Ideal Team Player Matrix</strong> (Humble, Hungry, Smart) with detailed 12-behavior scoring</li>
                    <li>Performance Summary & Additional Comments</li>
                  </ul>
                </div>
              </div>

              {/* Existing Reviews with ITP Details */}
              {performanceReviews.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Review History & ITP Matrix Scores</h3>
                  <div className="space-y-4">
                    {performanceReviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {review.review_type === 'self' ? (
                              <User className="w-6 h-6 text-green-600" />
                            ) : (
                              <UsersIcon className="w-6 h-6 text-blue-600" />
                            )}
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">
                                {review.review_type === 'self' ? 'Self-Assessment' : 'Manager Assessment'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {review.submitted_at
                                  ? `Submitted: ${new Date(review.submitted_at).toLocaleDateString()}`
                                  : `Last updated: ${new Date(review.updated_at).toLocaleDateString()}`
                                }
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            review.status === 'submitted' || review.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {review.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Overall ITP Scores */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                            <div className="text-sm font-medium text-blue-700 mb-1">Humble</div>
                            <div className="text-3xl font-bold text-blue-900">{review.humble_score}</div>
                            <div className="text-xs text-blue-600 mt-1">out of 10</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                            <div className="text-sm font-medium text-green-700 mb-1">Hungry</div>
                            <div className="text-3xl font-bold text-green-900">{review.hungry_score}</div>
                            <div className="text-xs text-green-600 mt-1">out of 10</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                            <div className="text-sm font-medium text-purple-700 mb-1">People Smart</div>
                            <div className="text-3xl font-bold text-purple-900">{review.smart_score}</div>
                            <div className="text-xs text-purple-600 mt-1">out of 10</div>
                          </div>
                        </div>

                        {/* Detailed Behavior Scores */}
                        {(review.humble_scores || review.hungry_scores || review.smart_scores) && (
                          <div className="space-y-4">
                            {/* Humble Behaviors */}
                            {review.humble_scores && (
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h5 className="font-bold text-blue-900 mb-3 flex items-center">
                                  <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                                  Humble Behaviors
                                </h5>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Recognition</span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded">{review.humble_scores.recognition}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Collaboration</span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded">{review.humble_scores.collaboration}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Handling Mistakes</span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded">{review.humble_scores.handling_mistakes}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Communication</span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded">{review.humble_scores.communication}/10</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Hungry Behaviors */}
                            {review.hungry_scores && (
                              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <h5 className="font-bold text-green-900 mb-3 flex items-center">
                                  <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                                  Hungry Behaviors
                                </h5>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Initiative</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-900 text-xs font-bold rounded">{review.hungry_scores.initiative}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Commitment</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-900 text-xs font-bold rounded">{review.hungry_scores.commitment}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Discretionary Effort</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-900 text-xs font-bold rounded">{review.hungry_scores.discretionary_effort}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Growth Mindset</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-900 text-xs font-bold rounded">{review.hungry_scores.growth_mindset}/10</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* People Smart Behaviors */}
                            {review.smart_scores && (
                              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                <h5 className="font-bold text-purple-900 mb-3 flex items-center">
                                  <span className="w-2 h-2 bg-purple-600 rounded-full mr-2"></span>
                                  People Smart Behaviors
                                </h5>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Situational Awareness</span>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded">{review.smart_scores.situational_awareness}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Empathy</span>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded">{review.smart_scores.empathy}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Relationship Building</span>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded">{review.smart_scores.relationship_building}/10</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">Influence</span>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded">{review.smart_scores.influence}/10</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Performance Reviews Yet</h3>
                  <p className="text-sm text-gray-600">
                    Start by creating a manager review or requesting a self-reflection above.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* One-on-One Modal */}
      <OneOnOneModal
        isOpen={isOneOnOneModalOpen}
        onClose={() => setIsOneOnOneModalOpen(false)}
        employee={employee}
        organizationId={employee.organization_id}
        currentUserName="Current Manager"
        currentUserId="mock-manager-123"
      />

      {/* PIP Modal */}
      <PIPModal
        isOpen={isPIPModalOpen}
        onClose={() => setIsPIPModalOpen(false)}
        employee={employee}
        organizationId={employee.organization_id}
        currentUserName="Current Manager"
        currentUserId="mock-manager-123"
        performanceReviews={performanceReviews}
      />

      <EnhancedEmployeePlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        employee={employee}
        department={department}
        onSave={(plan) => {
          setCurrentPlan(plan);
          onSavePlan?.(plan);
        }}
        existingPlan={currentPlan ?? undefined}
        performanceReviews={performanceReviews}
      />

      <RetentionPlanModal
        isOpen={isRetentionPlanModalOpen}
        onClose={() => setIsRetentionPlanModalOpen(false)}
        employee={employee}
        existingPlan={currentPlan ?? undefined}
        flightRiskScore={0}
        onSave={(plan) => {
          setCurrentPlan(plan);
          onSavePlan?.(plan);
        }}
      />

      <Survey360Wizard
        isOpen={is360ModalOpen}
        onClose={() => setIs360ModalOpen(false)}
        organizationId={employee.organization_id}
        preselectedEmployee={employee}
        onSurveyCreated={() => setIs360ModalOpen(false)}
        employees={availableEmployees}
      />

      {/* Succession Planning Modal */}
      <SuccessionPlanningModal
        isOpen={isSuccessionModalOpen}
        onClose={() => setIsSuccessionModalOpen(false)}
        organizationId={employee.organization_id}
        currentUserName="Current Manager"
      />

      {/* Performance Review Modal */}
      <PerformanceReviewModal
        isOpen={isPerformanceReviewModalOpen}
        onClose={() => setIsPerformanceReviewModalOpen(false)}
        employee={employee}
        reviewType={performanceReviewType}
        currentUserName="Current Manager"
        existingReview={performanceReviews.find(r => r.review_type === performanceReviewType)}
        onSave={(review) => {
          setPerformanceReviews(prev => {
            const next = [...prev];
            const existingIndex = next.findIndex(r => r.id === review.id);
            if (existingIndex >= 0) {
              next[existingIndex] = review;
            } else {
              next.push(review);
            }
            return next;
          });
          onReviewSave?.(review);
        }}
      />

      {/* Review Parser Modal - for ingesting existing reviews */}
      <ReviewParserModal
        isOpen={isReviewParserModalOpen}
        onClose={() => setIsReviewParserModalOpen(false)}
        departments={department ? [department] : []}
        onEmployeeCreated={() => {
          notify({
            title: 'Review ingested',
            description: 'Parsed reviews will soon improve this view. Manual linking is still required for now.',
            variant: 'info',
          });
          setIsReviewParserModalOpen(false);
          // TODO: Convert parsed review data to PerformanceReview format and add to performanceReviews
        }}
      />

      {/* Critical Role Setup Modal */}
      <CriticalRoleSetupModal
        isOpen={isCriticalRoleSetupOpen}
        onClose={() => setIsCriticalRoleSetupOpen(false)}
        employee={employee}
        department={department}
        availableEmployees={availableEmployees}
        onSave={(data) => {
          if (onUpdateEmployee) {
            const criticalRoleId = `cr-${employee.id}-${Date.now()}`;
            onUpdateEmployee({
              ...employee,
              is_critical_role: true,
              critical_role_id: criticalRoleId
            });
          }
          notify({
            title: 'Critical Role Configured',
            description: `${data.successorIds.length} successor(s) identified with ${data.timelineMonths}-month development plan`,
            variant: 'success',
          });
          setIsCriticalRoleSetupOpen(false);
          // Optionally open succession planning modal
          setTimeout(() => setIsSuccessionModalOpen(true), 500);
        }}
      />
    </div>
  );
}
