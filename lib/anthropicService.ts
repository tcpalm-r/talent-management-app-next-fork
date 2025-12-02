// Type definitions for Anthropic-powered AI services
// All AI functionality has been moved to server-side API routes for security

export interface AIAnalysisResult {
  employeeName: string;
  title: string;
  department: string;
  email: string;
  
  suggestedPerformance: 'low' | 'medium' | 'high';
  suggestedPotential: 'low' | 'medium' | 'high';
  confidence: number;
  
  reasoning: string;
  keyStrengths: string[];
  developmentAreas: string[];
  achievements: string[];
  
  objectives: string[];
  actionItems: Array<{
    description: string;
    dueDate: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  successMetrics: string[];
  
  sonanceSpecificInsights: string[];
  recommendedTimeline: string;
}

export type ReviewSectionKey = 'accomplishments' | 'growth' | 'support';

export interface ReviewSectionDraftRequest {
  section: ReviewSectionKey;
  reviewType: 'self' | 'manager';
  reviewerName: string;
  employee: {
    name: string;
    title?: string | null;
    department?: string | null;
  };
  voiceNotes: string[];
  manualNotes?: string;
  existingText?: string;
}

export interface OneOnOneSummaryRequest {
  managerName: string;
  employeeName: string;
  agenda: Array<{
    title: string;
    description?: string;
    comments: string[];
  }>;
  sharedNotes: string[];
  meetingComments: string[];
  existingActionItems: Array<{ title: string; owner: string }>;
  highlights?: string;
}

export interface OneOnOneSummaryResponse {
  summary: string;
  highlights: string[];
  suggestedActionItems: Array<{
    title: string;
    owner: string;
    rationale: string;
  }>;
  tone: 'positive' | 'neutral' | 'caution';
}

// NOTE: All AI functions have been moved to server-side API routes:
// - AI Coach Q&A: POST /api/ai/coach-chat
// - Performance Review Analysis: POST /api/ai/analyze-review
// - 1:1 Summary Generation: POST /api/ai/generate-1on1-summary
// - Survey AI Assistant: POST /api/ai/generate-survey-response
// - Create Survey with AI: POST /api/ai/parse-survey-description
// - Survey Narrative: POST /api/ai/generate-narrative
// - Action Item Adjustment: POST /api/ai/adjust-item-specificity
