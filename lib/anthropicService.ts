import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

// Initialize with a default that can be overridden
let anthropic: Anthropic | null = null;

// Auto-initialize if API key is in environment
if (apiKey) {
  anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // For client-side usage in development
  });
}

export function initializeAnthropic(key?: string) {
  const keyToUse = key || apiKey;
  if (keyToUse) {
    anthropic = new Anthropic({
      apiKey: keyToUse,
      dangerouslyAllowBrowser: true // For client-side usage in development
    });
  }
  return !!anthropic;
}

export function getAnthropicClient(): Anthropic {
  if (!anthropic && apiKey) {
    initializeAnthropic();
  }

  if (!anthropic) {
    throw new Error('Anthropic API not configured. Set NEXT_PUBLIC_ANTHROPIC_API_KEY in your environment.');
  }

  return anthropic;
}

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

export async function analyzeReviewWithAI(reviewText: string): Promise<AIAnalysisResult> {
  if (!anthropic) {
    throw new Error('Anthropic API not initialized. Please provide an API key.');
  }

  const prompt = `You are an expert HR analyst at Sonance, a premium audio company. Analyze this performance review and provide a comprehensive, structured assessment.

PERFORMANCE REVIEW:
${reviewText}

Please analyze this review and provide a JSON response with the following structure:

{
  "employeeName": "extracted full name",
  "title": "job title",
  "department": "department name",
  "email": "email if mentioned",
  
  "suggestedPerformance": "low/medium/high - based on results, goal achievement, quality of work",
  "suggestedPotential": "low/medium/high - based on learning agility, leadership qualities, growth mindset, adaptability",
  "confidence": 85,
  "reasoning": "2-3 sentences explaining the performance and potential assessment",
  
  "keyStrengths": ["3-5 specific strengths mentioned in the review"],
  "developmentAreas": ["3-5 specific areas for improvement"],
  "achievements": ["3-5 key accomplishments"],
  
  "objectives": ["5-7 SMART objectives tailored to this person's role at Sonance and their development areas"],
  "actionItems": [
    {
      "description": "Specific action based on review content",
      "dueDate": "30 days/60 days/90 days",
      "priority": "high/medium/low"
    }
  ],
  "successMetrics": ["5-7 measurable outcomes specific to this employee's goals at Sonance"],
  
  "sonanceSpecificInsights": ["3-4 insights about how this person can contribute to Sonance's mission of premium audio excellence, innovation, or customer experience"],
  "recommendedTimeline": "30 days/60 days/90 days/6 months/12 months"
}

IMPORTANT GUIDELINES:
1. Make objectives and action items SPECIFIC to what was mentioned in the review
2. Reference actual projects, skills, or situations from the review
3. For Sonance-specific insights, relate to: premium audio quality, customer experience, innovation, technical excellence, or brand values
4. Be realistic and actionable - avoid generic advice
5. Confidence score should reflect how clear the performance indicators are (60-95%)
6. Performance ratings: low = below expectations, medium = meets expectations, high = exceeds expectations
7. Potential ratings: low = limited growth, medium = steady growth, high = high growth/leadership potential
8. Return ONLY valid JSON, no other text`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Extract JSON from the response
      let jsonText = content.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const result = JSON.parse(jsonText);
      
      // Validate and return
      return {
        employeeName: result.employeeName || 'Unknown Employee',
        title: result.title || '',
        department: result.department || '',
        email: result.email || '',
        suggestedPerformance: result.suggestedPerformance || 'medium',
        suggestedPotential: result.suggestedPotential || 'medium',
        confidence: result.confidence || 70,
        reasoning: result.reasoning || '',
        keyStrengths: result.keyStrengths || [],
        developmentAreas: result.developmentAreas || [],
        achievements: result.achievements || [],
        objectives: result.objectives || [],
        actionItems: result.actionItems || [],
        successMetrics: result.successMetrics || [],
        sonanceSpecificInsights: result.sonanceSpecificInsights || [],
        recommendedTimeline: result.recommendedTimeline || '90 days'
      };
    }
    
    throw new Error('Unexpected response format from Claude');
  } catch (error: any) {
    console.error('Error analyzing review with AI:', error);
    throw new Error(`AI Analysis failed: ${error.message}`);
  }
}

export function isAnthropicConfigured(): boolean {
  return !!anthropic || !!apiKey;
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

const SECTION_FOCUS: Record<ReviewSectionKey, { label: string; guidance: string }> = {
  accomplishments: {
    label: 'Accomplishments, Impact & OKRs',
    guidance: 'Highlight measurable outcomes, impact on OKRs, cross-team collaboration, and reflections on what enabled results. Reference concrete wins, metrics, or stakeholder feedback when available.'
  },
  growth: {
    label: 'Growth & Development',
    guidance: 'Capture how the person has developed, lessons learned, and the 1-2 most important focus areas for growth. Balance strengths gained with candid opportunities that will elevate future impact.'
  },
  support: {
    label: 'Support & Feedback',
    guidance: 'Outline the support, resources, or feedback needed (for self reviews) or what the manager/team will provide (for manager reviews). Include specific actions, timing, and how support ties to OKRs.'
  },
};

export async function draftReviewSectionWithAI(request: ReviewSectionDraftRequest): Promise<string> {
  if (!anthropic) {
    throw new Error('Anthropic API not initialized. Please provide an API key.');
  }

  const { section, reviewType, reviewerName, employee, voiceNotes, manualNotes, existingText } = request;
  const sectionConfig = SECTION_FOCUS[section];

  const voiceNoteSummary = voiceNotes.length > 0
    ? voiceNotes.map((note, index) => `${index + 1}. ${note}`).join('\n')
    : 'None provided.';

  const prompt = `You are helping draft the "${sectionConfig.label}" portion of a ${reviewType === 'self' ? 'self' : 'manager'} performance review for ${employee.name}${employee.title ? ` (${employee.title})` : ''}${employee.department ? ` in the ${employee.department} team` : ''}.

Use the reviewer input to craft clear, professional copy that can be pasted directly into a performance review system.

GUIDELINES:
1. Tone should be supportive, specific, and business-appropriate.
2. Follow this focus: ${sectionConfig.guidance}
3. If details are sparse, infer reasonable specifics, but do not fabricate data that contradicts the supplied notes.
4. Keep the response to 2 short paragraphs (or 1 paragraph plus a concise bullet list when helpful).
5. Do not return Markdown or headings—plain text only.

CONTEXT PROVIDED BY ${reviewerName.toUpperCase()}:
- Existing text (if any): ${existingText && existingText.trim().length > 0 ? existingText : 'None'}
- Manual notes: ${manualNotes && manualNotes.trim().length > 0 ? manualNotes : 'None'}
- Voice note transcript:
${voiceNoteSummary}

Now write the polished review content:`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.6,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error: unknown) {
    console.error('Error drafting review section with AI:', error);
    throw new Error('Unable to generate draft right now. Please try again.');
  }
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

export async function generateOneOnOneSummary(request: OneOnOneSummaryRequest): Promise<OneOnOneSummaryResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API not initialized. Please provide an API key.');
  }

  const prompt = `You are assisting a manager after a 1:1 with ${request.employeeName}. Use the meeting context to produce a clear summary and identify action items.

MEETING CONTEXT
- Manager: ${request.managerName}
- Employee: ${request.employeeName}
- Agenda Items & Comments:
${request.agenda.map((item, index) => {
    const comments = item.comments.length > 0 ? item.comments.map(comment => `      - ${comment}`).join('\n') : '      - (no comments logged)';
    return `  ${index + 1}. ${item.title}${item.description ? ` — ${item.description}` : ''}\n${comments}`;
  }).join('\n')}

- Shared Notes:
${request.sharedNotes.length > 0 ? request.sharedNotes.map(note => `  - ${note}`).join('\n') : '  (none logged)'}

- Live Meeting Comments:
${request.meetingComments.length > 0 ? request.meetingComments.map(comment => `  - ${comment}`).join('\n') : '  (none logged)'}

- Existing Action Items:
${request.existingActionItems.length > 0 ? request.existingActionItems.map(item => `  - ${item.title} (owner: ${item.owner})`).join('\n') : '  (none yet)'}

${request.highlights?.trim() ? `Manager Highlights:\n${request.highlights.trim()}` : ''}

Return JSON with:
{
  "summary": "2 short paragraphs synthesizing discussion",
  "highlights": ["3 key themes"],
  "suggestedActionItems": [
    {
      "title": "Action title",
      "owner": "Manager" | "Employee",
      "rationale": "1 sentence"
    }
  ],
  "tone": "positive" | "neutral" | "caution"
}

Do not include markdown fences.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      let text = content.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(text);
      return {
        summary: parsed.summary ?? 'Summary unavailable.',
        highlights: parsed.highlights ?? [],
        suggestedActionItems: parsed.suggestedActionItems ?? [],
        tone: parsed.tone ?? 'neutral',
      };
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error: unknown) {
    console.error('Error generating 1:1 summary:', error);
    throw new Error('Unable to generate summary right now. Please try again.');
  }
}
