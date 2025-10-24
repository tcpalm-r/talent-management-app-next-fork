import { AlertTriangle, ArrowUpRight, ClipboardList, Pin } from 'lucide-react';
import type { Employee } from '../types';
import { EmployeeNameLink } from './unified';

export interface CommandWatchlistEntry {
  employee: Employee;
  riskScore: number;
  severity: 'critical' | 'high' | 'attention';
  reasons: string[];
}

interface CommandWatchlistProps {
  entries: CommandWatchlistEntry[];
  onOpenDetails: (employee: Employee) => void;
  onCreatePlan?: (employee: Employee) => void;
  onPin?: (employee: Employee) => void;
  className?: string;
}

const severityStyles: Record<CommandWatchlistEntry['severity'], { badge: string; label: string }> = {
  critical: {
    badge: 'bg-rose-100 text-rose-700 border border-rose-200',
    label: 'Critical',
  },
  high: {
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    label: 'High',
  },
  attention: {
    badge: 'bg-sky-100 text-sky-700 border border-sky-200',
    label: 'Attention',
  },
};

export default function CommandWatchlist({
  entries,
  onOpenDetails,
  onCreatePlan,
  onPin,
  className = '',
}: CommandWatchlistProps) {
  const visibleEntries = entries.slice(0, 5);

  return (
    <section className={`space-y-4 ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            AI Watchlist
          </div>
          <p className="text-xs text-slate-500">
            Highest-risk teammates based on tenure, performance, and plan signals.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {entries.length} flagged
        </span>
      </header>

      {visibleEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          All clear. No active retention or onboarding risks right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleEntries.map((entry) => {
            const severityStyle = severityStyles[entry.severity];

            return (
              <li
                key={entry.employee.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <EmployeeNameLink
                      employee={entry.employee}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                      onClick={() => onOpenDetails(entry.employee)}
                    />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityStyle.badge}`}>
                      {severityStyle.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityStyle.badge}`}>
                    Score {entry.riskScore}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(entry.employee)}
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      title="Open details"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                    {onCreatePlan && (
                      <button
                        type="button"
                        onClick={() => onCreatePlan(entry.employee)}
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title="Generate plan"
                      >
                        <ClipboardList className="h-4 w-4" />
                      </button>
                    )}
                    {onPin && (
                      <button
                        type="button"
                        onClick={() => onPin(entry.employee)}
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title="Pin to focus bar"
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
