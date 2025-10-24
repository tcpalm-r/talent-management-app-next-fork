import { ReactNode, MouseEvent } from 'react';
import { useQuickAction } from '../context/QuickActionContext';
import type { QuickActionPayload } from '../context/QuickActionContext';

interface QuickActionProps extends QuickActionPayload {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
}

/**
 * QuickAction Component
 * 
 * Wraps any clickable element to execute a quick action that triggers
 * navigation, modals, or other contextual behaviors.
 * 
 * Usage:
 * <QuickAction type="create-plan" employeeId={emp.id}>
 *   <button>Create Plan</button>
 * </QuickAction>
 */
export function QuickAction({ 
  children, 
  className = '', 
  onClick, 
  disabled = false,
  type,
  employeeId,
  employeeIds,
  context,
}: QuickActionProps) {
  const { executeAction } = useQuickAction();

  const handleClick = (e: MouseEvent) => {
    if (disabled) return;
    
    e.stopPropagation();
    onClick?.(e);
    
    executeAction({
      type,
      employeeId,
      employeeIds,
      context,
    });
  };

  return (
    <div
      onClick={handleClick}
      className={`quick-action ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      data-action-type={type}
    >
      {children}
    </div>
  );
}

