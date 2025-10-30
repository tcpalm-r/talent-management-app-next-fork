import { useState } from 'react';
import { Download, Search, User, Check } from 'lucide-react';
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
}: EmployeeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<'details' | 'review' | 'plan' | '360' | 'notes' | 'one-on-one' | 'pip' | 'succession' | 'perf-review'>('details');
  const [detailReviewType, setDetailReviewType] = useState<'manager' | 'self'>('manager');
  const [selected360Employee, setSelected360Employee] = useState<Employee | null>(null);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);

  const filteredEmployees = employees
    .filter(employee =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Employees ({filteredEmployees.length})</h2>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
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

              // Check if employee has done a 360 review this year
              const has360Review = employee.completed_360_survey_count && employee.completed_360_survey_count > 0;

              return (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeClick(employee)}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  {/* Header with name and avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{employee.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{employee.title || 'No title'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm text-gray-900 truncate">{employee.email || 'N/A'}</p>
                  </div>

                  {/* Manager */}
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Manager</p>
                    <p className="text-sm text-gray-900 truncate">{employee.manager_id ? 'Assigned' : 'Unassigned'}</p>
                  </div>

                  {/* Department */}
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Department</p>
                    <p className="text-sm text-gray-900 truncate">{dept?.name || 'No department'}</p>
                  </div>

                  {/* 360 Review Checkbox */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">360 Review Completed</span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      has360Review
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {has360Review && <Check className="w-3 h-3 text-white" />}
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
    </div>
  );
}
