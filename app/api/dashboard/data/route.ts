import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/data
 *
 * Loads employees, departments, and assessments for a given organization.
 * Query params:
 *   - organization_id: The organization ID to filter by (required)
 *
 * Returns:
 *   { employees, departments, assessments }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      );
    }

    // Load employees, departments, and assessments in parallel using admin client
    const [employeesResult, departmentsResult, assessmentsResult] = await Promise.all([
      supabaseAdmin
        .from('employees' as any)
        .select('*')
        .eq('organization_id', organizationId),
      supabaseAdmin
        .from('departments' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .order('name'),
      supabaseAdmin
        .from('assessments')
        .select('*')
        .eq('organization_id', organizationId)
    ]);

    if (employeesResult.error) {
      console.error('Error loading employees:', employeesResult.error);
      return NextResponse.json(
        { error: 'Failed to load employees', details: employeesResult.error.message },
        { status: 500 }
      );
    }

    if (departmentsResult.error) {
      console.error('Error loading departments:', departmentsResult.error);
      return NextResponse.json(
        { error: 'Failed to load departments', details: departmentsResult.error.message },
        { status: 500 }
      );
    }

    if (assessmentsResult.error) {
      console.error('Error loading assessments:', assessmentsResult.error);
      return NextResponse.json(
        { error: 'Failed to load assessments', details: assessmentsResult.error.message },
        { status: 500 }
      );
    }

    // Combine data and attach relations
    const employeesWithRelations = (employeesResult.data || []).map((employee: any) => ({
      ...employee,
      department: departmentsResult.data?.find((d: any) => d.id === employee.department_id) || null,
      assessment: assessmentsResult.data?.find((a: any) => a.employee_id === employee.id) || null
    }));

    return NextResponse.json({
      employees: employeesWithRelations,
      departments: departmentsResult.data || [],
      assessments: assessmentsResult.data || []
    });
  } catch (error) {
    console.error('Error in /api/dashboard/data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
