import type { Employee, Department } from '../types';
import type { PerformanceReview } from '../lib/schema';
import EmployeeList from './EmployeeList';

interface PeopleDashboardProps {
  employees: Employee[];
  departments: Department[];
  onEmployeeUpdate: () => void;
  userRole: any;
  employeePlans: Record<string, any>;
  onPlansUpdate: (plans: Record<string, any>) => void;
  currentUserName: string;
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  onReviewSave: (review: PerformanceReview) => void;
  organizationId: string;
  activeDepartmentIds?: string[];
  simpleMode?: boolean;
  currentUser?: Employee;
  finalizedSurveys?: Record<string, number>;
}

export default function PeopleDashboard({
  employees,
  departments,
  onEmployeeUpdate,
  userRole,
  employeePlans,
  onPlansUpdate,
  performanceReviews,
  onReviewSave,
  organizationId,
  activeDepartmentIds = [],
  currentUser,
  finalizedSurveys = {},
}: PeopleDashboardProps) {
  const scopedEmployees = activeDepartmentIds.length > 0
    ? employees.filter(emp => emp.department_id && activeDepartmentIds.includes(emp.department_id))
    : employees;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <EmployeeList
          employees={scopedEmployees}
          departments={departments}
          onEmployeeUpdate={onEmployeeUpdate}
          userRole={userRole}
          employeePlans={employeePlans}
          onPlansUpdate={onPlansUpdate}
          organizationId={organizationId}
          performanceReviews={performanceReviews}
          onReviewSave={onReviewSave}
          currentUser={currentUser}
          finalizedSurveys={finalizedSurveys}
        />
      </div>
    </div>
  );
}
