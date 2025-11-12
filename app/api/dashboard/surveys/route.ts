import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/dashboard/surveys
 *
 * Loads surveys for a given organization, optionally filtered by status.
 * Query params:
 *   - organization_id: The organization ID to filter by (required)
 *   - status: Optional status filter (e.g., 'finalized')
 *
 * Returns:
 *   { surveys, surveyCountByEmployee }
 *   - surveys: Array of survey records
 *   - surveyCountByEmployee: Object mapping employee_id to count of surveys
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      );
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = supabase
      .from('feedback_360_surveys' as any)
      .select('employee_id, id, status, survey_name, created_at, updated_at')
      .eq('organization_id', organizationId);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading surveys:', error);
      return NextResponse.json(
        { error: 'Failed to load surveys', details: error.message },
        { status: 500 }
      );
    }

    // Group surveys by employee_id and count them
    const surveyCountByEmployee: Record<string, number> = {};
    (data || []).forEach((survey: any) => {
      if (survey.employee_id) {
        surveyCountByEmployee[survey.employee_id] = (surveyCountByEmployee[survey.employee_id] || 0) + 1;
      }
    });

    return NextResponse.json({
      surveys: data || [],
      surveyCountByEmployee
    });
  } catch (error) {
    console.error('Error in /api/dashboard/surveys:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
