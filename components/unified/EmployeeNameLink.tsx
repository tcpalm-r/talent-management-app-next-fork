import type { MouseEvent, ReactNode } from 'react';
import { useQuickAction } from '../../context/QuickActionContext';
import type { Employee } from '../../types';

type BasicEmployee = Pick<Employee, 'id' | 'name'>;

interface EmployeeNameLinkProps {
  employee?: BasicEmployee | null;
  employeeId?: string;
  name?: string;
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}

/**
 * Renders an employee name that always opens the universal employee card.
 * Accepts either an `employee` object or explicit `employeeId` + `name`.
 */
export default function EmployeeNameLink({
  employee,
  employeeId,
  name,
  className = 'text-blue-600 hover:underline',
  children,
  onClick,
  title,
}: EmployeeNameLinkProps) {
  const { executeAction } = useQuickAction();

  const id = employee?.id ?? employeeId;
  const displayName = (children as ReactNode) ?? employee?.name ?? name ?? '—';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
    if (!id) return;
    executeAction({
      type: 'open-employee-detail',
      employeeId: id,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
      title={title ?? `Open ${typeof displayName === 'string' ? displayName : 'employee'} card`}
      data-employee-id={id ?? ''}
      disabled={!id}
    >
      {displayName}
    </button>
  );
}
