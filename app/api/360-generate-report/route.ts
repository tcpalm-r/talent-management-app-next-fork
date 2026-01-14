import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterReportForSubject } from '@/lib/filterReport';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { determineViewerRole, generateReportForSurvey } from '@/lib/report-generation';

export const dynamic = 'force-dynamic';
export const maxDuration = 720; // 12 minutes - needed for two-pass Claude API calls with large surveys

/**
 * API Route: /api/360-generate-report
 *
 * POST: Generate AI analysis report for a completed 360 survey
 * GET: Retrieve existing report for a survey
 */

// Use singleton supabaseAdmin client (service role, bypasses RLS)

/**
 * POST - Generate AI analysis report
 *
 * Request body: { survey_id: string, tone?: string, queue_if_busy?: boolean }
 *
 * Process:
 * 1. Fetch survey data (survey, reviewers, responses, questions)
 * 2. Transform data for AI analyzer
 * 3. Call Claude AI to analyze responses
 * 4. Save report to database (upsert)
 * 5. Update survey status to 'completed'
 * 6. Return generated report
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const surveyId = body?.survey_id;
  const tone = body?.tone || 'standard';
  const queueIfBusy = body?.queue_if_busy === true;
  // Citations are always enabled for accuracy - they're just hidden from non-admins

  if (!surveyId) {
    return NextResponse.json({ error: 'survey_id is required' }, { status: 400 });
  }

  // Authenticate user
  const authData = await getAuthenticatedUser(req);
  if (!authData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return generateReportForSurvey({
    surveyId,
    tone,
    requester: authData.profile,
    queueIfBusy,
  });
}

/**
 * GET - Retrieve existing report
 *
 * Query params: ?survey_id=<uuid>
 *
 * Returns existing AI analysis report for a survey
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const survey_id = searchParams.get('survey_id');

    if (!survey_id) {
      return NextResponse.json({
        error: 'survey_id query parameter is required'
      }, { status: 400 });
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use singleton admin client

    // Fetch report with survey details
    const { data: report, error } = await supabaseAdmin
      .from('feedback_360_reports')
      .select(`
        *,
        survey:feedback_360_surveys(
          id,
          survey_name,
          employee_id,
          status,
          created_by,
          created_by_email,
          created_at
        )
      `)
      .eq('survey_id', survey_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No report in database - this is expected if report was just generated
        // Return a message indicating the user should have already seen the results
        return NextResponse.json({
          error: 'No report found for this survey',
          message: 'Report data should have been displayed immediately after generation. Please regenerate the analysis if needed.'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to fetch report',
        details: error.message
      }, { status: 500 });
    }

    // Determine viewer role for authorization and filtering
    const survey = report.survey as any;
    if (!survey) {
      return NextResponse.json({
        error: 'Survey not found',
        message: 'Report exists but associated survey could not be loaded'
      }, { status: 404 });
    }

    const viewerRole = determineViewerRole(authData.profile, {
      created_by: survey.created_by,
      employee_id: survey.employee_id,
      status: survey.status
    });

    console.log('[GET /api/360-generate-report] Viewer role determined:', viewerRole);
    console.log('[GET /api/360-generate-report] User ID:', authData.profile.id);
    console.log('[GET /api/360-generate-report] Employee ID:', survey.employee_id);
    console.log('[GET /api/360-generate-report] Survey status:', survey.status);
    console.log('[GET /api/360-generate-report] Created by:', survey.created_by);

    if (viewerRole === 'unauthorized') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'You do not have permission to view this report'
      }, { status: 403 });
    }

    // Filter report data based on viewer role
    let filteredReport: any = { ...report };

    if (viewerRole === 'subject') {
      console.log('[GET /api/360-generate-report] Filtering report for subject');
      // Subjects see filtered report without relationship breakdowns
      filteredReport = filterReportForSubject(report as any);
    }

    // Sponsors and admins see full report (no filtering needed)

    return NextResponse.json({
      success: true,
      report: filteredReport,
      viewerRole // Include viewer role for debugging/frontend awareness
    });

  } catch (error: any) {
    console.error('Error fetching 360 report:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update report fields (e.g., narrative)
 *
 * Request body: { survey_id: string, final_narrative?: string, narrative_version?: number }
 *
 * Used for saving generated narrative to the report
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { survey_id, final_narrative, narrative_version } = body;

    if (!survey_id) {
      return NextResponse.json({ error: 'survey_id is required' }, { status: 400 });
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the survey to verify permissions
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, created_by, created_by_email, employee_id, status')
      .eq('id', survey_id)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Check permissions - only sponsor or admin can update the report
    const viewerRole = determineViewerRole(authData.profile, survey);
    if (viewerRole !== 'sponsor' && viewerRole !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Only the survey sponsor or admin can update the report'
      }, { status: 403 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (final_narrative !== undefined) {
      updateData.final_narrative = final_narrative;
    }

    if (narrative_version !== undefined) {
      updateData.narrative_version = narrative_version;
    }

    // Update the report
    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from('feedback_360_reports')
      .update(updateData)
      .eq('survey_id', survey_id)
      .select('id, final_narrative, narrative_version, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating report:', updateError);
      return NextResponse.json({
        error: 'Failed to update report',
        details: updateError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      report: updatedReport
    });

  } catch (error: any) {
    console.error('Error updating 360 report:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
