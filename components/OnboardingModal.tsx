import { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, CheckCircle2, AlertCircle, Clock, Users, Target, Award, TrendingUp, FileText, PlayCircle } from 'lucide-react';
import type {
  OnboardingPlanWithDetails,
  OnboardingPhase,
  OnboardingTaskStatus
} from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  currentUserRole: 'manager' | 'new_hire' | 'hr' | 'admin';
  currentUserId?: string;
  currentUserName: string;
}

type ViewMode = 'dashboard' | 'my_onboarding' | 'plans_list' | 'create';

export default function OnboardingModal({
  isOpen,
  onClose,
  organizationId,
  currentUserRole,
  currentUserName
}: OnboardingModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(currentUserRole === 'new_hire' ? 'my_onboarding' : 'dashboard');
  const [onboardingPlans, setOnboardingPlans] = useState<OnboardingPlanWithDetails[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlanWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadOnboardingData();
    }
  }, [isOpen, organizationId]);

  const loadOnboardingData = async () => {
    setLoading(true);
    // Mock data for demonstration
    setTimeout(() => {
      const mockPlans: OnboardingPlanWithDetails[] = [
        {
          id: 'p1',
          organization_id: organizationId,
          employee_id: 'e12',
          employee_name: 'John Smith',
          employee_email: 'john.smith@company.com',
          title: 'Senior Software Engineer',
          department: 'Engineering',
          manager_name: currentUserName,
          buddy_name: 'Sarah Johnson',
          hr_contact: 'HR Team',
          start_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          day_30_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          day_60_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          day_90_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          current_day: 45,
          completion_percentage: 65,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tasks_completed: 13,
          tasks_total: 20,
          tasks_overdue: 3
        },
        {
          id: 'p2',
          organization_id: organizationId,
          employee_id: 'e13',
          employee_name: 'Sarah Johnson',
          employee_email: 'sarah.j@company.com',
          title: 'Marketing Manager',
          department: 'Marketing',
          manager_name: currentUserName,
          buddy_name: 'David Chen',
          hr_contact: 'HR Team',
          start_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          day_30_date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
          day_60_date: new Date(Date.now() + 48 * 24 * 60 * 60 * 1000).toISOString(),
          day_90_date: new Date(Date.now() + 78 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          current_day: 12,
          completion_percentage: 22,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tasks_completed: 4,
          tasks_total: 18,
          tasks_overdue: 0
        }
      ];

      setOnboardingPlans(mockPlans);
      if (currentUserRole === 'new_hire') {
        setSelectedPlan(mockPlans[0]);
      }
      setLoading(false);
    }, 800);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPhaseLabel = (phase: OnboardingPhase): string => {
    switch (phase) {
      case 'pre_boarding': return 'Pre-Boarding';
      case 'day_1': return 'Day 1';
      case 'week_1': return 'Week 1';
      case 'day_30': return '30 Days';
      case 'day_60': return '60 Days';
      case 'day_90': return '90 Days';
      default: return phase;
    }
  };

  const getStatusColor = (status: OnboardingTaskStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-300';
      case 'not_started': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'skipped': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const renderManagerDashboard = () => {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Your New Hires Onboarding Status</h3>
          <div className="space-y-4">
            {onboardingPlans.map((plan) => (
              <div key={plan.id} className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-gray-900">{plan.employee_name}</h4>
                      <span className="text-sm text-gray-600">Day {plan.current_day}</span>
                    </div>
                    <div className="text-sm text-gray-600">{plan.title}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {plan.completion_percentage}% Complete
                    </span>
                    {plan.tasks_overdue && plan.tasks_overdue > 0 ? (
                      <span className="text-sm font-semibold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {plan.tasks_overdue} tasks overdue
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        On track
                      </span>
                    )}
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        plan.completion_percentage >= 80 ? 'bg-green-500' :
                        plan.completion_percentage >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${plan.completion_percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Tasks:</strong> {plan.tasks_completed}/{plan.tasks_total}
                  </div>
                  <div>
                    <strong>Buddy:</strong> {plan.buddy_name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions Required */}
          <div className="mt-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
            <h4 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              ACTIONS REQUIRED
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span className="text-gray-800">Complete John's 30-day review</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span className="text-gray-800">Schedule Sarah's stakeholder meetings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderNewHireDashboard = () => {
    if (!selectedPlan) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                My Onboarding Journey
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="font-semibold">Day {selectedPlan.current_day}</span>
                <span>•</span>
                <span>{selectedPlan.title}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {selectedPlan.completion_percentage}%
              </div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${selectedPlan.completion_percentage}%` }}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Start</span>
            <span>30 Days</span>
            <span>60 Days</span>
            <span className="font-semibold">90 Days</span>
          </div>
        </div>

        {/* This Week's Priorities */}
        <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            THIS WEEK'S PRIORITIES
          </h4>
          <div className="space-y-3">
            {[
              { title: 'Complete benefits enrollment', done: true },
              { title: 'Meet with 5 key stakeholders', done: false },
              { title: 'Review product documentation', done: false },
              { title: 'Submit first project plan', done: false }
            ].map((task, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  task.done ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm ${task.done ? 'text-gray-500 line-through' : 'text-gray-900 font-medium'}`}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Milestone */}
        <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-blue-900">NEXT MILESTONE</div>
              <div className="text-lg font-bold text-gray-900">30-Day Review</div>
            </div>
          </div>
          <div className="text-sm text-gray-700">
            <strong>Date:</strong> {formatDate(selectedPlan.day_30_date)}
          </div>
          <div className="text-sm text-gray-700 mt-1">
            <strong>With:</strong> {selectedPlan.manager_name}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {selectedPlan.tasks_completed}
            </div>
            <div className="text-xs text-gray-600">Tasks Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {5}
            </div>
            <div className="text-xs text-gray-600">People Met</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {3}
            </div>
            <div className="text-xs text-gray-600">Trainings Done</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPlansList = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">All Onboarding Plans</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            New Onboarding Plan
          </button>
        </div>

        {onboardingPlans.map((plan) => (
          <div
            key={plan.id}
            className="p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
            onClick={() => setSelectedPlan(plan)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-bold text-gray-900">{plan.employee_name}</h4>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                    Day {plan.current_day}
                  </span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    plan.status === 'active' ? 'bg-green-100 text-green-800' :
                    plan.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {plan.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Title:</strong> {plan.title} • {plan.department}</div>
                  <div><strong>Manager:</strong> {plan.manager_name}</div>
                  <div><strong>Started:</strong> {formatDate(plan.start_date)}</div>
                </div>
              </div>

              <div className="text-right ml-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {plan.completion_percentage}%
                </div>
                <div className="text-xs text-gray-600">Progress</div>
              </div>
            </div>

            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${plan.completion_percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b bg-gradient-to-r from-purple-600 to-pink-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Onboarding Excellence</h2>
                <p className="text-sm text-purple-100">90-Day Systematic Onboarding</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {currentUserRole !== 'new_hire' && (
          <div className="flex-shrink-0 px-6 border-b bg-gray-50">
            <div className="flex space-x-1">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  viewMode === 'dashboard'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Dashboard</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode('plans_list')}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  viewMode === 'plans_list'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>All Plans</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading onboarding data...</div>
          ) : (
            <>
              {viewMode === 'dashboard' && currentUserRole !== 'new_hire' && renderManagerDashboard()}
              {viewMode === 'my_onboarding' && currentUserRole === 'new_hire' && renderNewHireDashboard()}
              {viewMode === 'plans_list' && renderPlansList()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
