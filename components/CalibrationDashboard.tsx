import { useMemo } from 'react';
import {
  ClipboardList,
  ShieldAlert,
  TrendingUp,
  GitBranch,
  Target,
  ArrowUpRight,
  CircleCheck,
} from 'lucide-react';
import type { Department, Employee, EmployeePlan } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import { StatCard, Badge, DepartmentBadge, EmployeeNameLink } from './unified';

interface ReviewRecord {
  self?: PerformanceReview;
  manager?: PerformanceReview;
}

interface CalibrationDashboardProps {
  employees: Employee[];
  departments: Department[];
  employeePlans: Record<string, EmployeePlan>;
  performanceReviews: Record<string, ReviewRecord>;
  reviewMetrics: {
    pendingSelf: number;
    pendingManager: number;
    misaligned: number;
    totalPending: number;
  };
  planMetrics: {
    missingPlans: number;
    overdueActions: number;
    pendingAck: number;
    totalFollowThrough: number;
  };
  unassessedCount: number;
  onJumpToPrepare: (departmentId?: string) => void;
  onJumpToEvaluate: (departmentId?: string) => void;
  onJumpToFollowThrough: (departmentId?: string) => void;
}

type IssueSeverity = 'critical' | 'major' | 'minor';
type TargetView = 'prepare' | 'evaluate' | 'follow';

interface CalibrationIssue {
  key: string;
  label: string;
  severity: IssueSeverity;
  targetView: TargetView;
}

interface CalibrationRow {
  employee: Employee;
  department?: Department;
  issues: CalibrationIssue[];
}

interface EmployeeSignals {
  pendingManagerReview: boolean;
  pendingSelfReview: boolean;
  misaligned: boolean;
  needsPlan: boolean;
  overdueActions: number;
  departmentId: string | null;
}

const severityOrder: Record<IssueSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

const severityVariant: Record<IssueSeverity, 'danger' | 'warning' | 'neutral'> = {
  critical: 'danger',
  major: 'warning',
  minor: 'neutral',
};

const managerScoreToValue: Record<string, number> = {
  excellence: 5,
  exceeds: 4,
  meets: 3,
  occasionally_meets: 2,
  not_performing: 1,
};

const averageSelfScore = (review?: PerformanceReview) => {
  if (!review) return null;
  const total = review.humble_score + review.hungry_score + review.smart_score;
  return Math.round(total / 3);
};

const BOX_METADATA: Record<string, { title: string; subtitle: string; accent: string }> = {
  '3-3': { title: 'Stars', subtitle: 'High performance • High potential', accent: 'bg-emerald-500' },
  '3-2': { title: 'Performance Leaders', subtitle: 'High performance • Medium potential', accent: 'bg-blue-500' },
  '3-1': { title: 'Master Craft', subtitle: 'High performance • Developing potential', accent: 'bg-cyan-500' },
  '2-3': { title: 'Emerging Leaders', subtitle: 'Solid performance • High potential', accent: 'bg-indigo-500' },
  '2-2': { title: 'Steady Core', subtitle: 'Consistent contributors', accent: 'bg-purple-500' },
  '2-1': { title: 'Core Specialists', subtitle: 'Reliable with targeted potential', accent: 'bg-slate-500' },
  '1-3': { title: 'Rising Talent', subtitle: 'High potential • Needs results', accent: 'bg-amber-500' },
  '1-2': { title: 'Evaluate Further', subtitle: 'Needs clarity & coaching', accent: 'bg-rose-500' },
  '1-1': { title: 'Realign & Redirect', subtitle: 'High support required now', accent: 'bg-red-500' },
  unassigned: { title: 'Needs Placement', subtitle: 'Awaiting calibration call', accent: 'bg-gray-500' },
};

const BOX_RENDER_ORDER = ['3-3', '3-2', '3-1', '2-3', '2-2', '2-1', '1-3', '1-2', '1-1', 'unassigned'];

export default function CalibrationDashboard({
  employees,
  departments,
  employeePlans,
  performanceReviews,
  reviewMetrics,
  planMetrics,
  unassessedCount,
  onJumpToPrepare,
  onJumpToEvaluate,
  onJumpToFollowThrough,
}: CalibrationDashboardProps) {
  const departmentMap = useMemo(() => {
    return departments.reduce<Record<string, Department>>((acc, dept) => {
      acc[dept.id] = dept;
      return acc;
    }, {});
  }, [departments]);

  const employeeSignals = useMemo<Record<string, EmployeeSignals>>(() => {
    return employees.reduce((acc, employee) => {
      const record = performanceReviews[employee.id] || {};
      const managerReview = record.manager;
      const selfReview = record.self;
      const plan = employeePlans[employee.id];

      const managerComplete = Boolean(managerReview && managerReview.status === 'completed');
      const selfComplete = Boolean(selfReview && (selfReview.status === 'submitted' || selfReview.status === 'completed'));

      const managerScore = managerReview?.manager_performance_summary
        ? managerScoreToValue[managerReview.manager_performance_summary] ?? null
        : null;
      const selfScore = averageSelfScore(selfReview);
      const misaligned = Boolean(
        managerComplete &&
        selfComplete &&
        managerScore !== null &&
        selfScore !== null &&
        Math.abs(managerScore - selfScore) >= 1
      );

      const overdueActions = (plan?.action_items || []).filter(item => item.status === 'overdue').length;

      acc[employee.id] = {
        pendingManagerReview: !managerComplete,
        pendingSelfReview: !selfComplete,
        misaligned,
        needsPlan: Boolean(employee.assessment) && !plan,
        overdueActions,
        departmentId: employee.department_id ?? null,
      };

      return acc;
    }, {} as Record<string, EmployeeSignals>);
  }, [employees, employeePlans, performanceReviews]);

  const calibrationRows = useMemo<CalibrationRow[]>(() => {
    return employees
      .map((employee) => {
        const signals = employeeSignals[employee.id];
        const department = employee.department_id ? departmentMap[employee.department_id] : undefined;

        const issues: CalibrationIssue[] = [];

        if (signals?.pendingSelfReview) {
          issues.push({ key: 'self-review', label: 'Self review pending', severity: 'major', targetView: 'prepare' });
        }

        if (signals?.pendingManagerReview) {
          issues.push({ key: 'manager-review', label: 'Manager review pending', severity: 'major', targetView: 'prepare' });
        }

        if (signals?.misaligned) {
          issues.push({ key: 'misalignment', label: 'Manager & self misaligned', severity: 'critical', targetView: 'evaluate' });
        }

        if (!employee.assessment) {
          issues.push({ key: 'unassessed', label: 'Awaiting 9-box placement', severity: 'critical', targetView: 'evaluate' });
        }

        if (signals?.needsPlan) {
          issues.push({ key: 'plan-missing', label: 'Development plan missing', severity: 'major', targetView: 'follow' });
        }

        if ((signals?.overdueActions ?? 0) > 0) {
          issues.push({
            key: 'plan-overdue',
            label: `${signals?.overdueActions ?? 0} overdue actions`,
            severity: 'major',
            targetView: 'follow',
          });
        }

        if (issues.length === 0) {
          return null;
        }

        const sortedIssues = issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
          employee,
          department,
          issues: sortedIssues,
        } satisfies CalibrationRow | null;
      })
      .filter((row): row is CalibrationRow => Boolean(row))
      .sort((a, b) => severityOrder[a.issues[0].severity] - severityOrder[b.issues[0].severity]);
  }, [departmentMap, employeeSignals, employees]);

  const prioritySpotlight = useMemo(() => calibrationRows.slice(0, 5), [calibrationRows]);

  const boxDistribution = useMemo(() => {
    const base = BOX_RENDER_ORDER.reduce<Record<string, { key: string; count: number; title: string; subtitle: string; accent: string }>>((acc, key) => {
      const meta = BOX_METADATA[key];
      acc[key] = {
        key,
        count: 0,
        title: meta.title,
        subtitle: meta.subtitle,
        accent: meta.accent,
      };
      return acc;
    }, {});

    employees.forEach(employee => {
      const key = employee.assessment?.box_key || 'unassigned';
      if (!base[key]) {
        const fallback = BOX_METADATA[key] ?? BOX_METADATA.unassigned;
        base[key] = {
          key,
          count: 0,
          title: fallback.title,
          subtitle: fallback.subtitle,
          accent: fallback.accent,
        };
      }
      base[key].count += 1;
    });

    return BOX_RENDER_ORDER.map(key => base[key]).filter(Boolean);
  }, [employees]);

  const departmentProgress = useMemo(() => {
    return departments
      .map(dept => {
        const team = employees.filter(emp => emp.department_id === dept.id);
        if (team.length === 0) return null;

        const assessed = team.filter(emp => emp.assessment).length;
        const signals = team.map(emp => employeeSignals[emp.id]);
        const reviewsPending = signals.filter(sig => sig?.pendingManagerReview || sig?.pendingSelfReview).length;
        const misaligned = signals.filter(sig => sig?.misaligned).length;
        const planGaps = signals.filter(sig => sig?.needsPlan || (sig?.overdueActions ?? 0) > 0).length;
        const plansInPlace = team.filter(emp => employeePlans[emp.id]).length;
        const coverageBase = assessed === 0 ? team.length : assessed;
        const planCoverage = coverageBase === 0 ? 0 : Math.round((plansInPlace / coverageBase) * 100);

        return {
          department: dept,
          total: team.length,
          assessed,
          reviewsPending,
          misaligned,
          planGaps,
          planCoverage,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.reviewsPending - a.reviewsPending || b.misaligned - a.misaligned);
  }, [departments, employees, employeePlans, employeeSignals]);

  const totalEmployees = employees.length;

  const stageProgress = useMemo(() => {
    if (totalEmployees === 0) return [];

    const pendingSelf = Object.values(employeeSignals).filter(signal => signal.pendingSelfReview).length;
    const pendingManager = Object.values(employeeSignals).filter(signal => signal.pendingManagerReview).length;
    const pendingCalibration = employees.filter(emp => !emp.assessment).length;
    const pendingFollowThrough = Object.values(employeeSignals).filter(signal => signal.needsPlan || signal.overdueActions > 0).length;

    return [
      {
        id: 'self',
        title: 'Self reviews',
        pending: pendingSelf,
        completed: totalEmployees - pendingSelf,
        accent: 'bg-amber-500',
        onClick: () => onJumpToPrepare(),
      },
      {
        id: 'manager',
        title: 'Manager reviews',
        pending: pendingManager,
        completed: totalEmployees - pendingManager,
        accent: 'bg-blue-500',
        onClick: () => onJumpToPrepare(),
      },
      {
        id: 'calibration',
        title: '9-box placement',
        pending: pendingCalibration,
        completed: totalEmployees - pendingCalibration,
        accent: 'bg-purple-500',
        onClick: () => onJumpToEvaluate(),
      },
      {
        id: 'follow',
        title: 'Plans & feedback',
        pending: pendingFollowThrough,
        completed: totalEmployees - pendingFollowThrough,
        accent: 'bg-indigo-500',
        onClick: () => onJumpToFollowThrough(),
      },
    ];
  }, [employeeSignals, employees, onJumpToEvaluate, onJumpToFollowThrough, onJumpToPrepare, totalEmployees]);

  const reviewQueue = useMemo(() => calibrationRows
    .filter(row => row.issues.some(issue => issue.targetView === 'prepare'))
    .slice(0, 6), [calibrationRows]);

  const alignmentQueue = useMemo(() => calibrationRows
    .filter(row => row.issues.some(issue => issue.key === 'misalignment'))
    .slice(0, 6), [calibrationRows]);

  const followThroughQueue = useMemo(() => calibrationRows
    .filter(row => row.issues.some(issue => issue.targetView === 'follow'))
    .slice(0, 6), [calibrationRows]);

  const agendaItems = useMemo(() => {
    return [
      reviewMetrics.totalPending > 0
        ? `Resolve ${reviewMetrics.totalPending} outstanding reviews (${reviewMetrics.pendingSelf} self / ${reviewMetrics.pendingManager} manager)`
        : 'Confirm every self and manager review is submitted',
      reviewMetrics.misaligned > 0
        ? `Align on ${reviewMetrics.misaligned} manager vs self rating gap${reviewMetrics.misaligned > 1 ? 's' : ''}`
        : 'Document highlights and rationale — no alignment gaps flagged',
      unassessedCount > 0
        ? `Place ${unassessedCount} remaining employee${unassessedCount > 1 ? 's' : ''} on the grid`
        : 'Spot-check recent moves and confirm placement rationale',
      planMetrics.totalFollowThrough > 0
        ? `Close out ${planMetrics.missingPlans} missing plans and ${planMetrics.pendingAck} feedback acknowledgements`
        : 'Verify development plans and follow-up commitments are on track',
    ];
  }, [planMetrics, reviewMetrics, unassessedCount]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Reviews to complete"
          value={reviewMetrics.totalPending}
          subtitle={`${reviewMetrics.pendingSelf} self · ${reviewMetrics.pendingManager} manager`}
          color="bg-amber-500"
          onClick={() => onJumpToPrepare()}
        />
        <StatCard
          icon={GitBranch}
          label="Needs placement"
          value={unassessedCount}
          subtitle="Employees without 9-box assessment"
          color="bg-blue-600"
          onClick={() => onJumpToEvaluate()}
        />
        <StatCard
          icon={ShieldAlert}
          label="Alignment alerts"
          value={reviewMetrics.misaligned}
          subtitle="Manager vs self misalignment"
          color="bg-rose-500"
          onClick={() => onJumpToEvaluate()}
        />
        <StatCard
          icon={TrendingUp}
          label="Follow-through actions"
          value={planMetrics.totalFollowThrough}
          subtitle={`${planMetrics.missingPlans} plans · ${planMetrics.pendingAck} feedback`}
          color="bg-indigo-500"
          onClick={() => onJumpToFollowThrough()}
        />
      </section>

      {stageProgress.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Calibration Readiness</h2>
              <p className="text-sm text-gray-600">See how close you are to landing the conversation for each stage.</p>
            </div>
            <Badge variant="primary" size="md">{totalEmployees} Employees</Badge>
          </header>
          <div className="px-6 py-5 grid gap-4 md:grid-cols-2">
            {stageProgress.map(stage => {
              const percent = totalEmployees === 0 ? 0 : Math.round((stage.completed / totalEmployees) * 100);
              return (
                <div key={stage.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{stage.title}</p>
                      <p className="text-xs text-gray-500">{stage.completed} completed · {stage.pending} pending</p>
                    </div>
                    <span className={`inline-flex w-8 h-8 rounded-full ${stage.accent} text-white text-xs font-bold items-center justify-center`}>
                      {percent}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <button
                    onClick={stage.onClick}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Jump to stage
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Calibration Agenda</h2>
          <p className="text-sm text-gray-600">Use this checklist to land decisions and leave with clear accountability.</p>
        </header>
        <ol className="px-6 py-5 space-y-3 list-decimal list-inside text-sm text-gray-700">
          {agendaItems.map((item, index) => (
            <li key={index} className="leading-relaxed flex items-start gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 mt-1 text-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      {prioritySpotlight.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Priority Spotlight</h2>
              <p className="text-sm text-gray-600">Start calibration here — these team members need a call before you leave the room.</p>
            </div>
            <Badge variant="warning" size="md">{prioritySpotlight.length} in focus</Badge>
          </header>
          <div className="px-6 py-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {prioritySpotlight.map(row => (
              <article key={row.employee.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <EmployeeNameLink
                      employee={row.employee}
                      className="text-base font-semibold text-gray-900 hover:text-blue-600 focus-visible:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">{row.employee.title || 'Role pending'}</p>
                  </div>
                  {row.department && (
                    <DepartmentBadge name={row.department.name} color={row.department.color} size="sm" />
                  )}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${row.issues[0].severity === 'critical' ? 'bg-rose-100 text-rose-700' : row.issues[0].severity === 'major' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {row.issues[0].label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {row.issues.slice(0, 4).map(issue => (
                    <Badge key={issue.key} variant={severityVariant[issue.severity]} size="sm">
                      {issue.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 text-xs font-semibold text-blue-600">
                  <button onClick={() => onJumpToEvaluate(row.employee.department_id ?? undefined)} className="hover:underline flex items-center gap-1">
                    Open in grid
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                  <span className="text-gray-300">•</span>
                  <button onClick={() => onJumpToFollowThrough(row.employee.department_id ?? undefined)} className="hover:underline flex items-center gap-1">
                    Update plan
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nine-Box Snapshot</h2>
              <p className="text-sm text-gray-600">Pressure-test distribution to ensure the story matches your reality.</p>
            </div>
          </header>
          <div className="px-6 py-5 grid gap-4 sm:grid-cols-2">
            {boxDistribution.map(tile => (
              <div key={tile.key} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex w-8 h-8 rounded-full ${tile.accent} text-white text-sm font-bold items-center justify-center`}>
                    {tile.count}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{tile.title}</p>
                    <p className="text-xs text-gray-500 leading-snug">{tile.subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => onJumpToEvaluate()}
                  className="text-xs text-blue-600 font-semibold hover:underline self-start flex items-center gap-1"
                >
                  Review placements
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Department Progress</h2>
              <p className="text-sm text-gray-600">Spot which teams are ready and which need prep before calibration.</p>
            </div>
          </header>
          <div className="px-6 py-5 space-y-4 max-h-[420px] overflow-y-auto">
            {departmentProgress.length === 0 ? (
              <p className="text-xs text-gray-500">No department data yet. Import teammates to unlock this panel.</p>
            ) : (
              departmentProgress.map(item => (
                <div key={item.department.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <DepartmentBadge name={item.department.name} color={item.department.color} size="sm" />
                    <span className="text-xs text-gray-500">{item.assessed}/{item.total} assessed</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${item.planCoverage}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    <Badge variant={item.reviewsPending > 0 ? 'warning' : 'neutral'} size="sm">
                      {item.reviewsPending} reviews pending
                    </Badge>
                    <Badge variant={item.misaligned > 0 ? 'danger' : 'neutral'} size="sm">
                      {item.misaligned} misaligned
                    </Badge>
                    <Badge variant={item.planGaps > 0 ? 'info' : 'neutral'} size="sm">
                      {item.planGaps} plan gaps
                    </Badge>
                    <Badge variant="primary" size="sm">
                      {item.planCoverage}% plan coverage
                    </Badge>
                  </div>
                  <button
                    onClick={() => onJumpToEvaluate(item.department.id)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Drill into this team
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reviews to Chase</h2>
              <p className="text-sm text-gray-600">Nudge these folks before your calibration huddle.</p>
            </div>
            <Badge variant="warning" size="sm">{reviewQueue.length}</Badge>
          </header>
          <div className="px-6 py-5 space-y-3">
            {reviewQueue.length === 0 ? (
              <p className="text-xs text-gray-500">All self and manager reviews are in — great job.</p>
            ) : (
              reviewQueue.map(row => (
                <article key={`${row.employee.id}-reviews`} className="border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  <EmployeeNameLink
                    employee={row.employee}
                    className="font-semibold text-gray-900 hover:text-blue-600 focus-visible:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mb-2">{row.employee.title || 'Role pending'}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {row.issues
                      .filter(issue => issue.targetView === 'prepare')
                      .map(issue => (
                        <Badge key={issue.key} variant="warning" size="sm">
                          {issue.label}
                        </Badge>
                      ))}
                  </div>
                  <button
                    onClick={() => onJumpToPrepare(row.employee.department_id ?? undefined)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Finish reviews
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Alignment Gaps</h2>
              <p className="text-sm text-gray-600">Balance the story before you confirm final ratings.</p>
            </div>
            <Badge variant="danger" size="sm">{alignmentQueue.length}</Badge>
          </header>
          <div className="px-6 py-5 space-y-3">
            {alignmentQueue.length === 0 ? (
              <p className="text-xs text-gray-500">No misalignment flagged — capture highlights and keep momentum.</p>
            ) : (
              alignmentQueue.map(row => (
                <article key={`${row.employee.id}-alignment`} className="border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  <EmployeeNameLink
                    employee={row.employee}
                    className="font-semibold text-gray-900 hover:text-blue-600 focus-visible:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mb-2">{row.employee.title || 'Role pending'}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {row.issues
                      .filter(issue => issue.key === 'misalignment')
                      .map(issue => (
                        <Badge key={issue.key} variant="danger" size="sm">
                          {issue.label}
                        </Badge>
                      ))}
                  </div>
                  <button
                    onClick={() => onJumpToEvaluate(row.employee.department_id ?? undefined)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Review placement
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Follow-Through Gaps</h2>
              <p className="text-sm text-gray-600">Assign actions and unstick overdue items after calibration.</p>
            </div>
            <Badge variant="info" size="sm">{followThroughQueue.length}</Badge>
          </header>
          <div className="px-6 py-5 space-y-3">
            {followThroughQueue.length === 0 ? (
              <p className="text-xs text-gray-500">Plans and feedback are fully covered — keep momentum going.</p>
            ) : (
              followThroughQueue.map(row => (
                <article key={`${row.employee.id}-follow`} className="border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  <EmployeeNameLink
                    employee={row.employee}
                    className="font-semibold text-gray-900 hover:text-blue-600 focus-visible:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mb-2">{row.employee.title || 'Role pending'}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {row.issues
                      .filter(issue => issue.targetView === 'follow')
                      .map(issue => (
                        <Badge key={issue.key} variant={issue.key === 'plan-overdue' ? 'warning' : 'info'} size="sm">
                          {issue.label}
                        </Badge>
                      ))}
                  </div>
                  <button
                    onClick={() => onJumpToFollowThrough(row.employee.department_id ?? undefined)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Assign follow-up
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Calibration Queue</h2>
            <p className="text-sm text-gray-600">Everything unresolved — work the list and arrive at calibration ready.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onJumpToPrepare()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Finish Reviews
            </button>
            <button
              onClick={() => onJumpToEvaluate()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Open 9-Box
            </button>
            <button
              onClick={() => onJumpToFollowThrough()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Update Plans
            </button>
          </div>
        </header>

        {calibrationRows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-500">
            <CircleCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
            Everyone is aligned — keep an eye on new reviews and plan updates as they arrive.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Attention Needed
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Next Steps
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {calibrationRows.map(({ employee, department, issues }) => {
                  const needsPrepare = issues.some(issue => issue.targetView === 'prepare');
                  const needsEvaluate = issues.some(issue => issue.targetView === 'evaluate');
                  const needsFollow = issues.some(issue => issue.targetView === 'follow');

                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <EmployeeNameLink
                            employee={employee}
                            className="text-sm font-semibold text-gray-900 hover:text-blue-600 focus-visible:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">{employee.title || 'Role pending'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {department ? (
                          <DepartmentBadge name={department.name} color={department.color} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {issues.map(issue => (
                            <Badge key={issue.key} variant={severityVariant[issue.severity]} size="sm">
                              {issue.label}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          {needsPrepare && (
                            <button
                              onClick={() => onJumpToPrepare(employee.department_id ?? undefined)}
                              className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            >
                              Finish reviews
                            </button>
                          )}
                          {needsEvaluate && (
                            <button
                              onClick={() => onJumpToEvaluate(employee.department_id ?? undefined)}
                              className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            >
                              Calibrate
                            </button>
                          )}
                          {needsFollow && (
                            <button
                              onClick={() => onJumpToFollowThrough(employee.department_id ?? undefined)}
                              className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                            >
                              Update plan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
