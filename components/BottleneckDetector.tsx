import { AlertTriangle, Send, ArrowUpRight, Calendar, Users, Zap } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { useQuickAction } from '../context/QuickActionContext';
import { useToast } from './unified';
import { getStageLabel, getStageIcon } from '../lib/workflowOrchestrator';
import type { WorkflowBottleneck } from '../types/workflow';

export default function BottleneckDetector() {
  const { bottlenecks } = useWorkflow();
  const { executeAction } = useQuickAction();
  const { notify } = useToast();

  if (bottlenecks.length === 0) return null;

  // Show only the top 2 most severe bottlenecks
  const topBottlenecks = bottlenecks.slice(0, 2);

  return (
    <div className="space-y-4">
      {topBottlenecks.map((bottleneck) => (
        <BottleneckCard
          key={bottleneck.stage}
          bottleneck={bottleneck}
          onActionClick={(action) => {
            switch (action.actionType) {
              case 'bulk-remind':
                notify({
                  type: 'info',
                  title: 'Reminders Sent',
                  message: `Reminder emails sent to ${bottleneck.employeeCount} ${action.payload.recipientType}s`,
                });
                break;
              
              case 'view-list':
                // Open filtered view of employees at this stage
                console.log('[Bottleneck] View list:', bottleneck.affectedEmployees);
                break;
              
              case 'auto-draft':
                notify({
                  type: 'success',
                  title: 'AI Plans Generating',
                  message: `Creating draft development plans for ${bottleneck.employeeCount} employees...`,
                });
                // Trigger AI plan generation
                break;
              
              case 'schedule-session':
                notify({
                  type: 'info',
                  title: 'Calibration Session',
                  message: 'Opening calendar to schedule calibration...',
                });
                break;
              
              case 'escalate':
                notify({
                  type: 'warning',
                  title: 'Escalated',
                  message: 'VP HR has been notified of the bottleneck',
                });
                break;
            }
          }}
        />
      ))}
    </div>
  );
}

interface BottleneckCardProps {
  bottleneck: WorkflowBottleneck;
  onActionClick: (action: any) => void;
}

function BottleneckCard({ bottleneck, onActionClick }: BottleneckCardProps) {
  const severityColors = {
    critical: 'from-red-500 to-red-600',
    high: 'from-orange-500 to-orange-600',
    medium: 'from-amber-500 to-amber-600',
    low: 'from-yellow-500 to-yellow-600',
  };

  const severityTextColors = {
    critical: 'text-red-900',
    high: 'text-orange-900',
    medium: 'text-amber-900',
    low: 'text-yellow-900',
  };

  const severityBgColors = {
    critical: 'bg-red-50 border-red-200',
    high: 'bg-orange-50 border-orange-200',
    medium: 'bg-amber-50 border-amber-200',
    low: 'bg-yellow-50 border-yellow-200',
  };

  return (
    <div className={`rounded-xl border ${severityBgColors[bottleneck.severity]} overflow-hidden shadow-md`}>
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${severityColors[bottleneck.severity]} text-white px-6 py-4`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide opacity-90 mb-1">
              {bottleneck.severity.toUpperCase()} BOTTLENECK
            </div>
            <h3 className="text-xl font-bold">
              {bottleneck.employeeCount} employees stuck at {getStageLabel(bottleneck.stage)}
            </h3>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Impact */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <Users className={`w-5 h-5 flex-shrink-0 mt-0.5 ${severityTextColors[bottleneck.severity]}`} />
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">Impact</div>
              <p className="text-sm text-gray-700">
                {bottleneck.impactDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-600">Avg Days Stuck</div>
            <div className={`text-2xl font-bold ${severityTextColors[bottleneck.severity]}`}>
              {bottleneck.averageDaysStuck}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-600">Employees</div>
            <div className={`text-2xl font-bold ${severityTextColors[bottleneck.severity]}`}>
              {bottleneck.employeeCount}
            </div>
          </div>
        </div>

        {/* Suggested Actions */}
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            Suggested Actions
          </div>
          <div className="space-y-2">
            {bottleneck.suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onActionClick(action)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-all group"
              >
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {action.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    {action.estimatedImpact}
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

