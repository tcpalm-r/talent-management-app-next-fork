import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

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
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const role = user.app_role?.toLowerCase() || 'user';
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      );
    }

    let allowedEmployeeIds: string[] | null = null;

    if (role !== 'admin' && role !== 'slt') {
      if (role === 'leader') {
        const { data: directReports, error: directReportsError } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('manager_id', profile.id)
          .eq('is_active', true);

        if (directReportsError) {
          console.error('Error loading direct reports:', directReportsError);
          return NextResponse.json(
            { error: 'Failed to load direct reports', details: directReportsError.message },
            { status: 500 }
          );
        }

        const directReportIds = directReports?.map(dr => dr.id) || [];
        allowedEmployeeIds = Array.from(new Set([profile.id, ...directReportIds]));
      } else {
        allowedEmployeeIds = [profile.id];
      }
    }

    // Build query using admin client
    let query = supabaseAdmin
      .from('feedback_360_surveys' as any)
      .select('employee_id, id, status, survey_name, created_at, updated_at')
      .eq('organization_id', organizationId);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    if (allowedEmployeeIds) {
      query = query.in('employee_id', allowedEmployeeIds);
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
