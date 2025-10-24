import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import type { Employee, EmployeePlan } from '../types';
import type { 
  EmployeeWorkflow, 
  WorkflowStage, 
  WorkflowBottleneck,
  WorkflowVelocityMetrics,
  ReviewRecord,
} from '../types/workflow';
import {
  calculateEmployeeWorkflow,
  detectBottlenecks,
  calculateVelocityMetrics,
  shouldAutoAdvance,
  getNextAction,
} from '../lib/workflowOrchestrator';

interface WorkflowContextValue {
  workflows: Map<string, EmployeeWorkflow>;
  bottlenecks: WorkflowBottleneck[];
  velocityMetrics: WorkflowVelocityMetrics;
  getEmployeeWorkflow: (employeeId: string) => EmployeeWorkflow | undefined;
  getEmployeesAtStage: (stage: WorkflowStage) => EmployeeWorkflow[];
  refreshWorkflows: () => void;
  isLoading: boolean;
}

export const WorkflowContext = createContext<WorkflowContextValue | null>(null);

interface WorkflowProviderProps {
  children: ReactNode;
  employees: Employee[];
  performanceReviews: Record<string, ReviewRecord>;
  employeePlans: Record<string, EmployeePlan>;
}

export function WorkflowProvider({ 
  children, 
  employees,
  performanceReviews,
  employeePlans,
}: WorkflowProviderProps) {
  const [workflows, setWorkflows] = useState<Map<string, EmployeeWorkflow>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Calculate workflows whenever data changes
  const refreshWorkflows = useCallback(() => {
    setIsLoading(true);
    
    const newWorkflows = new Map<string, EmployeeWorkflow>();
    
    employees.forEach(employee => {
      const reviewRecord = performanceReviews[employee.id];
      const plan = employeePlans[employee.id];
      
      const workflow = calculateEmployeeWorkflow(employee, reviewRecord, plan);
      newWorkflows.set(employee.id, workflow);
    });

    setWorkflows(newWorkflows);
    setIsLoading(false);
    
    console.log(`[Workflow] Calculated workflows for ${newWorkflows.size} employees`);
  }, [employees, performanceReviews, employeePlans]);

  // Recalculate workflows when dependencies change
  useEffect(() => {
    refreshWorkflows();
  }, [refreshWorkflows]);

  // Calculate bottlenecks
  const bottlenecks = useMemo(() => {
    const workflowArray = Array.from(workflows.values());
    return detectBottlenecks(workflowArray);
  }, [workflows]);

  // Calculate velocity metrics
  const velocityMetrics = useMemo(() => {
    const workflowArray = Array.from(workflows.values());
    return calculateVelocityMetrics(workflowArray);
  }, [workflows]);

  // Get workflow for specific employee
  const getEmployeeWorkflow = useCallback((employeeId: string) => {
    return workflows.get(employeeId);
  }, [workflows]);

  // Get all employees at a specific stage
  const getEmployeesAtStage = useCallback((stage: WorkflowStage) => {
    return Array.from(workflows.values()).filter(w => w.currentStage === stage);
  }, [workflows]);

  const value: WorkflowContextValue = {
    workflows,
    bottlenecks,
    velocityMetrics,
    getEmployeeWorkflow,
    getEmployeesAtStage,
    refreshWorkflows,
    isLoading,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
}

/**
 * Hook to get workflow for specific employee
 */
export function useEmployeeWorkflow(employeeId: string): EmployeeWorkflow | undefined {
  const { getEmployeeWorkflow } = useWorkflow();
  return getEmployeeWorkflow(employeeId);
}

/**
 * Hook to get employees at specific stage
 */
export function useEmployeesAtStage(stage: WorkflowStage): EmployeeWorkflow[] {
  const { getEmployeesAtStage } = useWorkflow();
  return getEmployeesAtStage(stage);
}

