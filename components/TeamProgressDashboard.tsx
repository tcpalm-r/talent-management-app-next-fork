import { useState, useEffect, useMemo } from 'react';
import { Users, Filter, CheckCircle, Clock, AlertCircle, FileText, ClipboardList, MessageSquare, Briefcase, Plus } from 'lucide-react';
import type { Employee, Department, EmployeePlan } from '../types';
import { EmployeeCardUnified } from './unified';
import { supabase } from '../lib/supabase';
import type { PerformanceReview } from './PerformanceReviewModal';
import SuggestedNextSteps from './SuggestedNextSteps';
import BatchReviewFlow from './BatchReviewFlow';

interface TeamProgressDashboardProps {
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  employeePlans: Record<string, EmployeePlan>;
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  onOpenReviewModal: (employee: Employee) => void;
  onOpenPlanModal: (employee: Employee) => void;
  onOpen360Modal: (employee: Employee) => void;
  onOpenDetailModal: (employee: Employee) => void;
}

type FilterType = 'all' | 'needs-attention' | 'complete';

interface EmployeeProgress {
  employee: Employee;
  has360: boolean;
  has360InProgress: boolean;
  hasReview: boolean;
  hasPlan: boolean;
  hasJobDescription: boolean;
  completionPercentage: number;
}

export default function TeamProgressDashboard({
  employees,
  departments,
  organizationId,
  employeePlans,
  performanceReviews,
  onOpenReviewModal,
  onOpenPlanModal,
  onOpen360Modal,
  onOpenDetailModal,
}: TeamProgressDashboardProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [surveys360, setSurveys360] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchFlowEmployees, setBatchFlowEmployees] = useState<Employee[]>([]);
  const [batchFlowTitle, setBatchFlowTitle] = useState('');
  const [batchFlowDescription, setBatchFlowDescription] = useState('');
  const [isBatchFlowOpen, setIsBatchFlowOpen] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, [organizationId]);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback_360_surveys')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;
      setSurveys360(data || []);
    } catch (error) {
      console.error('Error loading 360 surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress for each employee
  const employeeProgress: EmployeeProgress[] = useMemo(() => {
    return employees.map(employee => {
      const survey360 = surveys360.find(s => s.employee_id === employee.id);
      const has360 = survey360?.status === 'completed';
      const has360InProgress = survey360 && survey360.status !== 'completed';
      const hasReview = !!performanceReviews[employee.id]?.manager;
      const hasPlan = !!employeePlans[employee.id];
      const hasJobDescription = !!employee.job_description;

      const completedItems = [has360, hasReview, hasPlan, hasJobDescription].filter(Boolean).length;
      const completionPercentage = Math.round((completedItems / 4) * 100);

      return {
        employee,
        has360,
        has360InProgress,
        hasReview,
        hasPlan,
        hasJobDescription,
        completionPercentage,
      };
    });
  }, [employees, surveys360, performanceReviews, employeePlans]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    switch (filter) {
      case 'needs-attention':
        return employeeProgress.filter(ep => ep.completionPercentage < 100);
      case 'complete':
        return employeeProgress.filter(ep => ep.completionPercentage === 100);
      default:
        return employeeProgress;
    }
  }, [employeeProgress, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = employeeProgress.length;
    const with360 = employeeProgress.filter(ep => ep.has360).length;
    const withReviews = employeeProgress.filter(ep => ep.hasReview).length;
    const withPlans = employeeProgress.filter(ep => ep.hasPlan).length;
    const complete = employeeProgress.filter(ep => ep.completionPercentage === 100).length;

    return { total, with360, withReviews, withPlans, complete };
  }, [employeeProgress]);

  const getDepartmentForEmployee = (employee: Employee) => {
    return departments.find(d => d.id === employee.department_id);
  };

  const getProgressBadge = (progress: EmployeeProgress) => {
    const { completionPercentage, has360InProgress } = progress;

    if (completionPercentage === 100) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Complete
        </div>
      );
    }

    if (has360InProgress) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          In Progress
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
        <AlertCircle className="w-3 h-3" />
        {completionPercentage}% Complete
      </div>
    );
  };

  const getQuickActions = (progress: EmployeeProgress) => {
    const actions = [];

    if (!progress.has360 && !progress.has360InProgress) {
      actions.push({
        label: 'Start 360',
        icon: MessageSquare,
        onClick: () => onOpen360Modal(progress.employee),
        color: 'blue',
      });
    }

    if (!progress.hasReview) {
      actions.push({
        label: 'Add Review',
        icon: FileText,
        onClick: () => onOpenReviewModal(progress.employee),
        color: 'purple',
      });
    }

    if (!progress.hasPlan) {
      actions.push({
        label: 'Create Plan',
        icon: ClipboardList,
        onClick: () => onOpenPlanModal(progress.employee),
        color: 'green',
      });
    }

    if (!progress.hasJobDescription) {
      actions.push({
        label: 'Add Job Description',
        icon: Briefcase,
        onClick: () => onOpenDetailModal(progress.employee),
        color: 'gray',
      });
    }

    return actions;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              My Team
            </h1>
            <p className="text-gray-600 mt-1">Track progress on building complete employee profiles</p>
          </div>
        </div>

        {/* Suggested Next Steps - only show if incomplete items exist */}
        {stats.complete < stats.total && (
          <SuggestedNextSteps
            employeeProgress={employeeProgress}
            surveys360={surveys360}
            onOpenReviewModal={onOpenReviewModal}
            onOpenPlanModal={onOpenPlanModal}
            onOpen360Modal={onOpen360Modal}
            onOpenDetailModal={onOpenDetailModal}
            organizationId={organizationId}
            onOpenBatchReviewFlow={(employees, title, description) => {
              setBatchFlowEmployees(employees);
              setBatchFlowTitle(title);
              setBatchFlowDescription(description);
              setIsBatchFlowOpen(true);
            }}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Team Members</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.with360}</div>
            <div className="text-sm text-gray-600">With 360 Feedback</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.withReviews}</div>
            <div className="text-sm text-gray-600">With Reviews</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{stats.withPlans}</div>
            <div className="text-sm text-gray-600">With Plans</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.complete}</div>
            <div className="text-sm text-gray-600">Complete Profiles</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({employeeProgress.length})
          </button>
          <button
            onClick={() => setFilter('needs-attention')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'needs-attention'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Needs Attention ({employeeProgress.filter(ep => ep.completionPercentage < 100).length})
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'complete'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Complete ({employeeProgress.filter(ep => ep.completionPercentage === 100).length})
          </button>
        </div>
      </div>

      {/* Employee Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team data...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No employees match this filter</p>
          <button
            onClick={() => setFilter('all')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View all employees
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map(progress => {
            const department = getDepartmentForEmployee(progress.employee);
            const quickActions = getQuickActions(progress);

            return (
              <div
                key={progress.employee.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                {/* Progress Badge */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    {getProgressBadge(progress)}
                    <div className="text-xs text-gray-500">
                      {[progress.has360, progress.hasReview, progress.hasPlan, progress.hasJobDescription].filter(Boolean).length} of 4 items
                    </div>
                  </div>
                </div>

                {/* Employee Card */}
                <div className="p-4">
                  <EmployeeCardUnified
                    employee={progress.employee}
                    department={department}
                    variant="compact"
                    enableDrag={false}
                    showMenu={false}
                    onCardClick={() => onOpenDetailModal(progress.employee)}
                  />
                </div>

                {/* Quick Actions */}
                {quickActions.length > 0 && (
                  <div className="p-4 border-t border-gray-100 space-y-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">Quick Actions:</div>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={action.onClick}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            action.color === 'blue'
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : action.color === 'purple'
                              ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                              : action.color === 'green'
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <action.icon className="w-3.5 h-3.5" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completion Checklist */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {progress.has360 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={progress.has360 ? 'text-gray-900' : 'text-gray-500'}>
                      360 Feedback
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {progress.hasReview ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={progress.hasReview ? 'text-gray-900' : 'text-gray-500'}>
                      Performance Review
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {progress.hasPlan ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={progress.hasPlan ? 'text-gray-900' : 'text-gray-500'}>
                      Development Plan
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {progress.hasJobDescription ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={progress.hasJobDescription ? 'text-gray-900' : 'text-gray-500'}>
                      Job Description
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Review Flow Modal */}
      <BatchReviewFlow
        isOpen={isBatchFlowOpen}
        onClose={() => {
          setIsBatchFlowOpen(false);
          setBatchFlowEmployees([]);
        }}
        employees={batchFlowEmployees}
        departments={departments}
        onOpenReviewForEmployee={(employee) => {
          setIsBatchFlowOpen(false);
          onOpenReviewModal(employee);
        }}
        title={batchFlowTitle}
        description={batchFlowDescription}
      />
    </div>
  );
}

