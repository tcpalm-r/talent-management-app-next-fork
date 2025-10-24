import { useMemo } from 'react';
import { Target, AlertTriangle, TrendingUp, ClipboardList } from 'lucide-react';
import type { Employee, Department, EmployeePlan } from '../types';
import { calculatePlanProgress, getOverdueActionItems } from '../lib/actionItemGenerator';
import PlanCardUnified, { type PlanMilestoneItem, type PlanOwnerDisplay, type PlanPhase, type PlanStatus } from './PlanCardUnified';
import { useToast } from './unified';

interface PlansDashboardProps {
  employees: Employee[];
  departments: Department[];
  employeePlans: Record<string, EmployeePlan>;
  onEmployeeClick?: (employee: Employee) => void;
  onOpenPlanModal?: (employee: Employee) => void;
}

interface ComputedPlanCard {
  employee: Employee;
  status: PlanStatus;
  progress: number;
  startDate: string;
  targetDate: string;
  phase: PlanPhase;
  focusSummary: string;
  milestones: PlanMilestoneItem[];
  owners: PlanOwnerDisplay[];
  planTypeLabel: string;
}

const PHASE_ORDER: PlanPhase[] = ['foundation', 'integration', 'impact'];

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function PlansDashboard({
  employees,
  departments: _departments,
  employeePlans,
  onEmployeeClick,
  onOpenPlanModal,
}: PlansDashboardProps) {
  const { notify } = useToast();

  const plans = useMemo<ComputedPlanCard[]>(() => {
    return employees
      .map((employee) => {
        const plan = employeePlans[employee.id];
        if (!plan) return null;

        const progress = typeof plan.progress_percentage === 'number'
          ? plan.progress_percentage
          : calculatePlanProgress(plan.action_items || []);

        const overdueItems = getOverdueActionItems(plan.action_items || []);

        let status: PlanStatus = 'on-track';
        if (overdueItems.length > 1 || progress < 30) {
          status = 'escalate';
        } else if (overdueItems.length === 1 || progress < 60) {
          status = 'needs-checkin';
        }

        const startDate = plan.created_at;
        const targetDate = plan.next_review_date ?? addDays(new Date(plan.created_at), 90);

        const phase: PlanPhase = progress < 35 ? 'foundation' : progress < 70 ? 'integration' : 'impact';

        const milestones: PlanMilestoneItem[] = (plan.milestones ?? plan.action_items?.slice(0, 5) ?? []).map((item, index) => {
          const id = plan.milestones ? item.id : plan.action_items[index]?.id ?? `${plan.id}-action-${index}`;
          const label = plan.milestones ? item.title : plan.action_items[index]?.description ?? `Action ${index + 1}`;
          const dueDate = plan.milestones ? item.targetDate : plan.action_items[index]?.dueDate;

          let milestoneStatus: 'upcoming' | 'complete' | 'overdue' = 'upcoming';
          if (plan.milestones) {
            milestoneStatus = item.completed ? 'complete' : new Date(dueDate ?? '') < new Date() ? 'overdue' : 'upcoming';
          } else {
            const action = plan.action_items[index];
            if (action?.status === 'completed') milestoneStatus = 'complete';
            else if (action?.status === 'overdue') milestoneStatus = 'overdue';
          }

          return {
            id,
            label,
            dueDate,
            owner: plan.action_items?.[index]?.owner ?? employee.manager_name ?? 'Manager',
            status: milestoneStatus,
          };
        });

        const owners: PlanOwnerDisplay[] = [
          {
            role: 'Manager',
            name: employee.manager_name ?? 'Manager',
            onNudge: () => notify({
              title: `Reminder queued for ${employee.manager_name ?? 'manager'}`,
              description: `We’ll remind them to follow up with ${employee.name}.`,
              variant: 'info',
            }),
          },
          {
            role: employee.name,
            name: 'Employee',
          },
        ];

        const focusSummary = plan.objectives?.[0] ?? 'Use this plan to turn feedback into momentum.';

        return {
          employee,
          status,
          progress,
          startDate,
          targetDate,
          phase,
          focusSummary,
          milestones,
          owners,
          planTypeLabel: plan.plan_type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        } satisfies ComputedPlanCard;
      })
      .filter(Boolean) as ComputedPlanCard[];
  }, [employees, employeePlans, notify]);

  const employeesWithoutPlan = useMemo(() => {
    return employees.filter((employee) => employee.assessment && !employeePlans[employee.id]);
  }, [employees, employeePlans]);

  const summary = useMemo(() => {
    const assessed = employees.filter((employee) => employee.assessment).length;
    const withPlans = plans.length;
    const coverage = assessed > 0 ? Math.round((withPlans / assessed) * 100) : 0;

    const overdueActions = plans.reduce((count, plan) => {
      return count + plan.milestones.filter((milestone) => milestone.status === 'overdue').length;
    }, 0);

    return {
      assessed,
      withPlans,
      coverage,
      overdueActions,
    };
  }, [employees, plans]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Target} label="Assessed talent" value={`${summary.assessed}`} accent="bg-blue-50 text-blue-700" />
        <SummaryCard icon={ClipboardList} label="Active plans" value={`${summary.withPlans}`} accent="bg-emerald-50 text-emerald-700" />
        <SummaryCard icon={TrendingUp} label="Plan coverage" value={`${summary.coverage}%`} accent="bg-indigo-50 text-indigo-700" />
        <SummaryCard icon={AlertTriangle} label="Overdue actions" value={`${summary.overdueActions}`} accent="bg-amber-50 text-amber-700" />
      </div>

      <div className="space-y-5">
        {plans.map((planCard) => (
          <PlanCardUnified
            key={planCard.employee.id}
            employeeRef={planCard.employee}
            employeeName={planCard.employee.name}
            employeeTitle={planCard.employee.title}
            planTypeLabel={planCard.planTypeLabel}
            status={planCard.status}
            progress={planCard.progress}
            startDate={planCard.startDate}
            targetDate={planCard.targetDate}
            phase={planCard.phase}
            focusSummary={planCard.focusSummary}
            milestones={planCard.milestones}
            owners={planCard.owners}
            onPhaseChange={(newPhase) => {
              notify({
                title: `Phase changed to ${newPhase}`,
                description: `${planCard.employee.name}'s milestones will be suggested again with AI.`,
                variant: 'info',
              });
            }}
            onRefineFocus={() => {
              notify({
                title: 'AI refine ready',
                description: `We’ll reopen the plan builder for ${planCard.employee.name} with updated prompts.`,
                variant: 'info',
              });
              onOpenPlanModal?.(planCard.employee);
            }}
            onCompleteMilestone={(id) => {
              notify({
                title: 'Milestone marked complete',
                description: `Logged completion for ${planCard.employee.name}.`,
                variant: 'success',
              });
            }}
            onNudgeMilestone={(id) => {
              notify({
                title: 'Nudge sent',
                description: `Owner nudged with context for ${planCard.employee.name}.`,
                variant: 'info',
              });
            }}
            onRescheduleMilestone={(id) => {
              notify({
                title: 'Milestone moved',
                description: 'Deadline pushed out by 3 days.',
                variant: 'info',
              });
            }}
            onAddNoteToMilestone={(id) => {
              notify({
                title: 'Note added',
                description: 'Captured an update on progress.',
                variant: 'success',
              });
            }}
            governanceActions={[
              {
                id: 'review',
                label: 'Review now',
                onClick: () => onEmployeeClick?.(planCard.employee),
              },
              {
                id: 'objective',
                label: 'Add objective',
                onClick: () => onOpenPlanModal?.(planCard.employee),
              },
              {
                id: 'request-360',
                label: 'Request 360 signal',
                onClick: () => notify({
                  title: '360 request queued',
                  description: 'We’ll spin up a 360 request template for you.',
                  variant: 'info',
                }),
              },
              {
                id: 'share',
                label: 'Share update',
                onClick: () => notify({
                  title: 'Update shared',
                  description: 'Posted a quick update to the plan channel.',
                  variant: 'success',
                }),
              },
            ]}
          />
        ))}

        {employeesWithoutPlan.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 shadow-inner">
            <h4 className="text-md font-semibold text-slate-900">{employeesWithoutPlan.length} teammates need plans</h4>
            <p className="mt-2 text-sm text-slate-600">
              Convert calibration decisions into action. Launch the plan builder to generate objectives, cadence, and owners in seconds.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {employeesWithoutPlan.slice(0, 6).map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onOpenPlanModal?.(employee)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                >
                  Draft for {employee.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
