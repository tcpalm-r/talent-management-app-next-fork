import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getActiveUsers } from '@/lib/database';

/**
 * GET /api/users/list
 *
 * Returns list of all active users for the dev user switcher.
 * Only available to authenticated users.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active users from database
    const users = await getActiveUsers();

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        app_role: user.app_role || 'user',
        department: user.department,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
