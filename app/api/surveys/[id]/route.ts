/**
 * /api/surveys/[id]
 *
 * PATCH: Update survey fields (status, name, due_date, flags, etc)
 * DELETE: Delete survey with cascade (responses, reviewers, questions)
 *
 * Replaces multiple update operations in Feedback360Dashboard:
 * - sendToAdminForReanalysis (status: 'needs_review')
 * - finalizeSurvey (status: 'finalized', flagged_for_admin: false)
 * - sendToAdmin (flagged_for_admin: true)
 * - resolveNeedsReview (flagged_for_reanalysis: false)
 * - sendBackward (status changes and flag clearing)
 * - deleteDraftSurvey, deleteInProgressSurvey
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/surveys/[id]
 * Update survey fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const surveyId = params.id;

    // Parse request body
    const body = await request.json();

    // Fetch existing survey to check permissions
    const { data: existingSurvey, error: fetchError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (fetchError || !existingSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Authorization check
    const canModify = await checkSurveyModifyPermission(
      existingSurvey,
      user.app_role,
      profile
    );

    if (!canModify) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this survey' },
        { status: 403 }
      );
    }

    // Build update object - only allow specific fields
    const allowedFields = [
      'status',
      'survey_name',
      'due_date',
      'flagged_for_admin',
      'flagged_for_reanalysis',
      'resolved_by_admin',
      // Note: ai_report_generated column doesn't exist in database - removed
      'report_data',
      'final_narrative',
      'narrative_generated_at',
      'narrative_version',
      'report_adjustments', // Sponsor's per-item adjustments (specificity, tone, length)
    ];

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    // Copy allowed fields from body
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Special handling for status changes
    if (body.status) {
      // GUARD: Prevent setting status to 'completed' via PATCH
      // The 'completed' status should ONLY be set by the report generation process
      // which also creates the report record. Setting it here would create an
      // inconsistent state where status is 'completed' but no report exists.
      if (body.status === 'completed') {
        return NextResponse.json(
          {
            error: 'Invalid status change',
            message: 'Cannot set status to "completed" directly. Use "Complete 360° with AI Analysis" to generate the report and set the status.'
          },
          { status: 400 }
        );
      }

      // If moving to 'finalized', clear certain flags
      if (body.status === 'finalized') {
        updates.flagged_for_admin = false;
      }

      // If moving backward from completed/finalized, clear reanalysis flag
      if (
        (existingSurvey.status === 'completed' || existingSurvey.status === 'finalized') &&
        (body.status === 'draft' || body.status === 'in_progress')
      ) {
        updates.flagged_for_reanalysis = false;
      }
    }

    // Update the survey
    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update(updates)
      .eq('id', surveyId)
      .select(`
        *,
        reviewers:feedback_360_survey_reviewers(
          id,
          status,
          reviewer_email,
          access_token
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating survey:', updateError);
      return NextResponse.json(
        { error: 'Failed to update survey', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      survey: updatedSurvey,
      message: 'Survey updated successfully',
    });

  } catch (error) {
    console.error('Error in PATCH /api/surveys/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/surveys/[id]
 * Delete survey with cascade
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const surveyId = params.id;

    // Fetch existing survey to check permissions
    const { data: existingSurvey, error: fetchError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (fetchError || !existingSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Authorization check for deletion:
    // - Admin can delete their own surveys in ANY status
    // - SLT can only delete their own DRAFT or IN_PROGRESS surveys
    // - Leaders and Users cannot delete surveys (they can't create them anyway)
    const isAdmin = user.app_role === 'admin';
    const isSLT = user.app_role === 'slt';
    const isCreator = existingSurvey.created_by === profile.id;
    const isDraftOrInProgress = existingSurvey.status === 'draft' || existingSurvey.status === 'in_progress';

    // Admin: can delete own surveys in any status
    // SLT: can only delete own draft or in_progress surveys
    const canDelete = isCreator && (isAdmin || (isSLT && isDraftOrInProgress));

    if (!canDelete) {
      // Provide specific error message based on why deletion failed
      if (isSLT && isCreator && !isDraftOrInProgress) {
        return NextResponse.json(
          { error: 'Forbidden: SLT can only delete draft or in-progress surveys. Contact an Admin to delete completed or finalized surveys.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Forbidden: Only the survey sponsor (Admin or SLT for draft/in-progress) can delete their own surveys' },
        { status: 403 }
      );
    }

    // ============================================================
    // ARCHIVE SURVEY DATA BEFORE DELETION
    // Captures complete snapshot for data insurance/retention
    // ============================================================
    
    // Fetch all related data for archiving
    const [reviewersResult, questionsResult, responsesResult, employeeResult] = await Promise.all([
      supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('survey_id', surveyId),
      supabaseAdmin
        .from('feedback_360_survey_questions')
        .select('*, question:feedback_360_questions(*)')
        .eq('survey_id', surveyId),
      supabaseAdmin
        .from('feedback_360_responses')
        .select('*')
        .eq('survey_id', surveyId),
      supabaseAdmin
        .from('user_profiles')
        .select('full_name')
        .eq('id', existingSurvey.employee_id)
        .single()
    ]);

    // Create archive record with complete snapshot
    const archiveData = {
      original_survey_id: surveyId,
      survey_name: existingSurvey.survey_name,
      employee_id: existingSurvey.employee_id,
      employee_name: employeeResult.data?.full_name || null,
      created_by: existingSurvey.created_by,
      deleted_by: profile.id,
      original_created_at: existingSurvey.created_at,
      original_status: existingSurvey.status,
      survey_data: existingSurvey,
      reviewers_data: reviewersResult.data || [],
      questions_data: questionsResult.data || [],
      responses_data: responsesResult.data || []
    };

    const { error: archiveError } = await supabaseAdmin
      .from('feedback_360_deleted_surveys')
      .insert(archiveData);

    if (archiveError) {
      console.error('Error archiving survey:', archiveError);
      // Don't block deletion if archiving fails, but log it
      // In production, you might want to alert on this
    }

    // ============================================================
    // CASCADE DELETE
    // ============================================================

    // Cascade delete in the correct order to avoid foreign key constraints
    // 1. Delete responses
    const { error: responsesError } = await supabaseAdmin
      .from('feedback_360_responses')
      .delete()
      .eq('survey_id', surveyId);

    if (responsesError) {
      console.error('Error deleting responses:', responsesError);
      return NextResponse.json(
        { error: 'Failed to delete survey responses', details: responsesError.message },
        { status: 500 }
      );
    }

    // 2. Delete reviewers
    const { error: reviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .delete()
      .eq('survey_id', surveyId);

    if (reviewersError) {
      console.error('Error deleting reviewers:', reviewersError);
      return NextResponse.json(
        { error: 'Failed to delete reviewers', details: reviewersError.message },
        { status: 500 }
      );
    }

    // 3. Delete survey questions
    const { error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .delete()
      .eq('survey_id', surveyId);

    if (questionsError) {
      console.error('Error deleting survey questions:', questionsError);
      return NextResponse.json(
        { error: 'Failed to delete survey questions', details: questionsError.message },
        { status: 500 }
      );
    }

    // 4. Finally, delete the survey itself
    const { error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .delete()
      .eq('id', surveyId);

    if (surveyError) {
      console.error('Error deleting survey:', surveyError);
      return NextResponse.json(
        { error: 'Failed to delete survey', details: surveyError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Survey deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/surveys/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has permission to modify this survey
 *
 * Permission Rules:
 * - Admins can modify any survey
 * - SLT can only modify surveys they created/sponsored
 * - Leaders can only modify surveys they created
 * - Users can only modify surveys they created
 *
 * This prevents conflict of interest and ensures only the survey sponsor
 * (or admin) can make changes to survey configuration and status.
 */
async function checkSurveyModifyPermission(
  survey: any,
  role: string,
  profile: any
): Promise<boolean> {
  // Admins can modify everything
  if (role === 'admin') return true;

  // Everyone else (including SLT) can only modify surveys they created
  if (survey.created_by === profile.id) return true;

  return false;
}
