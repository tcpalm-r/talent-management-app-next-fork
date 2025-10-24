import { useState } from 'react';
import { Target, UserPlus } from 'lucide-react';
import type { Employee, Department, EmployeePlan } from '../types';
import PlansDashboard from './PlansDashboard';
import OnboardingDashboard from './OnboardingDashboard';
import { NavigationTabs } from './unified';

interface DevelopmentDashboardProps {
  employees: Employee[];
  departments: Department[];
  employeePlans: Record<string, EmployeePlan>;
  onEmployeeClick: (employee: Employee) => void;
  onOpenPlanModal?: (employee: Employee) => void;
  activeDepartmentIds?: string[];
}

type DevelopmentView = 'plans' | 'onboarding';

export default function DevelopmentDashboard({
  employees,
  departments,
  employeePlans,
  onEmployeeClick,
  onOpenPlanModal,
  activeDepartmentIds = [],
}: DevelopmentDashboardProps) {
  const [activeView, setActiveView] = useState<DevelopmentView>('plans');

  const tabs = [
    { id: 'plans', label: 'Development Plans', icon: Target },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
  ];

  const scopedEmployees = activeDepartmentIds.length > 0
    ? employees.filter(emp => emp.department_id && activeDepartmentIds.includes(emp.department_id))
    : employees;

  const scopedDepartments = activeDepartmentIds.length > 0
    ? departments.filter(dept => activeDepartmentIds.includes(dept.id))
    : departments;

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <NavigationTabs
          tabs={tabs}
          activeTab={activeView}
          onTabChange={(tabId) => setActiveView(tabId as DevelopmentView)}
        />

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeDepartmentIds.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center justify-between">
              <span>
                Focusing on {activeDepartmentIds.length === 1 ? 'selected department' : 'selected departments'}.
              </span>
              <span className="font-semibold">{scopedEmployees.length} people with plans</span>
            </div>
          )}

          {activeView === 'plans' && (
            <PlansDashboard
              employees={scopedEmployees}
              departments={scopedDepartments}
              employeePlans={employeePlans}
              onEmployeeClick={onEmployeeClick}
              onOpenPlanModal={onOpenPlanModal}
            />
          )}

          {activeView === 'onboarding' && (
            <OnboardingDashboard
              employees={scopedEmployees}
              departments={scopedDepartments}
              onEmployeeClick={onEmployeeClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
