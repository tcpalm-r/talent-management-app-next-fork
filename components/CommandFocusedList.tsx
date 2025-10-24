import { ExternalLink, GitCompare, PinOff, Clock } from 'lucide-react';
import type { Employee } from '../types';
import { EmployeeNameLink } from './unified';

export interface CommandFocusedEntry {
  employee: Employee;
  pinnedAt: Date;
  status: 'needs-checkin' | 'on-track' | 'unpinned';
  reasons: string[];
  planProgress: number | null;
  overdueCount: number;
  urgency: number;
  highlight?: boolean;
}

interface CommandFocusedListProps {
  entries: CommandFocusedEntry[];
  compareMode: boolean;
  onToggleCompareMode: () => void;
  onOpenDetails: (employee: Employee) => void;
  onTogglePin: (employee: Employee) => void;
  className?: string;
}

const statusStyles: Record<CommandFocusedEntry['status'], { badge: string; label: string }> = {
  'needs-checkin': {
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    label: 'Needs check-in',
  },
  'on-track': {
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    label: 'On track',
  },
  unpinned: {
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    label: 'Unpinned',
  },
};

function formatPinnedAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Pinned today';
  if (diffDays === 1) return 'Pinned 1 day ago';
  if (diffDays < 7) return `Pinned ${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return 'Pinned 1 week ago';
  return `Pinned ${diffWeeks} weeks ago`;
}

export default function CommandFocusedList({
  entries,
  compareMode,
  onToggleCompareMode,
  onOpenDetails,
  onTogglePin,
  className = '',
}: CommandFocusedListProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            Focused list
          </div>
          <p className="text-xs text-slate-500">Pinned teammates you’re actively tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length >= 2 && (
            <button
              type="button"
              onClick={onToggleCompareMode}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                compareMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              title={compareMode ? 'Exit compare mode' : 'Compare pinned employees'}
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </button>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {entries.length} pinned
          </span>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Pin teammates from the People hub or watchlist to keep them within reach.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const statusStyle = statusStyles[entry.status];

            return (
              <li
                key={entry.employee.id}
                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-3 shadow-sm ${
                  entry.highlight ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <EmployeeNameLink
                      employee={entry.employee}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                      onClick={() => onOpenDetails(entry.employee)}
                    />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle.badge}`}>
                      {statusStyle.label}
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

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatPinnedAgo(entry.pinnedAt)}
                    </span>
                    {entry.planProgress !== null && (
                      <span className="inline-flex items-center gap-1">
                        Plan {entry.planProgress}%
                      </span>
                    )}
                    {entry.overdueCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        {entry.overdueCount} overdue
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(entry.employee)}
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    title="Open details"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  {entries.length >= 2 && (
                    <button
                      type="button"
                      onClick={onToggleCompareMode}
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      title={compareMode ? 'Exit compare mode' : 'Compare pinned employees'}
                    >
                      <GitCompare className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onTogglePin(entry.employee)}
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    title="Unpin"
                  >
                    <PinOff className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
