import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle, Users, FileText } from 'lucide-react';
import type { Employee, Department } from '../types';
import { EmployeeCardUnified } from './unified';
import { useToast } from './unified';

interface BatchReviewFlowProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  departments: Department[];
  onOpenReviewForEmployee: (employee: Employee) => void;
  title: string;
  description: string;
}

export default function BatchReviewFlow({
  isOpen,
  onClose,
  employees,
  departments,
  onOpenReviewForEmployee,
  title,
  description,
}: BatchReviewFlowProps) {
  const { notify } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  if (!isOpen || employees.length === 0) return null;

  const currentEmployee = employees[currentIndex];
  const currentDepartment = departments.find(d => d.id === currentEmployee.department_id);
  const progress = Math.round((completedIds.size / employees.length) * 100);

  const handleNext = () => {
    if (currentIndex < employees.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All done
      notify({
        title: 'Batch Review Complete',
        description: `You've reviewed all ${employees.length} team members!`,
        variant: 'success',
      });
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAddReview = () => {
    // Mark as completed
    const newCompleted = new Set(completedIds);
    newCompleted.add(currentEmployee.id);
    setCompletedIds(newCompleted);

    // Open review modal
    onOpenReviewForEmployee(currentEmployee);
  };

  const handleSkip = () => {
    handleNext();
  };

  const getDepartmentForEmployee = (employee: Employee) => {
    return departments.find(d => d.id === employee.department_id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Employee {currentIndex + 1} of {employees.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {completedIds.size} reviewed
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Current Employee Card */}
          <div className="bg-white rounded-lg border-2 border-blue-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Current Employee</h3>
              {completedIds.has(currentEmployee.id) && (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Reviewed
                </span>
              )}
            </div>
            <EmployeeCardUnified
              employee={currentEmployee}
              department={currentDepartment}
              variant="detailed"
              enableDrag={false}
              showMenu={false}
            />
          </div>

          {/* Upcoming Employees Preview */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Upcoming ({Math.max(0, employees.length - currentIndex - 1)} remaining)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {employees.slice(currentIndex + 1, currentIndex + 7).map(employee => {
                const dept = getDepartmentForEmployee(employee);
                const isCompleted = completedIds.has(employee.id);
                
                return (
                  <div
                    key={employee.id}
                    className={`p-3 rounded-lg border ${
                      isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCompleted && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{employee.name}</p>
                        {employee.title && (
                          <p className="text-xs text-gray-600 truncate">{employee.title}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {employees.length - currentIndex - 1 > 6 && (
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                  <p className="text-sm text-gray-600">
                    +{employees.length - currentIndex - 7} more
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleAddReview}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Add Review
            </button>
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

