import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Send, CheckCircle, Clock, XCircle, Users, Filter, X, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Employee, Department } from '../types';
import Survey360Wizard from './Survey360Wizard';

interface Feedback360DashboardProps {
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  currentUserName: string;
}

interface Survey {
  id: string;
  survey_name: string;
  status: string;
  due_date: string | null;
  created_at: string;
  employee_id: string;
  employee?: Employee;
  reviewers_count?: number;
  completed_count?: number;
}

export default function Feedback360Dashboard({
  employees,
  departments,
  organizationId,
  currentUserName
}: Feedback360DashboardProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'active' | 'closed'>('all');
  const [preselectedEmployee, setPreselectedEmployee] = useState<Employee | undefined>(undefined);

  useEffect(() => {
    loadSurveys();
  }, [organizationId]);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback_360_surveys')
        .select(`
          *,
          reviewers:feedback_360_survey_reviewers(id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance surveys with employee data and reviewer counts
      const enhancedSurveys = data?.map((survey: any) => {
        const employee = employees.find(e => e.id === survey.employee_id);
        const reviewers = survey.reviewers || [];
        return {
          ...survey,
          employee,
          reviewers_count: reviewers.length,
          completed_count: reviewers.filter((r: any) => r.status === 'completed').length
        };
      }) || [];

      setSurveys(enhancedSurveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSurveys = filterStatus === 'all'
    ? surveys
    : surveys.filter(s => s.status === filterStatus);

  const stats = {
    draft: surveys.filter(s => s.status === 'draft').length,
    active: surveys.filter(s => s.status === 'active').length,
    closed: surveys.filter(s => s.status === 'closed').length,
  };

  // Calculate risk flags (below 50% response rate with < 3 days to deadline)
  const atRiskSurveys = surveys.filter(s => {
    if (s.status !== 'active' || !s.due_date || !s.reviewers_count) return false;
    const responseRate = s.reviewers_count > 0 ? (s.completed_count || 0) / s.reviewers_count : 0;
    const daysUntilDue = Math.ceil((new Date(s.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      active: 'bg-blue-100 text-blue-700 border-blue-300',
      closed: 'bg-green-100 text-green-700 border-green-300'
    };
    const icons = {
      draft: Clock,
      active: Send,
      closed: CheckCircle
    };
    const Icon = icons[status as keyof typeof icons] || Clock;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-7 h-7 mr-2 text-blue-600" />
            360° Feedback
          </h2>
          <p className="text-gray-600 mt-1">Create and manage multi-source feedback surveys</p>
        </div>
        <button
          onClick={() => {
            setPreselectedEmployee(undefined);
            setIsWizardOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Create 360° Survey
        </button>
      </div>

      {/* Pipeline Stats with Risk Flags */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'all' ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Surveys</p>
              <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('draft')}
          className={`bg-white rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'draft' ? 'border-gray-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('active')}
          className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'active'
              ? 'border-blue-500 bg-blue-50'
              : 'bg-white border-blue-200 hover:bg-blue-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-blue-700">Active</p>
              <p className="text-2xl font-bold text-blue-900">{stats.active}</p>
            </div>
            <Send className="w-8 h-8 text-blue-400" />
          </div>
          {atRiskSurveys.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <AlertTriangle className="w-3 h-3" />
              <span>{atRiskSurveys.length} at risk</span>
            </div>
          )}
        </button>

        <button
          onClick={() => setFilterStatus('closed')}
          className={`rounded-lg shadow p-4 border-2 transition-all text-left ${
            filterStatus === 'closed'
              ? 'border-green-500 bg-green-50'
              : 'bg-white border-green-200 hover:bg-green-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Completed</p>
              <p className="text-2xl font-bold text-green-900">{stats.closed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          {['all', 'draft', 'active', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Surveys List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading surveys...</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12">
          <div className="text-center mb-8">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filterStatus === 'all' ? 'No surveys yet' : `No ${filterStatus} surveys`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filterStatus === 'all'
                ? 'Create your first 360° feedback survey to gather multi-source feedback'
                : `No surveys with ${filterStatus} status`
              }
            </p>
            {filterStatus === 'all' && (
              <button
                onClick={() => setIsWizardOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Create First Survey
              </button>
            )}
          </div>

          {/* Templates */}
          {filterStatus === 'all' && (
            <div className="border-t border-gray-200 pt-8">
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Common Templates
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="font-semibold text-blue-900 mb-1">New Hire 60-Day</div>
                  <div className="text-xs text-blue-700 mb-3">
                    Check onboarding experience and early integration
                  </div>
                  <div className="text-xs text-blue-600">6 questions • 4 raters</div>
                </div>
                <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                  <div className="font-semibold text-purple-900 mb-1">Role Change</div>
                  <div className="text-xs text-purple-700 mb-3">
                    Assess transition effectiveness and skill fit
                  </div>
                  <div className="text-xs text-purple-600">8 questions • 5 raters</div>
                </div>
                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="font-semibold text-green-900 mb-1">Performance Review Support</div>
                  <div className="text-xs text-green-700 mb-3">
                    Comprehensive feedback for annual reviews
                  </div>
                  <div className="text-xs text-green-600">10 questions • 7 raters</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{survey.survey_name}</h3>
                    {getStatusBadge(survey.status)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-3">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="font-medium">{survey.employee?.name || 'Unknown Employee'}</span>
                    {survey.employee?.title && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{survey.employee.title}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-500">Reviewers:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {survey.completed_count}/{survey.reviewers_count}
                      </span>
                      <span className="ml-1 text-gray-500">completed</span>
                    </div>
                    {survey.due_date && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-gray-400" />
                        <span className="text-gray-500">Due: {new Date(survey.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {survey.status === 'active' && survey.reviewers_count && survey.reviewers_count > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">
                          Response Rate: {Math.round((survey.completed_count! / survey.reviewers_count) * 100)}%
                        </span>
                        {(() => {
                          const responseRate = survey.reviewers_count > 0 ? (survey.completed_count || 0) / survey.reviewers_count : 0;
                          const daysUntilDue = survey.due_date ? Math.ceil((new Date(survey.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
                          const isAtRisk = responseRate < 0.5 && daysUntilDue <= 3 && daysUntilDue > 0;
                          
                          return isAtRisk && (
                            <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              At Risk
                            </span>
                          );
                        })()}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (survey.completed_count! / survey.reviewers_count) < 0.5 ? 'bg-orange-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${(survey.completed_count! / survey.reviewers_count) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View
                  </button>
                  {survey.status === 'draft' && (
                    <button
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Send className="w-4 h-4 inline mr-1" />
                      Send
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Survey Creation Wizard */}
      <Survey360Wizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setPreselectedEmployee(undefined);
        }}
        organizationId={organizationId}
        preselectedEmployee={preselectedEmployee}
        onSurveyCreated={() => {
          loadSurveys();
          setIsWizardOpen(false);
          setPreselectedEmployee(undefined);
        }}
        employees={employees}
      />
    </div>
  );
}
