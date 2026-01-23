import { NextRequest, NextResponse } from 'next/server';
import { getActiveUsers } from '@/lib/database';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/employees
 *
 * Returns list of all active employees for admin management.
 * Note: The admin settings page is already protected by role-based routing.
 */
export async function GET() {
  try {
    const employees = await getActiveUsers();

    return NextResponse.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error('[API] Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/employees
 *
 * Update an employee's profile.
 * Body: { id: string, updates: Partial<UserProfile> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API] Error updating employee:', error);
      return NextResponse.json(
        { error: 'Failed to update employee' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: data,
    });
  } catch (error) {
    console.error('[API] Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}
