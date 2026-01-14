import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateReportForSurvey } from '@/lib/report-generation';
import { getUserProfileByEmail, getUserProfileById } from '@/lib/auth-supabase';
import { getNextQueuedReport, removeQueuedReport } from '@/lib/report-generation-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 720; // 12 minutes

const revertSurveyStatus = async (surveyId: string) => {
  const { error } = await supabaseAdmin
    .from('feedback_360_surveys')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', surveyId);

  if (error) {
    console.error('[report-queue] Failed to revert survey status:', error);
  }
};

export async function GET(request: NextRequest) {
  console.log('[report-queue] Processing queued report generation');

  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment && (!authHeader || authHeader !== expectedAuth)) {
      console.error('[report-queue] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isDevelopment && !authHeader) {
      console.log('[report-queue] Running in development mode without auth');
    }

    const queuedReport = await getNextQueuedReport();
    if (!queuedReport) {
      return NextResponse.json({
        success: true,
        status: 'idle',
        message: 'No queued reports to process',
      });
    }

    const requester = queuedReport.requested_by
      ? await getUserProfileById(queuedReport.requested_by)
      : queuedReport.requested_by_email
        ? await getUserProfileByEmail(queuedReport.requested_by_email)
        : null;

    if (!requester) {
      console.error('[report-queue] Requester profile not found, dropping queue entry');
      await removeQueuedReport(queuedReport.survey_id);
      await revertSurveyStatus(queuedReport.survey_id);
      return NextResponse.json({
        success: false,
        status: 'dropped',
        message: 'Requester profile not found',
      }, { status: 404 });
    }

    const response = await generateReportForSurvey({
      surveyId: queuedReport.survey_id,
      tone: queuedReport.tone || 'standard',
      requester,
      queueIfBusy: false,
      allowQueuedProcessing: true,
    });

    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch (error) {
      console.warn('[report-queue] Failed to parse response body:', error);
    }

    if (response.status === 200) {
      await removeQueuedReport(queuedReport.survey_id);
      return NextResponse.json({
        success: true,
        status: 'processed',
        responseStatus: response.status,
      });
    }

    if (response.status === 202 || response.status === 409 || response.status === 429) {
      return NextResponse.json({
        success: true,
        status: 'deferred',
        responseStatus: response.status,
        responseBody,
      });
    }

    await removeQueuedReport(queuedReport.survey_id);
    await revertSurveyStatus(queuedReport.survey_id);

    return NextResponse.json({
      success: false,
      status: 'failed',
      responseStatus: response.status,
      responseBody,
    }, { status: 500 });
  } catch (error: any) {
    console.error('[report-queue] Error processing queue:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
    }, { status: 500 });
  }
}
