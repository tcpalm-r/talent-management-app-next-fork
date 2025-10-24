import { ChevronRight, Home } from 'lucide-react';
import { useQuickAction } from '../context/QuickActionContext';
import type { QuickActionPayload } from '../context/QuickActionContext';

export function BreadcrumbNav() {
  const { navigationHistory } = useQuickAction();
  
  // Only show last 3 items for cleanliness
  const recentHistory = navigationHistory.slice(-3);
  
  if (recentHistory.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b border-gray-200 text-sm">
      <Home className="w-4 h-4 text-gray-400" />
      <ChevronRight className="w-3 h-3 text-gray-400" />
      
      {recentHistory.map((action, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className={idx === recentHistory.length - 1 ? 'font-semibold text-blue-600' : 'text-gray-600'}>
            {getActionLabel(action)}
          </span>
          {idx < recentHistory.length - 1 && (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </div>
      ))}
    </nav>
  );
}

function getActionLabel(action: QuickActionPayload): string {
  const labels: Record<string, string> = {
    'create-plan': 'Create Development Plan',
    'schedule-1on1': 'Schedule 1:1 Meeting',
    'view-notes': 'Manager Notes',
    'start-pip': 'Performance Improvement Plan',
    'add-to-succession': 'Succession Pipeline',
    'open-calibration': 'Calibration Session',
    'request-360': 'Request 360 Feedback',
    'view-360': '360 Feedback Results',
    'open-employee-detail': 'Employee Details',
    'bulk-action': 'Bulk Action',
    'view-review': 'Performance Review',
    'create-review': 'Create Review',
  };
  return labels[action.type] || action.type;
}

