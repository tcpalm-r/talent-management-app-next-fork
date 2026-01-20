import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from './unified';
import type { User, Organization, Employee, Department } from '../types';
import PeopleDashboard from './PeopleDashboard';
import Feedback360Dashboard from './Feedback360Dashboard';
import MyReportDashboard from './MyReportDashboard';
import ITPDashboard from './ITPDashboard';
import AdminSettings from './AdminSettings';
import Sidebar from './Sidebar';

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

type View = '360-feedback' | 'my-report' | 'itp' | 'directory' | 'admin-settings';

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

  const shellClass = 'mx-auto w-full px-4 lg:px-6 xl:px-8 max-w-screen-2xl 2xl:px-10 2xl:max-w-[1700px]';

  const [currentView, setCurrentView] = useState<View>('360-feedback');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeePlans, setEmployeePlans] = useState<Record<string, any>>({});
  const [performanceReviews, setPerformanceReviews] = useState<Record<string, any>>({});
  const [finalizedSurveys, setFinalizedSurveys] = useState<Record<string, number>>({});


  // Find current user's employee record for 360 dashboard filtering
  const currentUserEmployee = useMemo(() => {
    // Try to find the user in the employees list by email (case-insensitive)
    const matched = employees.find(e => e.email?.toLowerCase() === userProfile.email?.toLowerCase());

    // If found, return the employee record with authenticated user's role
    if (matched) {
      return {
        ...matched,
        id: userProfile.id, // Use authenticated user's ID (source of truth)
        app_role: userProfile.app_role, // Always use authenticated user's role from session
      };
    }

    // Fallback: Create an employee record from userProfile so drafts can be saved with sponsor info
    if (userProfile.id && userProfile.email) {
      return {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.full_name || 'User',
        organization_id: organization.id,
        employee_id: null,
        department_id: null,
        manager_name: null,
        title: null,
        location: null,
        app_role: userProfile.app_role as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return undefined;
  }, [employees, userProfile]);

  // Redirect from restricted views if user no longer has access
  useEffect(() => {
    const currentRole = userProfile.app_role?.toLowerCase();

    if (currentView === 'admin-settings' && currentRole !== 'admin') {
      setCurrentView('360-feedback');
    }
  }, [userProfile.app_role, currentView]);

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

    try {
      const response = await fetch(`/api/dashboard/data?organization_id=${organization.id}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error loading dashboard data:', errorData);
        notify({
          title: 'Unable to load team members',
          description: 'Check your connection and try again.',
          variant: 'error'
        });
        return;
      }

      const { employees: employeesWithRelations, departments: departmentsData } = await response.json();

      setEmployees(employeesWithRelations as unknown as Employee[]);
      setDepartments(departmentsData as unknown as Department[]);
      onEmployeesChange?.(employeesWithRelations);
      onDepartmentsChange?.(departmentsData.map((d: any) => d.id) || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      notify({
        title: 'Unable to load team members',
        description: 'Check your connection and try again.',
        variant: 'error'
      });
    }
  }, [organization?.id, notify, onEmployeesChange, onDepartmentsChange]);


  const loadFinalizedSurveys = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    try {
      const response = await fetch(`/api/dashboard/surveys?organization_id=${organization.id}&status=finalized`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error loading finalized surveys:', errorData);
        return;
      }

      const { surveyCountByEmployee } = await response.json();
      setFinalizedSurveys(surveyCountByEmployee || {});
    } catch (error) {
      console.error('Error loading finalized surveys:', error);
    }
  }, [organization?.id]);

  const loadData = useCallback(async (): Promise<void> => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      await Promise.all([loadEmployees(), loadFinalizedSurveys()]);
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
  }, [organization?.id, loadEmployees, loadFinalizedSurveys, notify]);

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
    <div className="h-screen flex bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={changeView}
        userRole={userProfile.app_role}
        userProfile={userProfile}
      />

      {/* Main Content Area - overflow-y-scroll ensures consistent width with/without scrollbar */}
      <main className="flex-1 overflow-y-scroll overflow-x-hidden">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </div>
          )}

          {!loading && (
            <div className={`${shellClass} py-6`}>
              {/* View Content */}
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
                  userRole={userProfile.app_role}
                  onPlansUpdate={setEmployeePlans}
                  currentUserName={userProfile.full_name || userProfile.email || 'User'}
                  performanceReviews={performanceReviews}
                  onReviewSave={handleReviewSave}
                  organizationId={organization.id}
                  activeDepartmentIds={selectedDepartments}
                  simpleMode={true}
                  currentUser={currentUserEmployee}
                  finalizedSurveys={finalizedSurveys}
                />
              )}

              {currentView === 'my-report' && (
                <MyReportDashboard
                  currentUser={currentUserEmployee}
                  organizationId={organization.id}
                />
              )}

              {currentView === 'itp' && (
                <ITPDashboard
                  currentUser={currentUserEmployee}
                  organizationId={organization.id}
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
