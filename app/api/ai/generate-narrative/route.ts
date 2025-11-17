import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface NarrativeRequest {
  surveyId: string;
  subjectName: string;
  rawResponses: Array<{
    question: string;
    responses: string[];
  }>;
  reportData: {
    executive_summary?: string;
    themes?: Array<{ theme: string; description: string }>;
    strengths?: string[];
    development_areas?: string[];
    key_insights?: string[];
    recommendations?: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('[generate-narrative API] POST request received');

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    console.log('[generate-narrative API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[generate-narrative API] ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: NarrativeRequest = await request.json();
    const { subjectName, rawResponses, reportData } = body;

    console.log('[generate-narrative API] Subject:', subjectName);
    console.log('[generate-narrative API] Raw responses count:', rawResponses?.length);

    if (!subjectName || !rawResponses || !reportData) {
      return NextResponse.json(
        { error: 'Missing required fields: subjectName, rawResponses, or reportData' },
        { status: 400 }
      );
    }

    console.log('[generate-narrative API] Calling Claude API...');

    // Format raw responses for the prompt
    const rawResponsesText = rawResponses
      .map((item, idx) => {
        const responsesText = item.responses
          .filter(r => r && r.trim())
          .map((r, i) => `   ${i + 1}. ${r}`)
          .join('\n');
        return `${idx + 1}. ${item.question}\n${responsesText || '   (No responses)'}`;
      })
      .join('\n\n');

    // Format report data sections
    const reportSections = [];

    if (reportData.executive_summary) {
      reportSections.push(`EXECUTIVE SUMMARY:\n${reportData.executive_summary}`);
    }

    if (reportData.themes && reportData.themes.length > 0) {
      const themesText = reportData.themes
        .map((t, i) => `${i + 1}. ${t.theme}: ${t.description}`)
        .join('\n');
      reportSections.push(`KEY THEMES:\n${themesText}`);
    }

    if (reportData.strengths && reportData.strengths.length > 0) {
      const strengthsText = reportData.strengths
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n');
      reportSections.push(`STRENGTHS:\n${strengthsText}`);
    }

    if (reportData.development_areas && reportData.development_areas.length > 0) {
      const devAreasText = reportData.development_areas
        .map((d, i) => `${i + 1}. ${d}`)
        .join('\n');
      reportSections.push(`DEVELOPMENT AREAS:\n${devAreasText}`);
    }

    if (reportData.key_insights && reportData.key_insights.length > 0) {
      const insightsText = reportData.key_insights
        .map((insight, i) => `${i + 1}. ${insight}`)
        .join('\n');
      reportSections.push(`KEY INSIGHTS:\n${insightsText}`);
    }

    if (reportData.recommendations && reportData.recommendations.length > 0) {
      const recsText = reportData.recommendations
        .map((rec, i) => `${i + 1}. ${rec}`)
        .join('\n');
      reportSections.push(`RECOMMENDED ACTIONS:\n${recsText}`);
    }

    const reportDataText = reportSections.join('\n\n');

    const prompt = `You are an expert executive coach and leadership development specialist. You have been asked to create a comprehensive one-page narrative for ${subjectName}'s 360-degree feedback report.

This narrative will be the first page of the final report that ${subjectName} receives. It should be professionally written, developmental in tone, balanced, and approximately 500-700 words.

Your narrative should synthesize both the raw feedback data AND the analyzed report sections to create a cohesive, insightful summary that will help ${subjectName} understand their strengths, growth opportunities, and recommended next steps.

---

RAW FEEDBACK RESPONSES:
${rawResponsesText}

---

ANALYZED REPORT DATA:
${reportDataText}

---

INSTRUCTIONS:
1. Write a compelling, professionally crafted narrative (500-700 words) that synthesizes ALL the data above
2. Begin with an opening paragraph that sets a positive, developmental tone
3. Weave together themes, strengths, and development areas into a cohesive story
4. Reference specific feedback points from the raw responses where relevant to add authenticity
5. Include concrete, actionable insights and recommendations
6. End with an encouraging closing that emphasizes growth and potential
7. Use third person perspective (e.g., "${subjectName} demonstrates...")
8. Maintain a professional yet warm tone - this should be motivating and constructive
9. DO NOT use section headers, titles, bullet points, or markdown formatting (no **, ##, etc.) - this should be flowing narrative prose only
10. DO NOT include any title like "Executive Summary" or "360-Degree Feedback Report" - start directly with the narrative content
11. Make it feel personalized and specific to ${subjectName}, not generic

Write the narrative now (plain text only, no formatting):`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[generate-narrative API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[generate-narrative API] Unexpected response type:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    // Clean up the narrative text
    let narrative = content.text.trim();

    // Remove any markdown headers or formatting that Claude might have added
    narrative = narrative
      .replace(/^\*\*360-Degree Feedback Report:?\s*Executive Summary\*\*\s*/i, '')
      .replace(/^\*\*Executive Summary\*\*\s*/i, '')
      .replace(/^#+ .*\n/gm, '') // Remove any markdown headers
      .trim();

    console.log('[generate-narrative API] Narrative generated, length:', narrative.length);

    return NextResponse.json({
      success: true,
      narrative: narrative,
    });
  } catch (error) {
    console.error('[generate-narrative API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate narrative' },
      { status: 500 }
    );
  }
}
