import { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  TrendingUp,
  BookOpen,
  Users,
  FileText,
  Target,
  Plus,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  Employee,
  PerformanceImprovementPlan,
  PIPExpectation,
  PIPCheckIn,
  PIPResource,
  PIPMilestoneReview,
  PIPStatus,
  PIPPhase,
  PIPExpectationStatus,
  PIPCheckInStatus,
  ActionItem,
} from '../types';
import { EmployeeNameLink } from './unified';
import { analyzePerformanceReview } from '../lib/reviewAnalyzer';
import { composeReviewNarrative } from '../lib/reviewTextFormatter';
import type { PerformanceReview } from './PerformanceReviewModal';
import PIPConversationCoach from './PIPConversationCoach';
import PIPDocumentationAssistant from './PIPDocumentationAssistant';
import PIPProgressIntelligence from './PIPProgressIntelligence';
import PIPAuditTrail from './PIPAuditTrail';

interface PIPModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  organizationId: string;
  currentUserName: string;
  currentUserId: string;
  performanceReviews?: PerformanceReview[];
}

type ModalView = 'list' | 'create' | 'dashboard' | 'check_in' | 'milestone_review';

export default function PIPModal({
  isOpen,
  onClose,
  employee,
  organizationId,
  currentUserName,
  currentUserId,
  performanceReviews = [],
}: PIPModalProps) {
  const [view, setView] = useState<ModalView>('list');
  const [pips, setPips] = useState<PerformanceImprovementPlan[]>([]);
  const [selectedPIP, setSelectedPIP] = useState<PerformanceImprovementPlan | null>(null);

  // PIP Data
  const [expectations, setExpectations] = useState<PIPExpectation[]>([]);
  const [checkIns, setCheckIns] = useState<PIPCheckIn[]>([]);
  const [resources, setResources] = useState<PIPResource[]>([]);
  const [milestoneReviews, setMilestoneReviews] = useState<PIPMilestoneReview[]>([]);

  // Form state for new PIP
  const [reasonForPIP, setReasonForPIP] = useState('');
  const [consequences, setConsequences] = useState('');
  const [supportProvided, setSupportProvided] = useState('');
  const [creationStep, setCreationStep] = useState<'choose' | 'review-source' | 'review-internal' | 'review-external' | 'form'>('choose');
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isAnalyzingReview, setIsAnalyzingReview] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [derivedActionItems, setDerivedActionItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    if (view === 'create') {
      setCreationStep('choose');
      setSelectedReviewId(null);
      setReviewText('');
      setAnalysisError(null);
      setDerivedActionItems([]);
      setReasonForPIP('');
      setConsequences('');
      setSupportProvided('');
    }
  }, [view]);

  const DEFAULT_CONSEQUENCE_TEXT = 'Failure to demonstrate sustained improvement on these expectations may result in further disciplinary action, up to and including termination of employment.';

  const resetReviewSelection = () => {
    setSelectedReviewId(null);
    setReviewText('');
    setAnalysisError(null);
    setDerivedActionItems([]);
  };

  const buildExpectationsFromActionItems = (items: ActionItem[], pipId: string): PIPExpectation[] => {
    if (!items.length) return [];
    const phases: PIPPhase[] = ['30_day', '60_day', '90_day'];
    return items.map((item, index) => {
      const phase = phases[Math.min(phases.length - 1, Math.floor((index / Math.max(items.length, 1)) * phases.length))];
      return {
        id: `pip-expectation-${Date.now()}-${index}`,
        pip_id: pipId,
        phase,
        category: item.skillArea || 'Core Performance',
        expectation: item.description,
        success_criteria: item.notes || 'Demonstrate clear progress against this expectation and capture outcomes in the 30/60/90-day reviews.',
        status: 'pending',
        progress_percentage: 0,
        reviewed_date: undefined,
        reviewed_by: undefined,
        review_notes: undefined,
        order_index: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  };

  const handleStartManualPip = () => {
    resetReviewSelection();
    if (!reasonForPIP) {
      setReasonForPIP('Document the specific performance gaps that triggered this PIP. Include metrics, deadlines, or behavioral concerns.');
    }
    if (!consequences) {
      setConsequences(DEFAULT_CONSEQUENCE_TEXT);
    }
    setCreationStep('form');
  };

  const analyzeReviewForPip = async (text: string) => {
    if (!text.trim()) {
      setAnalysisError('Provide review content before generating the PIP outline.');
      return;
    }

    setIsAnalyzingReview(true);
    setAnalysisError(null);

    try {
      const { developmentPlan } = await analyzePerformanceReview(text, employee.name);
      const normalizedItems = developmentPlan?.action_items?.length
        ? developmentPlan.action_items
        : [];

      setDerivedActionItems(normalizedItems);

      const primaryObjectives = developmentPlan?.objectives?.slice(0, 2) || [];
      const objectiveSentence = primaryObjectives.length
        ? `Focus areas: ${primaryObjectives.join('; ')}`
        : 'Focus on the critical behaviors and metrics identified in the review.';

      setReasonForPIP(
        developmentPlan?.notes
          ? developmentPlan.notes
          : `Recent performance feedback indicates the need to address specific performance gaps. ${objectiveSentence}`,
      );

      setConsequences(DEFAULT_CONSEQUENCE_TEXT);

      setSupportProvided(
        developmentPlan?.success_metrics?.length
          ? `Support plan: ${developmentPlan.success_metrics.join('; ')}`
          : 'We will provide weekly coaching check-ins, clarity on expectations, and access to training resources to support success.',
      );

      setCreationStep('form');
    } catch (error) {
      console.error('Error analyzing review for PIP creation:', error);
      setAnalysisError('Unable to analyze that review. Try again or use the manual workflow.');
    } finally {
      setIsAnalyzingReview(false);
    }
  };

  const handleGenerateFromInternalReview = async () => {
    if (!selectedReviewId) {
      setAnalysisError('Select a review first.');
      return;
    }
    const target = performanceReviews.find((r) => r.id === selectedReviewId);
    if (!target) {
      setAnalysisError('Unable to find the selected review.');
      return;
    }
    const narrative = composeReviewNarrative(target);
    await analyzeReviewForPip(narrative);
  };

  const handleGenerateFromExternalReview = async () => {
    await analyzeReviewForPip(reviewText);
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
    <div className="p-8 space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">How do you want to kick off this PIP?</h3>
      <p className="text-gray-600">
        Start from a recent performance review to auto-draft expectations or craft a plan manually. Either way, you can customize everything before sending.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleStartManualPip}
          className="group border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-red-400 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-red-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Build Manually</h4>
          <p className="text-sm text-gray-600">
            Document expectations, consequences, and support from scratch. Perfect when you already know the remediation plan.
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
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Ingest a Review</h4>
          <p className="text-sm text-gray-600">
            Let Claude transform a performance review into draft expectations, support plans, and milestones for this PIP.
          </p>
        </button>
      </div>
    </div>
  );

  const renderReviewSourceStep = () => {
    const hasInternalReviews = performanceReviews.length > 0;
    return (
      <div className="p-8 space-y-6">
        <button
          onClick={() => setCreationStep('choose')}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h3 className="text-2xl font-bold text-gray-900">Which review should we analyze?</h3>
        <p className="text-gray-600">
          Pull a review already captured in Ninebox or paste the text from your HR system.
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
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Internal Review</h4>
            <p className="text-sm text-gray-600">
              {hasInternalReviews ? 'Select a manager or self-review for this employee.' : 'Capture a review first or paste one instead.'}
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
              Copy/paste a review from your HRIS or docs and we’ll draft the PIP foundation for you.
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
          Choose the review to analyze. We combine qualitative answers and ITP scores to craft the PIP outline.
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
              <p className="text-sm text-gray-700 line-clamp-3">{review.accomplishments_okrs}</p>
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
          onClick={handleGenerateFromInternalReview}
          disabled={isAnalyzingReview || !selectedReviewId}
          className="px-5 py-2 bg-gradient-to-r from-purple-500 to-red-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate PIP draft
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
          Include as much context as possible—wins, misses, coaching notes. Claude will convert it into PIP expectations and support plans.
        </p>
      </div>

      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        rows={12}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        placeholder="Paste the full performance review here..."
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
          onClick={handleGenerateFromExternalReview}
          disabled={isAnalyzingReview || !reviewText.trim()}
          className="px-5 py-2 bg-gradient-to-r from-purple-500 to-red-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate PIP draft
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getNextMilestone = (pip: PerformanceImprovementPlan) => {
    const now = new Date();
    const day30 = new Date(pip.day_30_review_date);
    const day60 = new Date(pip.day_60_review_date);
    const day90 = new Date(pip.day_90_review_date);

    if (now < day30) return { name: '30-Day Review', date: pip.day_30_review_date };
    if (now < day60) return { name: '60-Day Review', date: pip.day_60_review_date };
    if (now < day90) return { name: '90-Day Review', date: pip.day_90_review_date };
    return { name: 'Plan Complete', date: pip.end_date };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatFullDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleCreatePIP = () => {
    const startDate = new Date();
    const day30 = new Date(startDate);
    day30.setDate(day30.getDate() + 30);
    const day60 = new Date(startDate);
    day60.setDate(day60.getDate() + 60);
    const day90 = new Date(startDate);
    day90.setDate(day90.getDate() + 90);

    const newPIP: PerformanceImprovementPlan = {
      id: `pip-${Date.now()}`,
      employee_id: employee.id,
      organization_id: organizationId,
      manager_id: currentUserId,
      manager_name: currentUserName,
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: day90.toISOString(),
      day_30_review_date: day30.toISOString(),
      day_60_review_date: day60.toISOString(),
      day_90_review_date: day90.toISOString(),
      reason_for_pip: reasonForPIP,
      consequences,
      support_provided: supportProvided || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setPips([newPIP, ...pips]);
    setSelectedPIP(newPIP);

    const generatedExpectations = buildExpectationsFromActionItems(derivedActionItems, newPIP.id);
    setExpectations(generatedExpectations);
    setCheckIns([]);
    setResources([]);
    setMilestoneReviews([]);
    setDerivedActionItems([]);
    setView('dashboard');
  };

  const handleOpenPIP = (pip: PerformanceImprovementPlan) => {
    setSelectedPIP(pip);
    // In production, fetch PIP details here
    setView('dashboard');
  };

  const getStatusColor = (status: PIPStatus) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'terminated': return 'bg-red-100 text-red-800';
      case 'extended': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getExpectationStatusColor = (status: PIPExpectationStatus) => {
    switch (status) {
      case 'met': return 'bg-green-100 text-green-800';
      case 'partially_met': return 'bg-yellow-100 text-yellow-800';
      case 'not_met': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCheckInStatusColor = (status?: PIPCheckInStatus) => {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      case 'off_track': return 'bg-red-100 text-red-800';
      case 'needs_attention': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = () => {
    if (expectations.length === 0) return 0;
    const metCount = expectations.filter(e => e.status === 'met').length;
    const partialCount = expectations.filter(e => e.status === 'partially_met').length;
    return Math.round(((metCount + partialCount * 0.5) / expectations.length) * 100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Performance Improvement Plan</h2>
              <p className="text-red-100 text-sm">
                <EmployeeNameLink
                  employee={employee}
                  className="font-semibold text-white hover:text-red-100 focus-visible:ring-white"
                  onClick={(event) => event.stopPropagation()}
                />
                {' '}
                • {employee.title || 'No Title'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* View Navigation */}
        {view !== 'list' && (
          <div className="px-6 pt-4 border-b">
            <button
              onClick={() => setView('list')}
              className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
            >
              ← Back to PIPs
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* List View */}
          {view === 'list' && (
            <div className="p-6">
              <button
                onClick={() => setView('create')}
                className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Performance Improvement Plan
              </button>

              {pips.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No Active PIPs
                  </h3>
                  <p className="text-gray-500 mb-6">
                    <EmployeeNameLink
                      employee={employee}
                      className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
                      onClick={(event) => event.stopPropagation()}
                    />{' '}
                    does not currently have any Performance Improvement Plans
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pips.map((pip) => {
                    const daysRemaining = calculateDaysRemaining(pip.end_date);
                    const nextMilestone = getNextMilestone(pip);

                    return (
                      <div
                        key={pip.id}
                        onClick={() => handleOpenPIP(pip)}
                        className="p-6 border-2 border-gray-200 rounded-xl hover:border-red-400 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(pip.status)}`}>
                                {pip.status.toUpperCase()}
                              </span>
                              {daysRemaining > 0 && pip.status === 'active' && (
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {daysRemaining} days remaining
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                              {formatDate(pip.start_date)} - {formatDate(pip.end_date)}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              <strong>Reason:</strong> {pip.reason_for_pip}
                            </p>
                            {pip.status === 'active' && (
                              <div className="flex items-center gap-2 text-sm">
                                <Target className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">Next: {nextMilestone.name}</span>
                                <span className="text-gray-500">on {formatDate(nextMilestone.date)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {pip.outcome && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Outcome:</p>
                            <p className="text-sm text-gray-700">{pip.outcome}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create View */}
          {view === 'create' && (
            creationStep === 'form' ? (
              <div className="p-6 max-w-3xl mx-auto">
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-red-900 mb-1">Important Notice</h3>
                      <p className="text-sm text-red-800">
                        A Performance Improvement Plan is a formal process to address performance deficiencies.
                        Ensure all expectations are clearly documented and compliance with company policies is maintained.
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-6">Create New PIP for {employee.name}</h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for PIP <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={reasonForPIP}
                      onChange={(e) => setReasonForPIP(e.target.value)}
                      placeholder="Clearly describe the performance issues that necessitate this PIP..."
                      rows={4}
                      maxLength={5000}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">{reasonForPIP.length}/5000</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consequences if Standards Not Met <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={consequences}
                      onChange={(e) => setConsequences(e.target.value)}
                      placeholder="Describe what will happen if performance standards are not met (e.g., 'Failure to meet expectations may result in further disciplinary action up to and including termination')..."
                      rows={4}
                      maxLength={5000}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">{consequences.length}/5000</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Support and Resources Provided (Optional)
                    </label>
                    <textarea
                      value={supportProvided}
                      onChange={(e) => setSupportProvided(e.target.value)}
                      placeholder="Describe what support, training, resources, or accommodations will be provided to help the employee succeed..."
                      rows={4}
                      maxLength={5000}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">{supportProvided.length}/5000</p>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-900 mb-2">📅 Timeline</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      This PIP will automatically create a 90-day plan with the following review milestones:
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1 ml-4">
                      <li>• <strong>30-Day Review:</strong> Initial progress check</li>
                      <li>• <strong>60-Day Review:</strong> Mid-point formal assessment</li>
                      <li>• <strong>90-Day Review:</strong> Final evaluation and decision</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setView('list')}
                      className="flex-1 py-3 px-6 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePIP}
                      disabled={!reasonForPIP.trim() || !consequences.trim()}
                      className="flex-1 py-3 px-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create PIP
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              renderCreationStep()
            )
          )}

          {/* Dashboard View */}
          {view === 'dashboard' && selectedPIP && (
            <div className="p-6">
              {/* PIP Overview Card */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(selectedPIP.status)}`}>
                        {selectedPIP.status.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-700">
                        Started {formatDate(selectedPIP.start_date)}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      90-Day Performance Improvement Plan
                    </h3>
                    <p className="text-gray-700 mb-4">
                      <strong>Manager:</strong> {selectedPIP.manager_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {calculateDaysRemaining(selectedPIP.end_date)}
                    </div>
                    <div className="text-sm text-gray-600">Days Remaining</div>
                  </div>
                </div>

                {/* Timeline Progress */}
                <div className="relative pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">START</span>
                    <span className="text-xs font-semibold text-gray-600">30 DAYS</span>
                    <span className="text-xs font-semibold text-gray-600">60 DAYS</span>
                    <span className="text-xs font-semibold text-gray-600">90 DAYS</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, 100 - (calculateDaysRemaining(selectedPIP.end_date) / 90 * 100)))}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <span className="text-2xl font-bold text-gray-900">{expectations.length}</span>
                  </div>
                  <p className="text-sm text-gray-600">Expectations</p>
                </div>
                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-gray-900">{checkIns.length}</span>
                  </div>
                  <p className="text-sm text-gray-600">Check-ins</p>
                </div>
                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <span className="text-2xl font-bold text-gray-900">{resources.length}</span>
                  </div>
                  <p className="text-sm text-gray-600">Resources</p>
                </div>
                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <span className="text-2xl font-bold text-gray-900">{calculateProgress()}%</span>
                  </div>
                  <p className="text-sm text-gray-600">Progress</p>
                </div>
              </div>

              {/* Main Content Grid with Coaching Sidebar */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                {/* Main Content: Expectations, Check-ins, Resources */}
                <div className="space-y-6">
                  {/* Inner Grid for Expectations & Check-ins */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Expectations & Check-ins */}
                    <div className="space-y-6">
                  {/* Expectations by Phase */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      Performance Expectations
                    </h4>

                    {expectations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 mb-4">No expectations defined yet</p>
                        <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                          + Add Expectations
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {['30_day', '60_day', '90_day'].map((phase) => {
                          const phaseExpectations = expectations.filter(e => e.phase === phase);
                          if (phaseExpectations.length === 0) return null;

                          return (
                            <div key={phase} className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-gray-900 mb-3">
                                {phase.replace('_', '-').toUpperCase()} Expectations
                              </h5>
                              <div className="space-y-2">
                                {phaseExpectations.map(exp => (
                                  <div key={exp.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded">
                                    {exp.status === 'met' ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">{exp.expectation}</p>
                                      <p className="text-xs text-gray-600 mt-1">{exp.category}</p>
                                      <div className="mt-2">
                                        <span className={`text-xs px-2 py-1 rounded ${getExpectationStatusColor(exp.status)}`}>
                                          {exp.status.replace('_', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Recent Check-ins */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Recent Check-ins
                    </h4>

                    {checkIns.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 mb-4">No check-ins recorded yet</p>
                        <button className="text-sm text-green-600 hover:text-green-800 font-medium">
                          + Log Check-in
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {checkIns.slice(0, 5).map(checkIn => (
                          <div key={checkIn.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-900">
                                  {formatDate(checkIn.check_in_date)}
                                </span>
                              </div>
                              {checkIn.overall_status && (
                                <span className={`text-xs px-2 py-1 rounded ${getCheckInStatusColor(checkIn.overall_status)}`}>
                                  {checkIn.overall_status.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700">{checkIn.progress_summary}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Resources & Plan Details */}
                <div className="space-y-6">
                  {/* Assigned Resources */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                      Learning Resources
                    </h4>

                    {resources.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 mb-4">No resources assigned yet</p>
                        <button className="text-sm text-purple-600 hover:text-purple-800 font-medium">
                          + Add Resource
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {resources.map(resource => (
                          <div key={resource.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="text-sm font-semibold text-gray-900">{resource.title}</h5>
                              <span className="text-xs px-2 py-1 bg-white rounded border border-purple-300 text-purple-800">
                                {resource.resource_type}
                              </span>
                            </div>
                            {resource.description && (
                              <p className="text-xs text-gray-700 mb-2">{resource.description}</p>
                            )}
                            {resource.url && (
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-800 underline"
                              >
                                View Resource →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Plan Details */}
                  <div className="border-2 border-red-200 rounded-xl p-5 bg-red-50/50">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      Plan Details
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">REASON FOR PIP</p>
                        <p className="text-sm text-gray-900">{selectedPIP.reason_for_pip}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">CONSEQUENCES</p>
                        <p className="text-sm text-gray-900">{selectedPIP.consequences}</p>
                      </div>

                      {selectedPIP.support_provided && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">SUPPORT PROVIDED</p>
                          <p className="text-sm text-gray-900">{selectedPIP.support_provided}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">MILESTONE DATES</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">30-Day Review:</span>
                            <span className="font-medium">{formatDate(selectedPIP.day_30_review_date)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">60-Day Review:</span>
                            <span className="font-medium">{formatDate(selectedPIP.day_60_review_date)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">90-Day Review:</span>
                            <span className="font-medium">{formatDate(selectedPIP.day_90_review_date)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  </div>
                </div>

                {/* Coaching Sidebar */}
                <div className="space-y-4">
                  <PIPConversationCoach
                    pip={selectedPIP}
                    checkIns={checkIns}
                  />

                  <PIPProgressIntelligence
                    pip={selectedPIP}
                    expectations={expectations}
                    checkIns={checkIns}
                    milestoneReviews={milestoneReviews}
                    employeeName={employee.name}
                  />

                  <PIPDocumentationAssistant
                    pip={selectedPIP}
                    expectations={expectations}
                    checkIns={checkIns}
                    milestoneReviews={milestoneReviews}
                    employeeName={employee.name}
                  />

                  <PIPAuditTrail
                    pip={selectedPIP}
                    expectations={expectations}
                    checkIns={checkIns}
                    milestoneReviews={milestoneReviews}
                    employeeName={employee.name}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
