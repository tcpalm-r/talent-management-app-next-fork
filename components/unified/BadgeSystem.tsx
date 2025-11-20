import { ReactNode } from 'react';
import { CheckCircle, TrendingUp, Target, Users, Clock, AlertTriangle, Award } from 'lucide-react';

// Design tokens for badges
const BADGE_STYLES = {
  rounded: 'rounded-full',
  padding: 'px-2 py-0.5',
  textSize: 'text-xs',
  fontWeight: 'font-medium',
  border: 'border',
};

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({ children, variant = 'neutral', size = 'md', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    success: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
    danger: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    info: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
    neutral: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center ${BADGE_STYLES.rounded} ${sizeStyles[size]} ${BADGE_STYLES.fontWeight} ${BADGE_STYLES.border} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

interface PerformanceBadgeProps {
  performance: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PerformanceBadge({ performance, size = 'md', showIcon = true }: PerformanceBadgeProps) {
  const labels = {
    high: 'High Perf',
    medium: 'Med Perf',
    low: 'Low Perf',
  };

  const variants: Record<string, 'success' | 'primary' | 'warning'> = {
    high: 'success',
    medium: 'primary',
    low: 'warning',
  };

  return (
    <Badge variant={variants[performance]} size={size}>
      {showIcon && <TrendingUp className="w-3 h-3 mr-1" />}
      {labels[performance]}
    </Badge>
  );
}

interface PotentialBadgeProps {
  potential: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PotentialBadge({ potential, size = 'md', showIcon = true }: PotentialBadgeProps) {
  const labels = {
    high: 'High Pot',
    medium: 'Med Pot',
    low: 'Low Pot',
  };

  const variants: Record<string, 'success' | 'primary' | 'warning'> = {
    high: 'success',
    medium: 'primary',
    low: 'warning',
  };

  return (
    <Badge variant={variants[potential]} size={size}>
      {showIcon && <Target className="w-3 h-3 mr-1" />}
      {labels[potential]}
    </Badge>
  );
}

interface DepartmentBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export function DepartmentBadge({ name, color, size = 'md', showDot = true }: DepartmentBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span className={`inline-flex items-center ${BADGE_STYLES.rounded} ${sizeClasses[size]} ${BADGE_STYLES.fontWeight} bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600`}>
      {showDot && (
        <span
          className={`${dotSizes[size]} rounded-full mr-1.5`}
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'active' | 'completed' | 'pending' | 'draft' | 'overdue' | 'at-risk';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
  const config = {
    active: { label: 'Active', variant: 'primary' as const, icon: CheckCircle },
    completed: { label: 'Completed', variant: 'success' as const, icon: CheckCircle },
    pending: { label: 'Pending', variant: 'neutral' as const, icon: Clock },
    draft: { label: 'Draft', variant: 'neutral' as const, icon: Clock },
    overdue: { label: 'Overdue', variant: 'danger' as const, icon: AlertTriangle },
    'at-risk': { label: 'At Risk', variant: 'warning' as const, icon: AlertTriangle },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} size={size}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

interface CountBadgeProps {
  count: number;
  label?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export function CountBadge({ count, label, variant = 'primary', size = 'md' }: CountBadgeProps) {
  return (
    <Badge variant={variant} size={size}>
      {count} {label && <span className="ml-1">{label}</span>}
    </Badge>
  );
}

interface ProgressBadgeProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function ProgressBadge({ progress, size = 'md', showIcon = true }: ProgressBadgeProps) {
  const variant = progress === 100 ? 'success' : progress >= 50 ? 'primary' : 'warning';

  return (
    <Badge variant={variant} size={size}>
      {showIcon && progress === 100 && <CheckCircle className="w-3 h-3 mr-1" />}
      {progress}%
    </Badge>
  );
}

interface RiskBadgeProps {
  level: 'high' | 'medium' | 'low';
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function RiskBadge({ level, score, size = 'md', showIcon = true }: RiskBadgeProps) {
  const config = {
    high: { label: 'High Risk', variant: 'danger' as const, icon: AlertTriangle },
    medium: { label: 'Medium Risk', variant: 'warning' as const, icon: AlertTriangle },
    low: { label: 'Low Risk', variant: 'success' as const, icon: CheckCircle },
  };

  const { label, variant, icon: Icon } = config[level];

  return (
    <Badge variant={variant} size={size}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {score !== undefined ? `${score}` : label}
    </Badge>
  );
}

interface ITPScoreBadgeProps {
  type: 'humble' | 'hungry' | 'smart';
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ITPScoreBadge({ type, score, size = 'md' }: ITPScoreBadgeProps) {
  const config = {
    humble: { label: 'Humble', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
    hungry: { label: 'Hungry', color: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
    smart: { label: 'Smart', color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700' },
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm',
  };

  const { label, color } = config[type];

  return (
    <span className={`inline-flex items-center ${BADGE_STYLES.rounded} ${sizeClasses[size]} ${BADGE_STYLES.fontWeight} ${BADGE_STYLES.border} ${color}`}>
      <span className="font-bold mr-1">{score}</span>
      {label}
    </span>
  );
}

// Export all badge components
export const BadgeComponents = {
  Badge,
  PerformanceBadge,
  PotentialBadge,
  DepartmentBadge,
  StatusBadge,
  CountBadge,
  ProgressBadge,
  RiskBadge,
  ITPScoreBadge,
};
