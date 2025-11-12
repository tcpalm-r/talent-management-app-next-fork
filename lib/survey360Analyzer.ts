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

const anthropic = new Anthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface AnalysisInput {
  survey: Survey360;
  responses: Survey360Response[];
  participants: Survey360Participant[];
  questions: SurveyQuestion[];
  tone?: 'standard' | 'softer';
}

/**
 * Analyzes 360 survey responses using Claude Sonnet 4 to identify themes,
 * extract insights, and generate actionable recommendations
 */
export async function analyzeSurvey360Responses(
  input: AnalysisInput
): Promise<Omit<Survey360Report, 'id' | 'created_at' | 'updated_at'>> {
  const { survey, responses, participants, questions, tone = 'standard' } = input;

  // Prepare structured data for AI analysis
  const structuredResponses = prepareResponsesForAnalysis(responses, participants, questions);

  const toneGuidance = tone === 'softer'
    ? '\n\nTONE GUIDANCE: Use a supportive and constructive tone. Frame challenges as growth opportunities. Balance criticism with encouragement. Focus on potential and progress rather than deficiencies. Use phrases like "opportunity to enhance" rather than "weakness" or "needs improvement".'
    : '';

  const prompt = `You are an expert organizational psychologist specializing in 360-degree feedback analysis. Analyze these survey responses to identify themes, patterns, and actionable insights.${toneGuidance}

EMPLOYEE BEING REVIEWED: ${survey.employee_name}
SURVEY TITLE: ${survey.survey_title}
TOTAL RESPONSES: ${responses.length}

SURVEY QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q.question} (${q.type})`).join('\n')}

RESPONSES BY RELATIONSHIP TYPE:
${structuredResponses}

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON object. Return exactly this structure:

{
  "executive_summary": "A concise 2-3 sentence overview of the employee's overall performance, key strengths, and primary development opportunities based on the 360 feedback. This should provide a high-level snapshot of the entire review.",
  "themes": [
    {
      "theme": "Concise theme name (e.g., 'Strong Communication Skills')",
      "sentiment": "very_positive" | "positive" | "mixed" | "needs_work" | "critical",
      "supporting_evidence": ["Synthesized summary of feedback (NO direct quotes)", "Another paraphrased observation"]
    }
  ],
  "overall_strengths": [
    "Specific strength mentioned by multiple participants",
    "Another key strength with consensus"
  ],
  "development_areas": [
    "Area for improvement with supporting evidence",
    "Another development opportunity"
  ],
  "recommendations": [
    "Actionable recommendation based on feedback",
    "Another specific action to take"
  ],
  "sentiment_by_relationship": {
    "overall": 0.84,
    "manager": 0.85,
    "peer": 0.78,
    "direct_report": 0.92,
    "cross_functional": 0.80
  },
  "key_insights": [
    "Important pattern or insight from the data",
    "Another significant observation"
  ],
  "consensus_areas": [
    "Area where most participants strongly agree",
    "Another point of consensus"
  ],
  "outlier_opinions": [
    "Unique or contrasting perspective worth noting",
    "Another divergent viewpoint"
  ]
}

CRITICAL - ANONYMITY & AGGREGATION REQUIREMENTS:
- NEVER include direct quotes or verbatim text from responses
- ALWAYS paraphrase and synthesize feedback across ALL sources (never separated by relationship type)
- NEVER mention specific relationship types like "manager specifically noted" or "direct reports said"
- NEVER provide counts or breakdowns by relationship type (e.g., "mentioned by 6 managers and 4 peers")
- Use only general, aggregated attributions:
  * "Feedback consistently indicated..."
  * "Multiple reviewers noted..."
  * "A common theme across feedback..."
  * "Many shared perspective..."
  * "Several mentioned..."
  * "A unique perspective was..."
- Combine ALL feedback into unified, anonymized observations regardless of reviewer relationship
- The sentiment_by_relationship field should contain BOTH:
  * An "overall" score (0-1) representing aggregate sentiment across all reviewers
  * Individual scores for each relationship type that provided feedback: "manager", "peer", "direct_report", "cross_functional"
  * Calculate each relationship score based on the tone, positivity, and constructiveness of that group's responses
  * If a relationship type had no responses, omit that key from the object

ANALYSIS GUIDELINES:
1. **Executive Summary**: Write a concise 2-3 sentence overview that captures the employee's overall performance trajectory, highlighting their top 1-2 strengths and 1-2 key development areas. This should give a reader an immediate understanding of the review's key takeaways.
2. **Themes**: Identify 5-8 major themes. Look for patterns across all responses combined.
3. **Supporting Evidence**: Paraphrase and synthesize feedback (NO direct quotes). Combine observations from all reviewers into unified statements.
4. **Sentiment Classification**: Use constructive language:
   - "very_positive": Exceptional strengths with strong consensus
   - "positive": Clear strengths recognized widely
   - "mixed": Balance of positive and constructive feedback
   - "needs_work": Areas requiring attention and development
   - "critical": Serious concerns requiring immediate action
5. **Sentiment Scores**: Calculate sentiment scores (0-1 scale) based on overall tone and constructiveness:
   - Overall: Aggregate sentiment across all reviewers
   - Per-relationship: Calculate separate scores for manager, peer, direct_report, and cross_functional groups
   - Base scores on positivity, constructiveness, and supportiveness of feedback from each group
6. **Strengths**: List 3-5 clear strengths. Synthesize feedback from all sources into unified statements.
7. **Development Areas**: Identify 3-5 areas for growth. Use paraphrased, aggregated summaries.
8. **Recommendations**: Provide 4-6 specific, actionable steps based on synthesized feedback.
9. **Key Insights**: Surface 3-5 important patterns or observations from all feedback combined.
10. **Consensus**: Highlight areas where there is broad agreement.
11. **Outliers**: Note any unique or contrasting perspectives, but do NOT attribute to specific relationship types.

ABSOLUTELY MAINTAIN STRICT ANONYMITY: Never reveal who said what, how many people in each role responded, or any breakdown by relationship type.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.3, // Lower temperature for more consistent analysis
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
      generated_by: 'claude-sonnet-4-20250514',
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
  const participantMap = new Map(participants.map(p => [p.id, p]));

  // Group responses by relationship type
  const byRelationship: Record<string, Array<{ participant: Survey360Participant; response: Survey360Response }>> = {};

  responses.forEach(response => {
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

      questions.forEach(question => {
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

  const participantMap = new Map(participants.map(p => [p.id, p]));
  const relationshipCounts: Record<string, number> = {};

  responses.forEach(response => {
    const participant = participantMap.get(response.participant_id);
    if (!participant) return;

    const ratingQuestions = questions.filter(q => q.type === 'rating');
    let totalRating = 0;
    let ratingCount = 0;

    ratingQuestions.forEach(q => {
      const rating = response.responses[q.id];
      if (typeof rating === 'number') {
        totalRating += rating / (q.scale_max || 5);
        ratingCount++;
      }
    });

    if (ratingCount > 0) {
      const avgRating = totalRating / ratingCount;
      sentimentByRelationship[participant.relationship] =
        (sentimentByRelationship[participant.relationship] * (relationshipCounts[participant.relationship] || 0) + avgRating) /
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
      question: 'How would you rate this person\'s communication effectiveness?',
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
      question: 'What are this person\'s greatest strengths?',
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
