/**
 * Centralized Prompt Management
 *
 * All AI prompts are stored here for easier maintenance, review, and iteration.
 * Each prompt module exports:
 * - A config object with model settings
 * - Prompt builder functions that accept context and return the final prompt
 */

export * from './generate-survey-response';
export * from './survey-analyzer';
export * from './generate-narrative';
export * from './adjust-item-specificity';

// Shared model configuration
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

