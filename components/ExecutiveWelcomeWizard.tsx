import { useState } from 'react';
import { Users, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import type { Employee, Department } from '../types';
import { EmployeeCardUnified } from './unified';

interface ExecutiveWelcomeWizardProps {
  employees: Employee[];
  departments: Department[];
  currentUserName: string;
  onLaunch360s: (selectedEmployees: Employee[]) => void;
  onSkip: () => void;
}

export default function ExecutiveWelcomeWizard({
  employees,
  departments,
  currentUserName,
  onLaunch360s,
  onSkip,
}: ExecutiveWelcomeWizardProps) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // Get direct reports (all employees for now, or filter by manager)
  const directReports = employees;

  const toggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployeeIds(newSelected);
  };

  const selectAll = () => {
    setSelectedEmployeeIds(new Set(directReports.map(e => e.id)));
  };

  const deselectAll = () => {
    setSelectedEmployeeIds(new Set());
  };

  const handleLaunch = () => {
    const selected = directReports.filter(e => selectedEmployeeIds.has(e.id));
    onLaunch360s(selected);
  };

  const getDepartmentForEmployee = (employee: Employee) => {
    return departments.find(d => d.id === employee.department_id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Sonance, {currentUserName.split(' ')[0]}!
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Build a complete picture of your team
          </p>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            Start by launching 360-degree feedback for your team members. While feedback is being collected, 
            you can add performance reviews, development plans, and other context.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12 space-x-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-semibold">
              1
            </div>
            <span className="ml-3 text-sm font-medium text-gray-900">Launch 360s</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-semibold">
              2
            </div>
            <span className="ml-3 text-sm font-medium text-gray-500">Add Context</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-semibold">
              3
            </div>
            <span className="ml-3 text-sm font-medium text-gray-500">Review Insights</span>
          </div>
        </div>

        {/* Team Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Select team members for 360 feedback
              </h2>
              <p className="text-sm text-gray-600">
                {selectedEmployeeIds.size} of {directReports.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Employee Grid */}
          {directReports.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No team members found</p>
              <button
                onClick={onSkip}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Add team members first
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directReports.map(employee => {
                const isSelected = selectedEmployeeIds.has(employee.id);
                const department = getDepartmentForEmployee(employee);
                
                return (
                  <div
                    key={employee.id}
                    onClick={() => toggleEmployee(employee.id)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {/* Selection Indicator */}
                    <div className="absolute top-3 right-3 z-10">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-5 h-5 text-white" />}
                      </div>
                    </div>

                    {/* Employee Card */}
                    <div className="p-4">
                      <EmployeeCardUnified
                        employee={employee}
                        department={department}
                        variant="compact"
                        enableDrag={false}
                        showMenu={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onSkip}
            className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            I'll set up manually
          </button>
          <button
            onClick={handleLaunch}
            disabled={selectedEmployeeIds.size === 0}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              selectedEmployeeIds.size > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            Launch 360 Reviews for {selectedEmployeeIds.size} {selectedEmployeeIds.size === 1 ? 'person' : 'people'}
          </button>
        </div>

        {/* Help Text */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            💡 Tip: 360 feedback typically takes 5-7 days to collect. You can add reviews and plans while you wait.
          </p>
        </div>
      </div>
    </div>
  );
}

