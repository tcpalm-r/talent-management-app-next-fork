/**
 * @deprecated This context has been merged into TalentAppContext.
 * Import from TalentAppContext instead: import { useUnifiedAICoach } from '../context/TalentAppContext';
 * This file is kept for backwards compatibility only.
 */

import type { Performance, Potential } from '../types';

// Re-exported types for backwards compatibility
export interface AICoachSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'action' | 'insight' | 'warning' | 'tip';
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    actionType: string;
    payload: any;
  }>;
  dismissable: boolean;
  learnMore?: string;
  context?: {
    employeeIds?: string[];
    relatedTo?: string;
  };
  createdAt: number;
}

// Onboarding tips
export interface OnboardingTip {
  id: string;
  title: string;
  description: string;
  targetId?: string;
  navigateTo?: string;
  action?: () => void;
  completed: boolean;
}

// Q&A history - now with conversation context
export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
}

// Conversation message for context-aware chat
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Placement suggestions
export interface PlacementSuggestion {
  employeeId: string;
  performance: Performance;
  potential: Potential;
  reasoning: string;
  confidence?: number;
}

// Re-export from unified TalentAppContext
export { useUnifiedAICoach } from './TalentAppContext';

