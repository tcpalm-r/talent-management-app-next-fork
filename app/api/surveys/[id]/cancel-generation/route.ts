import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { markSurveyCancelled } from '@/lib/services/surveyAnalyzerService';
import { releaseReportGenerationLock } from '@/lib/report-generation-lock';
import { removeQueuedReport } from '@/lib/report-generation-queue';

export const dynamic = 'force-dynamic';

/**
 * POST /api/surveys/[id]/cancel-generation
 *
 * Cancels an in-progress or queued report generation by resetting the survey status
 * back to 'in_progress'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const surveyId = params.id;

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the survey to verify it exists and check authorization
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, status, created_by, employee_id')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Check authorization - only sponsors and admins can cancel
    const isAdmin = authData.profile.app_role === 'admin';
    const isSLT = authData.profile.app_role === 'slt';
    const isSponsor =
      authData.profile.id === survey.created_by ||
      authData.profile.email === survey.created_by;

    if (!isAdmin && !isSLT && !isSponsor) {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Only survey sponsors and administrators can cancel report generation'
      }, { status: 403 });
    }

    const cancellableStatuses = new Set(['generating', 'queued']);

    // Only allow cancellation if currently generating or queued
    if (!cancellableStatuses.has(survey.status)) {
      return NextResponse.json({
        error: 'Cannot cancel',
        message: `Survey is not currently generating or queued (status: ${survey.status})`,
        currentStatus: survey.status
      }, { status: 400 });
    }

    if (survey.status === 'generating') {
      // Mark the survey as cancelled in the in-memory registry
      // This will cause the analyzer service to stop between passes
      markSurveyCancelled(surveyId);
    }

    // Reset status to 'in_progress'
    const { error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', surveyId);

    if (updateError) {
      console.error('[cancel-generation] Failed to update survey status:', updateError);
      return NextResponse.json({
        error: 'Failed to cancel generation',
        details: updateError.message
      }, { status: 500 });
    }

    await removeQueuedReport(surveyId);
    await releaseReportGenerationLock(surveyId);

    console.log(`[cancel-generation] Survey ${surveyId} generation cancelled by ${authData.profile.email}`);

    return NextResponse.json({
      success: true,
      message: 'Report generation cancelled',
      newStatus: 'in_progress'
    });

  } catch (error: any) {
    console.error('[cancel-generation] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
