/**
 * /api/surveys/[id]
 *
 * PATCH: Update survey fields (status, name, due_date, flags, etc)
 * DELETE: Delete survey with cascade (responses, reviewers, questions)
 *
 * Replaces multiple update operations in Feedback360Dashboard:
 * - sendToHRForReanalysis (status: 'needs_review')
 * - finalizeSurvey (status: 'finalized', flagged_for_admin: false)
 * - sendToHR (flagged_for_admin: true)
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
      'ai_report_generated',
      'report_data',
      'final_narrative',
      'narrative_generated_at',
      'narrative_version',
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

    // Authorization check - only creator, admin, or SLT can delete
    const canDelete =
      user.app_role === 'admin' ||
      user.app_role === 'slt' ||  // HIGH PRIORITY FIX: SLT has elevated access
      existingSurvey.created_by === profile.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: Only the creator or admins can delete surveys' },
        { status: 403 }
      );
    }

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
 * CRITICAL FIX: Leaders can ONLY modify surveys they CREATED (not all direct report surveys)
 * This prevents conflict of interest where a leader modifies a direct report's survey
 * created by an admin or another leader
 */
async function checkSurveyModifyPermission(
  survey: any,
  role: string,
  profile: any
): Promise<boolean> {
  // Admins and SLT can modify everything
  if (role === 'admin' || role === 'slt') return true;

  // Survey creator can modify their own surveys
  if (survey.created_by === profile.id) return true;

  // CRITICAL FIX: Removed direct report modification permission for leaders
  // Leaders can only modify surveys THEY created, not direct reports' surveys
  // This enforces read-only access to direct reports' surveys (to avoid conflict)

  return false;
}
