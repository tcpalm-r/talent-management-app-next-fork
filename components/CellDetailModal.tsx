import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, TrendingUp, Target, Lightbulb, Users2 } from 'lucide-react';
import type { Employee, Department, BoxDefinition } from '../types';
import EmployeeCard from './EmployeeCard';

interface CellDetailModalProps {
  isOpen: boolean;
  boxDefinition: BoxDefinition | null;
  employees: Employee[];
  departments: Department[];
  allBoxDefinitions: BoxDefinition[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onEmployeeUpdate?: () => void;
  onCardClick?: (employee: Employee) => void;
}

export default function CellDetailModal({
  isOpen,
  boxDefinition,
  employees,
  departments,
  allBoxDefinitions,
  onClose,
  onNavigate,
  onEmployeeUpdate,
  onCardClick,
}: CellDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onNavigate('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNavigate('next');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !boxDefinition) return null;

  const getDepartment = (employee: Employee) => {
    return employee.department_id
      ? departments.find(d => d.id === employee.department_id)
      : undefined;
  };

  // Get performance and potential labels
  const getPerformanceLabel = () => {
    switch (boxDefinition.grid_x) {
      case 1: return 'Low Performance';
      case 2: return 'Medium Performance';
      case 3: return 'High Performance';
      default: return 'Performance';
    }
  };

  const getPotentialLabel = () => {
    switch (boxDefinition.grid_y) {
      case 1: return 'Low Potential';
      case 2: return 'Medium Potential';
      case 3: return 'High Potential';
      default: return 'Potential';
    }
  };

  // Get navigation info
  const currentIndex = allBoxDefinitions.findIndex(box => box.key === boxDefinition.key);
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < allBoxDefinitions.length - 1;

  // Get department distribution
  const departmentCounts = employees.reduce((acc, employee) => {
    const dept = getDepartment(employee);
    if (dept) {
      acc[dept.name] = (acc[dept.name] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div
        ref={modalRef}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className="w-12 h-12 rounded-xl shadow-md flex items-center justify-center"
                style={{ backgroundColor: boxDefinition.color }}
              >
                <span className="text-white font-bold text-lg">
                  {employees.length}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{boxDefinition.label}</h2>
                <p className="text-sm text-gray-600">{getPerformanceLabel()} • {getPotentialLabel()}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Navigation buttons */}
              <button
                onClick={() => onNavigate('prev')}
                disabled={!canNavigatePrev}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous cell (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <span className="text-xs text-gray-500 px-2">
                {currentIndex + 1} of {allBoxDefinitions.length}
              </span>
              
              <button
                onClick={() => onNavigate('next')}
                disabled={!canNavigateNext}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next cell (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-2" />

              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Close (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Cell Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Performance Level</h3>
                </div>
                <p className="text-sm text-blue-800">{getPerformanceLabel()}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Potential Level</h3>
                </div>
                <p className="text-sm text-green-800">{getPotentialLabel()}</p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users2 className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Team Size</h3>
                </div>
                <p className="text-sm text-purple-800">{employees.length} employees</p>
              </div>
            </div>

            {/* Action Recommendations */}
            {boxDefinition.action_hint && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Recommended Actions</h3>
                    <p className="text-sm text-amber-800">{boxDefinition.action_hint}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Department Distribution */}
            {Object.keys(departmentCounts).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Department Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(departmentCounts).map(([deptName, count]) => {
                    const dept = departments.find(d => d.name === deptName);
                    return (
                      <div
                        key={deptName}
                        className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm bg-gray-100 border"
                      >
                        {dept && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: dept.color }}
                          />
                        )}
                        <span className="font-medium">{deptName}</span>
                        <span className="text-gray-600">({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Employees List */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                {employees.length === 0 ? 'No Employees' : `All Employees (${employees.length})`}
              </h3>
              
              {employees.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium mb-1">No employees in this cell</p>
                  <p className="text-sm">Drag employees from the unassigned section or other cells to place them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((employee) => (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      department={getDepartment(employee)}
                      showMenu={false}
                      onCardClick={onCardClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              <span className="font-medium">Description:</span> {boxDefinition.description}
            </div>
            <div>
              Use <kbd className="px-1 py-0.5 bg-gray-200 rounded">←</kbd> <kbd className="px-1 py-0.5 bg-gray-200 rounded">→</kbd> to navigate, <kbd className="px-1 py-0.5 bg-gray-200 rounded">ESC</kbd> to close
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
