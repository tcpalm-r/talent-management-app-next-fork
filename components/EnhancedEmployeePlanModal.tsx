import { useState, useEffect } from 'react';
import {
  X,
  Target,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  FileText,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  Employee,
  Department,
  EmployeePlan,
  ActionItem,
  ActionItemPriority,
  ActionItemStatus,
} from '../types';
import {
  generateSmartActionItems,
  calculatePlanProgress,
  getOverdueActionItems,
  getUpcomingActionItems,
  calculateActionItemStatus,
} from '../lib/actionItemGenerator';
import type { PerformanceReview } from './PerformanceReviewModal';
import { analyzePerformanceReview } from '../lib/reviewAnalyzer';
import { composeReviewNarrative } from '../lib/reviewTextFormatter';
import { EmployeeNameLink } from './unified';

interface EnhancedEmployeePlanModalProps {
  isOpen: boolean;
  employee: Employee;
  department?: Department;
  onClose: () => void;
  onSave: (plan: Partial<EmployeePlan>) => void;
  existingPlan?: EmployeePlan;
  performanceReviews?: PerformanceReview[];
}

const PriorityBadge = ({ priority }: { priority: ActionItemPriority }) => {
  const colors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${colors[priority]}`}>
      {priority.toUpperCase()}
    </span>
  );
};

const StatusBadge = ({ status }: { status: ActionItemStatus }) => {
  const config = {
    not_started: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Not Started' },
    in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
    completed: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Completed' },
    blocked: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Blocked' },
    overdue: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Overdue' }
  };

  const { color, label } = config[status];

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
};

export default function EnhancedEmployeePlanModal({
  isOpen,
  employee,
  department,
  onClose,
  onSave,
  existingPlan,
  performanceReviews = [],
}: EnhancedEmployeePlanModalProps) {
  const [planType, setPlanType] = useState<'development' | 'performance_improvement' | 'retention' | 'succession'>(
    existingPlan?.plan_type || 'development'
  );
  const [title, setTitle] = useState(existingPlan?.title || '');
  const [actionItems, setActionItems] = useState<ActionItem[]>(existingPlan?.action_items || []);
  const [objectives, setObjectives] = useState<string[]>(existingPlan?.objectives || []);
  const [successMetrics, setSuccessMetrics] = useState<string[]>(existingPlan?.success_metrics || []);
  const [notes, setNotes] = useState(existingPlan?.notes || '');
  const [timeline, setTimeline] = useState(existingPlan?.timeline || '90 days');
  const [nextReviewDate, setNextReviewDate] = useState(existingPlan?.next_review_date || '');
  const [budgetAllocated, setBudgetAllocated] = useState(existingPlan?.budget_allocated || 0);
  const [budgetSpent, setBudgetSpent] = useState(existingPlan?.budget_spent || 0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    actions: true,
    objectives: false,
    metrics: false,
    budget: false
  });
  const [creationStep, setCreationStep] = useState<'choose' | 'review-source' | 'review-internal' | 'review-external' | 'editing'>(existingPlan ? 'editing' : 'choose');
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isAnalyzingReview, setIsAnalyzingReview] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const resetPlanFields = () => {
    setTitle('');
    setObjectives([]);
    setActionItems([]);
    setSuccessMetrics([]);
    setNotes('');
    setTimeline('90 days');
    setNextReviewDate('');
    setBudgetAllocated(0);
    setBudgetSpent(0);
  };

  const applyPlan = (plan: Partial<EmployeePlan>) => {
    if (plan.title) setTitle(plan.title);
    if (plan.objectives) setObjectives([...plan.objectives]);
    if (plan.action_items) setActionItems([...plan.action_items]);
    if (plan.success_metrics) setSuccessMetrics([...plan.success_metrics]);
    if (plan.notes !== undefined) setNotes(plan.notes);
    if (plan.timeline) setTimeline(plan.timeline);
    if (plan.next_review_date) setNextReviewDate(plan.next_review_date);
    if (plan.budget_allocated !== undefined) setBudgetAllocated(plan.budget_allocated);
    if (plan.budget_spent !== undefined) setBudgetSpent(plan.budget_spent);
  };

  const initializeManualPlan = () => {
    const smartItems = generateSmartActionItems(
      employee.assessment?.performance || null,
      employee.assessment?.potential || null,
      employee.name
    );

    resetPlanFields();
    setActionItems(smartItems);
    setAnalysisError(null);
    setReviewText('');
    setSelectedReviewId(null);

    const perf = employee.assessment?.performance || 'medium';
    const pot = employee.assessment?.potential || 'medium';
    setTitle(`${capitalize(perf)} Performance / ${capitalize(pot)} Potential Development Plan`);

    setNextReviewDate(getDefaultNextReviewDate());
    setCreationStep('editing');
  };

  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  const getDefaultNextReviewDate = (daysAhead = 30) => {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysAhead);
    return nextReview.toISOString().split('T')[0];
  };

  const getReviewTextById = (reviewId: string) => {
    const review = performanceReviews.find((r) => r.id === reviewId);
    if (!review) return null;
    return composeReviewNarrative(review);
  };

  const analyzeAndApplyReview = async (text: string) => {
    if (!text.trim()) {
      setAnalysisError('Please provide review content to analyze.');
      return;
    }

    setIsAnalyzingReview(true);
    setAnalysisError(null);

    try {
      const { developmentPlan } = await analyzePerformanceReview(text, employee.name);
      const normalizedActionItems = developmentPlan?.action_items?.length
        ? developmentPlan.action_items
        : generateSmartActionItems(
            employee.assessment?.performance || null,
            employee.assessment?.potential || null,
            employee.name,
          );

      setTitle(developmentPlan?.title || `Development Plan for ${employee.name}`);
      setObjectives(developmentPlan?.objectives || []);
      setActionItems(normalizedActionItems);
      setSuccessMetrics(developmentPlan?.success_metrics || []);
      setNotes(developmentPlan?.notes || '');
      setTimeline(developmentPlan?.timeline || '90 days');
      setNextReviewDate(developmentPlan?.next_review_date || getDefaultNextReviewDate());
      setBudgetAllocated(developmentPlan?.budget_allocated || 0);
      setBudgetSpent(developmentPlan?.budget_spent || 0);
      setCreationStep('editing');
    } catch (error) {
      console.error('Error analyzing review for development plan:', error);
      setAnalysisError('Unable to analyze the review. Please try again or use manual build.');
    } finally {
      setIsAnalyzingReview(false);
    }
  };

  const handleInternalReviewGenerate = async () => {
    if (!selectedReviewId) {
      setAnalysisError('Select a review to continue.');
      return;
    }
    const reviewText = getReviewTextById(selectedReviewId);
    if (!reviewText) {
      setAnalysisError('Could not load the selected review.');
      return;
    }
    await analyzeAndApplyReview(reviewText);
  };

  const handleExternalReviewGenerate = async () => {
    await analyzeAndApplyReview(reviewText);
  };

  const handleContinueEditing = () => {
    setCreationStep('editing');
  };

  // Initialize with smart action items if no existing plan
  useEffect(() => {
    if (!isOpen) return;

    setAnalysisError(null);
    setIsAnalyzingReview(false);
    setSelectedReviewId(null);
    setReviewText('');

    if (existingPlan) {
      applyPlan(existingPlan);
    } else {
      resetPlanFields();
    }

    setCreationStep('choose');
  }, [isOpen, existingPlan]);

  const progress = calculatePlanProgress(actionItems);
  const overdueItems = getOverdueActionItems(actionItems);
  const upcomingItems = getUpcomingActionItems(actionItems);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderCreationStep = () => {
    switch (creationStep) {
      case 'choose':
        return renderChooseStep();
      case 'review-source':
        return renderReviewSourceStep();
      case 'review-internal':
        return renderInternalReviewStep();
      case 'review-external':
        return renderExternalReviewStep();
      default:
        return null;
    }
  };

  const renderChooseStep = () => (
    <div className="p-8">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        How do you want to build{' '}
        <EmployeeNameLink
          employee={employee}
          className="text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
          onClick={(event) => event.stopPropagation()}
        />
        's plan?
      </h3>
      <p className="text-gray-600 mb-8">
        Choose whether to start from a recent performance review or craft a plan manually. You can always customize the plan afterward.
      </p>

      <div className={`grid ${existingPlan ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'} gap-6`}>
        <button
          onClick={initializeManualPlan}
          className="group border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-blue-400 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Build Manually</h4>
          <p className="text-sm text-gray-600">
            Start from our recommended objectives and action items tailored to{' '}
            <EmployeeNameLink
              employee={employee}
              className="text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
              onClick={(event) => event.stopPropagation()}
            />
            's 9-box placement.
          </p>
        </button>

        <button
          onClick={() => setCreationStep('review-source')}
          className="group border-2 border-purple-200 rounded-2xl p-6 text-left hover:border-purple-400 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Ingest a Performance Review</h4>
          <p className="text-sm text-gray-600">
            Let Claude analyze a review (internal or external) and auto-generate a tailored development plan with objectives, metrics, and action items.
          </p>
        </button>

        {existingPlan && (
          <button
            onClick={handleContinueEditing}
            className="group border-2 border-green-200 rounded-2xl p-6 text-left hover:border-green-400 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <PenSquare className="w-6 h-6" />
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-green-500" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Open Current Plan</h4>
            <p className="text-sm text-gray-600">
              Jump straight into the existing plan to tweak goals, action items, or metrics.
            </p>
          </button>
        )}
      </div>
    </div>
  );

  const renderReviewSourceStep = () => {
    const hasInternalReviews = performanceReviews.length > 0;
    return (
      <div className="p-8">
        <button
          onClick={() => setCreationStep('choose')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Where is the review coming from?</h3>
        <p className="text-gray-600 mb-8">
          Choose an internal review already captured in Ninebox, or paste content from an external system.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setCreationStep('review-internal')}
            disabled={!hasInternalReviews}
            className={`border-2 rounded-2xl p-6 text-left transition-all ${
              hasInternalReviews
                ? 'border-blue-200 hover:border-blue-400 hover:shadow-lg'
                : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <ChevronRight className={`w-6 h-6 ${hasInternalReviews ? 'text-gray-400' : 'text-gray-300'}`} />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Internal Review Library</h4>
            <p className="text-sm text-gray-600">
              {hasInternalReviews
                ? 'Pick a recent self or manager review for this employee.'
                : 'No internal reviews found yet. Capture a review first or paste one below.'}
            </p>
          </button>

          <button
            onClick={() => setCreationStep('review-external')}
            className="border-2 border-purple-200 rounded-2xl p-6 text-left hover:border-purple-400 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Paste External Review</h4>
            <p className="text-sm text-gray-600">
              Copy a review from an HRIS, Google Doc, or email and we’ll transform it into a development plan.
            </p>
          </button>
        </div>
      </div>
    );
  };

  const renderInternalReviewStep = () => (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCreationStep('review-source')}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => setCreationStep('review-external')}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          Paste external review instead
        </button>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Select an internal review</h3>
        <p className="text-gray-600">
          Choose a review to auto-generate the plan. We’ll combine the qualitative responses and Ideal Team Player scores before analyzing.
        </p>
      </div>

      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
        {performanceReviews.map((review) => {
          const isSelected = review.id === selectedReviewId;
          return (
            <button
              key={review.id}
              onClick={() => setSelectedReviewId(review.id)}
              className={`w-full text-left border-2 rounded-2xl p-5 transition-all ${
                isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {review.review_type === 'manager' ? 'Manager Review' : 'Self-Reflection'} • {review.reviewer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated {new Date(review.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">H {review.humble_score}</span>
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">Hu {review.hungry_score}</span>
                  <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">S {review.smart_score}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 line-clamp-3">
                {review.accomplishments_okrs}
              </p>
            </button>
          );
        })}
      </div>

      {analysisError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {analysisError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setCreationStep('review-source')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleInternalReviewGenerate}
          disabled={isAnalyzingReview || !selectedReviewId}
          className="px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate plan
        </button>
      </div>
    </div>
  );

  const renderExternalReviewStep = () => (
    <div className="p-8 space-y-6">
      <button
        onClick={() => setCreationStep('review-source')}
        className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Paste the performance review</h3>
        <p className="text-gray-600">
          Drop in the full review text. Longer context works best—include wins, growth areas, feedback, and manager comments when available.
        </p>
      </div>

      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        rows={12}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        placeholder="Paste the performance review narrative here..."
      />

      {analysisError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {analysisError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setCreationStep('review-source')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleExternalReviewGenerate}
          disabled={isAnalyzingReview || !reviewText.trim()}
          className="px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate plan
        </button>
      </div>
    </div>
  );

  const handleAddActionItem = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const newItem: ActionItem = {
      id: `action-${Date.now()}`,
      description: '',
      dueDate: dueDate.toISOString(),
      completed: false,
      owner: 'Employee',
      priority: 'medium',
      status: 'not_started',
      skillArea: 'General',
      estimatedHours: 0
    };
    setActionItems([...actionItems, newItem]);
  };

  const handleUpdateActionItem = (index: number, updates: Partial<ActionItem>) => {
    const newItems = [...actionItems];
    newItems[index] = { ...newItems[index], ...updates };

    // Auto-update status when completed
    if (updates.completed !== undefined) {
      newItems[index].status = updates.completed ? 'completed' : 'not_started';
      if (updates.completed) {
        newItems[index].completedDate = new Date().toISOString();
      } else {
        newItems[index].completedDate = undefined;
      }
    }

    setActionItems(newItems);
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const plan: Partial<EmployeePlan> = {
      employee_id: employee.id,
      plan_type: planType,
      title,
      objectives,
      action_items: actionItems,
      timeline,
      success_metrics: successMetrics,
      notes,
      next_review_date: nextReviewDate,
      status: 'active',
      progress_percentage: progress,
      budget_allocated: budgetAllocated,
      budget_spent: budgetSpent,
      last_reviewed: new Date().toISOString(),
      created_at: existingPlan?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    onSave(plan);
    onClose();
  };

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
        {/* Header with Progress */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-bold">
                  <EmployeeNameLink
                    employee={employee}
                    className="text-white hover:text-blue-100 focus-visible:ring-white"
                    onClick={(event) => event.stopPropagation()}
                  />
                </h2>
                {department && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white border-2 border-white/30"
                  >
                    {department.name}
                  </span>
                )}
              </div>
              <p className="text-blue-100">{employee.title || 'Employee'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-blue-100">
              <span>{actionItems.filter(a => a.completed).length} of {actionItems.length} actions completed</span>
              {overdueItems.length > 0 && (
                <span className="flex items-center space-x-1 text-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{overdueItems.length} overdue</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {creationStep === 'editing' ? (
          <>
            {/* Alert Bar */}
            {overdueItems.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Action Required</p>
                    <p className="text-sm text-red-700">
                      {overdueItems.length} action item{overdueItems.length > 1 ? 's are' : ' is'} overdue. Review and update status immediately.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {upcomingItems.length > 0 && overdueItems.length === 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900">Upcoming Deadlines</p>
                    <p className="text-sm text-yellow-700">
                      {upcomingItems.length} action item{upcomingItems.length > 1 ? 's' : ''} due in the next 7 days.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Plan Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Plan Type
            </label>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value as typeof planType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="development">Development Plan</option>
              <option value="performance_improvement">Performance Improvement Plan</option>
              <option value="retention">Retention Plan</option>
              <option value="succession">Succession Plan</option>
            </select>
            {planType === 'retention' && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Note: For detailed retention planning, use the dedicated Retention Plan modal from the Flight Risk dashboard.
                This simplified plan will track basic retention objectives.
              </p>
            )}
          </div>

          {/* Plan Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {planType === 'retention' ? 'Retention Plan Title' :
               planType === 'performance_improvement' ? 'PIP Title' :
               planType === 'succession' ? 'Succession Plan Title' :
               'Development Plan Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter plan title..."
            />
          </div>

          {/* Timeline and Review Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Timeline
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="30 days">30 Days</option>
                <option value="60 days">60 Days</option>
                <option value="90 days">90 Days (Recommended)</option>
                <option value="6 months">6 Months</option>
                <option value="12 months">12 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Next Review Date
              </label>
              <input
                type="date"
                value={nextReviewDate}
                onChange={(e) => setNextReviewDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Items Section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('actions')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Action Items ({actionItems.length})
                </h3>
              </div>
              {expandedSections.actions ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.actions && (
              <div className="p-4 border-t border-gray-200 space-y-3">
                {actionItems.map((item, index) => {
                  const daysUntil = getDaysUntilDue(item.dueDate);
                  const isOverdue = daysUntil < 0 && !item.completed;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border-2 rounded-lg ${
                        item.completed
                          ? 'border-green-200 bg-green-50/50'
                          : isOverdue
                          ? 'border-red-200 bg-red-50/50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleUpdateActionItem(index, { completed: !item.completed })}
                          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            item.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-blue-500'
                          }`}
                        >
                          {item.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </button>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div>
                            <textarea
                              value={item.description}
                              onChange={(e) => handleUpdateActionItem(index, { description: e.target.value })}
                              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none ${
                                item.completed ? 'line-through text-gray-500' : ''
                              }`}
                              rows={2}
                              placeholder="Describe the action item..."
                            />
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {/* Due Date */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                              <input
                                type="date"
                                value={item.dueDate.split('T')[0]}
                                onChange={(e) => handleUpdateActionItem(index, { dueDate: new Date(e.target.value).toISOString() })}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              {daysUntil > 0 && !item.completed && (
                                <p className="text-xs text-gray-500 mt-1">{daysUntil} days left</p>
                              )}
                              {isOverdue && (
                                <p className="text-xs text-red-600 font-semibold mt-1">{Math.abs(daysUntil)} days overdue!</p>
                              )}
                            </div>

                            {/* Owner */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                              <select
                                value={item.owner}
                                onChange={(e) => handleUpdateActionItem(index, { owner: e.target.value as any })}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="Employee">Employee</option>
                                <option value="Manager">Manager</option>
                                <option value="HR">HR</option>
                              </select>
                            </div>

                            {/* Priority */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                              <select
                                value={item.priority}
                                onChange={(e) => handleUpdateActionItem(index, { priority: e.target.value as ActionItemPriority })}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>

                            {/* Status */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateActionItem(index, { status: e.target.value as ActionItemStatus })}
                                disabled={item.completed}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                              >
                                <option value="not_started">Not Started</option>
                                <option value="in_progress">In Progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                          </div>

                          {/* Badges Row */}
                          <div className="flex items-center space-x-2 flex-wrap gap-2">
                            <PriorityBadge priority={item.priority} />
                            <StatusBadge status={calculateActionItemStatus(item)} />
                            {item.skillArea && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-md border border-purple-200">
                                {item.skillArea}
                              </span>
                            )}
                            {item.estimatedHours && item.estimatedHours > 0 && (
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-200">
                                ~{item.estimatedHours}h
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveActionItem(index)}
                          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove action item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={handleAddActionItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">Add Action Item</span>
                </button>
              </div>
            )}
          </div>

          {/* Budget Tracking (Optional) */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('budget')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">Development Budget (Optional)</h3>
              </div>
              {expandedSections.budget ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.budget && (
              <div className="p-4 border-t border-gray-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Budget Allocated
                    </label>
                    <input
                      type="number"
                      value={budgetAllocated}
                      onChange={(e) => setBudgetAllocated(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Budget Spent
                    </label>
                    <input
                      type="number"
                      value={budgetSpent}
                      onChange={(e) => setBudgetSpent(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
                {budgetAllocated > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">Budget Utilization</span>
                      <span className="font-semibold">{budgetAllocated > 0 ? Math.round((budgetSpent / budgetAllocated) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${budgetAllocated > 0 ? Math.min((budgetSpent / budgetAllocated) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ${budgetSpent.toLocaleString()} of ${budgetAllocated.toLocaleString()} used
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Add any additional context, notes, or special considerations..."
            />
          </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {existingPlan && (
                    <span>Last updated: {formatDate(existingPlan.updated_at)}</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-lg shadow-blue-500/30"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Development Plan</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {renderCreationStep()}
          </div>
        )}
      </div>
    </div>
  );
}
