import { useDroppable } from '@dnd-kit/core';
import { ReactNode } from 'react';
import { Users } from 'lucide-react';
import type { Employee, Department, BoxDefinition } from '../types';
import EmployeeCard from './EmployeeCard';

interface BoxCellProps {
  boxDefinition: BoxDefinition;
  employees: Employee[];
  departments: Department[];
  isOver?: boolean;
  onClick?: (boxDefinition: BoxDefinition, employees: Employee[]) => void;
  onOpenPlan?: (employee: Employee) => void;
  onCardClick?: (employee: Employee) => void;
  onOpenManagerReview?: (employee: Employee) => void;
  onOpenSelfReview?: (employee: Employee) => void;
  onOpen360?: (employee: Employee) => void;
  employeePlans?: Record<string, any>;
  focusFilter?: 'all' | 'pending-review' | 'misaligned' | 'needs-plan';
  alertSummary?: {
    pendingReview: number;
    misaligned: number;
    needsPlan: number;
  };
  getCardMeta?: (employee: Employee) => {
    hasManagerReview?: boolean;
    hasSelfReview?: boolean;
    topBadge?: ReactNode;
    bottomBanner?: ReactNode;
  };
}

export default function BoxCell({
  boxDefinition,
  employees,
  departments,
  isOver = false,
  onClick,
  onOpenPlan,
  onCardClick,
  onOpenManagerReview,
  onOpenSelfReview,
  onOpen360,
  employeePlans = {},
  focusFilter = 'all',
  alertSummary,
  getCardMeta,
}: BoxCellProps) {
  const { setNodeRef, isOver: isDragOver } = useDroppable({
    id: `box-${boxDefinition.key}`,
    data: {
      boxDefinition,
      type: 'box',
    },
  });

  const getDepartment = (employee: Employee) => {
    return employee.department_id
      ? departments.find(d => d.id === employee.department_id)
      : undefined;
  };

  const getGridPosition = () => {
    // Y coordinates are flipped for visual representation
    // grid_y: 1 = bottom (low potential), 3 = top (high potential)  
    const visualY = 4 - boxDefinition.grid_y;
    return {
      gridColumn: boxDefinition.grid_x,
      gridRow: visualY,
    };
  };

  // Get enhanced styling based on box type
  const getBoxStyling = () => {
    const isHighPerformance = boxDefinition.grid_x === 3;
    const isHighPotential = boxDefinition.grid_y === 3;
    const isMedium = boxDefinition.grid_x === 2 && boxDefinition.grid_y === 2;

    if (isHighPerformance && isHighPotential) {
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        accent: 'bg-emerald-600',
        textAccent: 'text-emerald-800'
      };
    } else if (isHighPotential) {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        accent: 'bg-blue-600',
        textAccent: 'text-blue-800'
      };
    } else if (isHighPerformance) {
      return {
        bg: 'bg-cyan-50',
        border: 'border-cyan-300',
        accent: 'bg-cyan-600',
        textAccent: 'text-cyan-800'
      };
    } else if (isMedium) {
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-300',
        accent: 'bg-purple-600',
        textAccent: 'text-purple-800'
      };
    } else if (boxDefinition.grid_y === 1) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        accent: 'bg-red-600',
        textAccent: 'text-red-800'
      };
    } else {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        accent: 'bg-amber-600',
        textAccent: 'text-amber-800'
      };
    }
  };

  const styling = getBoxStyling();

  const highlightActive = (() => {
    if (!alertSummary || focusFilter === 'all') return false;
    if (focusFilter === 'pending-review') return alertSummary.pendingReview > 0;
    if (focusFilter === 'misaligned') return alertSummary.misaligned > 0;
    if (focusFilter === 'needs-plan') return alertSummary.needsPlan > 0;
    return false;
  })();

  const highlightRingClass = (() => {
    if (!highlightActive) return '';
    switch (focusFilter) {
      case 'pending-review':
        return 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white';
      case 'misaligned':
        return 'ring-2 ring-rose-400 ring-offset-2 ring-offset-white';
      case 'needs-plan':
        return 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white';
      default:
        return 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white';
    }
  })();

  const summaryChips = alertSummary
    ? [
        { key: 'pendingReview', label: 'Reviews pending', value: alertSummary.pendingReview, className: 'bg-amber-100 text-amber-700' },
        { key: 'misaligned', label: 'Alignment gaps', value: alertSummary.misaligned, className: 'bg-rose-100 text-rose-700' },
        { key: 'needsPlan', label: 'Plans needed', value: alertSummary.needsPlan, className: 'bg-indigo-100 text-indigo-700' },
      ].filter(chip => chip.value > 0)
    : [];

  return (
    <div
      ref={setNodeRef}
      style={getGridPosition()}
      className={`
        relative rounded-lg border-2 p-4 min-h-[350px] flex flex-col transition-all duration-200
        ${styling.bg} ${styling.border}
        ${isDragOver ? 'border-blue-400 bg-blue-100 shadow-md' : ''}
        ${isOver ? 'border-green-400 bg-green-100 shadow-md' : ''}
        hover:shadow-md
        ${highlightRingClass}
      `}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <div
            className={`w-3 h-3 rounded-full mr-2 ${styling.accent}`}
          />
          <h3 className={`text-sm font-bold ${styling.textAccent} uppercase tracking-wide`}>
            {boxDefinition.label}
          </h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed mb-1">
          {boxDefinition.description}
        </p>
        {boxDefinition.action_hint && (
          <p className={`text-xs ${styling.textAccent} font-medium`}>
            {boxDefinition.action_hint}
          </p>
        )}

        {summaryChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {summaryChips.map(chip => (
              <span
                key={chip.key}
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded ${chip.className}`}
              >
                {chip.value} {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Employee count badge with click indicator */}
      {employees.length > 3 && onClick && (
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(boxDefinition, employees);
            }}
            className={`${styling.accent} text-white text-xs font-bold px-2 py-1 rounded flex items-center space-x-1 hover:opacity-90 transition-opacity`}
            title={`View all ${employees.length} employees`}
          >
            <span>{employees.length}</span>
          </button>
        </div>
      )}
      {employees.length > 0 && employees.length <= 3 && (
        <div className="absolute top-3 right-3">
          <div className={`${styling.accent} text-white text-xs font-bold px-2 py-1 rounded flex items-center space-x-1`}>
            <span>{employees.length}</span>
          </div>
        </div>
      )}

      {/* Employees - Show first 3 with "View All" indicator */}
      <div className="flex-1 space-y-2">
        {employees.slice(0, 3).map((employee) => {
          const meta = getCardMeta?.(employee) || {};
          return (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              department={getDepartment(employee)}
              showMenu={false}
              onOpenPlan={onOpenPlan}
              onCardClick={onCardClick}
              onOpenManagerReview={onOpenManagerReview}
              onOpenSelfReview={onOpenSelfReview}
              onOpen360={onOpen360}
              employeePlan={employeePlans[employee.id]}
              hasManagerReview={meta.hasManagerReview}
              hasSelfReview={meta.hasSelfReview}
              topRightBadge={meta.topBadge}
              bottomBanner={meta.bottomBanner}
            />
          );
        })}
        {employees.length > 3 && onClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(boxDefinition, employees);
            }}
            className="w-full text-center py-2 text-sm text-gray-600 font-medium bg-white/70 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            title={`View all ${employees.length} employees in this cell`}
          >
            +{employees.length - 3} more • Click to view all
          </button>
        )}
      </div>

      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/90">
          <div className="text-blue-600 text-sm font-medium bg-white px-3 py-2 rounded shadow-sm">
            Drop here
          </div>
        </div>
      )}

      {/* Empty state */}
      {employees.length === 0 && !isDragOver && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-xs text-center">
            <Users className="w-8 h-8 mx-auto mb-1 text-gray-300" />
            <div>No employees</div>
          </div>
        </div>
      )}
    </div>
  );
}
