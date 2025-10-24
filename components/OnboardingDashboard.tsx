import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, Users, ShieldCheck } from 'lucide-react';
import type { Department, Employee } from '../types';
import PlanCardUnified, { type PlanMilestoneItem, type PlanOwnerDisplay, type PlanPhase, type PlanStatus } from './PlanCardUnified';
import { useToast } from './unified';

interface OnboardingDashboardProps {
  employees: Employee[];
  departments: Department[];
  onEmployeeClick: (employee: Employee) => void;
}

type OnboardingHealth = 'on_track' | 'at_risk' | 'behind';
interface OnboardingMilestone {
  label: string;
  dueDate: string;
  status: 'upcoming' | 'complete' | 'overdue';
  owner: 'manager' | 'buddy' | 'employee';
}

interface OnboardingPlanSummary {
  id: string;
  employee: Employee;
  startDate: string;
  targetDate: string;
  manager: string;
  buddy: string;
  progress: number;
  health: OnboardingHealth;
  milestones: OnboardingMilestone[];
  focusArea: string;
  phase: PlanPhase;
}

const HEALTH_TO_STATUS: Record<OnboardingHealth, PlanStatus> = {
  on_track: 'on-track',
  at_risk: 'needs-checkin',
  behind: 'escalate',
};

const PHASES: PlanPhase[] = ['foundation', 'integration', 'impact'];

const OWNER_LABEL: Record<OnboardingMilestone['owner'], string> = {
  manager: 'Manager',
  buddy: 'Buddy',
  employee: 'New hire'
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
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

export default function OnboardingDashboard({
  employees,
  departments: _departments,
  onEmployeeClick,
}: OnboardingDashboardProps) {
  const [focusPhase, setFocusPhase] = useState<PlanPhase | 'all'>('all');
  const { notify } = useToast();

  const fallbackNames = ['Jordan Wells', 'Priya Kapoor', 'Alex Romero'];
  const fallbackManagers = ['Amelia Stone', 'Reid Porter', 'Marina Chen'];
  const fallbackBuddies = ['Carlos Vega', 'Sierra Bell', 'Noah Patel'];

  const plans = useMemo<OnboardingPlanSummary[]>(() => {
    const baseDate = new Date();

    const selected = employees.length > 0
      ? employees
      : fallbackNames.map((name, index) => ({
          id: `seed-${index}`,
          name,
          created_at: baseDate.toISOString(),
          organization_id: 'seed-org',
          employee_id: `SEED-${index}`,
          department_id: null,
          email: null,
          manager_name: fallbackManagers[index] || fallbackManagers[0],
          title: 'New Hire',
          location: 'Remote',
          updated_at: baseDate.toISOString(),
        } as Employee));

    return selected.map((employee, index) => {
      const start = new Date(baseDate);
      start.setDate(start.getDate() - index * 8);
      const target = new Date(start);
      target.setDate(target.getDate() + 90);

      const manager = employee.manager_name || fallbackManagers[index] || fallbackManagers[0];
      const buddy = fallbackBuddies[index] || fallbackBuddies[0];

      const progress = Math.min(100, 35 + index * 20);
      const phase: PlanPhase = index % 3 === 0 ? 'foundation' : index % 3 === 1 ? 'integration' : 'impact';
      const health: OnboardingHealth = progress >= 70 ? 'on_track' : progress >= 50 ? 'at_risk' : 'behind';

      const milestones: OnboardingMilestone[] = [
        {
          label: 'Foundations 30-day check-in',
          dueDate: addDays(start, 30),
          status: progress >= 35 ? 'complete' : 'upcoming',
          owner: 'manager',
        },
        {
          label: 'Cross-functional buddy sync',
          dueDate: addDays(start, 45),
          status: index === 0 ? 'complete' : index === 1 ? 'upcoming' : 'overdue',
          owner: 'buddy',
        },
        {
          label: '60-day impact narrative',
          dueDate: addDays(start, 60),
          status: progress >= 60 ? 'complete' : 'upcoming',
          owner: 'employee',
        },
        {
          label: 'Executive showcase',
          dueDate: addDays(start, 85),
          status: 'upcoming',
          owner: 'manager',
        },
      ];

      const focusAreas = [
        'Elevate customer empathy through field ride-alongs.',
        'Own the Q3 launch readiness operating cadence.',
        'Strengthen stakeholder trust via weekly integration touchpoints.',
      ];

      return {
        id: employee.id || `onboarding-${index}`,
        employee,
        startDate: start.toISOString(),
        targetDate: target.toISOString(),
        manager,
        buddy,
        progress,
        health,
        milestones,
        focusArea: focusAreas[index % focusAreas.length],
        phase,
      };
    });
  }, [employees]);

  const filteredPlans = focusPhase === 'all'
    ? plans
    : plans.filter((plan) => plan.phase === focusPhase);

  const summary = useMemo(() => {
    const activePlans = plans.length;
    const atRisk = plans.filter(plan => plan.health !== 'on_track').length;
    const upcomingMilestones = plans
      .flatMap(plan => plan.milestones)
      .filter(milestone => milestone.status === 'upcoming').length;

    return { activePlans, atRisk, upcomingMilestones };
  }, [plans]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={Users}
          label="Active onboarding plans"
          value={summary.activePlans}
          accent="bg-blue-50 text-blue-700"
        />
        <SummaryCard
          icon={CalendarCheck}
          label="Upcoming milestones"
          value={summary.upcomingMilestones}
          accent="bg-indigo-50 text-indigo-700"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Plans needing attention"
          value={summary.atRisk}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 text-indigo-500" />
          <span>Filter by phase</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', ...PHASES] as const).map((option) => {
            const isActive = focusPhase === option;
            const label = option === 'all' ? 'All phases' : option.charAt(0).toUpperCase() + option.slice(1);
            return (
              <button
                key={option}
                onClick={() => setFocusPhase(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filteredPlans.map((plan) => {
          const milestones: PlanMilestoneItem[] = plan.milestones.map((milestone, index) => ({
            id: `${plan.id}-milestone-${index}`,
            label: milestone.label,
            dueDate: milestone.dueDate,
            owner: OWNER_LABEL[milestone.owner],
            status: milestone.status,
          }));

          const owners: PlanOwnerDisplay[] = [
            {
              role: 'Manager',
              name: plan.manager,
              onNudge: () => notify({
                title: `Nudged ${plan.manager}`,
                description: 'Sent a prep message for their next check-in.',
                variant: 'info',
              }),
            },
            {
              role: 'Buddy',
              name: plan.buddy,
              onNudge: () => notify({
                title: `Buddy nudged`,
                description: 'Shared quick tips to keep integration moving.',
                variant: 'info',
              }),
            },
            {
              role: 'New Hire',
              name: plan.employee.name,
            },
          ];

          return (
            <PlanCardUnified
              key={plan.id}
              employeeRef={plan.employee}
              employeeName={plan.employee.name}
              employeeTitle={plan.employee.title}
              planTypeLabel="Onboarding"
              status={HEALTH_TO_STATUS[plan.health]}
              progress={plan.progress}
              startDate={plan.startDate}
              targetDate={plan.targetDate}
              phase={plan.phase}
              focusSummary={plan.focusArea}
              milestones={milestones}
              owners={owners}
              onPhaseChange={(newPhase) => {
                setFocusPhase('all');
                notify({
                  title: `Phase moved to ${newPhase}`,
                  description: 'Milestones will be realigned with the new phase.',
                  variant: 'info',
                });
              }}
              onRefineFocus={() => {
                notify({
                  title: 'AI refine ready',
                  description: 'We drafted an updated onboarding focus for review.',
                  variant: 'info',
                });
                onEmployeeClick(plan.employee);
              }}
              onCompleteMilestone={() => notify({
                title: 'Milestone marked complete',
                description: 'Progress updated and next step unlocked.',
                variant: 'success',
              })}
              onNudgeMilestone={() => notify({
                title: 'Nudge sent',
                description: 'Buddy received a quick reminder.',
                variant: 'info',
              })}
              onRescheduleMilestone={() => notify({
                title: 'Rescheduled +3 days',
                description: 'Timeline adjusted and owners notified.',
                variant: 'info',
              })}
              onAddNoteToMilestone={() => notify({
                title: 'Note captured',
                description: 'Added to onboarding record.',
                variant: 'success',
              })}
              governanceActions={[
                {
                  id: 'review',
                  label: 'Review now',
                  onClick: () => onEmployeeClick(plan.employee),
                },
                {
                  id: 'objective',
                  label: 'Add objective',
                  onClick: () => onEmployeeClick(plan.employee),
                },
                {
                  id: 'request-360',
                  label: 'Request 360 signal',
                  onClick: () => notify({
                    title: '360 request queued',
                    description: 'Sent the request to the People Ops queue.',
                    variant: 'info',
                  }),
                },
                {
                  id: 'share',
                  label: 'Share update',
                  onClick: () => notify({
                    title: 'Update shared',
                    description: 'Posted onboarding progress to Slack.',
                    variant: 'success',
                  }),
                },
              ]}
            />
          );
        })}
      </div>
    </div>
  );
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone.toISOString();
}
