import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useContext } from 'react';
import { getStageLabelShort, getStageIcon } from '../lib/workflowOrchestrator';
import { WorkflowContext } from '../context/WorkflowContext';

interface WorkflowProgressWidgetProps {
  employeeId: string;
  variant?: 'full' | 'compact' | 'minimal';
}

/**
 * WorkflowProgressWidget
 * 
 * Shows an employee's current position in the talent workflow
 * Can be embedded in employee cards across the app
 * 
 * Note: Only displays when WorkflowProvider is available in context
 */
export default function WorkflowProgressWidget({ 
  employeeId, 
  variant = 'full' 
}: WorkflowProgressWidgetProps) {
  // Check if WorkflowContext is available (optional dependency)
  const workflowContext = useContext(WorkflowContext);
  
  // If no workflow context (not on Workflow tab), don't render
  if (!workflowContext) return null;
  
  const workflow = workflowContext.getEmployeeWorkflow(employeeId);

  if (!workflow) return null;

  const currentStep = workflow.steps[workflow.currentStepIndex];
  const daysInStage = currentStep?.daysInStage || 0;

  // Minimal variant - just icon and progress
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span>{getStageIcon(workflow.currentStage)}</span>
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${workflow.overallProgress}%` }}
          />
        </div>
        <span className="text-gray-600 font-medium">{workflow.overallProgress}%</span>
      </div>
    );
  }

  // Compact variant - progress bar with stage
  if (variant === 'compact') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            {getStageIcon(workflow.currentStage)} {getStageLabelShort(workflow.currentStage)}
          </span>
          <span className="font-semibold text-gray-900">
            {workflow.currentStepIndex + 1}/7
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              workflow.isStuck ? 'bg-red-500' :
              workflow.overallProgress >= 80 ? 'bg-green-500' :
              workflow.overallProgress >= 50 ? 'bg-blue-500' :
              'bg-amber-500'
            }`}
            style={{ width: `${workflow.overallProgress}%` }}
          />
        </div>
        {daysInStage > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{daysInStage}d in stage</span>
            {workflow.isStuck && (
              <span className="ml-1 text-red-600 font-medium">⚠️</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full variant - detailed progress
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStageIcon(workflow.currentStage)}</span>
          <span className="text-sm font-semibold text-gray-900">
            Workflow Progress
          </span>
        </div>
        <div className="text-xs font-medium text-gray-600">
          Step {workflow.currentStepIndex + 1}/7
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Overall</span>
          <span className="text-xs font-bold text-gray-900">
            {workflow.overallProgress}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              workflow.isStuck ? 'bg-red-500' :
              workflow.overallProgress >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
              workflow.overallProgress >= 50 ? 'bg-gradient-to-r from-blue-500 to-purple-500' :
              'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${workflow.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Current Stage */}
      <div className={`p-2 rounded-lg border ${
        workflow.isStuck ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">
            Current: {getStageLabelShort(workflow.currentStage)}
          </span>
          {workflow.isStuck && (
            <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Stuck
            </div>
          )}
        </div>
        
        {daysInStage > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{daysInStage} day{daysInStage !== 1 ? 's' : ''} in stage</span>
          </div>
        )}

        {/* Next Action */}
        {currentStep?.nextAction && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-700 flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-blue-600" />
              <span className="font-medium">Next: </span>
              <span>{currentStep.nextAction}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mini Stage Indicators */}
      <div className="mt-3 flex justify-between items-center">
        {workflow.steps.map((step, idx) => {
          const Icon = 
            step.status === 'completed' ? CheckCircle :
            step.status === 'current' ? Clock :
            step.status === 'blocked' ? AlertTriangle :
            null;

          const color =
            step.status === 'completed' ? 'text-green-500' :
            step.status === 'current' ? 'text-blue-500' :
            step.status === 'blocked' ? 'text-red-500' :
            'text-gray-300';

          return (
            <div 
              key={step.stage} 
              className="flex flex-col items-center"
              title={`${getStageLabelShort(step.stage)}: ${step.status}`}
            >
              {Icon && <Icon className={`w-3 h-3 ${color}`} />}
              {!Icon && (
                <div className={`w-2 h-2 rounded-full ${
                  step.status === 'upcoming' ? 'bg-gray-300' : 'bg-gray-400'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

