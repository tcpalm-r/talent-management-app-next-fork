import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseSurveyDescriptionConfig, buildParseSurveyDescriptionPrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

interface ParseRequest {
  description: string;
  today?: string;
  wizardContext?: {
    selectedEmployee?: { id: string; name: string };
    currentStep?: string;
    availableEmployees?: Array<{ id: string; name: string }>;
  };
}

interface ParsedRater {
  name: string;
  email: string;
  relationship: 'manager' | 'slt' | 'direct_report' | 'cross_functional';
  clarification_needed?: boolean;
  clarification_reason?: string;
}

interface ParseResponse {
  employeeName: string;
  employeeName_confidence: 'high' | 'medium' | 'low';
  questions: string[];
  questions_confidence: 'high' | 'medium' | 'low';
  raters: ParsedRater[];
  raters_confidence: 'high' | 'medium' | 'low';
  dueDate?: string;
  dueDate_confidence?: 'high' | 'medium' | 'low';
  surveyTitle?: string;
  clarifications_needed: boolean;
  clarifications: Array<{
    field: string;
    reason: string;
    options?: string[];
  }>;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[parse-survey-description API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[parse-survey-description API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[parse-survey-description API] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client with explicit API key
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: ParseRequest = await request.json();
    const { description, today, wizardContext } = body;

    console.log('[parse-survey-description API] Description length:', description?.length);
    console.log('[parse-survey-description API] Today date received:', today);
    console.log('[parse-survey-description API] Wizard context:', wizardContext);
    console.log('[parse-survey-description API] Request body:', JSON.stringify(body));

    if (!description || description.trim().length === 0) {
      console.log('[parse-survey-description API] Error: Empty description');
      return NextResponse.json({ error: 'Survey description is required' }, { status: 400 });
    }

    console.log('[parse-survey-description API] Calling Claude API...');

    const prompt = buildParseSurveyDescriptionPrompt({ description, today, wizardContext });

    const response = await anthropic.messages.create({
      model: parseSurveyDescriptionConfig.model,
      max_tokens: parseSurveyDescriptionConfig.maxTokens,
      temperature: parseSurveyDescriptionConfig.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[parse-survey-description API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[parse-survey-description API] Unexpected response type from Claude:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    console.log('[parse-survey-description API] Claude response text length:', content.text.length);

    // Parse the JSON response
    let parseResult: ParseResponse;
    try {
      parseResult = JSON.parse(content.text);
      console.log('[parse-survey-description API] JSON parsed successfully');
    } catch (e) {
      console.log('[parse-survey-description API] Initial JSON parse failed, trying to extract from text');
      // Try to extract JSON from text if parsing fails
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[parse-survey-description API] Could not extract JSON from Claude response');
        throw new Error('Could not parse Claude response as JSON');
      }
      parseResult = JSON.parse(jsonMatch[0]);
      console.log('[parse-survey-description API] JSON extracted and parsed from text');
    }

    console.log('[parse-survey-description API] Parse result:', parseResult);

    // Enrich rater emails from employee database
    const enrichedRaters = await Promise.all(
      parseResult.raters.map(async (rater) => {
        // If email is already present, skip lookup
        if (rater.email) {
          return rater;
        }

        // Try to find the employee in the database by name
        try {
          const { data: employee } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .ilike('full_name', `%${rater.name}%`)
            .limit(1)
            .maybeSingle();

          if (employee?.email) {
            console.log(`[parse-survey-description API] Enriched email for "${rater.name}": ${employee.email}`);
            return {
              ...rater,
              email: employee.email,
            };
          }
        } catch (error) {
          console.log(`[parse-survey-description API] Error looking up email for "${rater.name}":`, error);
        }

        return rater;
      })
    );

    // Replace raters with enriched version
    parseResult.raters = enrichedRaters;
    console.log('[parse-survey-description API] Raters after email enrichment:', enrichedRaters);

    // Check if clarifications are needed
    if (parseResult.clarifications_needed && parseResult.clarifications.length > 0) {
      console.log('[parse-survey-description API] Returning with clarifications needed');
      return NextResponse.json({
        requiresClarification: true,
        clarifications: parseResult.clarifications,
        partialData: parseResult,
      });
    }

    // If no clarifications needed, return the parsed data
    // Default due date to 1 week from today if not specified
    let defaultedDueDate = parseResult.dueDate;
    if (!defaultedDueDate) {
      const todayDate = today ? new Date(today) : new Date();
      const oneWeekLater = new Date(todayDate);
      oneWeekLater.setDate(oneWeekLater.getDate() + 7);
      defaultedDueDate = oneWeekLater.toISOString().split('T')[0];
      console.log(
        '[parse-survey-description API] No due date specified, defaulting to 1 week from today:',
        defaultedDueDate
      );
    }

    const parsedData = {
      employeeName: parseResult.employeeName,
      questions: parseResult.questions,
      raters: parseResult.raters
        .filter((r) => !r.clarification_needed)
        .map((r) => ({
          name: r.name,
          email: r.email,
          relationship: r.relationship,
        })),
      dueDate: defaultedDueDate,
      surveyTitle: parseResult.surveyTitle,
    };

    console.log('[parse-survey-description API] Returning success with parsed data:', parsedData);

    return NextResponse.json({
      success: true,
      requiresClarification: false,
      parsedData,
    });
  } catch (error) {
    console.error('[parse-survey-description API] Error parsing survey description:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse survey description' },
      { status: 500 }
    );
  }
}
