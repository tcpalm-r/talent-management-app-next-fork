import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Single-tenant organization ID (was hardcoded in the employees materialized view)
const ORGANIZATION_ID = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f';

/**
 * GET /api/dashboard/data
 *
 * Loads employees, departments, and assessments for a given organization.
 * Query params:
 *   - organization_id: The organization ID to filter by (required for API compatibility)
 *
 * Returns:
 *   { employees, departments, assessments }
 *
 * Note: This endpoint now queries user_profiles directly instead of the
 * employees materialized view. Field names are mapped for backward compatibility.
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

    // Load user_profiles (employees), departments, and assessments in parallel
    const [userProfilesResult, departmentsResult, assessmentsResult] = await Promise.all([
      supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email, employee_number, department, manager_id, title, location, app_role, created_at, updated_at')
        .eq('is_active', true),
      supabaseAdmin
        .from('departments' as any)
        .select('*')
        .order('name'),
      supabaseAdmin
        .from('assessments')
        .select('*')
    ]);

    if (userProfilesResult.error) {
      console.error('Error loading employees:', userProfilesResult.error);
      return NextResponse.json(
        { error: 'Failed to load employees', details: userProfilesResult.error.message },
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

    // Create a lookup map for manager names
    const userProfilesById = new Map(
      (userProfilesResult.data || []).map((up: any) => [up.id, up])
    );

    // Transform user_profiles to match legacy Employee interface
    const employeesWithRelations = (userProfilesResult.data || []).map((up: any) => {
      // Find department by name match
      const dept = departmentsResult.data?.find((d: any) => d.name === up.department) || null;
      // Get manager's name
      const manager = up.manager_id ? userProfilesById.get(up.manager_id) : null;

      return {
        id: up.id,
        organization_id: ORGANIZATION_ID,
        employee_id: up.employee_number,
        name: up.full_name,
        email: up.email,
        department_id: dept?.id || null,
        department: dept,
        manager_name: manager?.full_name || null,
        title: up.title,
        location: up.location,
        app_role: up.app_role,
        reports_to_id: up.manager_id,
        created_at: up.created_at,
        updated_at: up.updated_at,
        assessment: assessmentsResult.data?.find((a: any) => a.user_id === up.id) || null
      };
    });

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
