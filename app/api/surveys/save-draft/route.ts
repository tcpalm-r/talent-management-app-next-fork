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

    // CRITICAL FIX: Role check - only admin, slt, and leader can save drafts
    if (user.app_role !== 'admin' && user.app_role !== 'slt' && user.app_role !== 'leader') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins, SLT, and leaders can create 360 reviews' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      organizationId,
      employeeId,
      surveyTitle,
      dueDate,
      preferredName,
      requiredQuestions,
      customQuestions,
      raters,
      questionsConfirmed,
      currentStep,
    } = body;

    console.log('[API save-draft] ========== RECEIVED CREATE REQUEST ==========');
    console.log('[API save-draft] Employee ID:', employeeId);
    console.log('[API save-draft] Raters received:', JSON.stringify(raters, null, 2));
    console.log('[API save-draft] Current step:', currentStep);

    // Split raters into complete (with name/email) and partial (relationship-only)
    const completeRaters = (raters || []).filter((r: any) => r.name && r.email);
    const partialRaters = (raters || []).filter((r: any) => r.relationship && (!r.name || !r.email));

    console.log('[API save-draft] Complete raters (will go to DB):', JSON.stringify(completeRaters, null, 2));
    console.log('[API save-draft] Partial raters (will go to JSON field):', JSON.stringify(partialRaters, null, 2));

    // Validate required fields
    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // HIGH PRIORITY FIX: Employee authorization - leaders can only create drafts for direct reports
    if (user.app_role === 'leader') {
      // Get leader's direct reports
      const { data: directReports, error: drError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('manager_id', profile.id);

      if (drError) {
        console.error('[API /surveys/save-draft] Error fetching direct reports:', drError);
        return NextResponse.json(
          { error: 'Failed to validate employee authorization' },
          { status: 500 }
        );
      }

      const directReportIds = directReports?.map(dr => dr.id) || [];

      // Leaders can create drafts for direct reports only
      if (!directReportIds.includes(employeeId)) {
        return NextResponse.json(
          { error: 'Forbidden: Leaders can only create 360 reviews for their direct reports' },
          { status: 403 }
        );
      }
    }
    // Admin and SLT can create drafts for any employee (no additional check needed)

    // Create draft survey - use authenticated user's profile ID
    const surveyData = {
      organization_id: organizationId,
      employee_id: employeeId,
      survey_name: surveyTitle,
      status: 'draft',
      due_date: dueDate || null,
      subject_preferred_name: preferredName || null,
      created_by: authData.profile.id, // Use authenticated user's ID
      current_step: currentStep || null, // Save the wizard step
      draft_partial_reviewers: partialRaters.length > 0 ? partialRaters : null, // Save partial reviewers as JSON
    };

    console.log('[API save-draft] Creating survey with data:', JSON.stringify(surveyData, null, 2));

    const { data: survey, error: surveyError} = await supabaseAdmin
      .from('feedback_360_surveys')
      .insert(surveyData)
      .select()
      .single();

    if (surveyError) {
      console.error('[API save-draft] ❌ Survey insert error:', surveyError);
      return NextResponse.json(
        { error: surveyError.message, details: surveyError },
        { status: 500 }
      );
    }

    console.log('[API save-draft] ✅ Survey created with ID:', survey.id);

    // Save questions only if confirmed or if custom questions were added
    const shouldSaveQuestions = questionsConfirmed || (customQuestions && customQuestions.length > 0);
    const allQuestions = shouldSaveQuestions
      ? [...(requiredQuestions || []).filter((q: string) => q.trim()), ...(customQuestions || [])]
      : [];

    if (allQuestions.length > 0 && shouldSaveQuestions) {
      const questionUUIDs: string[] = [];

      for (const questionText of allQuestions) {
        let { data: existingQuestion } = await supabaseAdmin
          .from('feedback_360_questions')
          .select('id')
          .eq('question_text', questionText)
          .maybeSingle();

        if (!existingQuestion) {
          const { data: newQuestion } = await supabaseAdmin
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

        await supabaseAdmin
          .from('feedback_360_survey_questions')
          .insert(questionsToInsert);
      }
    }

    // Save complete raters (those with name AND email) to reviewers table
    if (completeRaters.length > 0) {
      const reviewersToInsert = completeRaters.map((r: any) => ({
        survey_id: survey.id,
        reviewer_name: r.name,
        reviewer_email: r.email,
        relationship: r.relationship,
        status: 'pending',
        access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      console.log('[API save-draft] Inserting reviewers:', JSON.stringify(reviewersToInsert, null, 2));

      const { data: insertedReviewers, error: reviewersError } = await supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .insert(reviewersToInsert)
        .select();

      if (reviewersError) {
        console.error('[API save-draft] ❌ Error inserting reviewers:', reviewersError);
      } else {
        console.log('[API save-draft] ✅ Inserted reviewers:', insertedReviewers?.length || 0);
      }
    } else {
      console.log('[API save-draft] ⚠️ No complete reviewers to insert');
    }

    console.log('[API save-draft] ========== CREATE COMPLETE ==========');

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
