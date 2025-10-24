// Unified component system exports
export { default as EmployeeCardUnified } from './EmployeeCardUnified';
export { default as NavigationTabs } from './NavigationTabs';
export { default as ModalLayout } from './ModalLayout';
export { default as EmptyState } from './EmptyState';
export { default as StatCard } from './StatCard';
export { default as EmployeeNameLink } from './EmployeeNameLink';

// Re-export useToast from TalentAppContext for backwards compatibility
export { useToast } from '../../context/TalentAppContext';

// Badge system exports
export {
  Badge,
  PerformanceBadge,
  PotentialBadge,
  DepartmentBadge,
  StatusBadge,
  CountBadge,
  ProgressBadge,
  RiskBadge,
  ITPScoreBadge,
  BadgeComponents,
} from './BadgeSystem';
