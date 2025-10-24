import { useState } from 'react';
import { Download, Search, User } from 'lucide-react';
import type { Employee, Department, UserRole } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import EnhancedEmployeePlanModal from './EnhancedEmployeePlanModal';
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
}: EmployeeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<'details' | 'review' | 'plan' | '360' | 'notes' | 'one-on-one' | 'pip' | 'succession' | 'perf-review'>('details');
  const [detailReviewType, setDetailReviewType] = useState<'manager' | 'self'>('manager');
  const [planTargetEmployee, setPlanTargetEmployee] = useState<Employee | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selected360Employee, setSelected360Employee] = useState<Employee | null>(null);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleOpenPlan = (employee: Employee) => {
    setPlanTargetEmployee(employee);
    setIsPlanModalOpen(true);
  };

  const handleOpenManagerReview = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailInitialTab('perf-review');
    setDetailReviewType('manager');
    setIsDetailModalOpen(true);
  };

  const handleOpenSelfReview = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailInitialTab('perf-review');
    setDetailReviewType('self');
    setIsDetailModalOpen(true);
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
          <div className="space-y-4">
            {filteredEmployees.map((employee) => (
              <EmployeeCardUnified
                key={employee.id}
                employee={employee}
                department={departments.find(d => d.id === employee.department_id)}
                variant="list"
                enableDrag={false}
                onCardClick={handleEmployeeClick}
                employeePlan={employeePlans[employee.id]}
                onOpenPlan={handleOpenPlan}
                onOpenManagerReview={handleOpenManagerReview}
                onOpenSelfReview={handleOpenSelfReview}
                onOpen360={handleOpen360}
              />
            ))}
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
        />
      )}

      {planTargetEmployee && (
        <EnhancedEmployeePlanModal
          isOpen={isPlanModalOpen}
          onClose={() => {
            setIsPlanModalOpen(false);
            setPlanTargetEmployee(null);
          }}
          employee={planTargetEmployee}
          department={departments.find(d => d.id === planTargetEmployee.department_id)}
          onSave={(plan) => {
            if (onPlansUpdate) {
              const updatedPlans = {
                ...employeePlans,
                [planTargetEmployee.id]: plan,
              };
              onPlansUpdate(updatedPlans);
            }
          }}
          existingPlan={employeePlans[planTargetEmployee.id]}
          performanceReviews={getReviewArray(planTargetEmployee.id)}
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
