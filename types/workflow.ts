import type { Employee, EmployeePlan, Performance, Potential } from './index';
import type { PerformanceReview } from '../components/PerformanceReviewModal';

/**
 * Workflow Stage Types
 * Represents the natural progression of talent management
 */
export type WorkflowStage =
  | 'assess'          // Place on 9-box grid
  | 'self-review'     // Employee completes self-review
  | 'manager-review'  // Manager completes performance review
  | 'calibrate'       // Cross-functional calibration
  | 'plan'           // Create development plan
  | 'execute-30'     // 30-day check-in on plan
  | 'monitor-90';    // 90-day progress review

export type WorkflowStepStatus = 
  | 'completed'   // Step is done
  | 'current'     // Employee is at this step now
  | 'upcoming'    // Not yet reached
  | 'blocked'     // Waiting on prerequisite
  | 'skipped';    // Intentionally skipped

export type BottleneckSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual workflow step
 */
export interface WorkflowStep {
  stage: WorkflowStage;
  status: WorkflowStepStatus;
  completedAt?: Date;
  startedAt?: Date;
  daysInStage?: number;
  blockers?: string[];
  canAutoAdvance?: boolean; // Whether this step can auto-trigger next step
  nextAction?: string; // What user needs to do to complete this step
}

/**
 * Complete workflow for an employee
 */
export interface EmployeeWorkflow {
  employeeId: string;
  employeeName: string;
  currentStage: WorkflowStage;
  currentStepIndex: number;
  steps: WorkflowStep[];
  overallProgress: number; // 0-100%
  totalDaysInWorkflow: number;
  isStuck: boolean; // True if in same stage >14 days
  estimatedCompletion?: Date;
  lastAdvancedAt?: Date;
}

/**
 * Workflow bottleneck detection
 */
export interface WorkflowBottleneck {
  stage: WorkflowStage;
  employeeCount: number;
  averageDaysStuck: number;
  severity: BottleneckSeverity;
  affectedEmployees: string[]; // Employee IDs
  suggestedActions: BottleneckAction[];
  impactDescription: string;
}

export interface BottleneckAction {
  label: string;
  actionType: 'bulk-remind' | 'escalate' | 'auto-draft' | 'schedule-session' | 'view-list';
  payload: any;
  estimatedImpact: string; // e.g., "Clear 23 employees in 2 hours"
}

/**
 * Workflow velocity metrics
 */
export interface WorkflowVelocityMetrics {
  averageTimeToAssess: number; // Days
  averageTimeToReview: number; // Days  
  averageTimeToCalibrate: number; // Days
  averageTimeToPlan: number; // Days
  averageCompleteCycle: number; // Days from start to 90-day review
  completionRate: number; // % of employees who complete full cycle
  stuckCount: number; // Employees stuck >30 days
  fastestCycle: number; // Best time (days)
  slowestCycle: number; // Worst time (days)
}

/**
 * Workflow analytics
 */
export interface WorkflowAnalytics {
  byStage: Record<WorkflowStage, {
    count: number;
    avgDaysInStage: number;
    completionRate: number;
  }>;
  trends: {
    weekOverWeek: number; // % change in overall progress
    monthOverMonth: number;
  };
  bottlenecks: WorkflowBottleneck[];
  velocityMetrics: WorkflowVelocityMetrics;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  stageTimeouts: Record<WorkflowStage, number>; // Days before considered "stuck"
  autoAdvanceEnabled: boolean;
  sendReminders: boolean;
  escalationThresholds: {
    daysStuck: number;
    employeeCount: number;
  };
}

/**
 * Helper type for review records
 */
export interface ReviewRecord {
  self?: PerformanceReview;
  manager?: PerformanceReview;
}

