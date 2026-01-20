/**
 * Survey Analyzer Service
 *
 * Handles 360 survey analysis with citation tracking for admin audit trail.
 * Uses a two-pass pipeline to reduce hallucination:
 * - Pass 1: Question-level extraction (themes, strengths, gaps per question)
 * - Pass 2: Global synthesis (cross-cutting themes, recommendations, group analysis)
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetch as undiciFetch } from 'undici';

// ==================== Cancellation Registry ====================
// In-memory registry to track cancelled survey generations
// This allows us to stop processing between passes or before saving
const cancelledSurveys = new Set<string>();

/**
 * Mark a survey generation as cancelled.
 * Call this from the cancel-generation API route.
 */
export function markSurveyCancelled(surveyId: string): void {
  cancelledSurveys.add(surveyId);
  console.log(`[surveyAnalyzerService] Survey ${surveyId} marked for cancellation`);
}

/**
 * Check if a survey generation has been cancelled.
 */
export function isSurveyCancelled(surveyId: string): boolean {
  return cancelledSurveys.has(surveyId);
}

/**
 * Clear the cancellation flag for a survey.
 * Call this when starting a new generation or after handling cancellation.
 */
export function clearSurveyCancellation(surveyId: string): void {
  cancelledSurveys.delete(surveyId);
}

/**
 * Custom error for cancelled operations
 */
export class GenerationCancelledError extends Error {
  constructor(surveyId: string) {
    super(`Report generation cancelled for survey ${surveyId}`);
    this.name = 'GenerationCancelledError';
  }
}
import type {
  Survey360,
  Survey360Response,
  Survey360Participant,
  Survey360ReportWithCitations,
  SurveyQuestion,
  QuestionSummary,
  ParticipantRelationship,
} from '../../types';
import {
  pass1Config,
  buildPass1Prompt,
  preparePass1Input,
  pass2Config,
  buildPass2Prompt,
  formatQuestionSummaries,
} from '../prompts';

export interface AnalysisInput {
  survey: Survey360;
  responses: Survey360Response[];
  participants: Survey360Participant[];
  questions: SurveyQuestion[];
  tone?: 'standard' | 'softer';
}

export interface AnalysisResultWithCitations {
  report: Omit<Survey360ReportWithCitations, 'id' | 'created_at' | 'updated_at'>;
  /** Flattened list of all citations for database storage */
  citations: Array<{
    response_id: string;
    section_type: 'theme' | 'strength' | 'development' | 'recommendation' | 'consensus' | 'outlier';
    section_index: number;
    statement_index: number;
    snippet: string;
    relevance_score?: number;
  }>;
  meta: {
    version: 'v1-citations' | 'v2-two-pass';
    elapsedMs: number;
    totalCitations: number;
    citationCoverage: number; // 0-100, percentage of statements with citations
    pass1DurationMs?: number;
    pass2DurationMs?: number;
  };
}

/**
 * Analyze survey responses with citation tracking using two-pass pipeline.
 * Pass 1 extracts question-level summaries, Pass 2 synthesizes into final report.
 * Supports cancellation between passes via the cancellation registry.
 */
export async function analyzeWithCitations(input: AnalysisInput): Promise<AnalysisResultWithCitations> {
  const startTime = Date.now();
  const { survey, responses, participants, questions, tone = 'standard' } = input;
  const surveyId = survey.id;

  // Clear any stale cancellation flag from previous attempts
  clearSurveyCancellation(surveyId);

  console.log('[surveyAnalyzerService] Starting two-pass analysis pipeline');
  console.log(`[surveyAnalyzerService] Survey: ${survey.survey_name || survey.survey_title}`);
  console.log(`[surveyAnalyzerService] Employee: ${survey.employee_name}`);
  console.log(`[surveyAnalyzerService] Responses: ${responses.length}, Questions: ${questions.length}`);

  // Validate API key before proceeding
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured. Please check your environment settings.');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 5 * 60 * 1000, // 5 minute timeout (mainly for initial connection)
    maxRetries: 2, // Reduced retries since we use streaming now
    fetch: undiciFetch as unknown as typeof fetch, // Use undici fetch to bypass Next.js patching
  });

  // Get relationships that have responses (for Pass 2 sentiment calculation)
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const relationshipsWithResponses = [...new Set(
    responses
      .map((r) => participantMap.get(r.participant_id)?.relationship)
      .filter((rel): rel is ParticipantRelationship => rel !== undefined)
  )];

  // ========== PASS 1: Question-Level Extraction ==========
  console.log('[surveyAnalyzerService] Pass 1: Extracting question-level summaries...');
  const pass1Start = Date.now();

  const pass1Result = await runPass1(anthropic, {
    survey,
    responses,
    questions,
  });
  const { summaries: questionSummaries, outputTokens: pass1OutputTokens } = pass1Result;

  const pass1Duration = Date.now() - pass1Start;
  console.log(`[surveyAnalyzerService] Pass 1 complete: ${questionSummaries.length} question summaries in ${pass1Duration}ms`);
  console.log(`[surveyAnalyzerService] Pass 1 output tokens: ${pass1OutputTokens}`);

  // Check for cancellation after Pass 1
  if (isSurveyCancelled(surveyId)) {
    console.log(`[surveyAnalyzerService] Generation cancelled after Pass 1 for survey ${surveyId}`);
    clearSurveyCancellation(surveyId);
    throw new GenerationCancelledError(surveyId);
  }

  // Validate Pass 1 coverage
  const pass1Coverage = validatePass1Coverage(responses, questions, questionSummaries);
  console.log(`[surveyAnalyzerService] Pass 1 citation coverage: ${pass1Coverage.toFixed(1)}%`);

  // ========== RATE LIMIT DELAY ==========
  // Calculate and apply delay to avoid hitting rate limit on Pass 2
  const rateLimitDelay = calculateRateLimitDelay(pass1OutputTokens);
  const delaySeconds = Math.round(rateLimitDelay / 1000);
  console.log(`[surveyAnalyzerService] Rate limit management: waiting ${delaySeconds}s before Pass 2...`);
  console.log(`[surveyAnalyzerService] (Pass 1 used ${pass1OutputTokens} tokens, limit is ${RATE_LIMIT_TOKENS_PER_MINUTE}/min)`);

  // Check for cancellation during rate limit wait
  const checkInterval = 5000; // Check every 5 seconds
  let waited = 0;
  while (waited < rateLimitDelay) {
    if (isSurveyCancelled(surveyId)) {
      console.log(`[surveyAnalyzerService] Generation cancelled during rate limit wait for survey ${surveyId}`);
      clearSurveyCancellation(surveyId);
      throw new GenerationCancelledError(surveyId);
    }
    const sleepTime = Math.min(checkInterval, rateLimitDelay - waited);
    await sleep(sleepTime);
    waited += sleepTime;
  }
  console.log(`[surveyAnalyzerService] Rate limit wait complete, proceeding to Pass 2`);

  // ========== PASS 2: Global Synthesis ==========
  console.log('[surveyAnalyzerService] Pass 2: Synthesizing global report...');
  const pass2Start = Date.now();

  const analysis = await runPass2(anthropic, {
    survey,
    questionSummaries,
    relationshipsWithResponses,
    tone,
  });

  const pass2Duration = Date.now() - pass2Start;
  console.log(`[surveyAnalyzerService] Pass 2 complete in ${pass2Duration}ms`);

  // Check for cancellation after Pass 2 (before saving)
  if (isSurveyCancelled(surveyId)) {
    console.log(`[surveyAnalyzerService] Generation cancelled after Pass 2 for survey ${surveyId}`);
    clearSurveyCancellation(surveyId);
    throw new GenerationCancelledError(surveyId);
  }

  // Log what the AI returned for group-level fields
  console.log('[surveyAnalyzerService] AI returned consensus_areas:', JSON.stringify(analysis.consensus_areas, null, 2).slice(0, 500));
  console.log('[surveyAnalyzerService] AI returned varied_by_relationship:', JSON.stringify(analysis.varied_by_relationship, null, 2).slice(0, 500));
  console.log('[surveyAnalyzerService] AI returned outliers:', JSON.stringify(analysis.outliers, null, 2).slice(0, 500));

  // Extract and flatten all citations for database storage
  const flattenedCitations = extractCitationsFromAnalysis(analysis);

  // Calculate citation coverage
  const totalStatements = countStatements(analysis);
  const statementsWithCitations = countStatementsWithCitations(analysis);
  const citationCoverage = totalStatements > 0 ? Math.round((statementsWithCitations / totalStatements) * 100) : 0;

  // Compute frequency for themes from citations (not AI-estimated)
  const themesWithFrequency = computeThemeFrequencies(analysis.themes);

  const totalDuration = Date.now() - startTime;
  console.log(`[surveyAnalyzerService] Two-pass analysis complete: ${flattenedCitations.length} citations, ${citationCoverage}% coverage`);
  console.log(`[surveyAnalyzerService] Total time: ${totalDuration}ms (Pass 1: ${pass1Duration}ms, Pass 2: ${pass2Duration}ms)`);

  return {
    report: {
      survey_id: survey.id,
      themes: themesWithFrequency as Survey360ReportWithCitations['themes'] || [],
      overall_strengths: analysis.overall_strengths as Survey360ReportWithCitations['overall_strengths'] || [],
      development_areas: analysis.development_areas as Survey360ReportWithCitations['development_areas'] || [],
      recommendations: analysis.recommendations as Survey360ReportWithCitations['recommendations'] || [],
      sentiment_by_relationship: analysis.sentiment_by_relationship as Record<string, number> || {},
      // Group-level analysis
      consensus_areas: analysis.consensus_areas as Survey360ReportWithCitations['consensus_areas'] || [],
      varied_by_relationship: (analysis.varied_by_relationship as Survey360ReportWithCitations['varied_by_relationship']) || [],
      outliers: (analysis.outliers as Survey360ReportWithCitations['outliers']) || [],
      outlier_opinions: analysis.outlier_opinions as Survey360ReportWithCitations['outlier_opinions'] || [], // Keep for backward compat
      generated_at: new Date().toISOString(),
      generated_by: `${pass1Config.model} (two-pass)`,
      has_citations: true,
      citation_version: '3.0', // New version for two-pass pipeline
      total_citations: flattenedCitations.length,
      citation_coverage: citationCoverage,
    },
    citations: flattenedCitations,
    meta: {
      version: 'v2-two-pass',
      elapsedMs: totalDuration,
      totalCitations: flattenedCitations.length,
      citationCoverage,
      pass1DurationMs: pass1Duration,
      pass2DurationMs: pass2Duration,
    },
  };
}

// ==================== Rate Limit Configuration ====================

const RATE_LIMIT_TOKENS_PER_MINUTE = 8000;
const RATE_LIMIT_BUFFER_SECONDS = 15; // Extra buffer to ensure bucket has refilled

/**
 * Calculate delay needed to respect rate limits based on token usage.
 * @param outputTokens - Number of output tokens used in previous request
 * @returns Delay in milliseconds
 */
function calculateRateLimitDelay(outputTokens: number): number {
  if (outputTokens <= RATE_LIMIT_TOKENS_PER_MINUTE) {
    // Under limit, just add a small buffer
    return RATE_LIMIT_BUFFER_SECONDS * 1000;
  }

  // Calculate how long to wait for the token bucket to refill
  // Tokens refill at RATE_LIMIT_TOKENS_PER_MINUTE per minute
  const tokensOverLimit = outputTokens - RATE_LIMIT_TOKENS_PER_MINUTE;
  const minutesToWait = tokensOverLimit / RATE_LIMIT_TOKENS_PER_MINUTE;
  const secondsToWait = Math.ceil(minutesToWait * 60) + RATE_LIMIT_BUFFER_SECONDS;

  return secondsToWait * 1000;
}

/**
 * Sleep helper for rate limit delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Pass 1: Question-Level Extraction ====================

interface Pass1Input {
  survey: Survey360;
  responses: Survey360Response[];
  questions: SurveyQuestion[];
}

interface Pass1Result {
  summaries: QuestionSummary[];
  outputTokens: number;
}

/**
 * Run Pass 1: Extract themes, strengths, and gaps per question.
 * Returns both summaries and token usage for rate limit management.
 */
async function runPass1(
  anthropic: Anthropic,
  input: Pass1Input
): Promise<Pass1Result> {
  const { survey, responses, questions } = input;

  // Prepare responses grouped by question
  const questionBlocks = preparePass1Input(
    responses.map((r) => ({
      participant_id: r.participant_id,
      responses: r.responses,
      response_ids: r.response_ids,
    })),
    questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      scale_max: q.scale_max,
    }))
  );

  const prompt = buildPass1Prompt({
    employeeName: survey.employee_name || 'the employee',
    surveyTitle: survey.survey_name || survey.survey_title || '360 Feedback Survey',
    totalResponseCount: responses.length,
    questionBlocks,
  });

  console.log(`[Pass1] Prompt built, ${prompt.length} chars. Calling Claude API...`);
  console.log(`[Pass1] Model: ${pass1Config.model}, maxTokens: ${pass1Config.maxTokens}`);

  const apiCallStart = Date.now();
  let responseText = '';
  let usage: { input_tokens?: number; output_tokens?: number } = {};
  let stopReason = '';

  try {
    // Use streaming to avoid timeout issues with large responses
    console.log(`[Pass1] Using streaming API to avoid timeout...`);
    const stream = anthropic.messages.stream({
      model: pass1Config.model,
      max_tokens: pass1Config.maxTokens,
      temperature: pass1Config.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    // Track progress during streaming
    let tokenCount = 0;
    let lastProgressLog = Date.now();
    const PROGRESS_LOG_INTERVAL = 10000; // Log every 10 seconds

    stream.on('text', (text) => {
      responseText += text;
      tokenCount++;

      // Log progress periodically
      const now = Date.now();
      if (now - lastProgressLog > PROGRESS_LOG_INTERVAL) {
        const elapsed = Math.round((now - apiCallStart) / 1000);
        console.log(`[Pass1] Streaming progress: ${responseText.length} chars, ~${tokenCount} tokens, ${elapsed}s elapsed`);
        lastProgressLog = now;
      }
    });

    // Wait for the stream to complete
    const finalMessage = await stream.finalMessage();

    usage = finalMessage.usage || {};
    stopReason = finalMessage.stop_reason || '';

    console.log(`[Pass1] API call completed after ${Date.now() - apiCallStart}ms`);
  } catch (apiError: any) {
    console.error(`[Pass1] API call FAILED after ${Date.now() - apiCallStart}ms`);
    console.error(`[Pass1] Error name: ${apiError.name}`);
    console.error(`[Pass1] Error message: ${apiError.message}`);
    console.error(`[Pass1] Error status: ${apiError.status}`);
    if (apiError.error) {
      console.error(`[Pass1] Error details: ${JSON.stringify(apiError.error)}`);
    }
    // Log partial response if we got any
    if (responseText.length > 0) {
      console.error(`[Pass1] Partial response received (${responseText.length} chars) before error`);
    }
    throw apiError;
  }

  console.log(`[Pass1] Claude API response received. Usage: ${JSON.stringify(usage)}, Stop reason: ${stopReason}`);

  // With streaming, we already have the text in responseText
  if (!responseText || responseText.length === 0) {
    console.error(`[Pass1] Empty response received from Claude API`);
    throw new Error('Empty response from Claude in Pass 1');
  }

  console.log(`[Pass1] Response received: ${responseText.length} chars`);

  // Parse the JSON array response
  let summaries;
  try {
    summaries = extractJsonArrayFromResponse(responseText);
    console.log(`[Pass1] Parsed ${Array.isArray(summaries) ? summaries.length : 0} question summaries`);
  } catch (parseError: any) {
    console.error(`[Pass1] JSON parse failed: ${parseError.message}`);
    console.error(`[Pass1] Response preview: ${responseText.slice(0, 500)}...`);
    throw parseError;
  }

  if (!Array.isArray(summaries)) {
    throw new Error('Pass 1 did not return a valid JSON array of question summaries');
  }

  // Validate structure
  (summaries as Array<Record<string, unknown>>).forEach((summary, idx) => {
    if (!summary.question_id || !summary.question_text) {
      console.warn(`[Pass1] Question summary ${idx} missing required fields`);
    }
  });

  return {
    summaries: summaries as QuestionSummary[],
    outputTokens: usage.output_tokens || 0,
  };
}

// ==================== Pass 2: Global Synthesis ====================

interface Pass2Input {
  survey: Survey360;
  questionSummaries: QuestionSummary[];
  relationshipsWithResponses: ParticipantRelationship[];
  tone: 'standard' | 'softer';
}

/**
 * Run Pass 2: Synthesize question summaries into final report.
 */
async function runPass2(
  anthropic: Anthropic,
  input: Pass2Input
): Promise<Record<string, unknown>> {
  const { survey, questionSummaries, relationshipsWithResponses, tone } = input;

  // Format question summaries for the prompt
  const questionSummariesFormatted = formatQuestionSummaries(questionSummaries);

  // Count total responses from summaries
  const totalResponseCount = questionSummaries.reduce((sum, qs) => sum + qs.response_count, 0);

  const prompt = buildPass2Prompt({
    employeeName: survey.employee_name || 'the employee',
    surveyTitle: survey.survey_name || survey.survey_title || '360 Feedback Survey',
    totalResponseCount: Math.ceil(totalResponseCount / questionSummaries.length), // Average per question
    relationshipsWithResponses,
    questionSummariesFormatted,
    tone,
  });

  console.log(`[Pass2] Prompt built, ${prompt.length} chars. Calling Claude API...`);
  console.log(`[Pass2] Model: ${pass2Config.model}, maxTokens: ${pass2Config.maxTokens}`);

  const apiCallStart = Date.now();
  let responseText = '';

  try {
    // Use streaming to avoid timeout issues with large responses
    console.log(`[Pass2] Using streaming API to avoid timeout...`);
    const stream = anthropic.messages.stream({
      model: pass2Config.model,
      max_tokens: pass2Config.maxTokens,
      temperature: pass2Config.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    // Track progress during streaming
    let lastProgressLog = Date.now();
    const PROGRESS_LOG_INTERVAL = 10000; // Log every 10 seconds

    stream.on('text', (text) => {
      responseText += text;

      const now = Date.now();
      if (now - lastProgressLog > PROGRESS_LOG_INTERVAL) {
        const elapsed = Math.round((now - apiCallStart) / 1000);
        console.log(`[Pass2] Streaming progress: ${responseText.length} chars, ${elapsed}s elapsed`);
        lastProgressLog = now;
      }
    });

    const finalMessage = await stream.finalMessage();
    console.log(`[Pass2] API call completed after ${Date.now() - apiCallStart}ms`);
    console.log(`[Pass2] Claude API response received. Usage: ${JSON.stringify(finalMessage.usage)}`);
  } catch (apiError: any) {
    console.error(`[Pass2] API call FAILED after ${Date.now() - apiCallStart}ms`);
    console.error(`[Pass2] Error: ${apiError.name} - ${apiError.message}`);
    if (responseText.length > 0) {
      console.error(`[Pass2] Partial response received (${responseText.length} chars) before error`);
    }
    throw apiError;
  }

  if (!responseText || responseText.length === 0) {
    throw new Error('Empty response from Claude in Pass 2');
  }

  // Parse the JSON object response
  const analysis = extractJsonFromResponse(responseText);

  return analysis;
}

// ==================== Validation ====================

/**
 * Calculate what percentage of response_ids from input appear in Pass 1 citations.
 */
function validatePass1Coverage(
  responses: Survey360Response[],
  questions: SurveyQuestion[],
  summaries: QuestionSummary[]
): number {
  // Collect all response_ids from input
  const allResponseIds = new Set<string>();
  responses.forEach((r) => {
    questions.forEach((q) => {
      const answer = r.responses[q.id];
      if (answer !== undefined && answer !== null && answer !== '') {
        const responseId = r.response_ids?.[q.id] || r.participant_id;
        allResponseIds.add(responseId);
      }
    });
  });

  // Collect all cited response_ids from Pass 1 summaries
  const citedIds = new Set<string>();
  summaries.forEach((summary) => {
    // From themes
    summary.themes?.forEach((theme) => {
      theme.evidence?.forEach((ev) => {
        ev.citations?.forEach((c) => {
          if (c.response_id) citedIds.add(c.response_id);
        });
      });
    });
    // From strengths
    summary.strengths?.forEach((s) => {
      s.citations?.forEach((c) => {
        if (c.response_id) citedIds.add(c.response_id);
      });
    });
    // From gaps
    summary.gaps?.forEach((g) => {
      g.citations?.forEach((c) => {
        if (c.response_id) citedIds.add(c.response_id);
      });
    });
  });

  if (allResponseIds.size === 0) return 100;
  return (citedIds.size / allResponseIds.size) * 100;
}

// ==================== Existing Helper Functions ====================

/**
 * Compute frequency for each theme based on unique response_ids in citations.
 * This replaces AI-estimated frequency with actual citation-backed counts.
 */
function computeThemeFrequencies(themes: unknown): unknown[] {
  if (!Array.isArray(themes)) return [];

  return themes.map((theme) => {
    if (typeof theme !== 'object' || theme === null) return theme;

    const themeObj = theme as Record<string, unknown>;
    const supportingEvidence = themeObj.supporting_evidence;

    if (!Array.isArray(supportingEvidence)) {
      // No supporting evidence, frequency is 0
      return { ...themeObj, frequency: 0 };
    }

    // Collect all unique response_ids from citations across all supporting evidence
    const uniqueResponseIds = new Set<string>();

    supportingEvidence.forEach((evidence) => {
      if (typeof evidence === 'object' && evidence !== null && 'citations' in evidence) {
        const evidenceObj = evidence as { citations?: Array<{ response_id?: string }> };
        if (Array.isArray(evidenceObj.citations)) {
          evidenceObj.citations.forEach((citation) => {
            if (citation.response_id) {
              uniqueResponseIds.add(citation.response_id);
            }
          });
        }
      }
    });

    // Frequency = number of unique responses cited (each response = 1 reviewer)
    return { ...themeObj, frequency: uniqueResponseIds.size };
  });
}

/**
 * Extract citations from analysis result and flatten for database storage
 */
function extractCitationsFromAnalysis(analysis: Record<string, unknown>): AnalysisResultWithCitations['citations'] {
  const citations: AnalysisResultWithCitations['citations'] = [];

  // Helper to extract citations from CitedStatement arrays
  const extractFromStatements = (
    statements: unknown[],
    sectionType: AnalysisResultWithCitations['citations'][0]['section_type']
  ) => {
    if (!Array.isArray(statements)) return;

    statements.forEach((stmt, sectionIndex) => {
      if (typeof stmt === 'object' && stmt !== null && 'citations' in stmt) {
        const citedStmt = stmt as { text: string; citations?: Array<{ response_id: string; snippet: string; relevance_score?: number }> };
        if (Array.isArray(citedStmt.citations)) {
          citedStmt.citations.forEach((citation, statementIndex) => {
            citations.push({
              response_id: citation.response_id,
              section_type: sectionType,
              section_index: sectionIndex,
              statement_index: statementIndex,
              snippet: citation.snippet,
              relevance_score: citation.relevance_score,
            });
          });
        }
      }
    });
  };

  // Extract from themes (supporting_evidence may have citations)
  if (Array.isArray(analysis.themes)) {
    analysis.themes.forEach((theme: unknown, themeIndex: number) => {
      if (typeof theme === 'object' && theme !== null && 'supporting_evidence' in theme) {
        const themeObj = theme as { supporting_evidence?: unknown[] };
        if (Array.isArray(themeObj.supporting_evidence)) {
          themeObj.supporting_evidence.forEach((evidence, evidenceIndex) => {
            if (typeof evidence === 'object' && evidence !== null && 'citations' in evidence) {
              const citedEvidence = evidence as { text: string; citations?: Array<{ response_id: string; snippet: string; relevance_score?: number }> };
              if (Array.isArray(citedEvidence.citations)) {
                citedEvidence.citations.forEach((citation, citationIndex) => {
                  citations.push({
                    response_id: citation.response_id,
                    section_type: 'theme',
                    section_index: themeIndex,
                    statement_index: evidenceIndex * 100 + citationIndex, // Composite index for theme evidence
                    snippet: citation.snippet,
                    relevance_score: citation.relevance_score,
                  });
                });
              }
            }
          });
        }
      }
    });
  }

  // Extract from other sections
  extractFromStatements(analysis.overall_strengths as unknown[], 'strength');
  extractFromStatements(analysis.development_areas as unknown[], 'development');
  extractFromStatements(analysis.recommendations as unknown[], 'recommendation');
  extractFromStatements(analysis.consensus_areas as unknown[], 'consensus');
  extractFromStatements(analysis.outlier_opinions as unknown[], 'outlier');
  // Also check for 'outliers' (new field name)
  extractFromStatements(analysis.outliers as unknown[], 'outlier');

  return citations;
}

/**
 * Count total statements in analysis
 */
function countStatements(analysis: Record<string, unknown>): number {
  let count = 0;

  const countArray = (arr: unknown) => {
    if (Array.isArray(arr)) count += arr.length;
  };

  countArray(analysis.overall_strengths);
  countArray(analysis.development_areas);
  countArray(analysis.recommendations);
  countArray(analysis.consensus_areas);
  countArray(analysis.outlier_opinions);
  countArray(analysis.outliers);

  // Count theme supporting evidence
  if (Array.isArray(analysis.themes)) {
    analysis.themes.forEach((theme: unknown) => {
      if (typeof theme === 'object' && theme !== null && 'supporting_evidence' in theme) {
        const themeObj = theme as { supporting_evidence?: unknown[] };
        if (Array.isArray(themeObj.supporting_evidence)) {
          count += themeObj.supporting_evidence.length;
        }
      }
    });
  }

  return count;
}

/**
 * Count statements that have citations
 */
function countStatementsWithCitations(analysis: Record<string, unknown>): number {
  let count = 0;

  const countCitedArray = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      if (typeof item === 'object' && item !== null && 'citations' in item) {
        const cited = item as { citations?: unknown[] };
        if (Array.isArray(cited.citations) && cited.citations.length > 0) {
          count++;
        }
      }
    });
  };

  countCitedArray(analysis.overall_strengths);
  countCitedArray(analysis.development_areas);
  countCitedArray(analysis.recommendations);
  countCitedArray(analysis.consensus_areas);
  countCitedArray(analysis.outlier_opinions);
  countCitedArray(analysis.outliers);

  // Count theme supporting evidence with citations
  if (Array.isArray(analysis.themes)) {
    analysis.themes.forEach((theme: unknown) => {
      if (typeof theme === 'object' && theme !== null && 'supporting_evidence' in theme) {
        const themeObj = theme as { supporting_evidence?: unknown[] };
        countCitedArray(themeObj.supporting_evidence);
      }
    });
  }

  return count;
}

/**
 * Attempt to repair common JSON issues from AI responses
 */
function repairJson(text: string): string {
  let repaired = text;

  // Remove trailing commas before ] or }
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix unescaped newlines in strings (common AI issue)
  repaired = repaired.replace(/([^\\])\\n/g, '$1\\\\n');

  // Try to close unclosed arrays/objects at the end
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  // Add missing closing brackets/braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  return repaired;
}

/**
 * Extract JSON object from response with error recovery
 */
function extractJsonFromResponse(text: string): Record<string, unknown> {
  let jsonText = text.trim();

  // Try to find JSON in code blocks first
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  } else {
    // Try to find raw JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  // First attempt: parse as-is
  try {
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.log('[extractJsonFromResponse] First parse attempt failed, trying repair...');

    // Second attempt: try to repair common issues
    try {
      const repaired = repairJson(jsonText);
      return JSON.parse(repaired);
    } catch (secondError) {
      console.log('[extractJsonFromResponse] Repair attempt failed, trying truncation recovery...');

      // Third attempt: find the last complete object/array
      for (let i = jsonText.length - 1; i > jsonText.length / 2; i--) {
        if (jsonText[i] === '}') {
          const truncated = jsonText.substring(0, i + 1);
          const repaired = repairJson(truncated);
          try {
            const result = JSON.parse(repaired);
            console.log('[extractJsonFromResponse] Recovered JSON by truncating at position', i);
            return result;
          } catch {
            // Continue searching
          }
        }
      }

      // If all else fails, throw the original error
      console.error('[extractJsonFromResponse] All recovery attempts failed');
      throw firstError;
    }
  }
}

/**
 * Extract JSON array from response with error recovery (for Pass 1)
 */
function extractJsonArrayFromResponse(text: string): unknown[] {
  let jsonText = text.trim();
  console.log(`[extractJsonArrayFromResponse] DEBUG - Input length: ${jsonText.length}`);

  // Try to find JSON in code blocks first
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
    console.log(`[extractJsonArrayFromResponse] DEBUG - Found JSON in code block, extracted ${jsonText.length} chars`);
  } else {
    // Try to find raw JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
      console.log(`[extractJsonArrayFromResponse] DEBUG - Found raw JSON array, extracted ${jsonText.length} chars`);
    } else {
      console.log(`[extractJsonArrayFromResponse] DEBUG - No JSON array pattern found in response`);
      console.log(`[extractJsonArrayFromResponse] DEBUG - Response starts with: ${jsonText.slice(0, 200)}`);
    }
  }

  // First attempt: parse as-is
  try {
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.log('[extractJsonArrayFromResponse] First parse attempt failed, trying repair...');

    // Second attempt: try to repair common issues
    try {
      const repaired = repairJson(jsonText);
      return JSON.parse(repaired);
    } catch (secondError) {
      console.log('[extractJsonArrayFromResponse] Repair attempt failed, trying truncation recovery...');

      // Third attempt: find the last complete array
      for (let i = jsonText.length - 1; i > jsonText.length / 2; i--) {
        if (jsonText[i] === ']') {
          const truncated = jsonText.substring(0, i + 1);
          const repaired = repairJson(truncated);
          try {
            const result = JSON.parse(repaired);
            console.log('[extractJsonArrayFromResponse] Recovered JSON by truncating at position', i);
            return result;
          } catch {
            // Continue searching
          }
        }
      }

      // If all else fails, throw the original error
      console.error('[extractJsonArrayFromResponse] All recovery attempts failed');
      throw firstError;
    }
  }
}
