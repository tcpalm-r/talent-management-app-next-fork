import { useState } from 'react';
import { Users, Award, AlertTriangle } from 'lucide-react';
import type { Employee, Department } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import EmployeeList from './EmployeeList';
import IdealTeamPlayerDashboard from './IdealTeamPlayerDashboard';
import FlightRiskDashboard from './FlightRiskDashboard';
import { NavigationTabs } from './unified';

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
}

type PeopleView = 'all' | 'team-player' | 'flight-risk';

export default function PeopleDashboard({
  employees,
  departments,
  onEmployeeUpdate,
  userRole,
  employeePlans,
  onPlansUpdate,
  currentUserName,
  performanceReviews,
  onReviewSave,
  organizationId,
  activeDepartmentIds = [],
}: PeopleDashboardProps) {
  const [activeView, setActiveView] = useState<PeopleView>('all');

  const scopedEmployees = activeDepartmentIds.length > 0
    ? employees.filter(emp => emp.department_id && activeDepartmentIds.includes(emp.department_id))
    : employees;

  const tabs = [
    { id: 'all', label: 'All Employees', icon: Users },
    { id: 'team-player', label: 'Ideal Team Player', icon: Award },
    { id: 'flight-risk', label: 'Flight Risk', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <NavigationTabs
          tabs={tabs}
          activeTab={activeView}
          onTabChange={(tabId) => setActiveView(tabId as PeopleView)}
        />

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeDepartmentIds.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center justify-between">
              <span>
                Showing employees from {activeDepartmentIds.length === 1 ? 'selected department' : 'selected departments'}.
              </span>
              <span className="font-semibold">{scopedEmployees.length} people</span>
            </div>
          )}

          {activeView === 'all' && (
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
            />
          )}

          {activeView === 'team-player' && (
            <IdealTeamPlayerDashboard
              employees={scopedEmployees}
              departments={departments}
              employeePlans={employeePlans}
              onPlansUpdate={onPlansUpdate}
              onEmployeeUpdate={onEmployeeUpdate}
              currentUserName={currentUserName}
              performanceReviews={performanceReviews}
              onReviewSave={onReviewSave}
            />
          )}

          {activeView === 'flight-risk' && (
            <FlightRiskDashboard
              employees={scopedEmployees}
              departments={departments}
              employeePlans={employeePlans}
              onPlansUpdate={onPlansUpdate}
              onEmployeeUpdate={onEmployeeUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
