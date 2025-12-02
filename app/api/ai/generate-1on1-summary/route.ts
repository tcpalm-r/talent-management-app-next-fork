import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface OneOnOneSummaryRequest {
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

interface OneOnOneSummaryResponse {
  summary: string;
  highlights: string[];
  suggestedActionItems: Array<{
    title: string;
    owner: string;
    rationale: string;
  }>;
  tone: 'positive' | 'neutral' | 'caution';
}

export async function POST(request: NextRequest) {
  try {
    console.log('[generate-1on1-summary API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[generate-1on1-summary API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[generate-1on1-summary API] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: OneOnOneSummaryRequest = await request.json();
    const { managerName, employeeName, agenda, sharedNotes, meetingComments, existingActionItems, highlights } = body;

    console.log('[generate-1on1-summary API] Manager:', managerName);
    console.log('[generate-1on1-summary API] Employee:', employeeName);
    console.log('[generate-1on1-summary API] Agenda items:', agenda?.length || 0);

    if (!managerName || !employeeName) {
      return NextResponse.json(
        { error: 'Manager name and employee name are required' },
        { status: 400 }
      );
    }

    const prompt = `You are assisting a manager after a 1:1 with ${employeeName}. Use the meeting context to produce a clear summary and identify action items.

MEETING CONTEXT
- Manager: ${managerName}
- Employee: ${employeeName}
- Agenda Items & Comments:
${agenda.map((item, index) => {
    const comments = item.comments.length > 0 ? item.comments.map(comment => `      - ${comment}`).join('\n') : '      - (no comments logged)';
    return `  ${index + 1}. ${item.title}${item.description ? ` — ${item.description}` : ''}\n${comments}`;
  }).join('\n')}

- Shared Notes:
${sharedNotes.length > 0 ? sharedNotes.map(note => `  - ${note}`).join('\n') : '  (none logged)'}

- Live Meeting Comments:
${meetingComments.length > 0 ? meetingComments.map(comment => `  - ${comment}`).join('\n') : '  (none logged)'}

- Existing Action Items:
${existingActionItems.length > 0 ? existingActionItems.map(item => `  - ${item.title} (owner: ${item.owner})`).join('\n') : '  (none yet)'}

${highlights?.trim() ? `Manager Highlights:\n${highlights.trim()}` : ''}

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

    console.log('[generate-1on1-summary API] Calling Claude API...');

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

    console.log('[generate-1on1-summary API] Claude API response received');

    const content = response.content[0];
    if (content.type === 'text') {
      let text = content.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(text);
      const result: OneOnOneSummaryResponse = {
        summary: parsed.summary ?? 'Summary unavailable.',
        highlights: parsed.highlights ?? [],
        suggestedActionItems: parsed.suggestedActionItems ?? [],
        tone: parsed.tone ?? 'neutral',
      };

      return NextResponse.json(result);
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error: any) {
    console.error('[generate-1on1-summary API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to generate summary right now. Please try again.' },
      { status: 500 }
    );
  }
}

