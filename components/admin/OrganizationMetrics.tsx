import { ReactNode } from 'react';
import { Users, CheckCircle, AlertTriangle, TrendingUp, Calendar, Target } from 'lucide-react';
import type { Employee, Department } from '../../types';

interface OrganizationMetricsProps {
  employees: Employee[];
  departments: Department[];
  employeePlans: Record<string, any>;
}

interface MetricCard {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  bgColor: string;
  subtext?: string;
  trend?: { value: string; positive: boolean };
}

export default function OrganizationMetrics({ employees, departments, employeePlans }: OrganizationMetricsProps) {
  // Calculate metrics
  const totalEmployees = employees.length;
  const assessedEmployees = employees.filter(emp => emp.assessment?.performance && emp.assessment?.potential).length;
  const assessmentRate = totalEmployees > 0 ? Math.round((assessedEmployees / totalEmployees) * 100) : 0;

  const unassessedEmployees = totalEmployees - assessedEmployees;

  // Performance distribution
  const highPerformers = employees.filter(emp => emp.assessment?.performance === 'high').length;
  const mediumPerformers = employees.filter(emp => emp.assessment?.performance === 'medium').length;
  const lowPerformers = employees.filter(emp => emp.assessment?.performance === 'low').length;

  // Potential distribution
  const highPotential = employees.filter(emp => emp.assessment?.potential === 'high').length;
  const mediumPotential = employees.filter(emp => emp.assessment?.potential === 'medium').length;
  const lowPotential = employees.filter(emp => emp.assessment?.potential === 'low').length;

  // Plans
  const activePlans = Object.values(employeePlans).filter((plan: any) => plan.status === 'active').length;
  const completedPlans = Object.values(employeePlans).filter((plan: any) => plan.status === 'completed').length;

  // Risk indicators
  const atRiskCount = employees.filter(emp => {
    const box = emp.assessment?.box_key;
    return box && ['1-1', '1-2', '2-1'].includes(box); // Low performers
  }).length;

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentHires = employees.filter(emp => new Date(emp.created_at) > thirtyDaysAgo).length;
  const recentAssessments = employees.filter(emp =>
    emp.assessment && new Date(emp.assessment.assessed_at) > thirtyDaysAgo
  ).length;

  // Top level metrics
  const metrics: MetricCard[] = [
    {
      label: 'Total Employees',
      value: totalEmployees,
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtext: `Across ${departments.length} departments`,
    },
    {
      label: 'Assessment Rate',
      value: `${assessmentRate}%`,
      icon: <CheckCircle className="w-5 h-5" />,
      color: assessmentRate >= 80 ? 'text-green-600' : assessmentRate >= 50 ? 'text-yellow-600' : 'text-red-600',
      bgColor: assessmentRate >= 80 ? 'bg-green-50' : assessmentRate >= 50 ? 'bg-yellow-50' : 'bg-red-50',
      subtext: `${assessedEmployees} of ${totalEmployees} assessed`,
    },
    {
      label: 'Active Plans',
      value: activePlans,
      icon: <Target className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtext: `${completedPlans} completed`,
    },
    {
      label: 'At Risk',
      value: atRiskCount,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: atRiskCount > 0 ? 'text-red-600' : 'text-gray-600',
      bgColor: atRiskCount > 0 ? 'bg-red-50' : 'bg-gray-50',
      subtext: 'Require attention',
    },
    {
      label: 'High Performers',
      value: highPerformers,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      subtext: `${highPotential} high potential`,
    },
    {
      label: 'Recent Activity',
      value: recentHires + recentAssessments,
      icon: <Calendar className="w-5 h-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      subtext: 'Last 30 days',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Key Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.label}</p>
                  <p className={`text-3xl font-bold ${metric.color} mb-1`}>{metric.value}</p>
                  {metric.subtext && (
                    <p className="text-xs text-gray-500">{metric.subtext}</p>
                  )}
                </div>
                <div className={`${metric.bgColor} ${metric.color} p-3 rounded-lg`}>
                  {metric.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Performance Distribution</h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">High Performance</span>
                <span className="text-sm font-semibold text-emerald-600">{highPerformers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (highPerformers / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Medium Performance</span>
                <span className="text-sm font-semibold text-blue-600">{mediumPerformers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (mediumPerformers / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Low Performance</span>
                <span className="text-sm font-semibold text-red-600">{lowPerformers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (lowPerformers / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Potential Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Potential Distribution</h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">High Potential</span>
                <span className="text-sm font-semibold text-purple-600">{highPotential}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (highPotential / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Medium Potential</span>
                <span className="text-sm font-semibold text-indigo-600">{mediumPotential}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (mediumPotential / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Low Potential</span>
                <span className="text-sm font-semibold text-orange-600">{lowPotential}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${assessedEmployees > 0 ? (lowPotential / assessedEmployees) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Department Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {departments.map(dept => {
            const deptEmployees = employees.filter(emp => emp.department_id === dept.id);
            const deptAssessed = deptEmployees.filter(emp => emp.assessment?.performance).length;
            const assessmentPct = deptEmployees.length > 0
              ? Math.round((deptAssessed / deptEmployees.length) * 100)
              : 0;

            return (
              <div key={dept.id} className="text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: dept.color }}
                >
                  {deptEmployees.length}
                </div>
                <p className="text-xs font-medium text-gray-900 mb-1">{dept.name}</p>
                <p className="text-xs text-gray-500">{assessmentPct}% assessed</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
