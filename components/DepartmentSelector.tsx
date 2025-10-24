import { useState } from 'react';
import { Building2, Users, TrendingUp, Award, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Department, Employee } from '../types';
import { StatCard } from './unified';

interface DepartmentSelectorProps {
  departments: Department[];
  employees: Employee[];
  selectedDepartments: string[];
  onSelectionChange: (departmentIds: string[]) => void;
}

export default function DepartmentSelector({
  departments,
  employees,
  selectedDepartments,
  onSelectionChange,
}: DepartmentSelectorProps) {
  const [showStats, setShowStats] = useState(false);
  const compactCardClass = 'bg-white border border-gray-200 shadow-sm';

  const getDepartmentStats = (deptId: string) => {
    const deptEmployees = employees.filter((emp) => emp.department_id === deptId);
    const assessed = deptEmployees.filter((emp) => emp.assessment);
    const highPotential = assessed.filter((emp) => emp.assessment?.potential === 'high');
    const highPerformers = assessed.filter((emp) => emp.assessment?.performance === 'high');
    const stars = assessed.filter(
      (emp) => emp.assessment?.performance === 'high' && emp.assessment?.potential === 'high',
    );
    const atRisk = assessed.filter((emp) => emp.assessment?.performance === 'low');

    return {
      total: deptEmployees.length,
      assessed: assessed.length,
      highPotential: highPotential.length,
      highPerformers: highPerformers.length,
      stars: stars.length,
      atRisk: atRisk.length,
      assessmentRate: deptEmployees.length > 0 ? (assessed.length / deptEmployees.length) * 100 : 0,
    };
  };

  const departmentSummaries = departments.map((dept) => ({
    dept,
    stats: getDepartmentStats(dept.id),
  }));

  const companyStats = {
    total: employees.length,
    assessed: employees.filter((emp) => emp.assessment).length,
    highPotential: employees.filter((emp) => emp.assessment?.potential === 'high').length,
    highPerformers: employees.filter((emp) => emp.assessment?.performance === 'high').length,
    stars: employees.filter(
      (emp) => emp.assessment?.performance === 'high' && emp.assessment?.potential === 'high',
    ).length,
    atRisk: employees.filter((emp) => emp.assessment?.performance === 'low').length,
    assessmentRate:
      employees.length > 0 ? (employees.filter((emp) => emp.assessment).length / employees.length) * 100 : 0,
  };

  const selectedDepartmentSummaries = departmentSummaries.filter(({ dept }) =>
    selectedDepartments.includes(dept.id),
  );

  const isCompanyView = selectedDepartments.length === 0;

  const selectionLabel = isCompanyView
    ? 'Viewing entire company'
    : selectedDepartmentSummaries.length === 1
    ? `${selectedDepartmentSummaries[0].dept.name} selected`
    : selectedDepartmentSummaries.length > 1
    ? `${selectedDepartmentSummaries.length} departments selected`
    : 'Custom selection';

  const totalSelectedEmployees = selectedDepartmentSummaries.reduce(
    (total, summary) => total + summary.stats.total,
    0,
  );

  const summaryText = isCompanyView
    ? `Showing all ${companyStats.total} employees across ${departments.length} departments`
    : selectedDepartmentSummaries.length === 1
    ? `${selectedDepartmentSummaries[0].dept.name} • ${selectedDepartmentSummaries[0].stats.total} employees`
    : selectedDepartmentSummaries.length > 1
    ? `Comparing ${selectedDepartmentSummaries.length} departments • ${totalSelectedEmployees} employees`
    : 'Showing custom selection';

  const handleSelectAll = () => {
    onSelectionChange([]);
  };

  const handleSelectDepartment = (deptId: string) => {
    if (selectedDepartments.includes(deptId)) {
      onSelectionChange(selectedDepartments.filter((id) => id !== deptId));
    } else {
      onSelectionChange([...selectedDepartments, deptId]);
    }
  };

  const handleSelectOnly = (deptId: string) => {
    onSelectionChange([deptId]);
  };

  const renderDepartmentCard = (
    summary: { dept: Department; stats: ReturnType<typeof getDepartmentStats> },
    options: { showFocus?: boolean } = {},
  ) => {
    const { dept, stats } = summary;
    const assessmentRate = stats.total > 0 ? Math.round((stats.assessed / stats.total) * 100) : 0;

    return (
      <div key={dept.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: dept.color }}
            />
            <span className="text-sm font-semibold text-gray-900">{dept.name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{stats.total} total</span>
            {options.showFocus && (
              <button
                type="button"
                onClick={() => handleSelectOnly(dept.id)}
                className="rounded-md border border-gray-200 px-2 py-1 font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                Focus
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
          <span>
            <span className="font-semibold text-gray-900">{stats.assessed}</span> assessed ({assessmentRate}%)
          </span>
          <span>
            <span className="font-semibold text-gray-900">{stats.stars}</span> star talent
          </span>
          <span>
            <span className="font-semibold text-gray-900">{stats.highPotential}</span> high potential
          </span>
          <span>
            <span className="font-semibold text-gray-900">{stats.highPerformers}</span> high performers
          </span>
          <span>
            <span className="font-semibold text-gray-900">{stats.atRisk}</span> at risk
          </span>
        </div>
      </div>
    );
  };

  return (
    <div id="department-focus-panel" className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="px-6 py-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Department View</h3>
              <p className="text-sm text-gray-600">{selectionLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowStats((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
          >
            <span>{showStats ? 'Hide stats' : 'Show stats'}</span>
            {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                isCompanyView
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Company-wide</span>
              <span className="text-xs font-medium opacity-80">{companyStats.total}</span>
            </button>

            {departmentSummaries.map(({ dept, stats }) => {
              const isSelected = selectedDepartments.includes(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelectDepartment(dept.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span>{dept.name}</span>
                  <span className="text-xs font-medium text-gray-500">{stats.total}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <span>{summaryText}</span>
            {!isCompanyView && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                Reset to company view
              </button>
            )}
          </div>
        </div>

        {showStats && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            {isCompanyView ? (
              <>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Company snapshot</h4>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      icon={Users}
                      label="Total talent"
                      value={companyStats.total}
                      subtitle="Employees"
                      variant="compact"
                      className={compactCardClass}
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Assessed"
                      value={`${companyStats.assessed} (${Math.round(companyStats.assessmentRate)}%)`}
                      subtitle="Completed assessments"
                      variant="compact"
                      textColor="text-indigo-700"
                      iconClassName="text-indigo-600"
                      className={compactCardClass}
                    />
                    <StatCard
                      icon={Award}
                      label="Star talent"
                      value={companyStats.stars}
                      subtitle="High performance + potential"
                      variant="compact"
                      textColor="text-emerald-700"
                      iconClassName="text-emerald-600"
                      className={compactCardClass}
                    />
                    <StatCard
                      icon={AlertCircle}
                      label="At risk"
                      value={companyStats.atRisk}
                      subtitle="Needs support"
                      variant="compact"
                      textColor="text-amber-700"
                      iconClassName="text-amber-500"
                      className={compactCardClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <span>Department snapshot</span>
                    <span>{departments.length} departments</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {departmentSummaries.map((summary) => renderDepartmentCard(summary))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {selectedDepartmentSummaries.length > 0 ? (
                  selectedDepartmentSummaries.map((summary) =>
                    renderDepartmentCard(summary, { showFocus: selectedDepartmentSummaries.length > 1 }),
                  )
                ) : (
                  <p className="text-sm text-gray-500">Selected departments are not available in the current dataset.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
