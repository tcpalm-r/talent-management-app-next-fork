/**
 * @deprecated This context has been merged into TalentAppContext.
 * Import from TalentAppContext instead: import { useQuickAction } from '../context/TalentAppContext';
 * This file is kept for backwards compatibility only.
 */

import type { PlanType } from '../types';

export type QuickActionType =
  | 'create-plan'
  | 'schedule-1on1'
  | 'view-notes'
  | 'start-pip'
  | 'add-to-succession'
  | 'open-calibration'
  | 'request-360'
  | 'view-360'
  | 'open-employee-detail'
  | 'bulk-action'
  | 'view-review'
  | 'create-review'
  | 'navigate'
  | 'open-plan-wizard'
  | 'open-review-modal'
  | 'open-plan-modal'
  | 'bulk-create-plans'
  | 'launch-plan-wizard';

export interface QuickActionPayload {
  type: QuickActionType;
  employeeId?: string;
  employeeIds?: string[];
  context?: {
    planType?: PlanType;
    urgent?: boolean;
    initialTab?: string;
    prefill?: any;
    mode?: string;
    [key: string]: any;
  };
}

// Re-export from unified TalentAppContext
export { useQuickAction } from './TalentAppContext';

