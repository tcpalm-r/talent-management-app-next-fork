/**
 * Survey Analyzer Service
 *
 * Handles 360 survey analysis with automatic fallback from v2 (skill-based) to v1 (prompt-based).
 * Provides notification callbacks for monitoring which API version was used.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Survey360,
  Survey360Response,
  Survey360Participant,
  Survey360Report,
  SurveyQuestion,
} from '../../types';
import { surveyAnalyzerConfig, buildSurveyAnalyzerPrompt } from '../prompts';

export interface AnalysisInput {
  survey: Survey360;
  responses: Survey360Response[];
  participants: Survey360Participant[];
  questions: SurveyQuestion[];
  tone?: 'standard' | 'softer';
}

export interface AnalysisResult {
  report: Omit<Survey360Report, 'id' | 'created_at' | 'updated_at'>;
  meta: {
    version: 'v1-prompt' | 'v2-skill' | 'fallback';
    elapsedMs: number;
    fallbackUsed?: boolean;
    fallbackReason?: string;
  };
}

export type FallbackNotifyFn = (reason: string, originalError: string) => void;

// Default no-op notification
const defaultNotify: FallbackNotifyFn = () => {};

// Environment flag to enable/disable v2 skill-based analysis
const USE_SKILL_API = process.env.NEXT_PUBLIC_USE_SURVEY_ANALYZER_SKILL === 'true';
const SKILL_ID = process.env.SURVEY_ANALYZER_SKILL_ID;

/**
 * Analyze survey responses with automatic fallback
 */
export async function analyzeSurveyWithFallback(
  input: AnalysisInput,
  onFallback: FallbackNotifyFn = defaultNotify
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // If skill API is disabled or no skill ID, go straight to v1
  if (!USE_SKILL_API || !SKILL_ID) {
    console.log('[surveyAnalyzerService] Skill API disabled, using v1 prompt');
    return analyzeWithPrompt(input, startTime);
  }

  // Try v2 (skill-based) first
  try {
    console.log('[surveyAnalyzerService] Attempting v2 skill-based analysis');
    const v2Result = await analyzeWithSkill(input, startTime);
    console.log('[surveyAnalyzerService] v2 skill analysis succeeded');
    return v2Result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const reason = 'v2 skill API failed';

    console.warn('[surveyAnalyzerService] v2 failed, falling back to v1:', errorMessage);
    onFallback(reason, errorMessage);

    try {
      const v1Result = await analyzeWithPrompt(input, startTime);
      return {
        ...v1Result,
        meta: {
          ...v1Result.meta,
          fallbackUsed: true,
          fallbackReason: reason,
        },
      };
    } catch (v1Error) {
      // Both failed - return fallback analysis
      console.error('[surveyAnalyzerService] Both v2 and v1 failed');
      return {
        report: generateFallbackAnalysis(input),
        meta: {
          version: 'fallback',
          elapsedMs: Date.now() - startTime,
          fallbackUsed: true,
          fallbackReason: 'Both v2 and v1 API calls failed',
        },
      };
    }
  }
}

/**
 * Analyze using v1 prompt-based approach
 */
async function analyzeWithPrompt(input: AnalysisInput, startTime: number): Promise<AnalysisResult> {
  const { survey, responses, participants, questions, tone = 'standard' } = input;

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

  return {
    report: {
      survey_id: survey.id,
      executive_summary: analysis.executive_summary || null,
      themes: analysis.themes || [],
      overall_strengths: analysis.overall_strengths || [],
      development_areas: analysis.development_areas || [],
      recommendations: analysis.recommendations || [],
      sentiment_by_relationship: analysis.sentiment_by_relationship || {},
      key_insights: analysis.key_insights || [],
      consensus_areas: analysis.consensus_areas || [],
      outlier_opinions: analysis.outlier_opinions || [],
      generated_at: new Date().toISOString(),
      generated_by: surveyAnalyzerConfig.model,
    },
    meta: {
      version: 'v1-prompt',
      elapsedMs: Date.now() - startTime,
    },
  };
}

/**
 * Analyze using v2 skill-based approach
 */
async function analyzeWithSkill(input: AnalysisInput, startTime: number): Promise<AnalysisResult> {
  const { survey, responses, participants, questions, tone = 'standard' } = input;

  if (!SKILL_ID) {
    throw new Error('SURVEY_ANALYZER_SKILL_ID not configured');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const structuredResponses = prepareResponsesForAnalysis(responses, participants, questions);
  const questionsFormatted = questions.map((q, i) => `${i + 1}. ${q.question} (${q.type})`).join('\n');

  // Prepare skill input as JSON
  const skillInput = JSON.stringify({
    employeeName: survey.employee_name,
    surveyTitle: survey.survey_title,
    responseCount: responses.length,
    questionsFormatted,
    structuredResponses,
    tone,
  });

  // Call Claude with the custom skill
  const response = await (anthropic.beta.messages.create as Function)({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    betas: ['code-execution-2025-08-25', 'skills-2025-10-02'],
    container: {
      skills: [
        {
          type: 'custom',
          skill_id: SKILL_ID,
          version: 'latest',
        },
      ],
    },
    messages: [
      {
        role: 'user',
        content: `Analyze this 360 survey using the 360 Survey Analyzer skill.

Input:
${skillInput}

Generate the analysis now. Return ONLY the JSON response.`,
      },
    ],
    tools: [
      {
        type: 'code_execution_20250825',
        name: 'code_execution',
      },
    ],
  });

  // Extract text from response
  let fullText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      fullText += block.text;
    }
  }

  // Extract JSON from skill response (may include reasoning)
  const analysis = extractJsonFromSkillResponse(fullText);

  return {
    report: {
      survey_id: survey.id,
      executive_summary: analysis.executive_summary || null,
      themes: analysis.themes || [],
      overall_strengths: analysis.overall_strengths || [],
      development_areas: analysis.development_areas || [],
      recommendations: analysis.recommendations || [],
      sentiment_by_relationship: analysis.sentiment_by_relationship || {},
      key_insights: analysis.key_insights || [],
      consensus_areas: analysis.consensus_areas || [],
      outlier_opinions: analysis.outlier_opinions || [],
      generated_at: new Date().toISOString(),
      generated_by: 'claude-sonnet-4-5-20250929-skill',
    },
    meta: {
      version: 'v2-skill',
      elapsedMs: Date.now() - startTime,
    },
  };
}

/**
 * Extract JSON from v1 prompt response
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

  return JSON.parse(jsonText);
}

/**
 * Extract JSON from v2 skill response (may include Claude's reasoning)
 */
function extractJsonFromSkillResponse(fullText: string): Record<string, unknown> {
  // Try code blocks first
  const jsonBlockMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch {
      // Continue to other methods
    }
  }

  // Try to find JSON after common markers
  const markers = [
    /(?:here(?:'s| is) the (?:analysis|report|json)[:\s]*)\s*(\{[\s\S]*\})/i,
    /(?:final (?:analysis|report|output)[:\s]*)\s*(\{[\s\S]*\})/i,
    /(?:## (?:analysis|report|output)[:\s]*)\s*(\{[\s\S]*\})/i,
  ];

  for (const marker of markers) {
    const match = fullText.match(marker);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // Continue to next marker
      }
    }
  }

  // Find the largest JSON object in the text
  const jsonMatches = fullText.match(/\{[\s\S]*?\}/g);
  if (jsonMatches) {
    // Sort by length (largest first) and try to parse
    const sorted = jsonMatches.sort((a, b) => b.length - a.length);
    for (const jsonStr of sorted) {
      try {
        const parsed = JSON.parse(jsonStr);
        // Verify it looks like our expected structure
        if (parsed.executive_summary || parsed.themes || parsed.recommendations) {
          return parsed;
        }
      } catch {
        // Continue to next match
      }
    }
  }

  // Last resort: try to parse the whole thing
  const cleanedText = fullText.match(/\{[\s\S]*\}/);
  if (cleanedText) {
    return JSON.parse(cleanedText[0]);
  }

  throw new Error('Could not extract JSON from skill response');
}

/**
 * Prepare responses for analysis (same as original)
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

/**
 * Generate fallback analysis if both APIs fail
 */
function generateFallbackAnalysis(input: AnalysisInput): Omit<Survey360Report, 'id' | 'created_at' | 'updated_at'> {
  const { survey, responses, participants } = input;

  return {
    survey_id: survey.id,
    themes: [
      {
        theme: 'Overall Performance',
        sentiment: 'mixed',
        frequency: responses.length,
        supporting_evidence: ['Survey responses collected successfully - detailed AI analysis unavailable'],
        relationships_mentioned: [],
      },
    ],
    overall_strengths: ['Received feedback from multiple perspectives'],
    development_areas: ['Detailed analysis requires AI processing'],
    recommendations: ['Review individual responses for detailed insights', 'Consider re-running AI analysis'],
    sentiment_by_relationship: { overall: 0.5 },
    key_insights: [`Collected ${responses.length} responses from ${participants.length} participants`],
    consensus_areas: [],
    outlier_opinions: [],
    generated_at: new Date().toISOString(),
    generated_by: 'fallback-analyzer',
  };
}

/**
 * Check if skill API is enabled
 */
export function isSkillApiEnabled(): boolean {
  return USE_SKILL_API && !!SKILL_ID;
}
