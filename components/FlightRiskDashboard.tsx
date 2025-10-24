import { useState } from 'react';
import { AlertTriangle, TrendingUp, Clock, Award, Users, AlertCircle, CheckCircle, Info, Shield } from 'lucide-react';
import type { Employee, Department, EmployeePlan } from '../types';
import EmployeeCard from './EmployeeCard';
import EmployeeDetailModal from './EmployeeDetailModal';
import RetentionPlanModal from './RetentionPlanModal';

interface FlightRiskDashboardProps {
  employees: Employee[];
  departments: Department[];
  employeePlans?: Record<string, EmployeePlan>;
  onPlansUpdate?: (plans: Record<string, EmployeePlan>) => void;
  onEmployeeUpdate?: () => void;
}

type RiskLevel = 'high' | 'medium' | 'low';

interface RiskAssessment {
  employee: Employee;
  riskLevel: RiskLevel;
  riskScore: number;
  factors: {
    tenure: { risk: number; reason: string };
    performance: { risk: number; reason: string };
    potential: { risk: number; reason: string };
    hasReview: { risk: number; reason: string };
  };
}

export default function FlightRiskDashboard({
  employees,
  departments,
  employeePlans = {},
  onPlansUpdate,
  onEmployeeUpdate,
}: FlightRiskDashboardProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RiskLevel | 'all'>('all');
  const [retentionPlanEmployee, setRetentionPlanEmployee] = useState<Employee | null>(null);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);

  // Calculate risk assessment for each employee
  const calculateRisk = (employee: Employee): RiskAssessment => {
    const factors = {
      tenure: { risk: 0, reason: '' },
      performance: { risk: 0, reason: '' },
      potential: { risk: 0, reason: '' },
      hasReview: { risk: 0, reason: '' },
    };

    // 1. Tenure risk (0-30 points)
    const joinDate = new Date(employee.created_at);
    const monthsWithCompany = Math.floor(
      (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (monthsWithCompany < 6) {
      factors.tenure = { risk: 20, reason: 'New hire (<6 months)' };
    } else if (monthsWithCompany < 12) {
      factors.tenure = { risk: 15, reason: 'Recently joined (<1 year)' };
    } else if (monthsWithCompany > 48) {
      factors.tenure = { risk: 10, reason: 'Long tenure (>4 years)' };
    } else {
      factors.tenure = { risk: 0, reason: 'Stable tenure' };
    }

    // 2. Performance risk (0-40 points)
    if (employee.assessment) {
      const perf = employee.assessment.performance;
      const pot = employee.assessment.potential;

      // High performers are flight risks if not engaged
      if (perf === 'high' && pot === 'high') {
        factors.performance = { risk: 30, reason: 'Top talent (High perf/High potential)' };
        factors.potential = { risk: 10, reason: 'High potential - likely to seek growth' };
      } else if (perf === 'high') {
        factors.performance = { risk: 20, reason: 'High performer - retention critical' };
      } else if (perf === 'low') {
        factors.performance = { risk: 15, reason: 'Low performance - may need support or exit' };
      } else {
        factors.performance = { risk: 5, reason: 'Solid performer' };
      }

      // High potential = higher risk if not challenged
      if (pot === 'high' && perf !== 'high') {
        factors.potential = { risk: 15, reason: 'Untapped potential' };
      }
    } else {
      factors.performance = { risk: 10, reason: 'Not yet assessed' };
    }

    // 3. Lack of development plan (0-20 points)
    if (employee.assessment && !employeePlans[employee.id]) {
      factors.hasReview = { risk: 20, reason: 'No development plan' };
    }

    const riskScore =
      factors.tenure.risk +
      factors.performance.risk +
      factors.potential.risk +
      factors.hasReview.risk;

    let riskLevel: RiskLevel = 'low';
    if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    return {
      employee,
      riskLevel,
      riskScore,
      factors,
    };
  };

  // Assess all employees
  const riskAssessments = employees.map(calculateRisk);

  // Group by risk level
  const highRisk = riskAssessments.filter((a) => a.riskLevel === 'high');
  const mediumRisk = riskAssessments.filter((a) => a.riskLevel === 'medium');
  const lowRisk = riskAssessments.filter((a) => a.riskLevel === 'low');

  // Filter based on active filter
  const filteredAssessments =
    activeFilter === 'all'
      ? riskAssessments
      : riskAssessments.filter((a) => a.riskLevel === activeFilter);

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const handleSavePlan = (plan: any) => {
    if (selectedEmployee && onPlansUpdate) {
      const updatedPlans = {
        ...employeePlans,
        [selectedEmployee.id]: plan,
      };
      onPlansUpdate(updatedPlans);
    }
  };

  const handleSaveRetentionPlan = (plan: Partial<EmployeePlan>) => {
    if (retentionPlanEmployee && onPlansUpdate) {
      const updatedPlans = {
        ...employeePlans,
        [retentionPlanEmployee.id]: plan as EmployeePlan,
      };
      onPlansUpdate(updatedPlans);
    }
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return 'red';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
    }
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return AlertTriangle;
      case 'medium':
        return AlertCircle;
      case 'low':
        return CheckCircle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="surface-card space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Flight Risk Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Identify employees who may need attention or are at risk of leaving
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* Total Employees */}
          <button
            onClick={() => setActiveFilter('all')}
            className={`rounded-lg border bg-white px-4 py-3 transition ${
              activeFilter === 'all'
                ? 'border-blue-400 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">{employees.length}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">Total Employees</div>
          </button>

          {/* High Risk */}
          <button
            onClick={() => setActiveFilter('high')}
            className={`rounded-lg border bg-white px-4 py-3 transition ${
              activeFilter === 'high'
                ? 'border-red-400 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{highRisk.length}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">High Risk</div>
            <div className="text-xs text-gray-500 mt-1">
              {employees.length > 0
                ? `${Math.round((highRisk.length / employees.length) * 100)}% of workforce`
                : '0%'}
            </div>
          </button>

          {/* Medium Risk */}
          <button
            onClick={() => setActiveFilter('medium')}
            className={`rounded-lg border bg-white px-4 py-3 transition ${
              activeFilter === 'medium'
                ? 'border-amber-400 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-600">{mediumRisk.length}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">Medium Risk</div>
            <div className="text-xs text-gray-500 mt-1">
              {employees.length > 0
                ? `${Math.round((mediumRisk.length / employees.length) * 100)}% of workforce`
                : '0%'}
            </div>
          </button>

          {/* Low Risk */}
          <button
            onClick={() => setActiveFilter('low')}
            className={`rounded-lg border bg-white px-4 py-3 transition ${
              activeFilter === 'low'
                ? 'border-green-400 shadow-sm'
                : 'border-gray-200 hover-border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{lowRisk.length}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">Low Risk</div>
            <div className="text-xs text-gray-500 mt-1">
              {employees.length > 0
                ? `${Math.round((lowRisk.length / employees.length) * 100)}% of workforce`
                : '0%'}
            </div>
          </button>
        </div>
      </div>

      {/* Risk Factor Legend */}
      <div className="surface-muted space-y-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-indigo-500 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h3 className="section-heading mb-2">Risk Assessment Factors</h3>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                <span>Tenure (new hires & long tenure)</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                <span>Performance level</span>
              </div>
              <div className="flex items-center">
                <Award className="w-4 h-4 mr-2" />
                <span>Potential rating</span>
              </div>
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Development plan status</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Cards by Risk Level */}
      {filteredAssessments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {activeFilter === 'all' ? 'No Employees' : `No ${activeFilter} Risk Employees`}
          </h3>
          <p className="text-gray-600">
            {activeFilter === 'all'
              ? 'Add employees to see their flight risk assessment.'
              : `Great news! No employees are currently flagged as ${activeFilter} risk.`}
          </p>
        </div>
      ) : (
        ['high', 'medium', 'low'].map((level) => {
          const levelAssessments = filteredAssessments.filter((a) => a.riskLevel === level);
          if (levelAssessments.length === 0 && activeFilter !== 'all') return null;

          const RiskIcon = getRiskIcon(level as RiskLevel);
          const colorMap = {
            high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', badge: 'bg-red-600' },
            medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', badge: 'bg-yellow-600' },
            low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', badge: 'bg-green-600' },
          };
          const colors = colorMap[level as RiskLevel];

          return (
            <div key={level} className={`bg-white rounded-lg shadow overflow-hidden`}>
              <div className={`${colors.bg} border-b-2 ${colors.border} px-6 py-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 ${colors.badge} rounded-full flex items-center justify-center mr-3`}>
                      <RiskIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${colors.text} capitalize`}>
                        {level} Risk Employees
                      </h3>
                      <p className="text-sm text-gray-600">
                        {levelAssessments.length} {levelAssessments.length === 1 ? 'employee' : 'employees'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {levelAssessments.length > 0 && (
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {levelAssessments.map((assessment) => {
                      const department = departments.find(
                        (d) => d.id === assessment.employee.department_id
                      );
                      return (
                        <div key={assessment.employee.id} className="relative">
                          <EmployeeCard
                            employee={assessment.employee}
                            department={department}
                            showMenu={false}
                            onCardClick={handleEmployeeClick}
                            employeePlan={employeePlans[assessment.employee.id]}
                          />
                          {/* Risk Score Badge */}
                          <div
                            className={`absolute -top-2 -right-2 w-8 h-8 ${colors.badge} text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg`}
                            title={`Risk Score: ${assessment.riskScore}`}
                          >
                            {assessment.riskScore}
                          </div>
                          {/* Risk Factors Tooltip */}
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            {Object.entries(assessment.factors)
                              .filter(([_, factor]) => factor.risk > 0)
                              .map(([key, factor]) => (
                                <div key={key} className="flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
                                  <span>{factor.reason}</span>
                                </div>
                              ))}
                          </div>

                          {/* Retention Plan Action */}
                          {(!employeePlans[assessment.employee.id] || 
                            employeePlans[assessment.employee.id].plan_type !== 'retention') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRetentionPlanEmployee(assessment.employee);
                                setIsRetentionModalOpen(true);
                              }}
                              className="mt-3 w-full px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Create Retention Plan
                            </button>
                          )}

                          {employeePlans[assessment.employee.id]?.plan_type === 'retention' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRetentionPlanEmployee(assessment.employee);
                                setIsRetentionModalOpen(true);
                              }}
                              className="mt-3 w-full px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              View Retention Plan
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          department={departments.find((d) => d.id === selectedEmployee.department_id)}
          employeePlan={employeePlans[selectedEmployee.id]}
          initialTab="details"
          initialReviewType="manager"
          onSavePlan={handleSavePlan}
          onUpdateEmployee={() => {
            if (onEmployeeUpdate) onEmployeeUpdate();
          }}
        />
      )}

      {/* Retention Plan Modal */}
      {retentionPlanEmployee && (
        <RetentionPlanModal
          isOpen={isRetentionModalOpen}
          onClose={() => {
            setIsRetentionModalOpen(false);
            setRetentionPlanEmployee(null);
          }}
          employee={retentionPlanEmployee}
          existingPlan={employeePlans[retentionPlanEmployee.id]}
          flightRiskScore={calculateRisk(retentionPlanEmployee).riskScore}
          onSave={handleSaveRetentionPlan}
        />
      )}
    </div>
  );
}
