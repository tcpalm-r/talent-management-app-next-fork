import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/employees/[id]/surveys
 *
 * Returns completed 360 feedback surveys for a specific employee.
 * Only available to authenticated users.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use custom auth instead of Auth0
    const authData = await getAuthenticatedUser(request);

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const employeeId = params.id;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get completed 360 surveys for the employee using admin client (bypasses RLS)
    const { data: surveys, error } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('employee_id', employeeId)
      .in('status', ['completed', 'finalized'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Error fetching employee surveys:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      surveys: surveys || [],
    });
  } catch (error) {
    console.error('[API] Error fetching employee surveys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee surveys' },
      { status: 500 }
    );
  }
}
