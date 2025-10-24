import Anthropic from '@anthropic-ai/sdk';
import type { Performance, Potential, EmployeePlan, ActionItem } from '../types';
import { generateSmartActionItems } from './actionItemGenerator';

const anthropic = new Anthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

interface ReviewInsights {
  strengths: string[];
  developmentAreas: string[];
  successMetrics: string[];
  summary: string;
}

interface ReviewAnalysis {
  suggestedPlacement: {
    performance: Performance;
    potential: Potential;
    reasoning: string;
    confidence?: number;
  };
  developmentPlan: Partial<EmployeePlan>;
  insights: ReviewInsights;
}

export async function analyzePerformanceReview(
  reviewText: string,
  employeeName: string
): Promise<ReviewAnalysis> {
  const prompt = `You are an expert organizational psychologist and talent management consultant. Analyze this performance review and provide a structured assessment.

EMPLOYEE: ${employeeName}

PERFORMANCE REVIEW:
${reviewText}

Based on this review, provide your analysis in the following JSON format:

{
  "performance": "low" | "medium" | "high",
  "potential": "low" | "medium" | "high",
  "reasoning": "2-3 sentence explanation of why you placed them in this box",
  "confidence": 75,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "developmentAreas": ["area 1", "area 2", "area 3"],
  "planTitle": "A specific title for their development plan",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "actionItems": [
    {
      "description": "Specific, actionable task",
      "skillArea": "Category like 'Leadership', 'Technical', 'Communication'",
      "priority": "high" | "medium" | "low",
      "daysToComplete": 30,
      "estimatedHours": 10,
      "owner": "Employee" | "Manager" | "HR"
    }
  ],
  "successMetrics": ["measurable metric 1", "measurable metric 2"],
  "timeline": "90 days" | "6 months" | "12 months"
}

IMPORTANT GUIDELINES:
- Performance = current results, execution, meeting expectations
- Potential = future capability, growth trajectory, leadership potential
- Be objective and evidence-based
- Consider: results delivered, skills demonstrated, growth shown, feedback received
- Action items should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Prioritize high-impact development activities

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the JSON response
    const analysisText = content.text.trim();
    // Remove markdown code blocks if present
    const jsonText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(jsonText);

    // Generate full action items with proper structure
    const now = new Date();
    const actionItems: ActionItem[] = analysis.actionItems.map((item: any, index: number) => {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + item.daysToComplete);

      return {
        id: `action-${Date.now()}-${index}`,
        description: item.description,
        dueDate: dueDate.toISOString(),
        completed: false,
        owner: item.owner,
        priority: item.priority,
        status: 'not_started' as const,
        skillArea: item.skillArea,
        estimatedHours: item.estimatedHours
      };
    });

    // Calculate next review date (30 days from now)
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 30);

    const developmentPlan: Partial<EmployeePlan> = {
      plan_type: analysis.performance === 'low' ? 'performance_improvement' : 'development',
      title: analysis.planTitle,
      objectives: analysis.objectives,
      action_items: actionItems,
      timeline: analysis.timeline,
      success_metrics: analysis.successMetrics,
      notes: `Auto-generated from performance review analysis.\n\nStrengths identified: ${analysis.strengths.join(', ')}\n\nDevelopment areas: ${analysis.developmentAreas.join(', ')}`,
      status: 'active',
      next_review_date: nextReview.toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      suggestedPlacement: {
        performance: analysis.performance,
        potential: analysis.potential,
        reasoning: analysis.reasoning,
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : undefined
      },
      developmentPlan,
      insights: {
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        developmentAreas: Array.isArray(analysis.developmentAreas) ? analysis.developmentAreas : [],
        successMetrics: Array.isArray(analysis.successMetrics) ? analysis.successMetrics : [],
        summary: analysis.reasoning || ''
      }
    };
  } catch (error) {
    console.error('Error analyzing review:', error);

    // If parsing fails or API error, return a fallback based on keywords
    const fallbackAnalysis = analyzeFallback(reviewText);

    // Generate smart action items based on fallback
    const actionItems = generateSmartActionItems(
      fallbackAnalysis.performance,
      fallbackAnalysis.potential,
      employeeName
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 30);

    return {
      suggestedPlacement: {
        performance: fallbackAnalysis.performance,
        potential: fallbackAnalysis.potential,
        reasoning: 'Based on keyword analysis of the performance review.',
        confidence: 60
      },
      developmentPlan: {
        plan_type: fallbackAnalysis.performance === 'low' ? 'performance_improvement' : 'development',
        title: `Development Plan for ${employeeName}`,
        objectives: [
          'Continue building on current strengths',
          'Address identified development areas',
          'Prepare for future growth opportunities'
        ],
        action_items: actionItems,
        timeline: '90 days',
        success_metrics: [
          'Measurable improvement in key performance areas',
          'Completion of development activities',
          'Positive feedback from manager and peers'
        ],
        notes: 'Generated based on performance review. Please review and customize as needed.',
        status: 'active',
        next_review_date: nextReview.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      insights: {
        strengths: ['Strong results relative to peers', 'Consistent follow-through', 'Positive stakeholder feedback'],
        developmentAreas: ['Clarify growth plan with manager', 'Expand cross-functional influence', 'Document repeatable processes'],
        successMetrics: [
          'Hit next cycle KPIs',
          'Complete all plan action items',
          'Capture progress update in 90 days'
        ],
        summary: 'Generated from fallback keyword analysis. Please review and customize before finalizing.'
      }
    };
  }
}

// Fallback analysis using keyword matching
function analyzeFallback(reviewText: string): { performance: Performance; potential: Potential } {
  const text = reviewText.toLowerCase();

  // Performance indicators
  const highPerformanceKeywords = [
    'exceeded expectations', 'outstanding', 'exceptional', 'excellent',
    'consistently delivers', 'top performer', 'high quality', 'ahead of schedule'
  ];
  const lowPerformanceKeywords = [
    'below expectations', 'needs improvement', 'struggling', 'concerns',
    'inconsistent', 'missed deadlines', 'performance issues'
  ];

  // Potential indicators
  const highPotentialKeywords = [
    'leadership', 'promotion', 'high potential', 'future leader',
    'strategic thinking', 'takes initiative', 'mentor', 'growing rapidly'
  ];
  const lowPotentialKeywords = [
    'limited growth', 'plateaued', 'comfort zone', 'resistant to change',
    'no interest in advancement', 'content in current role'
  ];

  // Count keyword matches
  const highPerfMatches = highPerformanceKeywords.filter(kw => text.includes(kw)).length;
  const lowPerfMatches = lowPerformanceKeywords.filter(kw => text.includes(kw)).length;
  const highPotMatches = highPotentialKeywords.filter(kw => text.includes(kw)).length;
  const lowPotMatches = lowPotentialKeywords.filter(kw => text.includes(kw)).length;

  // Determine performance
  let performance: Performance;
  if (highPerfMatches > lowPerfMatches && highPerfMatches >= 2) {
    performance = 'high';
  } else if (lowPerfMatches > highPerfMatches) {
    performance = 'low';
  } else {
    performance = 'medium';
  }

  // Determine potential
  let potential: Potential;
  if (highPotMatches > lowPotMatches && highPotMatches >= 2) {
    potential = 'high';
  } else if (lowPotMatches > highPotMatches) {
    potential = 'low';
  } else {
    potential = 'medium';
  }

  return { performance, potential };
}
