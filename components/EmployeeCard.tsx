import { ReactNode } from 'react';
import type { Employee, Department } from '../types';
import EmployeeCardUnified from './unified/EmployeeCardUnified';

interface EmployeeCardProps {
  employee: Employee;
  department?: Department;
  isDragging?: boolean;
  showMenu?: boolean;
  onEdit?: (employee: Employee) => void;
  onRemove?: (employee: Employee) => void;
  onOpenPlan?: (employee: Employee) => void;
  onCardClick?: (employee: Employee) => void;
  onOpenManagerReview?: (employee: Employee) => void;
  onOpenSelfReview?: (employee: Employee) => void;
  onOpen360?: (employee: Employee) => void;
  employeePlan?: any;
  hasManagerReview?: boolean;
  hasSelfReview?: boolean;
  topRightBadge?: ReactNode;
  bottomBanner?: ReactNode;
  cardClassName?: string;
}

/**
 * EmployeeCard - Wrapper component that uses the unified EmployeeCardUnified component
 * This provides backwards compatibility while using the new unified design system
 */
export default function EmployeeCard(props: EmployeeCardProps) {
  return <EmployeeCardUnified {...props} variant="grid" />;
}
