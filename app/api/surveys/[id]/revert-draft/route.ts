/**
 * POST /api/surveys/[id]/revert-draft
 *
 * Send survey back to draft status:
 * - Change status to 'draft'
 * - Clear reanalysis flag
 * - Delete all reviewers (invalidate access links)
 *
 * Replaces sendBackward() logic in Feedback360Dashboard when moving to draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Check if survey exists
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Check permission - admins and creators can revert
    const canRevert =
      user.app_role === 'admin' ||
      survey.created_by === profile.id;

    if (!canRevert) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this survey' },
        { status: 403 }
      );
    }

    // Delete all reviewers (invalidate access links)
    const { error: deleteReviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .delete()
      .eq('survey_id', surveyId);

    if (deleteReviewersError) {
      console.error('Error deleting reviewers:', deleteReviewersError);
      return NextResponse.json(
        { error: 'Failed to remove reviewers', details: deleteReviewersError.message },
        { status: 500 }
      );
    }

    // Update survey status to draft
    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        status: 'draft',
        flagged_for_reanalysis: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId)
      .select()
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
      message: 'Survey reverted to draft successfully',
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/revert-draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
