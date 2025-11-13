import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();
    const {
      organizationId,
      employeeId,
      surveyTitle,
      dueDate,
      requiredQuestions,
      customQuestions,
      raters,
      questionsConfirmed,
    } = body;

    // Validate required fields
    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Create draft survey - use authenticated user's profile ID
    const { data: survey, error: surveyError } = await supabase
      .from('feedback_360_surveys')
      .insert({
        organization_id: organizationId,
        employee_id: employeeId,
        survey_name: surveyTitle,
        status: 'draft',
        due_date: dueDate || null,
        created_by: authData.profile.id, // Use authenticated user's ID
      })
      .select()
      .single();

    if (surveyError) {
      console.error('[API /surveys/save-draft] Survey insert error:', surveyError);
      return NextResponse.json(
        { error: surveyError.message, details: surveyError },
        { status: 500 }
      );
    }

    // Save questions only if confirmed or if custom questions were added
    const shouldSaveQuestions = questionsConfirmed || (customQuestions && customQuestions.length > 0);
    const allQuestions = shouldSaveQuestions
      ? [...(requiredQuestions || []).filter((q: string) => q.trim()), ...(customQuestions || [])]
      : [];

    if (allQuestions.length > 0 && shouldSaveQuestions) {
      const questionUUIDs: string[] = [];

      for (const questionText of allQuestions) {
        let { data: existingQuestion } = await supabase
          .from('feedback_360_questions')
          .select('id')
          .eq('question_text', questionText)
          .maybeSingle();

        if (!existingQuestion) {
          const { data: newQuestion } = await supabase
            .from('feedback_360_questions')
            .insert({
              question_text: questionText,
              category: 'general',
              is_default: false,
              is_active: true,
            })
            .select('id')
            .single();

          if (newQuestion) questionUUIDs.push(newQuestion.id);
        } else {
          questionUUIDs.push(existingQuestion.id);
        }
      }

      if (questionUUIDs.length > 0) {
        const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
          survey_id: survey.id,
          question_id: questionUUID,
          question_order: index,
        }));

        await supabase
          .from('feedback_360_survey_questions')
          .insert(questionsToInsert);
      }
    }

    // Save raters if any are added
    const validRaters = (raters || []).filter((r: any) => r.name && r.email);
    if (validRaters.length > 0) {
      const reviewersToInsert = validRaters.map((r: any) => ({
        survey_id: survey.id,
        reviewer_name: r.name,
        reviewer_email: r.email,
        relationship: r.relationship,
        status: 'pending',
        access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      await supabase
        .from('feedback_360_survey_reviewers')
        .insert(reviewersToInsert);
    }

    return NextResponse.json({
      success: true,
      survey,
    });
  } catch (error: any) {
    console.error('[API /surveys/save-draft] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
