import type { Employee, EmployeePlan } from '../types';
import type { 
  WorkflowStage, 
  WorkflowStep, 
  WorkflowStepStatus,
  EmployeeWorkflow,
  WorkflowBottleneck,
  WorkflowVelocityMetrics,
  WorkflowAnalytics,
  ReviewRecord,
  BottleneckSeverity,
} from '../types/workflow';

/**
 * Calculate the current workflow stage for an employee
 */
export function calculateWorkflowStage(
  employee: Employee,
  reviewRecord?: ReviewRecord,
  plan?: EmployeePlan
): WorkflowStage {
  // Not assessed yet
  if (!employee.assessment) {
    return 'assess';
  }

  // Assessed but no self-review
  const hasSelfReview = reviewRecord?.self && 
    (reviewRecord.self.status === 'submitted' || reviewRecord.self.status === 'completed');
  if (!hasSelfReview) {
    return 'self-review';
  }

  // Self-review done but no manager review
  const hasManagerReview = reviewRecord?.manager && 
    reviewRecord.manager.status === 'completed';
  if (!hasManagerReview) {
    return 'manager-review';
  }

  // Both reviews done, check for calibration
  // For now, we consider calibration complete when both reviews are done and assessment exists
  // In future, could track actual calibration session attendance
  const isCalibrated = employee.assessment && hasSelfReview && hasManagerReview;
  if (!isCalibrated) {
    return 'calibrate';
  }

  // Calibrated but no development plan
  if (!plan) {
    return 'plan';
  }

  // Has plan, check if 30-day check-in done
  const planAge = plan.created_at ? 
    (Date.now() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
  
  const hasThirtyDayCheckIn = plan.last_reviewed && 
    new Date(plan.last_reviewed).getTime() > new Date(plan.created_at).getTime();

  if (planAge >= 30 && !hasThirtyDayCheckIn) {
    return 'execute-30';
  }

  // Default to monitoring phase
  return 'monitor-90';
}

/**
 * Calculate complete workflow for an employee
 */
export function calculateEmployeeWorkflow(
  employee: Employee,
  reviewRecord?: ReviewRecord,
  plan?: EmployeePlan
): EmployeeWorkflow {
  const currentStage = calculateWorkflowStage(employee, reviewRecord, plan);
  const steps = buildWorkflowSteps(employee, reviewRecord, plan, currentStage);
  const currentStepIndex = steps.findIndex(s => s.status === 'current');
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const overallProgress = Math.round((completedSteps / steps.length) * 100);

  // Calculate time in current stage
  const currentStep = steps[currentStepIndex];
  const daysInStage = currentStep?.daysInStage || 0;
  const isStuck = daysInStage > 14;

  // Calculate total days in workflow
  const firstCompletedStep = steps.find(s => s.status === 'completed');
  const totalDaysInWorkflow = firstCompletedStep?.completedAt
    ? Math.floor((Date.now() - firstCompletedStep.completedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    currentStage,
    currentStepIndex,
    steps,
    overallProgress,
    totalDaysInWorkflow,
    isStuck,
    estimatedCompletion: estimateCompletionDate(steps, currentStepIndex),
    lastAdvancedAt: getLastAdvancementDate(steps),
  };
}

/**
 * Build workflow steps with status for an employee
 */
function buildWorkflowSteps(
  employee: Employee,
  reviewRecord?: ReviewRecord,
  plan?: EmployeePlan,
  currentStage?: WorkflowStage
): WorkflowStep[] {
  const now = new Date();

  // Step 1: Assess
  const hasAssessment = Boolean(employee.assessment);
  const assessmentDate = employee.assessment?.assessed_at 
    ? new Date(employee.assessment.assessed_at) 
    : undefined;

  // Step 2: Self Review
  const hasSelfReview = reviewRecord?.self && 
    (reviewRecord.self.status === 'submitted' || reviewRecord.self.status === 'completed');
  const selfReviewDate = hasSelfReview && reviewRecord.self?.submitted_at
    ? new Date(reviewRecord.self.submitted_at)
    : undefined;

  // Step 3: Manager Review
  const hasManagerReview = reviewRecord?.manager && 
    reviewRecord.manager.status === 'completed';
  const managerReviewDate = hasManagerReview && reviewRecord.manager?.submitted_at
    ? new Date(reviewRecord.manager.submitted_at)
    : undefined;

  // Step 4: Calibrate (considered complete when both reviews done)
  const isCalibrated = hasAssessment && hasSelfReview && hasManagerReview;
  const calibrationDate = managerReviewDate; // Use manager review date as calibration proxy

  // Step 5: Plan
  const hasPlan = Boolean(plan);
  const planDate = plan?.created_at ? new Date(plan.created_at) : undefined;

  // Step 6: 30-day check-in
  const has30DayCheckIn = plan?.last_reviewed && planDate &&
    new Date(plan.last_reviewed).getTime() > planDate.getTime();
  const checkIn30Date = has30DayCheckIn && plan.last_reviewed
    ? new Date(plan.last_reviewed)
    : undefined;

  // Step 7: 90-day monitoring
  const planAge = planDate ? (now.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const has90DayReview = planAge >= 90 && has30DayCheckIn;

  const steps: WorkflowStep[] = [
    {
      stage: 'assess',
      status: hasAssessment ? 'completed' : 'current',
      completedAt: assessmentDate,
      startedAt: new Date(employee.created_at),
      daysInStage: hasAssessment ? 0 : daysSince(new Date(employee.created_at)),
      nextAction: 'Drag employee to 9-box grid position',
      canAutoAdvance: false,
    },
    {
      stage: 'self-review',
      status: hasSelfReview ? 'completed' : hasAssessment ? 'current' : 'upcoming',
      completedAt: selfReviewDate,
      startedAt: assessmentDate,
      daysInStage: !hasSelfReview && assessmentDate ? daysSince(assessmentDate) : 0,
      blockers: !hasAssessment ? ['Needs 9-box assessment'] : undefined,
      nextAction: 'Send self-review invitation to employee',
      canAutoAdvance: true,
    },
    {
      stage: 'manager-review',
      status: hasManagerReview ? 'completed' : hasSelfReview ? 'current' : 'upcoming',
      completedAt: managerReviewDate,
      startedAt: selfReviewDate,
      daysInStage: !hasManagerReview && selfReviewDate ? daysSince(selfReviewDate) : 0,
      blockers: !hasSelfReview ? ['Waiting for self-review'] : undefined,
      nextAction: 'Complete manager performance review',
      canAutoAdvance: true,
    },
    {
      stage: 'calibrate',
      status: isCalibrated ? 'completed' : hasManagerReview ? 'current' : 'upcoming',
      completedAt: calibrationDate,
      startedAt: managerReviewDate,
      daysInStage: !isCalibrated && managerReviewDate ? daysSince(managerReviewDate) : 0,
      blockers: !hasManagerReview ? ['Waiting for manager review'] : undefined,
      nextAction: 'Review in calibration session',
      canAutoAdvance: false,
    },
    {
      stage: 'plan',
      status: hasPlan ? 'completed' : isCalibrated ? 'current' : 'upcoming',
      completedAt: planDate,
      startedAt: calibrationDate,
      daysInStage: !hasPlan && calibrationDate ? daysSince(calibrationDate) : 0,
      blockers: !isCalibrated ? ['Waiting for calibration'] : undefined,
      nextAction: 'Create development plan with AI assist',
      canAutoAdvance: true,
    },
    {
      stage: 'execute-30',
      status: has30DayCheckIn ? 'completed' : (hasPlan && planAge >= 30) ? 'current' : 'upcoming',
      completedAt: checkIn30Date,
      startedAt: planDate,
      daysInStage: hasPlan && !has30DayCheckIn && planAge >= 30 ? Math.floor(planAge - 30) : 0,
      blockers: !hasPlan ? ['Needs development plan'] : planAge < 30 ? ['Plan is less than 30 days old'] : undefined,
      nextAction: 'Conduct 30-day progress check-in',
      canAutoAdvance: false,
    },
    {
      stage: 'monitor-90',
      status: has90DayReview ? 'completed' : (hasPlan && planAge >= 90 && has30DayCheckIn) ? 'current' : 'upcoming',
      startedAt: checkIn30Date,
      daysInStage: hasPlan && planAge >= 90 ? Math.floor(planAge - 90) : 0,
      blockers: !has30DayCheckIn ? ['Needs 30-day check-in'] : undefined,
      nextAction: 'Complete 90-day progress review',
      canAutoAdvance: false,
    },
  ];

  return steps;
}

/**
 * Helper: Calculate days since a date
 */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Get last advancement date
 */
function getLastAdvancementDate(steps: WorkflowStep[]): Date | undefined {
  const completedSteps = steps.filter(s => s.status === 'completed' && s.completedAt);
  if (completedSteps.length === 0) return undefined;
  
  const sorted = completedSteps.sort((a, b) => 
    (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
  );
  
  return sorted[0]?.completedAt;
}

/**
 * Helper: Estimate completion date
 */
function estimateCompletionDate(steps: WorkflowStep[], currentIndex: number): Date | undefined {
  const remainingSteps = steps.length - currentIndex - 1;
  if (remainingSteps <= 0) return undefined;

  // Estimate 14 days per remaining step (conservative)
  const estimatedDays = remainingSteps * 14;
  const completion = new Date();
  completion.setDate(completion.getDate() + estimatedDays);
  
  return completion;
}

/**
 * Detect workflow bottlenecks
 */
export function detectBottlenecks(workflows: EmployeeWorkflow[]): WorkflowBottleneck[] {
  const bottlenecks: WorkflowBottleneck[] = [];

  // Group employees by current stage
  const byStage = workflows.reduce((acc, workflow) => {
    const stage = workflow.currentStage;
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(workflow);
    return acc;
  }, {} as Record<WorkflowStage, EmployeeWorkflow[]>);

  // Check each stage for bottlenecks
  Object.entries(byStage).forEach(([stage, stageWorkflows]) => {
    const employeesInStage = stageWorkflows.length;
    const averageDays = stageWorkflows.reduce((sum, w) => {
      const currentStep = w.steps[w.currentStepIndex];
      return sum + (currentStep?.daysInStage || 0);
    }, 0) / employeesInStage;

    // Determine if this is a bottleneck
    const isBottleneck = employeesInStage >= 10 || averageDays > 14;
    
    if (isBottleneck) {
      const severity: BottleneckSeverity = 
        employeesInStage >= 20 || averageDays > 30 ? 'critical' :
        employeesInStage >= 15 || averageDays > 21 ? 'high' :
        employeesInStage >= 10 || averageDays > 14 ? 'medium' : 'low';

      bottlenecks.push({
        stage: stage as WorkflowStage,
        employeeCount: employeesInStage,
        averageDaysStuck: Math.round(averageDays),
        severity,
        affectedEmployees: stageWorkflows.map(w => w.employeeId),
        suggestedActions: getSuggestedActions(stage as WorkflowStage, employeesInStage),
        impactDescription: getImpactDescription(stage as WorkflowStage, employeesInStage, averageDays),
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Get suggested actions to clear a bottleneck
 */
function getSuggestedActions(stage: WorkflowStage, employeeCount: number): any[] {
  const actions: any[] = [];

  switch (stage) {
    case 'assess':
      actions.push({
        label: `Review ${employeeCount} unassessed employees`,
        actionType: 'view-list',
        payload: { stage: 'assess' },
        estimatedImpact: `Place all on 9-box in 1-2 hours`,
      });
      break;

    case 'self-review':
      actions.push({
        label: `Send reminder to ${employeeCount} employees`,
        actionType: 'bulk-remind',
        payload: { stage: 'self-review', recipientType: 'employee' },
        estimatedImpact: `Get 70% completion in 3-5 days`,
      });
      break;

    case 'manager-review':
      actions.push({
        label: `Remind ${employeeCount} managers`,
        actionType: 'bulk-remind',
        payload: { stage: 'manager-review', recipientType: 'manager' },
        estimatedImpact: `Clear bottleneck in 2-3 days`,
      });
      actions.push({
        label: 'Escalate to VP HR',
        actionType: 'escalate',
        payload: { stage: 'manager-review' },
        estimatedImpact: `Executive visibility on delays`,
      });
      break;

    case 'calibrate':
      actions.push({
        label: `Schedule calibration session`,
        actionType: 'schedule-session',
        payload: { employeeCount },
        estimatedImpact: `Calibrate all in one 2-hour session`,
      });
      break;

    case 'plan':
      actions.push({
        label: `AI draft ${employeeCount} plans`,
        actionType: 'auto-draft',
        payload: { stage: 'plan', employeeCount },
        estimatedImpact: `Generate drafts in 5 minutes`,
      });
      actions.push({
        label: `View employees needing plans`,
        actionType: 'view-list',
        payload: { stage: 'plan' },
        estimatedImpact: `Create plans individually`,
      });
      break;

    case 'execute-30':
      actions.push({
        label: `View ${employeeCount} employees due for check-in`,
        actionType: 'view-list',
        payload: { stage: 'execute-30' },
        estimatedImpact: `Schedule 1:1s to review progress`,
      });
      break;

    case 'monitor-90':
      actions.push({
        label: `Review ${employeeCount} 90-day milestones`,
        actionType: 'view-list',
        payload: { stage: 'monitor-90' },
        estimatedImpact: `Complete progress reviews`,
      });
      break;
  }

  return actions;
}

/**
 * Get impact description for a bottleneck
 */
function getImpactDescription(stage: WorkflowStage, count: number, avgDays: number): string {
  const descriptions: Record<WorkflowStage, string> = {
    'assess': `${count} employees cannot begin review cycle until assessed`,
    'self-review': `${count} employees waiting to provide input, averaging ${Math.round(avgDays)} days`,
    'manager-review': `${count} employees blocked from calibration, averaging ${Math.round(avgDays)} days stuck`,
    'calibrate': `${count} employees cannot receive development plans until calibrated`,
    'plan': `${count} employees at risk of disengagement without clear development path`,
    'execute-30': `${count} employees missing crucial 30-day check-ins, momentum at risk`,
    'monitor-90': `${count} employees overdue for progress reviews`,
  };

  return descriptions[stage] || `${count} employees stuck at ${stage} stage`;
}

/**
 * Calculate velocity metrics across all workflows
 */
export function calculateVelocityMetrics(workflows: EmployeeWorkflow[]): WorkflowVelocityMetrics {
  const completed = workflows.filter(w => w.overallProgress === 100);
  const inProgress = workflows.filter(w => w.overallProgress > 0 && w.overallProgress < 100);

  // Average time per stage (from completed workflows only)
  const avgTimeToAssess = calculateAvgTimeToStage(workflows, 'assess');
  const avgTimeToReview = calculateAvgTimeToStage(workflows, 'manager-review');
  const avgTimeToCalibrate = calculateAvgTimeToStage(workflows, 'calibrate');
  const avgTimeToPlan = calculateAvgTimeToStage(workflows, 'plan');

  // Average complete cycle time
  const avgCompleteCycle = completed.length > 0
    ? completed.reduce((sum, w) => sum + w.totalDaysInWorkflow, 0) / completed.length
    : 0;

  const stuckCount = workflows.filter(w => w.isStuck).length;

  // Find fastest and slowest cycles
  const cycleTimes = completed.map(w => w.totalDaysInWorkflow);
  const fastestCycle = cycleTimes.length > 0 ? Math.min(...cycleTimes) : 0;
  const slowestCycle = cycleTimes.length > 0 ? Math.max(...cycleTimes) : 0;

  const completionRate = workflows.length > 0
    ? Math.round((completed.length / workflows.length) * 100)
    : 0;

  return {
    averageTimeToAssess: Math.round(avgTimeToAssess),
    averageTimeToReview: Math.round(avgTimeToReview),
    averageTimeToCalibrate: Math.round(avgTimeToCalibrate),
    averageTimeToPlan: Math.round(avgTimeToPlan),
    averageCompleteCycle: Math.round(avgCompleteCycle),
    completionRate,
    stuckCount,
    fastestCycle,
    slowestCycle,
  };
}

/**
 * Helper: Calculate average time to reach a specific stage
 */
function calculateAvgTimeToStage(workflows: EmployeeWorkflow[], targetStage: WorkflowStage): number {
  const workflowsReachedStage = workflows.filter(w => {
    const stageIndex = w.steps.findIndex(s => s.stage === targetStage);
    return stageIndex >= 0 && w.currentStepIndex >= stageIndex;
  });

  if (workflowsReachedStage.length === 0) return 0;

  const totalDays = workflowsReachedStage.reduce((sum, workflow) => {
    const targetStep = workflow.steps.find(s => s.stage === targetStage);
    if (!targetStep?.completedAt) return sum;

    const firstStep = workflow.steps[0];
    if (!firstStep.startedAt) return sum;

    const daysTaken = (targetStep.completedAt.getTime() - firstStep.startedAt.getTime()) / (1000 * 60 * 60 * 24);
    return sum + daysTaken;
  }, 0);

  return totalDays / workflowsReachedStage.length;
}

/**
 * Check if employee should auto-advance to next stage
 */
export function shouldAutoAdvance(
  workflow: EmployeeWorkflow,
  completedStage: WorkflowStage
): boolean {
  const stepIndex = workflow.steps.findIndex(s => s.stage === completedStage);
  if (stepIndex === -1) return false;

  const step = workflow.steps[stepIndex];
  return step.canAutoAdvance || false;
}

/**
 * Get next action for current workflow stage
 */
export function getNextAction(workflow: EmployeeWorkflow): string {
  const currentStep = workflow.steps[workflow.currentStepIndex];
  return currentStep?.nextAction || 'Continue workflow';
}

/**
 * Get stage label for display
 */
export function getStageLabel(stage?: WorkflowStage): string {
  const labels: Record<WorkflowStage, string> = {
    'assess': '9-Box Assessment',
    'self-review': 'Self Review',
    'manager-review': 'Manager Review',
    'calibrate': 'Calibration',
    'plan': 'Development Plan',
    'execute-30': '30-Day Check-In',
    'monitor-90': '90-Day Review',
  };

  return stage ? labels[stage] : 'Unknown';
}

/**
 * Get stage short label for compact displays
 */
export function getStageLabelShort(stage: WorkflowStage): string {
  const labels: Record<WorkflowStage, string> = {
    'assess': 'Assess',
    'self-review': 'Self',
    'manager-review': 'Manager',
    'calibrate': 'Calibrate',
    'plan': 'Plan',
    'execute-30': '30-Day',
    'monitor-90': '90-Day',
  };

  return labels[stage];
}

/**
 * Get stage icon/emoji
 */
export function getStageIcon(stage: WorkflowStage): string {
  const icons: Record<WorkflowStage, string> = {
    'assess': '📊',
    'self-review': '✍️',
    'manager-review': '👤',
    'calibrate': '🎯',
    'plan': '📋',
    'execute-30': '⏱️',
    'monitor-90': '📈',
  };

  return icons[stage];
}

/**
 * Get stage color for UI
 */
export function getStageColor(stage: WorkflowStage): string {
  const colors: Record<WorkflowStage, string> = {
    'assess': 'blue',
    'self-review': 'purple',
    'manager-review': 'pink',
    'calibrate': 'amber',
    'plan': 'green',
    'execute-30': 'teal',
    'monitor-90': 'indigo',
  };

  return colors[stage];
}

