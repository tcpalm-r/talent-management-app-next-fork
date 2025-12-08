import { useState } from 'react';
import { Download, Search, User, Check, ChevronDown, X } from 'lucide-react';
import type { Employee, Department, UserRole } from '../types';
import type { PerformanceReview } from '../lib/schema';
import EmployeeDetailModal from './EmployeeDetailModal';
import Quick360Modal from './Quick360Modal';
import { EmployeeCardUnified, EmptyState } from './unified';

interface EmployeeListProps {
  employees: Employee[];
  departments: Department[];
  onEmployeeUpdate: () => void;
  userRole: UserRole;
  employeePlans?: Record<string, any>;
  onPlansUpdate?: (plans: Record<string, any>) => void;
  organizationId?: string;
  performanceReviews?: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  onReviewSave?: (review: PerformanceReview) => void;
  currentUser?: Employee;
  finalizedSurveys?: Record<string, number>; // Maps employee_id to count of finalized surveys
}

export default function EmployeeList({
  employees,
  departments,
  onEmployeeUpdate,
  userRole: _userRole,
  employeePlans = {},
  onPlansUpdate,
  organizationId,
  performanceReviews = {},
  onReviewSave,
  currentUser,
  finalizedSurveys = {},
}: EmployeeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<'details' | 'review' | 'plan' | '360' | 'notes' | 'one-on-one' | 'pip' | 'succession' | 'perf-review'>('details');
  const [detailReviewType, setDetailReviewType] = useState<'manager' | 'self'>('manager');
  const [selected360Employee, setSelected360Employee] = useState<Employee | null>(null);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);

  // Filter state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [status360, setStatus360] = useState<'all' | 'completed' | 'pending'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredEmployees = employees
    .filter(employee => {
      // Search filter
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.department?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Department filter
      if (selectedDepartments.length > 0) {
        if (!employee.department_id || !selectedDepartments.includes(employee.department_id)) {
          return false;
        }
      }

      // Role filter
      if (selectedRoles.length > 0) {
        if (!employee.app_role || !selectedRoles.includes(employee.app_role)) {
          return false;
        }
      }

      // 360 Status filter
      if (status360 !== 'all') {
        const has360 = finalizedSurveys[employee.id] && finalizedSurveys[employee.id] > 0;
        if (status360 === 'completed' && !has360) return false;
        if (status360 === 'pending' && has360) return false;
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = async () => {
    try {
      const { exportToCSV } = await import('../lib/export');
      exportToCSV({
        employees: filteredEmployees,
        departments,
        boxDefinitions: [],
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailInitialTab('details');
    setDetailReviewType('manager');
    setIsDetailModalOpen(true);
  };

  const handleSavePlan = (plan: any) => {
    if (selectedEmployee && onPlansUpdate) {
      const updatedPlans = {
        ...employeePlans,
        [selectedEmployee.id]: plan
      };
      onPlansUpdate(updatedPlans);
    }
  };

  const handleOpen360 = (employee: Employee) => {
    setSelected360Employee(employee);
    setIs360ModalOpen(true);
  };

  const handleReviewSaveInternal = (review: PerformanceReview) => {
    onReviewSave?.(review);
  };

  const getReviewRecord = (employeeId: string) => performanceReviews[employeeId];

  const getReviewArray = (employeeId: string): PerformanceReview[] => {
    const record = performanceReviews[employeeId];
    if (!record) return [];
    return Object.values(record).filter(Boolean) as PerformanceReview[];
  };

  return (
    <>
      <div className="px-6 py-4 border-b dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-gray-100">Employees ({filteredEmployees.length})</h2>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          Filters {selectedDepartments.length + selectedRoles.length + (status360 !== 'all' ? 1 : 0) > 0 && `(${selectedDepartments.length + selectedRoles.length + (status360 !== 'all' ? 1 : 0)})`}
        </button>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-md border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 360 Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">360 Feedback Status</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="360-status"
                      value="all"
                      checked={status360 === 'all'}
                      onChange={() => setStatus360('all')}
                      className="rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">All</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="360-status"
                      value="completed"
                      checked={status360 === 'completed'}
                      onChange={() => setStatus360('completed')}
                      className="rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Completed</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="360-status"
                      value="pending"
                      checked={status360 === 'pending'}
                      onChange={() => setStatus360('pending')}
                      className="rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Pending</span>
                  </label>
                </div>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Departments</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDepartments([...selectedDepartments, dept.id]);
                          } else {
                            setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{dept.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles</label>
                <div className="space-y-2">
                  {['admin', 'leader', 'user'].map((role) => (
                    <label key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, role]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(selectedDepartments.length > 0 || selectedRoles.length > 0 || status360 !== 'all') && (
              <button
                onClick={() => {
                  setSelectedDepartments([]);
                  setSelectedRoles([]);
                  setStatus360('all');
                }}
                className="mt-4 flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="p-6">
        {filteredEmployees.length === 0 ? (
          <EmptyState
            icon={employees.length === 0 ? User : Search}
            title={employees.length === 0 ? 'No employees yet' : 'No employees match your search'}
            description={employees.length === 0 ? 'Import employees to get started with assessments.' : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => {
              const dept = departments.find(d => d.id === employee.department_id);
              const initials = employee.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();

              // Check if employee has finalized 360 feedback
              const has360Review = finalizedSurveys[employee.id] && finalizedSurveys[employee.id] > 0;

              return (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeClick(employee)}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-5 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  {/* Header with name and avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-500 dark:bg-blue-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{employee.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{employee.title || 'No title'}</p>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          department={departments.find(d => d.id === selectedEmployee.department_id)}
          employeePlan={employeePlans[selectedEmployee.id]}
          initialTab={detailInitialTab}
          initialReviewType={detailReviewType}
          performanceReviewRecord={getReviewRecord(selectedEmployee.id)}
          onReviewSave={handleReviewSaveInternal}
          onSavePlan={handleSavePlan}
          onUpdateEmployee={() => {
            onEmployeeUpdate();
          }}
          currentUser={currentUser}
          availableEmployees={employees}
        />
      )}

      {selected360Employee && (
        <Quick360Modal
          isOpen={is360ModalOpen}
          onClose={() => {
            setIs360ModalOpen(false);
            setSelected360Employee(null);
          }}
          employee={selected360Employee}
          organizationId={organizationId ?? selected360Employee.organization_id}
          onSurveyCreated={() => {
            setIs360ModalOpen(false);
            setSelected360Employee(null);
          }}
        />
      )}
    </>
  );
}
