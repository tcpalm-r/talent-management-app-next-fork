import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import type { UserProfile } from '@/lib/schema';

export const dynamic = 'force-dynamic';

/**
 * API Route: /api/360-citations
 *
 * GET: Retrieve citations for a report (for audit mode)
 *
 * Query params:
 *   - report_id: UUID of the report (required)
 *   - section_type: Filter by section type (optional)
 *   - section_index: Filter by section index (optional)
 *
 * Returns citations with anonymized snippets (no reviewer attribution)
 * Only accessible to admins - sponsors and subjects get 403
 */

/**
 * Determine if user can access citations
 * Only admins can access citation audit data - sponsors see normal reports
 */
function canAccessCitations(
  user: UserProfile,
  _survey: { created_by: string; employee_id: string }
): boolean {
  // Only admins can access citations (audit mode is admin-only)
  return user.app_role === 'admin';
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const report_id = searchParams.get('report_id');
    const section_type = searchParams.get('section_type');
    const section_index = searchParams.get('section_index');

    if (!report_id) {
      return NextResponse.json(
        { error: 'report_id query parameter is required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch report with survey to check authorization
    const { data: report, error: reportError } = await supabaseAdmin
      .from('feedback_360_reports')
      .select(`
        id,
        survey_id,
        has_citations,
        survey:feedback_360_surveys(
          created_by,
          employee_id,
          status
        )
      `)
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const survey = report.survey as any;
    if (!survey) {
      return NextResponse.json(
        { error: 'Associated survey not found' },
        { status: 404 }
      );
    }

    // Check authorization - only sponsors and admins can access citations
    const hasAccess = canAccessCitations(authData.profile, survey);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only survey sponsors and administrators can access citation audit data'
        },
        { status: 403 }
      );
    }

    // Check if report has citations
    if (!report.has_citations) {
      return NextResponse.json(
        {
          error: 'No citations available',
          message: 'This report was generated without citation tracking. Regenerate the report to enable citations.'
        },
        { status: 404 }
      );
    }

    // Build query for citations
    let query = supabaseAdmin
      .from('feedback_360_report_citations')
      .select('*')
      .eq('report_id', report_id)
      .order('section_type')
      .order('section_index')
      .order('statement_index');

    // Apply optional filters
    if (section_type) {
      query = query.eq('section_type', section_type);
    }
    if (section_index !== null && section_index !== undefined) {
      query = query.eq('section_index', parseInt(section_index, 10));
    }

    const { data: citations, error: citationsError } = await query;

    if (citationsError) {
      console.error('Error fetching citations:', citationsError);
      return NextResponse.json(
        { error: 'Failed to fetch citations', details: citationsError.message },
        { status: 500 }
      );
    }

    // Return anonymized citations (just the snippet, no response_id exposed to frontend)
    // The response_id is stored but we only return what's needed for the UI
    const anonymizedCitations = (citations || []).map(citation => ({
      id: citation.id,
      section_type: citation.section_type,
      section_index: citation.section_index,
      statement_index: citation.statement_index,
      snippet: citation.snippet,
      // Note: We intentionally do NOT return response_id to the frontend
      // The audit trail exists in the DB but users see only anonymized snippets
    }));

    return NextResponse.json({
      success: true,
      citations: anonymizedCitations,
      total: anonymizedCitations.length,
    });

  } catch (error: any) {
    console.error('Error fetching citations:', error);
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
 * GET citations for a specific statement
 *
 * This is a convenience endpoint to fetch citations for a single statement
 * Used by the CitationPopover component when a user clicks on a statement
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id, section_type, section_index, statement_index = 0 } = body;

    if (!report_id || !section_type || section_index === undefined) {
      return NextResponse.json(
        { error: 'report_id, section_type, and section_index are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch report with survey to check authorization
    const { data: report, error: reportError } = await supabaseAdmin
      .from('feedback_360_reports')
      .select(`
        id,
        survey_id,
        has_citations,
        survey:feedback_360_surveys(
          created_by,
          employee_id
        )
      `)
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const survey = report.survey as any;
    if (!survey) {
      return NextResponse.json(
        { error: 'Associated survey not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const hasAccess = canAccessCitations(authData.profile, survey);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch citations for this specific statement
    const { data: citations, error: citationsError } = await supabaseAdmin
      .from('feedback_360_report_citations')
      .select('id, snippet, section_type, section_index, statement_index')
      .eq('report_id', report_id)
      .eq('section_type', section_type)
      .eq('section_index', section_index)
      .eq('statement_index', statement_index);

    if (citationsError) {
      console.error('Error fetching citations:', citationsError);
      return NextResponse.json(
        { error: 'Failed to fetch citations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      citations: citations || [],
      total: citations?.length || 0,
    });

  } catch (error: any) {
    console.error('Error fetching statement citations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
