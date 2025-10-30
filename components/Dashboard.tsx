import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from './unified';
import { supabase } from '../lib/supabase';
import type { User, Organization, Employee, Department } from '../types';
import PeopleDashboard from './PeopleDashboard';
import Feedback360Dashboard from './Feedback360Dashboard';
import AdminSettings from './AdminSettings';

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

type View = '360-feedback' | 'directory' | 'admin-settings';

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

  const shellClass = 'mx-auto w-full px-6 lg:px-8 xl:px-12 max-w-screen-2xl 2xl:px-16 2xl:max-w-[1700px]';

  const [currentView, setCurrentView] = useState<View>('360-feedback');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeePlans, setEmployeePlans] = useState<Record<string, any>>({});
  const [performanceReviews, setPerformanceReviews] = useState<Record<string, any>>({});

  // DEV: Employee override for testing 360 dashboard with different users
  const [employeeOverride, setEmployeeOverride] = useState<string | null>('admin.test@example.com');
  const [isDevelopment, setIsDevelopment] = useState(false);

  useEffect(() => {
    // Enable development features (test role switcher) for localhost and demo deployments
    const isDev = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname.includes('vercel.app')
    );
    setIsDevelopment(isDev);
  }, []);

  // Find current user's employee record for 360 dashboard filtering
  const currentUserEmployee = useMemo(() => {
    const userEmail = employeeOverride || userProfile.email;
    return employees.find(e => e.email === userEmail);
  }, [employees, userProfile.email, employeeOverride]);

  // Redirect from admin settings if user is no longer admin
  useEffect(() => {
    if (currentView === 'admin-settings' && currentUserEmployee?.role !== 'admin') {
      setCurrentView('360-feedback');
    }
  }, [currentUserEmployee?.role, currentView]);

  const changeView = useCallback((view: View) => {
    setCurrentView(view);
    onViewChange?.(view);
  }, [onViewChange]);

  const handleViewNavigation = useCallback((view: string) => {
    switch (view) {
      case '360':
      case 'feedback360':
        changeView('360-feedback');
        break;
      case 'people':
      case 'directory':
        changeView('directory');
        break;
      default:
        break;
    }
  }, [changeView]);

  useEffect(() => {
    if (!onRegisterNavigate) return;
    onRegisterNavigate(handleViewNavigation);
    return () => onRegisterNavigate(null);
  }, [onRegisterNavigate, handleViewNavigation]);

  const loadEmployees = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    // Using 'any' type for Supabase queries since employees/departments are views not in generated types
    const [employeesResult, departmentsResult, assessmentsResult] = await Promise.all([
      supabase
        .from('employees' as any)
        .select('*')
        .eq('organization_id', organization.id),
      supabase
        .from('departments' as any)
        .select('*')
        .eq('organization_id', organization.id),
      supabase
        .from('assessments')
        .select('*')
        .eq('organization_id', organization.id)
    ]);

    if (employeesResult.error) {
      console.error('Error loading employees:', employeesResult.error);
      notify({
        title: 'Unable to load team members',
        description: 'Check your connection or Supabase credentials and try again.',
        variant: 'error'
      });
      return;
    }

    const employeesWithRelations = (employeesResult.data || []).map((employee: any) => ({
      ...employee,
      department: departmentsResult.data?.find((d: any) => d.id === employee.department_id) || null,
      assessment: assessmentsResult.data?.find((a: any) => a.employee_id === employee.id) || null
    })) as unknown as Employee[];

    setEmployees(employeesWithRelations);
    onEmployeesChange?.(employeesWithRelations);
  }, [organization?.id, notify, onEmployeesChange]);

  const loadDepartments = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from('departments' as any)
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

    const departments = (data || []) as unknown as Department[];
    setDepartments(departments);
    onDepartmentsChange?.(departments.map((d: Department) => d.id) || []);
  }, [organization?.id, notify, onDepartmentsChange]);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReviewSave = (review: any) => {
    setPerformanceReviews(prev => {
      const existing = prev[review.employee_id] || {};
      const updatedForEmployee = {
        ...existing,
        [review.review_type]: review,
      };
      const updated = {
        ...prev,
        [review.employee_id]: updatedForEmployee,
      };
      onReviewsChange?.(updated);
      return updated;
    });

    notify({
      title: 'Review saved',
      description: 'Performance review has been saved successfully.',
      variant: 'success',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="py-8">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-600">Loading...</p>
          </div>
        )}

        {!loading && (
          <div className={`${shellClass}`}>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Sonance Talent Management</h1>

                {isDevelopment && (
                  <div className={`flex items-center gap-2 ${currentView === '360-feedback' ? '' : 'invisible'}`}>
                    <span className="text-xs text-gray-500 font-medium">Test as:</span>
                    <div className="flex gap-1 bg-blue-50 border border-blue-200 p-1 rounded-lg">
                      <button
                        onClick={() => setEmployeeOverride('admin.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'admin.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="Admin [TEST] - can see ALL reviews"
                      >
                        Admin
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('leader1.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'leader1.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="Leader 1 [TEST] - can see own + direct reports (User 1, User 2)"
                      >
                        Leader 1
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('leader2.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'leader2.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="Leader 2 [TEST] - can see own + direct reports (User 3, User 4)"
                      >
                        Leader 2
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('user1.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'user1.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="User 1 [TEST] - can see own reviews only"
                      >
                        User 1
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('user2.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'user2.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="User 2 [TEST] - can see own reviews only"
                      >
                        User 2
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('user3.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'user3.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="User 3 [TEST] - can see own reviews only"
                      >
                        User 3
                      </button>
                      <button
                        onClick={() => setEmployeeOverride('user4.test@example.com')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === 'user4.test@example.com'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="User 4 [TEST] - can see own reviews only"
                      >
                        User 4
                      </button>
                      <button
                        onClick={() => setEmployeeOverride(null)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          employeeOverride === null
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-blue-100'
                        }`}
                        title="Use actual logged-in user"
                      >
                        Actual User
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-1 border-b border-gray-200">
                <button
                  onClick={() => changeView('directory')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    currentView === 'directory'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => changeView('360-feedback')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    currentView === '360-feedback'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  360° Reviews
                </button>
                {currentUserEmployee?.role === 'admin' && (
                  <button
                    onClick={() => changeView('admin-settings')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      currentView === 'admin-settings'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Admin Settings
                  </button>
                )}
              </div>
            </div>

            {currentView === '360-feedback' && (
              <Feedback360Dashboard
                employees={employees}
                departments={departments}
                organizationId={organization.id}
                currentUserName={userProfile.full_name || userProfile.email || 'User'}
                currentUser={currentUserEmployee}
              />
            )}

            {currentView === 'directory' && (
              <PeopleDashboard
                employees={employees}
                departments={departments}
                employeePlans={employeePlans}
                onEmployeeUpdate={loadEmployees}
                userRole={userProfile.role}
                onPlansUpdate={setEmployeePlans}
                currentUserName={userProfile.full_name || userProfile.email || 'User'}
                performanceReviews={performanceReviews}
                onReviewSave={handleReviewSave}
                organizationId={organization.id}
                activeDepartmentIds={selectedDepartments}
                simpleMode={true}
                currentUser={currentUserEmployee}
              />
            )}

            {currentView === 'admin-settings' && (
              <AdminSettings />
            )}

          </div>
        )}
      </main>
    </div>
  );
}
