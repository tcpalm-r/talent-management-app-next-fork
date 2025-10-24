import { useMemo, useState } from 'react';
import { Users, Clock, TrendingUp, AlertTriangle, ChevronRight, Zap, Filter, BarChart3 } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { useQuickAction } from '../context/QuickActionContext';
import { useEmployeeFocus } from '../context/EmployeeFocusContext';
import type { WorkflowStage, EmployeeWorkflow } from '../types/workflow';
import { getStageLabel, getStageLabelShort, getStageIcon, getStageColor } from '../lib/workflowOrchestrator';
import BottleneckDetector from './BottleneckDetector';

const ALL_STAGES: WorkflowStage[] = [
  'assess',
  'self-review',
  'manager-review',
  'calibrate',
  'plan',
  'execute-30',
  'monitor-90',
];

export default function WorkflowDashboard() {
  const { workflows, bottlenecks, velocityMetrics, isLoading } = useWorkflow();
  const { executeAction } = useQuickAction();
  const { pinEmployee } = useEmployeeFocus();
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);

  const workflowsByStage = useMemo(() => {
    const byStage: Record<WorkflowStage, EmployeeWorkflow[]> = {
      'assess': [],
      'self-review': [],
      'manager-review': [],
      'calibrate': [],
      'plan': [],
      'execute-30': [],
      'monitor-90': [],
    };

    Array.from(workflows.values()).forEach(workflow => {
      byStage[workflow.currentStage].push(workflow);
    });

    // Sort by days in stage (descending - most stuck first)
    Object.keys(byStage).forEach(stage => {
      byStage[stage as WorkflowStage].sort((a, b) => {
        const aDays = a.steps[a.currentStepIndex]?.daysInStage || 0;
        const bDays = b.steps[b.currentStepIndex]?.daysInStage || 0;
        return bDays - aDays;
      });
    });

    return byStage;
  }, [workflows]);

  const totalEmployees = workflows.size;
  const stuckEmployees = Array.from(workflows.values()).filter(w => w.isStuck).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Calculating workflows...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Talent Workflow Pipeline</h2>
        <p className="text-gray-600 mt-2">
          Track every employee through the complete talent management cycle
        </p>
      </div>

      {/* Bottleneck Alerts */}
      {bottlenecks.length > 0 && <BottleneckDetector />}

      {/* Velocity Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <VelocityCard
          label="Avg Time to Plan"
          value={`${velocityMetrics.averageTimeToPlan}d`}
          target="14d"
          status={velocityMetrics.averageTimeToPlan <= 14 ? 'good' : 'needs-improvement'}
          icon={TrendingUp}
        />
        <VelocityCard
          label="Complete Cycle"
          value={`${velocityMetrics.averageCompleteCycle}d`}
          target="90d"
          status={velocityMetrics.averageCompleteCycle <= 90 ? 'good' : 'needs-improvement'}
          icon={BarChart3}
        />
        <VelocityCard
          label="Completion Rate"
          value={`${velocityMetrics.completionRate}%`}
          target="80%"
          status={velocityMetrics.completionRate >= 80 ? 'good' : 'needs-improvement'}
          icon={Users}
        />
        <VelocityCard
          label="Stuck Employees"
          value={velocityMetrics.stuckCount}
          target="<5"
          status={velocityMetrics.stuckCount < 5 ? 'good' : 'critical'}
          icon={AlertTriangle}
        />
      </div>

      {/* Pipeline Overview Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pipeline Overview</h3>
          <div className="text-sm text-gray-600">
            {totalEmployees} total employees • {stuckEmployees} stuck &gt;14 days
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {ALL_STAGES.map(stage => {
            const count = workflowsByStage[stage].length;
            const percentage = totalEmployees > 0 ? (count / totalEmployees) * 100 : 0;
            
            return (
              <div
                key={stage}
                className="text-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setSelectedStage(selectedStage === stage ? null : stage)}
              >
                <div className="text-2xl mb-1">{getStageIcon(stage)}</div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {getStageLabelShort(stage)}
                </div>
                <div className="text-lg font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-500">{Math.round(percentage)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Workflow Stages</h3>
            {selectedStage && (
              <button
                onClick={() => setSelectedStage(null)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Filter className="w-4 h-4" />
                Clear filter
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 xl:grid-cols-7 gap-4">
            {ALL_STAGES.map(stage => (
              <WorkflowColumn
                key={stage}
                stage={stage}
                workflows={workflowsByStage[stage]}
                isFiltered={selectedStage === stage}
                onEmployeeClick={(workflow) => {
                  executeAction({
                    type: 'open-employee-detail',
                    employeeId: workflow.employeeId,
                  });
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected Stage Detail */}
      {selectedStage && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {getStageIcon(selectedStage)} {getStageLabel(selectedStage)} - {workflowsByStage[selectedStage].length} Employees
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workflowsByStage[selectedStage].map(workflow => (
              <WorkflowEmployeeCard
                key={workflow.employeeId}
                workflow={workflow}
                onClick={() => {
                  executeAction({
                    type: 'open-employee-detail',
                    employeeId: workflow.employeeId,
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Workflow Column Component
 */
interface WorkflowColumnProps {
  stage: WorkflowStage;
  workflows: EmployeeWorkflow[];
  isFiltered: boolean;
  onEmployeeClick: (workflow: EmployeeWorkflow) => void;
}

function WorkflowColumn({ stage, workflows, isFiltered, onEmployeeClick }: WorkflowColumnProps) {
  const stageColor = getStageColor(stage);
  const count = workflows.length;
  
  // Calculate average days in this stage
  const avgDays = workflows.length > 0
    ? Math.round(
        workflows.reduce((sum, w) => sum + (w.steps[w.currentStepIndex]?.daysInStage || 0), 0) / workflows.length
      )
    : 0;

  // Detect if this column has issues
  const hasIssues = count >= 10 || avgDays > 14;

  return (
    <div className={`rounded-lg border-2 ${
      isFiltered ? 'border-blue-500 bg-blue-50' :
      hasIssues ? 'border-red-200 bg-red-50' :
      'border-gray-200 bg-gray-50'
    } transition-all`}>
      {/* Column Header */}
      <div className={`px-3 py-2 border-b ${
        hasIssues ? 'border-red-200 bg-red-100' : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getStageIcon(stage)}</span>
            <span className="text-sm font-semibold text-gray-900">
              {getStageLabelShort(stage)}
            </span>
          </div>
          <span className={`text-lg font-bold ${
            hasIssues ? 'text-red-600' : 'text-gray-700'
          }`}>
            {count}
          </span>
        </div>
        {avgDays > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{avgDays}d avg</span>
          </div>
        )}
      </div>

      {/* Employee Cards */}
      <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
        {workflows.slice(0, 5).map(workflow => (
          <div
            key={workflow.employeeId}
            onClick={() => onEmployeeClick(workflow)}
            className="bg-white rounded border border-gray-200 p-2 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 truncate flex-1">
                {workflow.employeeName}
              </span>
              {workflow.isStuck && (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="w-3 h-3" />
              <span>{workflow.steps[workflow.currentStepIndex]?.daysInStage || 0}d</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </div>
          </div>
        ))}
        
        {workflows.length > 5 && (
          <button className="w-full text-xs text-gray-600 hover:text-gray-900 py-2 font-medium">
            +{workflows.length - 5} more
          </button>
        )}
        
        {workflows.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-xs">
            No employees
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Velocity Metric Card
 */
interface VelocityCardProps {
  label: string;
  value: string | number;
  target: string;
  status: 'good' | 'needs-improvement' | 'critical';
  icon: any;
}

function VelocityCard({ label, value, target, status, icon: Icon }: VelocityCardProps) {
  const colorMap = {
    good: 'bg-green-50 border-green-200 text-green-700',
    'needs-improvement': 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-red-50 border-red-200 text-red-700',
  };

  const iconColorMap = {
    good: 'text-green-600',
    'needs-improvement': 'text-amber-600',
    critical: 'text-red-600',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <Icon className={`w-5 h-5 ${iconColorMap[status]}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-75">Target: {target}</div>
    </div>
  );
}

/**
 * Workflow Employee Card (for selected stage view)
 */
interface WorkflowEmployeeCardProps {
  workflow: EmployeeWorkflow;
  onClick: () => void;
}

function WorkflowEmployeeCard({ workflow, onClick }: WorkflowEmployeeCardProps) {
  const currentStep = workflow.steps[workflow.currentStepIndex];
  const daysInStage = currentStep?.daysInStage || 0;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Employee Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">
            {workflow.employeeName}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-xs text-gray-600">
              Step {workflow.currentStepIndex + 1}/7
            </div>
            {workflow.isStuck && (
              <div className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Stuck
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Overall Progress</span>
          <span className="text-xs font-semibold text-gray-900">
            {workflow.overallProgress}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${workflow.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Current Stage Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-600">
          <Clock className="w-3 h-3" />
          <span>{daysInStage} days in stage</span>
        </div>
        {currentStep?.nextAction && (
          <span className="text-blue-600 font-medium truncate max-w-[120px]">
            {currentStep.nextAction}
          </span>
        )}
      </div>
    </div>
  );
}

