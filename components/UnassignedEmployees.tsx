import { ReactNode } from 'react';
import { Users, Target, UserPlus } from 'lucide-react';
import type { Employee, Department, UserRole } from '../types';
import EmployeeCard from './EmployeeCard';

interface UnassignedEmployeesProps {
  employees: Employee[];
  departments: Department[];
  userRole: UserRole;
  isUpdating: boolean;
  onOpenPlan?: (employee: Employee) => void;
  onCardClick?: (employee: Employee) => void;
  employeePlans?: Record<string, any>;
  onAddEmployee?: () => void;
  getCardMeta?: (employee: Employee) => {
    hasManagerReview?: boolean;
    hasSelfReview?: boolean;
    topBadge?: ReactNode;
    bottomBanner?: ReactNode;
  };
}

export default function UnassignedEmployees({
  employees,
  departments,
  userRole,
  isUpdating,
  onOpenPlan,
  onCardClick,
  employeePlans = {},
  onAddEmployee,
  getCardMeta,
}: UnassignedEmployeesProps) {
  const getDepartment = (employee: Employee) => {
    return employee.department_id
      ? departments.find(d => d.id === employee.department_id)
      : undefined;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Unassigned Employees
              </h3>
              <p className="text-sm text-gray-600">Drag to grid to assess</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded text-sm font-semibold bg-gray-100 text-gray-700">
              {employees.length}
            </span>
            {userRole !== 'viewer' && onAddEmployee && (
              <button
                onClick={onAddEmployee}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {employees.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-2">All employees assessed</h4>
            <p className="text-sm text-gray-600 mb-6">
              Everyone has been placed in the 9-box grid.
            </p>
            {userRole !== 'viewer' && onAddEmployee && (
              <button onClick={onAddEmployee} className="btn-secondary">
                Add New Employee
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {employees.map((employee) => {
                const meta = getCardMeta?.(employee) || {};
                return (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  department={getDepartment(employee)}
                  showMenu={false}
                  onOpenPlan={onOpenPlan}
                  onCardClick={onCardClick}
                  employeePlan={employeePlans[employee.id]}
                  hasManagerReview={meta.hasManagerReview}
                  hasSelfReview={meta.hasSelfReview}
                  topRightBadge={meta.topBadge}
                  bottomBanner={meta.bottomBanner}
                />
                );
              })}
            </div>

            {isUpdating && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-blue-900">Updating assessment...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
