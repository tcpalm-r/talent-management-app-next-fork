import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  validateReportCitations,
  getValidationStatus,
} from '@/lib/services/citationValidationService';

export const dynamic = 'force-dynamic';

/**
 * API Route: /api/360-validate-citations
 *
 * POST: Start background citation validation for a report (admin-only)
 * GET: Check validation status for a report
 *
 * This is an admin-only QA feature to verify AI-generated reports
 * aren't hallucinating or embellishing.
 */

/**
 * POST - Start citation validation
 *
 * Request body: { report_id: string }
 *
 * This triggers a background validation that:
 * 1. Re-runs the AI analysis with citation tracking enabled
 * 2. Validates each citation references a real response
 * 3. Updates the report with citation data
 * 4. Sets validation status
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id } = body;

    if (!report_id) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can trigger citation validation
    if (authData.profile.app_role !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Only administrators can validate report citations',
      }, { status: 403 });
    }

    // Verify report exists
    const { data: report, error: reportError } = await supabaseAdmin
      .from('feedback_360_reports')
      .select('id, citation_validation_status')
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({
        error: 'Report not found',
        details: reportError?.message,
      }, { status: 404 });
    }

    // Check if validation is already in progress
    if (report.citation_validation_status === 'pending' || report.citation_validation_status === 'validating') {
      return NextResponse.json({
        error: 'Validation already in progress',
        status: report.citation_validation_status,
      }, { status: 409 });
    }

    // Set status to pending immediately
    await supabaseAdmin
      .from('feedback_360_reports')
      .update({ citation_validation_status: 'pending' })
      .eq('id', report_id);

    // Start validation in background (fire and forget)
    // In a production system, you'd use a proper job queue
    // For now, we'll just start the async operation
    validateReportCitations(report_id).catch((error) => {
      console.error(`[360-validate-citations] Background validation failed:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Citation validation started',
      status: 'pending',
      report_id,
    });
  } catch (error) {
    console.error('[360-validate-citations] POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET - Check validation status
 *
 * Query params: ?report_id=xxx
 *
 * Returns current validation status and results
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('report_id');

    if (!reportId) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can check citation validation status
    if (authData.profile.app_role !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Only administrators can view citation validation status',
      }, { status: 403 });
    }

    const status = await getValidationStatus(reportId);

    return NextResponse.json({
      success: true,
      report_id: reportId,
      ...status,
    });
  } catch (error) {
    console.error('[360-validate-citations] GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
