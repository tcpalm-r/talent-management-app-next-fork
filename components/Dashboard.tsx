import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from './unified';
import type { User, Organization, Employee, Department } from '../types';
import Feedback360Dashboard from './Feedback360Dashboard';
import AdminSettings from './AdminSettings';
import TopNavBar from './TopNavBar';

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

type View = '360-feedback' | 'admin-settings';

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

  const shellClass = 'mx-auto w-full px-4 max-w-6xl';

  const [currentView, setCurrentView] = useState<View>('360-feedback');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeePlans, setEmployeePlans] = useState<Record<string, any>>({});
  const [performanceReviews, setPerformanceReviews] = useState<Record<string, any>>({});
  const [finalizedSurveys, setFinalizedSurveys] = useState<Record<string, number>>({});

  const isAdmin = userProfile.app_role?.toLowerCase() === 'admin';

  // Find current user's employee record for 360 dashboard filtering
  const currentUserEmployee = useMemo(() => {
    const matched = employees.find(e => e.email?.toLowerCase() === userProfile.email?.toLowerCase());

    if (matched) {
      return {
        ...matched,
        id: userProfile.id,
        app_role: userProfile.app_role,
      };
    }

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
    if (currentView === 'admin-settings' && !isAdmin) {
      setCurrentView('360-feedback');
    }
  }, [userProfile.app_role, currentView, isAdmin]);

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
    <div className="min-h-screen">
      {/* Top Navigation Bar */}
      <TopNavBar
        userProfile={userProfile}
        userRole={userProfile.app_role}
        showAdminSettings={isAdmin}
        onAdminClick={() => changeView(currentView === 'admin-settings' ? '360-feedback' : 'admin-settings')}
        isAdminView={currentView === 'admin-settings'}
      />

      {/* Main Content Area */}
      <main>
          {loading && (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A3E1] mx-auto"></div>
                <p className="mt-3 text-sm text-[#6B7780]">Loading...</p>
              </div>
            </div>
          )}

          {!loading && (
            <div className={`${shellClass} py-8`}>
              {currentView === '360-feedback' && (
                <Feedback360Dashboard
                  employees={employees}
                  departments={departments}
                  organizationId={organization.id}
                  currentUserName={userProfile.full_name || userProfile.email || 'User'}
                  currentUser={currentUserEmployee}
                />
              )}

              {currentView === 'admin-settings' && (
                <AdminSettings />
              )}
            </div>
          )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E3E8EB] mt-auto">
        <div className={`${shellClass} py-4`}>
          <p className="text-center text-xs text-[#6B7780]">Powered by Sonance</p>
        </div>
      </footer>
    </div>
  );
}
