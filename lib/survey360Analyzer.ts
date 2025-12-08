import Anthropic from '@anthropic-ai/sdk';
import type {
  Survey360,
  Survey360Response,
  Survey360Participant,
  Survey360Report,
  ThemeAnalysis,
  ParticipantRelationship,
  SurveyQuestion,
} from '../types';
import { surveyAnalyzerConfig, buildSurveyAnalyzerPrompt } from './prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisInput {
  survey: Survey360;
  responses: Survey360Response[];
  participants: Survey360Participant[];
  questions: SurveyQuestion[];
  tone?: 'standard' | 'softer';
}

/**
 * Analyzes 360 survey responses using Claude Sonnet 4.5 to identify themes,
 * extract insights, and generate actionable recommendations
 */
export async function analyzeSurvey360Responses(
  input: AnalysisInput
): Promise<Omit<Survey360Report, 'id' | 'created_at' | 'updated_at'>> {
  const { survey, responses, participants, questions, tone = 'standard' } = input;

  // Prepare structured data for AI analysis
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

  try {
    const response = await anthropic.messages.create({
      model: surveyAnalyzerConfig.model,
      max_tokens: surveyAnalyzerConfig.maxTokens,
      temperature: surveyAnalyzerConfig.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (handle code blocks and surrounding text)
    let jsonText = content.text.trim();

    // Try to find JSON in code blocks first
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1];
    } else {
      // Try to find raw JSON object (look for outermost braces)
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    const analysis = JSON.parse(jsonText);

    return {
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
    };
  } catch (error) {
    console.error('Error analyzing 360 survey:', error);

    // Provide fallback basic analysis if AI fails
    return generateFallbackAnalysis(input);
  }
}

/**
 * Prepare responses in a structured, readable format for AI analysis
 */
function prepareResponsesForAnalysis(
  responses: Survey360Response[],
  participants: Survey360Participant[],
  questions: SurveyQuestion[]
): string {
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Group responses by relationship type
  const byRelationship: Record<string, Array<{ participant: Survey360Participant; response: Survey360Response }>> = {};

  responses.forEach((response) => {
    const participant = participantMap.get(response.participant_id);
    if (!participant) return;

    if (!byRelationship[participant.relationship]) {
      byRelationship[participant.relationship] = [];
    }
    byRelationship[participant.relationship].push({ participant, response });
  });

  // Format output
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
 * Generate a basic analysis if AI analysis fails (fallback)
 */
function generateFallbackAnalysis(input: AnalysisInput): Omit<Survey360Report, 'id' | 'created_at' | 'updated_at'> {
  const { survey, responses, participants, questions } = input;

  // Calculate average ratings by relationship
  const sentimentByRelationship: Record<ParticipantRelationship, number> = {
    manager: 0,
    peer: 0,
    direct_report: 0,
    cross_functional: 0,
  };

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const relationshipCounts: Record<string, number> = {};

  responses.forEach((response) => {
    const participant = participantMap.get(response.participant_id);
    if (!participant) return;

    const ratingQuestions = questions.filter((q) => q.type === 'rating');
    let totalRating = 0;
    let ratingCount = 0;

    ratingQuestions.forEach((q) => {
      const rating = response.responses[q.id];
      if (typeof rating === 'number') {
        totalRating += rating / (q.scale_max || 5);
        ratingCount++;
      }
    });

    if (ratingCount > 0) {
      const avgRating = totalRating / ratingCount;
      sentimentByRelationship[participant.relationship] =
        (sentimentByRelationship[participant.relationship] * (relationshipCounts[participant.relationship] || 0) +
          avgRating) /
        ((relationshipCounts[participant.relationship] || 0) + 1);
      relationshipCounts[participant.relationship] = (relationshipCounts[participant.relationship] || 0) + 1;
    }
  });

  return {
    survey_id: survey.id,
    themes: [
      {
        theme: 'Overall Performance',
        sentiment: 'mixed',
        frequency: responses.length,
        supporting_evidence: ['Survey responses collected successfully - detailed AI analysis unavailable'],
        relationships_mentioned: Object.keys(relationshipCounts) as ParticipantRelationship[],
      },
    ],
    overall_strengths: ['Received feedback from multiple perspectives'],
    development_areas: ['Detailed analysis requires AI processing'],
    recommendations: ['Review individual responses for detailed insights', 'Consider re-running AI analysis'],
    sentiment_by_relationship: sentimentByRelationship,
    key_insights: [`Collected ${responses.length} responses from ${participants.length} participants`],
    consensus_areas: [],
    outlier_opinions: [],
    generated_at: new Date().toISOString(),
    generated_by: 'fallback-analyzer',
  };
}

/**
 * Get default 360 survey questions
 */
export function getDefault360Questions(): SurveyQuestion[] {
  return [
    {
      id: 'q1',
      question: "How would you rate this person's communication effectiveness?",
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q2',
      question: 'How well does this person collaborate and work in teams?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q3',
      question: 'How would you rate their leadership and initiative?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q4',
      question: 'How would you rate the quality of their work?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q5',
      question: 'How would you rate their problem-solving ability?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q6',
      question: 'How reliable and accountable is this person?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q7',
      question: 'How well does this person adapt to change?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q8',
      question: 'How would you rate their technical/functional expertise?',
      type: 'rating',
      required: true,
      scale_min: 1,
      scale_max: 5,
      scale_labels: { min: 'Poor', max: 'Excellent' },
    },
    {
      id: 'q9',
      question: "What are this person's greatest strengths?",
      type: 'text',
      required: true,
    },
    {
      id: 'q10',
      question: 'What areas could this person develop or improve?',
      type: 'text',
      required: true,
    },
    {
      id: 'q11',
      question: 'What should this person start doing, stop doing, or continue doing?',
      type: 'text',
      required: false,
    },
    {
      id: 'q12',
      question: 'Any additional comments or feedback?',
      type: 'text',
      required: false,
    },
  ];
}
