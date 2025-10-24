import { useMemo, useState } from 'react';
import { AlertTriangle, Users, TrendingUp, Clock, ArrowRight, Shield, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from './unified';
import { useEmployeeFocus } from '../context/EmployeeFocusContext';
import type { Employee, EmployeePlan, Department } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import { useQuickAction } from '../context/QuickActionContext';

interface CriticalDecision {
  id: string;
  priority: 'urgent' | 'high' | 'attention';
  title: string;
  impact: string;
  affectedCount: number;
  affectedEmployees: Employee[];
  actions: Array<{
    label: string;
    actionType: string;
    payload: any;
  }>;
}

interface CriticalDecisionsPriorityProps {
  employees: Employee[];
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  employeePlans: Record<string, EmployeePlan>;
  departments: Department[];
  onCreateRetentionPlans?: (employeeIds: string[]) => void;
  onViewEmployees?: (employees: Employee[]) => void;
  onNavigate?: (view: string) => void;
}

export default function CriticalDecisionsPriority({
  employees,
  performanceReviews,
  employeePlans,
  departments,
  onCreateRetentionPlans,
  onViewEmployees,
  onNavigate,
}: CriticalDecisionsPriorityProps) {
  const { executeAction } = useQuickAction();
  const { notify } = useToast();
  const { pinEmployee } = useEmployeeFocus();
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);

  const handleDecisionAction = (action: any, decision: CriticalDecision) => {
    switch (action.actionType) {
      case 'bulk-create-plans':
        // Create retention plans for high performers at risk
        if (onCreateRetentionPlans) {
          onCreateRetentionPlans(action.payload.employeeIds);
        }
        notify({
          type: 'success',
          title: 'Retention Plans Created',
          message: `Creating development plans for ${decision.affectedCount} high performers...`,
        });
        break;

      case 'bulk-action':
        // Pin employees to context bar for easy access
        decision.affectedEmployees.slice(0, 5).forEach(emp => {
          pinEmployee(emp, 'critical-decision');
        });
        notify({
          type: 'info',
          title: 'Employees Pinned',
          message: `Pinned ${Math.min(5, decision.affectedCount)} employees to context bar for review.`,
        });
        if (onViewEmployees) {
          onViewEmployees(decision.affectedEmployees);
        }
        break;

      case 'navigate':
        if (onNavigate) {
          onNavigate(action.payload.view);
        }
        break;

      case 'bulk-remind':
        notify({
          type: 'success',
          title: 'Reminders Sent',
          message: `Sent reminders to managers for ${decision.affectedCount} pending reviews.`,
        });
        break;

      default:
        console.log('[Critical Decision] Action:', action.actionType, action.payload);
    }
  };

  const decisions = useMemo(() => {
    const criticalDecisions: CriticalDecision[] = [];

    // Decision 1: Critical roles without succession
    const criticalRoles = employees.filter(e => e.is_critical_role);
    const highPotentialSuccessors = employees.filter(e =>
      e.assessment?.performance === 'high' && e.assessment?.potential === 'high'
    );

    if (criticalRoles.length > 0 && highPotentialSuccessors.length < criticalRoles.length * 2) {
      criticalDecisions.push({
        id: 'succession-gap',
        priority: 'urgent',
        title: `${criticalRoles.length} critical roles need succession coverage`,
        impact: 'High business continuity risk if key people leave',
        affectedCount: criticalRoles.length,
        affectedEmployees: criticalRoles,
        actions: [
          {
            label: 'Review succession pipeline',
            actionType: 'navigate',
            payload: { view: 'admin' },
          },
          {
            label: 'Identify candidates',
            actionType: 'bulk-action',
            payload: { employeeIds: criticalRoles.map(e => e.id) },
          },
        ],
      });
    }

    // Decision 2: High performers without development plans (flight risk)
    const highPerformersNoPlan = employees.filter(e =>
      e.assessment?.performance === 'high' &&
      !employeePlans[e.id]
    );

    if (highPerformersNoPlan.length >= 3) {
      // Estimate replacement cost ($150K average per high performer)
      const estimatedCost = highPerformersNoPlan.length * 150000;

      criticalDecisions.push({
        id: 'flight-risk',
        priority: 'high',
        title: `${highPerformersNoPlan.length} high performers showing flight risk indicators`,
        impact: `$${(estimatedCost / 1000000).toFixed(1)}M potential replacement cost`,
        affectedCount: highPerformersNoPlan.length,
        affectedEmployees: highPerformersNoPlan,
        actions: [
          {
            label: 'Create retention plans',
            actionType: 'bulk-create-plans',
            payload: { employeeIds: highPerformersNoPlan.map(e => e.id), planType: 'retention' },
          },
          {
            label: 'View employees',
            actionType: 'bulk-action',
            payload: { employeeIds: highPerformersNoPlan.map(e => e.id) },
          },
        ],
      });
    }

    // Decision 3: Workflow bottleneck (many pending reviews)
    const pendingManagerReviews = employees.filter(e => {
      const record = performanceReviews[e.id];
      const hasSelf = record?.self && (record.self.status === 'submitted' || record.self.status === 'completed');
      const hasManager = record?.manager && record.manager.status === 'completed';
      return e.assessment && hasSelf && !hasManager;
    });

    if (pendingManagerReviews.length >= 15) {
      // Calculate average days stuck
      const avgDaysStuck = pendingManagerReviews.reduce((sum, emp) => {
        const selfDate = performanceReviews[emp.id]?.self?.submitted_at;
        if (!selfDate) return sum;
        const days = Math.floor((Date.now() - new Date(selfDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / pendingManagerReviews.length;

      criticalDecisions.push({
        id: 'review-bottleneck',
        priority: 'attention',
        title: `${pendingManagerReviews.length} employees stuck waiting for manager reviews`,
        impact: `Blocking workflow for ${Math.round(pendingManagerReviews.length / employees.length * 100)}% of team (avg ${Math.round(avgDaysStuck)} days)`,
        affectedCount: pendingManagerReviews.length,
        affectedEmployees: pendingManagerReviews,
        actions: [
          {
            label: 'Send manager reminders',
            actionType: 'bulk-remind',
            payload: { stage: 'manager-review', count: pendingManagerReviews.length },
          },
          {
            label: 'View pending',
            actionType: 'navigate',
            payload: { view: 'prepare' },
          },
        ],
      });
    }

    // Decision 4: Unassessed employees (can't start workflow)
    const unassessed = employees.filter(e => !e.assessment);
    if (unassessed.length >= 10) {
      criticalDecisions.push({
        id: 'unassessed',
        priority: 'high',
        title: `${unassessed.length} employees not yet assessed on 9-box grid`,
        impact: 'Cannot begin review cycle or development planning until assessed',
        affectedCount: unassessed.length,
        affectedEmployees: unassessed,
        actions: [
          {
            label: 'Go to 9-Box Grid',
            actionType: 'navigate',
            payload: { view: 'evaluate' },
          },
        ],
      });
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, attention: 2 };
    return criticalDecisions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [employees, performanceReviews, employeePlans]);

  if (decisions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-red-600" />
        Critical Decisions
      </h2>
      
      {decisions.map((decision) => (
        <DecisionCard
          key={decision.id}
          decision={decision}
          isExpanded={expandedDecision === decision.id}
          onToggleExpand={() => setExpandedDecision(expandedDecision === decision.id ? null : decision.id)}
          onActionClick={(action) => {
            handleDecisionAction(action, decision);
          }}
        />
      ))}
    </div>
  );
}

interface DecisionCardProps {
  decision: CriticalDecision;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onActionClick: (action: any) => void;
}

function DecisionCard({ decision, isExpanded, onToggleExpand, onActionClick }: DecisionCardProps) {
  const priorityConfig = {
    urgent: {
      emoji: '🔴',
      label: 'URGENT',
      bg: 'bg-red-50',
      border: 'border-red-200',
      textColor: 'text-red-900',
      badgeBg: 'bg-red-600',
    },
    high: {
      emoji: '🟠',
      label: 'HIGH PRIORITY',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      textColor: 'text-orange-900',
      badgeBg: 'bg-orange-600',
    },
    attention: {
      emoji: '🟡',
      label: 'ATTENTION NEEDED',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      textColor: 'text-amber-900',
      badgeBg: 'bg-amber-600',
    },
  };

  const config = priorityConfig[decision.priority];

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-xl p-6 shadow-md`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{config.emoji}</span>
            <span className={`text-xs font-bold uppercase tracking-wide ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {decision.title}
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            <span className="font-semibold">Impact:</span> {decision.impact}
          </p>
        </div>
        
        <div className={`${config.badgeBg} text-white px-4 py-2 rounded-lg text-center flex-shrink-0 ml-4`}>
          <div className="text-2xl font-bold">{decision.affectedCount}</div>
          <div className="text-xs opacity-90">affected</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {decision.actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onActionClick(action)}
            className="px-5 py-2.5 bg-white hover:bg-blue-50 border-2 border-blue-400 rounded-lg text-sm font-bold text-blue-900 transition-all hover:shadow-lg flex items-center gap-2 group"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>

      {/* Expand/Collapse Affected Employees */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-2 bg-white/50 hover:bg-white rounded-lg transition-colors text-sm font-medium text-gray-700"
      >
        <span>View {decision.affectedCount} affected employee{decision.affectedCount !== 1 ? 's' : ''}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Expanded Employee List */}
      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {decision.affectedEmployees.slice(0, 10).map((emp) => (
            <div
              key={emp.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{emp.name}</div>
                <div className="text-xs text-gray-600 truncate">{emp.title || 'No title'}</div>
              </div>
            </div>
          ))}
          {decision.affectedEmployees.length > 10 && (
            <div className="col-span-2 text-center text-sm text-gray-600 py-2">
              +{decision.affectedEmployees.length - 10} more employees
            </div>
          )}
        </div>
      )}
    </div>
  );
}

