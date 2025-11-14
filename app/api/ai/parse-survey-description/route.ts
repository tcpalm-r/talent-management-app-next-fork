import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
  relationship: 'manager' | 'peer' | 'direct_report' | 'cross_functional';
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

    // Check for API key (check both private and public variants)
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    console.log('[parse-survey-description API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[parse-survey-description API] Neither ANTHROPIC_API_KEY nor NEXT_PUBLIC_ANTHROPIC_API_KEY is set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your .env.local file.' },
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
      return NextResponse.json(
        { error: 'Survey description is required' },
        { status: 400 }
      );
    }

    console.log('[parse-survey-description API] Calling Claude API...');

    // Build context about wizard state
    const contextNotes = wizardContext?.selectedEmployee
      ? `IMPORTANT: The user is already on step 3 of the 360 review wizard and has already selected "${wizardContext.selectedEmployee.name}" as the person being reviewed.
Use this as the employeeName and do NOT ask for clarification about who the review is for. The user is now describing what feedback to collect.`
      : '';

    // Build employee directory for name recognition
    const employeeDirectory = wizardContext?.availableEmployees
      ? `AVAILABLE EMPLOYEES IN SYSTEM:
${wizardContext.availableEmployees.map(emp => `- ${emp.name}`).join('\n')}

When extracting employee names, ALWAYS try to match against this list first. Use fuzzy matching for variations (e.g., "Bob" → "Robert", "Sarah" → "Sarah Chen").
For reviewers, if a name is mentioned, try to find the closest match in this list.
`
      : '';

    const prompt = `You are an expert HR assistant helping to parse 360-degree review survey requests.

Parse the following survey description and extract the structured information. Return ONLY valid JSON, no additional text.

TODAY'S DATE: ${today || 'Unknown - use best guess'}

${employeeDirectory}

${contextNotes}

USER DESCRIPTION:
"${description}"

IMPORTANT EXTRACTION RULES:
1. Employee Name: ${wizardContext?.selectedEmployee ? `Use "${wizardContext.selectedEmployee.name}" (already selected in wizard)` : 'Extract the name of the person being reviewed. Must be unambiguous. Match against available employees when possible.'}.
2. Questions: Extract specific questions or assessment areas mentioned. If NOT explicitly mentioned, return empty array (system will use default admin questions).
3. REVIEWERS (CRITICAL - EXTRACT COMPREHENSIVELY):
   - Extract ALL mentioned reviewers (names, titles, departments, roles)
   - For each mentioned person, MUST include in raters array
   - Match names against available employees - use fuzzy matching if not exact match
   - For emails: extract from text or infer from available employees if name matches
   - ALWAYS infer relationship type from context clues (manager/peer/direct_report/cross_functional)
   - If relationship unclear, default to "peer"
   - Examples:
     * "Get feedback from John" → search for John in employees, add as peer
     * "2 team members" → look for team context to classify as peer/direct_report
     * "Her manager and 3 peers" → extract manager (set relationship="manager"), peers (relationship="peer")
   - NEVER skip a mentioned person
4. Due Date: Extract due date if mentioned. Convert to ISO format (YYYY-MM-DD) using TODAY'S DATE as reference:
   - "next Friday" → calculate Friday after today
   - "2 weeks" → add 14 days to today
   - "next month" → same date next month
   - If ambiguous, leave as null
5. Survey Title: Extract or infer a good title for the survey.

RELATIONSHIP TYPE CLASSIFICATION:
- manager: Their manager/supervisor (keywords: "manager", "boss", "supervisor", "lead")
- peer: Colleagues at same level (keywords: "colleague", "peer", "coworker", "team member")
- direct_report: People who report to this person (keywords: "direct report", "report", "team member under")
- cross_functional: People from other departments/functions (keywords: "from", "in the", "across")
Use context clues from the text to infer relationships when not explicitly stated.

CONFIDENCE LEVELS:
- high: Clearly stated in the description
- medium: Inferred from context but not explicitly stated
- low: Ambiguous or unclear

RETURN THIS EXACT JSON STRUCTURE:
{
  "employeeName": "string or null",
  "employeeName_confidence": "high|medium|low",
  "questions": ["question 1", "question 2", ...],
  "questions_confidence": "high|medium|low",
  "raters": [
    {
      "name": "string",
      "email": "string or null",
      "relationship": "manager|peer|direct_report|cross_functional",
      "clarification_needed": false,
      "clarification_reason": null
    }
  ],
  "raters_confidence": "high|medium|low",
  "dueDate": "YYYY-MM-DD or null",
  "dueDate_confidence": "high|medium|low",
  "surveyTitle": "string or null",
  "clarifications_needed": boolean,
  "clarifications": [
    {
      "field": "employeeName|questions|raters|dueDate",
      "reason": "Explanation of what needs clarification",
      "options": ["option1", "option2"]
    }
  ]
}

CRITICAL:
- Return ONLY the JSON object, no markdown, no explanation
- If a field cannot be extracted, use null
- If confidence is low or critical info is missing, add to clarifications_needed
- IMPORTANT: If no specific questions are mentioned, return empty questions array - DO NOT ask for clarification (system uses default admin questions)
- IMPORTANT FOR REVIEWERS:
  * AGGRESSIVE EXTRACTION: Always try to extract reviewers even from vague mentions
  * Match names against available employees using fuzzy matching
  * Email can be null - system will infer from matched employee or ask later
  * ONLY mark raters as needing clarification if name is EXTREMELY ambiguous (e.g., "someone from accounting" with multiple matches)
  * If ANY name/title/role is mentioned, MUST extract to raters array - DO NOT return empty array if people are mentioned
  * Use context to infer relationships when not explicit
- Only flag employee name as clarifications_needed if truly unclear
- Always include the full JSON structure even if some fields are null
- When name clarification is needed, provide up to 3 similar employee names as "options" in the clarifications
- Prioritize exact and fuzzy matches from the available employees list`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.3,
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
      console.log('[parse-survey-description API] No due date specified, defaulting to 1 week from today:', defaultedDueDate);
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
