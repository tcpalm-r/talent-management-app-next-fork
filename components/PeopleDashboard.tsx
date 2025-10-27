import { useState } from 'react';
import { Users, Award, AlertTriangle, ClipboardList } from 'lucide-react';
import type { Employee, Department } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import EmployeeList from './EmployeeList';
import IdealTeamPlayerDashboard from './IdealTeamPlayerDashboard';
import FlightRiskDashboard from './FlightRiskDashboard';
import Feedback360Dashboard from './Feedback360Dashboard';
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

// BETA: Core assessment views - All Employees, Ideal Team Player, 360 Feedback, ITP Matrix, Performance Reviews
type PeopleView = 'all' | 'team-player' | 'feedback360' | 'itp-matrix' | 'performance-review'; // | 'flight-risk' - Disabled for beta

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

  // BETA: Core assessment tabs - showing all 5 main views
  const tabs = [
    { id: 'all', label: 'All Employees', icon: Users, tooltip: 'View all employee cards' },
    { id: 'team-player', label: 'Ideal Team Player', icon: Award, tooltip: 'View Ideal Team Player assessments' },
    { id: 'feedback360', label: '360 Feedback', icon: Users, tooltip: 'Anonymous 360-degree feedback from peers, managers, and reports' },
    { id: 'itp-matrix', label: 'ITP Matrix', icon: Award, tooltip: 'Ideal Team Player self-assessment matrix' },
    { id: 'performance-review', label: 'Performance Reviews', icon: ClipboardList, tooltip: 'Manager and self performance reviews' },
    // { id: 'flight-risk', label: 'Flight Risk', icon: AlertTriangle }, // Disabled for beta
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

          {activeView === 'feedback360' && (
            <Feedback360Dashboard
              employees={scopedEmployees}
              departments={departments}
              organizationId={organizationId}
            />
          )}

          {activeView === 'itp-matrix' && (
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

          {activeView === 'performance-review' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Performance Reviews</h2>
                <p className="text-sm text-gray-600">
                  Conduct performance reviews for your team members. Click on an employee card to open their review.
                </p>
              </div>
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
            </div>
          )}

          {/* BETA: Flight Risk view disabled for beta
          {activeView === 'flight-risk' && (
            <FlightRiskDashboard
              employees={scopedEmployees}
              departments={departments}
              employeePlans={employeePlans}
              onPlansUpdate={onPlansUpdate}
              onEmployeeUpdate={onEmployeeUpdate}
            />
          )}
          */}
        </div>
      </div>
    </div>
  );
}
