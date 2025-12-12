/**
 * Survey Analyzer Service
 *
 * Handles 360 survey analysis with citation tracking for admin audit trail.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Survey360,
  Survey360Response,
  Survey360Participant,
  Survey360ReportWithCitations,
  SurveyQuestion,
} from '../../types';
import {
  surveyAnalyzerConfig,
  buildSurveyAnalyzerPrompt,
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
    version: 'v1-citations';
    elapsedMs: number;
    totalCitations: number;
    citationCoverage: number; // 0-100, percentage of statements with citations
  };
}

/**
 * Analyze survey responses with citation tracking.
 * This generates a report where each statement is linked to source response IDs.
 */
export async function analyzeWithCitations(input: AnalysisInput): Promise<AnalysisResultWithCitations> {
  const startTime = Date.now();
  const { survey, responses, participants, questions, tone = 'standard' } = input;

  console.log('[surveyAnalyzerService] Starting citation-enabled analysis');

  // Validate API key before proceeding
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured. Please check your environment settings.');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const structuredResponses = prepareResponsesForAnalysis(responses, participants, questions);
  const questionsFormatted = questions.map((q, i) => `${i + 1}. ${q.question} (${q.type})`).join('\n');

  const prompt = buildSurveyAnalyzerPrompt({
    employeeName: survey.employee_name,
    surveyTitle: survey.survey_title,
    responseCount: responses.length,
    questionsFormatted,
    structuredResponses,
    tone,
  });

  const response = await anthropic.messages.create({
    model: surveyAnalyzerConfig.model,
    max_tokens: surveyAnalyzerConfig.maxTokens,
    temperature: surveyAnalyzerConfig.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const analysis = extractJsonFromResponse(content.text);

  // Extract and flatten all citations for database storage
  const flattenedCitations = extractCitationsFromAnalysis(analysis);

  // Calculate citation coverage
  const totalStatements = countStatements(analysis);
  const statementsWithCitations = countStatementsWithCitations(analysis);
  const citationCoverage = totalStatements > 0 ? Math.round((statementsWithCitations / totalStatements) * 100) : 0;

  // Compute frequency for themes from citations (not AI-estimated)
  const themesWithFrequency = computeThemeFrequencies(analysis.themes);

  console.log(`[surveyAnalyzerService] Citation analysis complete: ${flattenedCitations.length} citations, ${citationCoverage}% coverage`);

  return {
    report: {
      survey_id: survey.id,
      themes: themesWithFrequency as Survey360ReportWithCitations['themes'] || [],
      overall_strengths: analysis.overall_strengths as Survey360ReportWithCitations['overall_strengths'] || [],
      development_areas: analysis.development_areas as Survey360ReportWithCitations['development_areas'] || [],
      recommendations: analysis.recommendations as Survey360ReportWithCitations['recommendations'] || [],
      sentiment_by_relationship: analysis.sentiment_by_relationship as Record<string, number> || {},
      consensus_areas: analysis.consensus_areas as Survey360ReportWithCitations['consensus_areas'] || [],
      outlier_opinions: analysis.outlier_opinions as Survey360ReportWithCitations['outlier_opinions'] || [],
      generated_at: new Date().toISOString(),
      generated_by: surveyAnalyzerConfig.model,
      has_citations: true,
      citation_version: '1.0',
      total_citations: flattenedCitations.length,
      citation_coverage: citationCoverage,
    },
    citations: flattenedCitations,
    meta: {
      version: 'v1-citations',
      elapsedMs: Date.now() - startTime,
      totalCitations: flattenedCitations.length,
      citationCoverage,
    },
  };
}

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
  // This is tricky - we need to find strings and escape newlines within them
  // For now, just replace literal newlines that aren't already escaped
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
 * Extract JSON from v1 prompt response with error recovery
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
      // Look for the last valid closing brace that makes valid JSON
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
 * Prepare responses for analysis with response IDs for citation tracking.
 * Each answer includes a [response_id: uuid] marker that Claude can reference.
 * The response_id maps to a specific question-answer row in feedback_360_responses.
 */
function prepareResponsesForAnalysis(
  responses: Survey360Response[],
  participants: Survey360Participant[],
  questions: SurveyQuestion[]
): string {
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const byRelationship: Record<string, Array<{ participant: Survey360Participant; response: Survey360Response }>> = {};

  responses.forEach((response) => {
    const participant = participantMap.get(response.participant_id);
    if (!participant) return;

    if (!byRelationship[participant.relationship]) {
      byRelationship[participant.relationship] = [];
    }
    byRelationship[participant.relationship].push({ participant, response });
  });

  let output = '';

  Object.entries(byRelationship).forEach(([relationship, items]) => {
    output += `\n### ${relationship.toUpperCase()} (${items.length} response${items.length !== 1 ? 's' : ''})\n\n`;

    items.forEach((item, index) => {
      output += `**${relationship.charAt(0).toUpperCase() + relationship.slice(1)} #${index + 1}:**\n`;

      questions.forEach((question) => {
        const answer = item.response.responses[question.id];
        if (answer !== undefined && answer !== null && answer !== '') {
          // Get the specific response ID for this question-answer pair
          // This is the actual row ID in feedback_360_responses table
          const responseId = item.response.response_ids?.[question.id] || item.response.id;

          output += `[response_id: ${responseId}]\n`;
          output += `Q: ${question.question}\n`;

          if (question.type === 'rating') {
            output += `A: ${answer}/${question.scale_max || 5}\n`;
          } else if (question.type === 'text') {
            output += `A: "${answer}"\n`;
          } else if (question.type === 'multiple_choice') {
            output += `A: ${answer}\n`;
          }
          output += '\n';
        }
      });
    });
  });

  return output;
}

