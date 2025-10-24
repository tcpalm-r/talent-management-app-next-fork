import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface CommandTaskItem {
  id: string;
  label: string;
  count: number;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionLabel: string;
  onAction: () => void;
}

interface CommandTaskInboxProps {
  items: CommandTaskItem[];
  focus: 'overview' | 'attention';
  onFocusChange: (focus: 'overview' | 'attention') => void;
  className?: string;
}

const severityAccent: Record<CommandTaskItem['severity'], string> = {
  critical: 'text-rose-600',
  high: 'text-amber-600',
  medium: 'text-blue-600',
  low: 'text-slate-400',
};

const severityBadge: Record<CommandTaskItem['severity'], string> = {
  critical: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

export default function CommandTaskInbox({
  items,
  focus,
  onFocusChange,
  className = '',
}: CommandTaskInboxProps) {
  const filteredItems = focus === 'attention'
    ? items.filter((item) => item.count > 0 && (item.severity === 'critical' || item.severity === 'high' || item.severity === 'medium'))
    : items;

  return (
    <section className={`space-y-4 ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertCircle className="h-4 w-4 text-rose-500" />
            What needs my attention
          </div>
          <p className="text-xs text-slate-500">Use AI signals to clear bottlenecks across reviews, plans, and 360s.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onFocusChange('overview')}
            className={`rounded-full px-3 py-1 transition ${focus === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => onFocusChange('attention')}
            className={`rounded-full px-3 py-1 transition ${focus === 'attention' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Needs attention
          </button>
        </div>
      </header>

      {filteredItems.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Nothing urgent right now. Keep the cadence going!
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-semibold ${severityAccent[item.severity]}`}>
                    {item.count}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.description}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadge[item.severity]}`}>
                  {item.severity === 'critical' ? 'Critical' : item.severity === 'high' ? 'High' : item.severity === 'medium' ? 'Medium' : 'Low'} priority
                </span>
              </div>

              <button
                type="button"
                onClick={item.onAction}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                {item.actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
