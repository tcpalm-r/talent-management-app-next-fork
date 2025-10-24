import { AlertTriangle, Zap, Users, Clock, XCircle, CheckCircle2 } from 'lucide-react';

export interface AIGuidanceItem {
  id: string;
  title: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: 'individual' | 'team' | 'org';
  signal: string;
  onApply: () => void;
  onSnooze?: (duration: string) => void;
  onAssign?: (owner: string) => void;
  onDismiss?: (reason: string) => void;
}

interface AIGuidancePanelProps {
  heading: string;
  description: string;
  items: AIGuidanceItem[];
}

const severityStyles: Record<AIGuidanceItem['severity'], { badge: string; label: string }> = {
  critical: {
    badge: 'bg-rose-100 text-rose-700',
    label: 'Critical',
  },
  high: {
    badge: 'bg-amber-100 text-amber-700',
    label: 'High',
  },
  medium: {
    badge: 'bg-blue-100 text-blue-700',
    label: 'Medium',
  },
  low: {
    badge: 'bg-slate-100 text-slate-600',
    label: 'Low',
  },
};

const impactLabels: Record<AIGuidanceItem['impact'], string> = {
  individual: 'Individual impact',
  team: 'Team impact',
  org: 'Org impact',
};

export default function AIGuidancePanel({ heading, description, items }: AIGuidancePanelProps) {
  if (items.length === 0) return null;

  return (
    <aside className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
          <Zap className="h-4 w-4" />
          {heading}
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </header>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${severityStyles[item.severity].badge}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {severityStyles[item.severity].label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                  <Users className="h-3 w-3" />
                  {impactLabels[item.impact]}
                </span>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-600">{item.summary}</p>

            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              {item.signal}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={item.onApply}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 font-semibold text-white transition hover:bg-blue-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Apply
              </button>
              {item.onSnooze && (
                <button
                  type="button"
                  onClick={() => {
                    const duration = window.prompt('Snooze until?', '3 days');
                    if (duration) { const snooze = item.onSnooze; if (snooze) snooze(duration); }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Snooze
                </button>
              )}
              {item.onAssign && (
                <button
                  type="button"
                  onClick={() => {
                    const owner = window.prompt('Assign to (name or team)?', currentUserSuggestion());
                    if (owner) { const assign = item.onAssign; if (assign) assign(owner); }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Assign
                </button>
              )}
              {item.onDismiss && (
                <button
                  type="button"
                  onClick={() => {
                    const reason = window.prompt('Why dismiss this suggestion?', 'Handled elsewhere');
                    if (reason) { const dismiss = item.onDismiss; if (dismiss) dismiss(reason); }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function currentUserSuggestion() {
  if (typeof window === 'undefined') return '';
  const name = window.localStorage.getItem('ai-helper-assignee');
  return name ?? '';
}
