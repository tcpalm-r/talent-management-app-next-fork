import { useState } from 'react';
import { FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, Filter, Target, Award } from 'lucide-react';
import type { Employee, Department, UserRole } from '../types';
import EmployeeCard from './EmployeeCard';

interface PlansOverviewProps {
  employees: Employee[];
  departments: Department[];
  employeePlans: Record<string, any>;
  userRole: UserRole;
  onOpenPlan: (employee: Employee) => void;
  onEmployeeClick?: (employee: Employee) => void;
}

type PlanFilter = 'all' | 'not-started' | 'in-progress' | 'complete' | 'development' | 'performance_improvement' | 'retention' | 'succession';

export default function PlansOverview({
  employees,
  departments,
  employeePlans,
  userRole,
  onOpenPlan,
  onEmployeeClick
}: PlansOverviewProps) {
  const [filter, setFilter] = useState<PlanFilter>('all');

  // Calculate statistics
  const assessedEmployees = employees.filter(emp => emp.assessment);
  const employeesWithPlans = assessedEmployees.filter(emp => employeePlans[emp.id]);
  
  const planStats = {
    total: employeesWithPlans.length,
    notStarted: 0,
    inProgress: 0,
    complete: 0,
    development: 0,
    performanceImprovement: 0,
    retention: 0,
    succession: 0,
  };

  employeesWithPlans.forEach(emp => {
    const plan = employeePlans[emp.id];
    if (!plan) return;
    
    // Count by type
    if (plan.plan_type === 'development') planStats.development++;
    if (plan.plan_type === 'performance_improvement') planStats.performanceImprovement++;
    if (plan.plan_type === 'retention') planStats.retention++;
    if (plan.plan_type === 'succession') planStats.succession++;
    
    // Count by status
    const actionItems = plan.action_items || [];
    if (actionItems.length === 0) {
      planStats.notStarted++;
      return;
    }
    
    const completed = actionItems.filter((item: any) => item.completed).length;
    const progress = (completed / actionItems.length) * 100;
    
    if (progress === 100) planStats.complete++;
    else if (progress > 0) planStats.inProgress++;
    else planStats.notStarted++;
  });

  const employeesNeedingPlans = assessedEmployees.filter(emp => !employeePlans[emp.id]);

  // Filter employees
  const getFilteredEmployees = () => {
    let filtered = employeesWithPlans;

    if (filter === 'not-started') {
      filtered = filtered.filter(emp => {
        const plan = employeePlans[emp.id];
        const actionItems = plan?.action_items || [];
        return actionItems.length === 0 || actionItems.every((item: any) => !item.completed);
      });
    } else if (filter === 'in-progress') {
      filtered = filtered.filter(emp => {
        const plan = employeePlans[emp.id];
        const actionItems = plan?.action_items || [];
        if (actionItems.length === 0) return false;
        const completed = actionItems.filter((item: any) => item.completed).length;
        const progress = (completed / actionItems.length) * 100;
        return progress > 0 && progress < 100;
      });
    } else if (filter === 'complete') {
      filtered = filtered.filter(emp => {
        const plan = employeePlans[emp.id];
        const actionItems = plan?.action_items || [];
        if (actionItems.length === 0) return false;
        return actionItems.every((item: any) => item.completed);
      });
    } else if (['development', 'performance_improvement', 'retention', 'succession'].includes(filter)) {
      filtered = filtered.filter(emp => employeePlans[emp.id]?.plan_type === filter);
    }

    return filtered;
  };

  const filteredEmployees = getFilteredEmployees();
  const planCoverage = assessedEmployees.length > 0 
    ? Math.round((employeesWithPlans.length / assessedEmployees.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Plans</span>
          </div>
          <div className="text-4xl font-bold text-blue-900">{planStats.total}</div>
          <div className="text-sm text-blue-700 mt-1">
            {planCoverage}% coverage
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-6 border-2 border-green-200 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Complete</span>
          </div>
          <div className="text-4xl font-bold text-green-900">{planStats.complete}</div>
          <div className="text-sm text-green-700 mt-1">
            {planStats.total > 0 ? Math.round((planStats.complete / planStats.total) * 100) : 0}% done
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl p-6 border-2 border-yellow-200 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700 uppercase tracking-wide">In Progress</span>
          </div>
          <div className="text-4xl font-bold text-yellow-900">{planStats.inProgress}</div>
          <div className="text-sm text-yellow-700 mt-1">
            Active plans
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-100 rounded-2xl p-6 border-2 border-orange-200 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <span className="text-xs font-medium text-orange-700 uppercase tracking-wide">Need Plans</span>
          </div>
          <div className="text-4xl font-bold text-orange-900">{employeesNeedingPlans.length}</div>
          <div className="text-sm text-orange-700 mt-1">
            Assessed employees
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Filter Plans</h3>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Plans ({planStats.total})
          </button>
          <button
            onClick={() => setFilter('not-started')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'not-started'
                ? 'bg-gray-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Not Started ({planStats.notStarted})
          </button>
          <button
            onClick={() => setFilter('in-progress')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'in-progress'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            In Progress ({planStats.inProgress})
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'complete'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Complete ({planStats.complete})
          </button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">By Type</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('development')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filter === 'development'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Development ({planStats.development})
            </button>
            <button
              onClick={() => setFilter('performance_improvement')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filter === 'performance_improvement'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              Performance Improvement ({planStats.performanceImprovement})
            </button>
            <button
              onClick={() => setFilter('retention')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filter === 'retention'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              Retention ({planStats.retention})
            </button>
            <button
              onClick={() => setFilter('succession')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filter === 'succession'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Succession ({planStats.succession})
            </button>
          </div>
        </div>
      </div>

      {/* Employee Plans Grid */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            {filter === 'all' ? 'All Plans' : 
             filter === 'not-started' ? 'Not Started Plans' :
             filter === 'in-progress' ? 'In Progress Plans' :
             filter === 'complete' ? 'Completed Plans' :
             filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Plans'}
          </h3>
          <span className="text-sm text-gray-600">
            {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
          </span>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-600 mb-2">No plans match this filter</h4>
            <p className="text-sm text-gray-500">Try selecting a different filter or create new plans</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              department={departments.find(d => d.id === employee.department_id)}
              showMenu={false}
              onOpenPlan={onOpenPlan}
              onCardClick={onEmployeeClick}
              employeePlan={employeePlans[employee.id]}
            />
          ))}
        </div>
      )}
      </div>

      {/* Employees Needing Plans */}
      {employeesNeedingPlans.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl shadow-lg p-6 border-2 border-orange-200">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Employees Without Plans</h3>
              <p className="text-sm text-gray-600">
                {employeesNeedingPlans.length} assessed {employeesNeedingPlans.length === 1 ? 'employee needs a' : 'employees need'} development plan
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {employeesNeedingPlans.map(employee => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                department={departments.find(d => d.id === employee.department_id)}
                showMenu={false}
                onOpenPlan={onOpenPlan}
                onCardClick={onEmployeeClick}
                employeePlan={undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
