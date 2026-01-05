/**
 * POST /api/surveys/[id]/revert-draft
 *
 * Send survey backward to previous status:
 * - finalized → completed (no data loss, just status change)
 * - completed → in_progress (clear AI report, clear reanalysis flag)
 * - in_progress → draft (delete reviewers, invalidate access links)
 *
 * Replaces sendBackward() logic in Feedback360Dashboard.
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

    // Get current status from request body
    const body = await request.json();
    const currentStatus = body.currentStatus;

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

    // Check permission - admin-only access
    const canRevert = user.app_role === 'admin';

    if (!canRevert) {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can revert surveys' },
        { status: 403 }
      );
    }

    // Determine target status and what data to clear
    // IMPORTANT: Send Backward should NEVER delete reviewers or responses
    // It only changes status and optionally clears the AI report
    let targetStatus: string;
    let shouldClearReport = false;

    if (currentStatus === 'finalized') {
      // finalized → completed: Just change status, keep everything
      targetStatus = 'completed';
    } else if (currentStatus === 'completed') {
      // completed → in_progress: Change status and clear AI report
      targetStatus = 'in_progress';
      shouldClearReport = true;
    } else if (currentStatus === 'in_progress') {
      // in_progress → draft: Just change status, keep reviewers
      targetStatus = 'draft';
    } else {
      return NextResponse.json(
        { error: 'Cannot send backward from this status' },
        { status: 400 }
      );
    }

    // Clear AI report when going back to in_progress
    if (shouldClearReport) {
      const { error: deleteReportError } = await supabaseAdmin
        .from('feedback_360_reports')
        .delete()
        .eq('survey_id', surveyId);

      if (deleteReportError) {
        console.error('Error deleting report:', deleteReportError);
        // Don't fail the request if report deletion fails
      }
    }

    // Update survey status
    const updateData: any = {
      status: targetStatus,
      flagged_for_reanalysis: false,
      updated_at: new Date().toISOString(),
    };

    // Clear flagged_for_admin and narrative fields when going back from completed
    if (currentStatus === 'completed') {
      updateData.flagged_for_admin = false;
    }

    // Clear narrative fields when going back to in_progress
    if (shouldClearReport) {
      updateData.final_narrative = null;
      updateData.narrative_generated_at = null;
      updateData.narrative_version = null;
      // Note: ai_report_generated column was removed - don't set it
    }

    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update(updateData)
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
      message: `Survey moved back to ${targetStatus} status successfully`,
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/revert-draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
