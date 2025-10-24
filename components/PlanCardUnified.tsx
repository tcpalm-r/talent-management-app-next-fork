import { useMemo } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, Megaphone, CalendarClock, StickyNote, Wand2 } from 'lucide-react';
import type { Employee } from '../types';
import { EmployeeNameLink } from './unified';
export type PlanPhase = 'foundation' | 'integration' | 'impact';
export type PlanStatus = 'on-track' | 'needs-checkin' | 'escalate';

export interface PlanOwnerDisplay {
  role: string;
  name: string;
  options?: string[];
  onReassign?: (newOwner: string) => void;
  onNudge?: () => void;
}

export interface PlanMilestoneItem {
  id: string;
  label: string;
  dueDate?: string;
  owner: string;
  status: 'upcoming' | 'complete' | 'overdue';
}

export interface PlanCardUnifiedProps {
  employeeRef?: Pick<Employee, 'id' | 'name'> | null;
  employeeName: string;
  employeeTitle?: string | null;
  planTypeLabel?: string;
  status: PlanStatus;
  progress: number;
  startDate: string;
  targetDate: string;
  phase: PlanPhase;
  onPhaseChange?: (phase: PlanPhase) => void;
  focusSummary: string;
  onRefineFocus?: () => void;
  milestones: PlanMilestoneItem[];
  owners: PlanOwnerDisplay[];
  onCompleteMilestone?: (milestoneId: string) => void;
  onNudgeMilestone?: (milestoneId: string) => void;
  onRescheduleMilestone?: (milestoneId: string) => void;
  onAddNoteToMilestone?: (milestoneId: string) => void;
  governanceActions?: Array<{ id: string; label: string; onClick: () => void }>;
}

const statusStyles: Record<PlanStatus, { badge: string; border: string }> = {
  'on-track': {
    badge: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
  },
  'needs-checkin': {
    badge: 'bg-amber-100 text-amber-700',
    border: 'border-amber-200',
  },
  escalate: {
    badge: 'bg-rose-100 text-rose-700',
    border: 'border-rose-200',
  },
};

const phaseLabels: Record<PlanPhase, string> = {
  foundation: 'Foundation',
  integration: 'Integration',
  impact: 'Impact',
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const endOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, startOptions)} → ${endDate.toLocaleDateString(undefined, endOptions)}`;
}

function formatDueDate(date?: string): string {
  if (!date) return 'No due date';
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProgressRing({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <svg className="h-20 w-20" viewBox="0 0 64 64">
      <circle
        className="text-slate-200"
        stroke="currentColor"
        strokeWidth="6"
        fill="transparent"
        r={radius}
        cx="32"
        cy="32"
      />
      <circle
        className="text-blue-500"
        stroke="currentColor"
        strokeWidth="6"
        fill="transparent"
        r={radius}
        cx="32"
        cy="32"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        className="fill-slate-900 text-sm font-semibold"
      >
        {normalized}%
      </text>
    </svg>
  );
}

export default function PlanCardUnified({
  employeeName,
  employeeTitle,
  planTypeLabel,
  status,
  progress,
  startDate,
  targetDate,
  phase,
  onPhaseChange,
  focusSummary,
  onRefineFocus,
  milestones,
  owners,
  onCompleteMilestone,
  onNudgeMilestone,
  onRescheduleMilestone,
  onAddNoteToMilestone,
  governanceActions,
}: PlanCardUnifiedProps) {
  const statusStyle = statusStyles[status];
  const formattedRange = useMemo(() => formatDateRange(startDate, targetDate), [startDate, targetDate]);

  const actions = governanceActions ?? [
    { id: 'review', label: 'Review now', onClick: () => {} },
    { id: 'objective', label: 'Add objective', onClick: () => {} },
    { id: 'request-360', label: 'Request 360 signal', onClick: () => {} },
    { id: 'share', label: 'Share update', onClick: () => {} },
  ];

  return (
    <article className={`flex flex-col gap-5 rounded-2xl border bg-white p-6 shadow-sm ${statusStyle.border}`.trim()}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <EmployeeNameLink
              employee={employeeRef ?? undefined}
              name={employeeName}
              className="text-lg font-semibold text-slate-900 hover:text-blue-600"
            />
            {planTypeLabel && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {planTypeLabel}
              </span>
            )}
          </div>
          {employeeTitle && (
            <p className="text-xs text-slate-500">{employeeTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.badge}`}>
              {status === 'on-track' && 'On Track'}
              {status === 'needs-checkin' && 'Needs Check-in'}
              {status === 'escalate' && 'Escalate'}
            </div>
            <p className="mt-2 text-xs text-slate-500">{formattedRange}</p>
          </div>
          <ProgressRing value={progress} />
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Current emphasis
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {(['foundation', 'integration', 'impact'] as PlanPhase[]).map((phaseKey) => {
              const isActive = phaseKey === phase;
              return (
                <button
                  key={phaseKey}
                  type="button"
                  onClick={() => onPhaseChange?.(phaseKey)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {phaseLabels[phaseKey]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">{focusSummary}</p>
          {onRefineFocus && (
            <button
              type="button"
              onClick={onRefineFocus}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Refine with AI
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
          <span>Milestone timeline</span>
          <span className="text-slate-400">{milestones.length} checkpoints</span>
        </div>
        <ul className="space-y-2">
          {milestones.map((milestone) => {
            const completed = milestone.status === 'complete';
            const overdue = milestone.status === 'overdue';
            return (
              <li
                key={milestone.id}
                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                  completed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : overdue
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${completed ? 'text-emerald-600' : overdue ? 'text-rose-500' : 'text-slate-300'}`} />
                    <span className="font-semibold">{milestone.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">Owner: {milestone.owner}</span>
                    <span className={overdue ? 'text-rose-600' : 'text-slate-500'}>{formatDueDate(milestone.dueDate)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {onCompleteMilestone && !completed && (
                    <button
                      type="button"
                      onClick={() => onCompleteMilestone(milestone.id)}
                      className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white"
                      title="Mark complete"
                    >
                      Done
                    </button>
                  )}
                  {onNudgeMilestone && (
                    <button
                      type="button"
                      onClick={() => onNudgeMilestone(milestone.id)}
                      className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white"
                      title="Nudge owner"
                    >
                      <Megaphone className="mr-1 inline-block h-3.5 w-3.5" />
                      Nudge
                    </button>
                  )}
                  {onRescheduleMilestone && (
                    <button
                      type="button"
                      onClick={() => onRescheduleMilestone(milestone.id)}
                      className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white"
                      title="Reschedule (+3d)"
                    >
                      <CalendarClock className="mr-1 inline-block h-3.5 w-3.5" />
                      +3d
                    </button>
                  )}
                  {onAddNoteToMilestone && (
                    <button
                      type="button"
                      onClick={() => onAddNoteToMilestone(milestone.id)}
                      className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white"
                      title="Add note"
                    >
                      <StickyNote className="mr-1 inline-block h-3.5 w-3.5" />
                      Note
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {owners.map(({ role, name, options, onReassign, onNudge }) => (
            <div
              key={role}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{role}</span>
              {options && onReassign ? (
                <select
                  defaultValue={name}
                  onChange={(event) => onReassign(event.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold text-slate-700">{name}</span>
              )}
              {onNudge && (
                <button
                  type="button"
                  onClick={onNudge}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-600 shadow-sm"
                >
                  Nudge
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))}
      </footer>
    </article>
  );
}
