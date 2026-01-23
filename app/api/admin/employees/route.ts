import { NextResponse } from 'next/server';
import { getActiveUsers } from '@/lib/database';

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
