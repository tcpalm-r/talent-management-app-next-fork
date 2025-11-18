import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

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

    const { user, profile } = authData;

    // HIGH PRIORITY FIX: Role check - only admin, slt, and leader can create surveys
    if (user.app_role !== 'admin' && user.app_role !== 'slt' && user.app_role !== 'leader') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins, SLT, and leaders can create 360 reviews' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      employeeId,
      surveyName,
      dueDate,
      requiredQuestions,
      customQuestions,
      raters,
    } = body;

    // Validate required fields
    if (!employeeId || !surveyName || !dueDate || !requiredQuestions || !raters) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // HIGH PRIORITY FIX: Employee authorization - leaders can only create for direct reports
    if (user.app_role === 'leader') {
      // Get leader's direct reports
      const { data: directReports, error: drError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('manager_id', profile.id);

      if (drError) {
        console.error('[API /surveys/create] Error fetching direct reports:', drError);
        return NextResponse.json(
          { error: 'Failed to validate employee authorization' },
          { status: 500 }
        );
      }

      const directReportIds = directReports?.map(dr => dr.id) || [];

      // Leaders can create for direct reports only
      if (!directReportIds.includes(employeeId)) {
        return NextResponse.json(
          { error: 'Forbidden: Leaders can only create 360 reviews for their direct reports' },
          { status: 403 }
        );
      }
    }
    // Admin and SLT can create for any employee (no additional check needed)

    // Create survey - use authenticated user's profile ID
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .insert({
        employee_id: employeeId,
        survey_name: surveyName,
        status: 'draft',
        due_date: dueDate,
        created_by: authData.profile.id, // Use authenticated user's ID
      })
      .select()
      .single();

    if (surveyError) {
      console.error('[API /surveys/create] Survey insert error:', surveyError);
      return NextResponse.json(
        { error: surveyError.message, details: surveyError },
        { status: 500 }
      );
    }

    // Combine required and custom questions
    const allQuestions = [...requiredQuestions, ...(customQuestions || [])];
    const questionUUIDs: string[] = [];

    for (const questionText of allQuestions) {
      // Check if question exists
      let { data: existingQuestion, error: checkError } = await supabaseAdmin
        .from('feedback_360_questions')
        .select('id')
        .eq('question_text', questionText)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[API /surveys/create] Error checking question:', checkError);
        return NextResponse.json(
          { error: checkError.message, details: checkError },
          { status: 500 }
        );
      }

      if (!existingQuestion) {
        // Create the question
        const { data: newQuestion, error: createError } = await supabaseAdmin
          .from('feedback_360_questions')
          .insert({
            question_text: questionText,
            category: 'general',
            is_default: false,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[API /surveys/create] Error creating question:', createError);
          return NextResponse.json(
            { error: createError.message, details: createError },
            { status: 500 }
          );
        }
        questionUUIDs.push(newQuestion.id);
      } else {
        questionUUIDs.push(existingQuestion.id);
      }
    }

    // Create survey questions
    if (questionUUIDs.length > 0) {
      const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
        survey_id: survey.id,
        question_id: questionUUID,
        question_order: index,
      }));

      const { error: questionsError } = await supabaseAdmin
        .from('feedback_360_survey_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        console.error('[API /surveys/create] Error inserting survey questions:', questionsError);
        return NextResponse.json(
          { error: questionsError.message, details: questionsError },
          { status: 500 }
        );
      }
    }

    // Create reviewers
    const validRaters = raters.filter((r: any) => r.name && r.name.trim());
    if (validRaters.length > 0) {
      const reviewersToInsert = validRaters.map((r: any) => ({
        survey_id: survey.id,
        reviewer_name: r.name,
        reviewer_email: r.email || 'pending-email@example.com',
        relationship: r.relationship,
        status: 'pending',
        access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const { data: insertedReviewers, error: reviewersError } = await supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .insert(reviewersToInsert)
        .select();

      if (reviewersError) {
        console.error('[API /surveys/create] Error inserting reviewers:', reviewersError);
        return NextResponse.json(
          { error: reviewersError.message, details: reviewersError },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        survey,
        reviewers: insertedReviewers,
      });
    }

    return NextResponse.json({
      success: true,
      survey,
      reviewers: [],
    });
  } catch (error: any) {
    console.error('[API /surveys/create] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
