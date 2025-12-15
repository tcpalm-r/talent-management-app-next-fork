/**
 * Survey Analyzer Service
 *
 * Handles 360 survey analysis with citation tracking for admin audit trail.
 * Uses a two-pass pipeline to reduce hallucination:
 * - Pass 1: Question-level extraction (themes, strengths, gaps per question)
 * - Pass 2: Global synthesis (cross-cutting themes, recommendations, group analysis)
 */

import Anthropic from '@anthropic-ai/sdk';
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
 */
export async function analyzeWithCitations(input: AnalysisInput): Promise<AnalysisResultWithCitations> {
  const startTime = Date.now();
  const { survey, responses, participants, questions, tone = 'standard' } = input;

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

  const questionSummaries = await runPass1(anthropic, {
    survey,
    responses,
    questions,
  });

  const pass1Duration = Date.now() - pass1Start;
  console.log(`[surveyAnalyzerService] Pass 1 complete: ${questionSummaries.length} question summaries in ${pass1Duration}ms`);

  // Validate Pass 1 coverage
  const pass1Coverage = validatePass1Coverage(responses, questions, questionSummaries);
  console.log(`[surveyAnalyzerService] Pass 1 citation coverage: ${pass1Coverage.toFixed(1)}%`);

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

// ==================== Pass 1: Question-Level Extraction ====================

interface Pass1Input {
  survey: Survey360;
  responses: Survey360Response[];
  questions: SurveyQuestion[];
}

/**
 * Run Pass 1: Extract themes, strengths, and gaps per question.
 */
async function runPass1(
  anthropic: Anthropic,
  input: Pass1Input
): Promise<QuestionSummary[]> {
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

  const response = await anthropic.messages.create({
    model: pass1Config.model,
    max_tokens: pass1Config.maxTokens,
    temperature: pass1Config.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  console.log(`[Pass1] Claude API response received. Usage: ${JSON.stringify(response.usage)}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude in Pass 1');
  }

  // Parse the JSON array response
  const summaries = extractJsonArrayFromResponse(content.text);

  if (!Array.isArray(summaries)) {
    throw new Error('Pass 1 did not return a valid JSON array of question summaries');
  }

  // Validate structure
  (summaries as Array<Record<string, unknown>>).forEach((summary, idx) => {
    if (!summary.question_id || !summary.question_text) {
      console.warn(`[Pass1] Question summary ${idx} missing required fields`);
    }
  });

  return summaries as QuestionSummary[];
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

  const response = await anthropic.messages.create({
    model: pass2Config.model,
    max_tokens: pass2Config.maxTokens,
    temperature: pass2Config.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  console.log(`[Pass2] Claude API response received. Usage: ${JSON.stringify(response.usage)}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude in Pass 2');
  }

  // Parse the JSON object response
  const analysis = extractJsonFromResponse(content.text);

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

  // Try to find JSON in code blocks first
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  } else {
    // Try to find raw JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
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
