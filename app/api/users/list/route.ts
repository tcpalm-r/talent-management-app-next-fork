import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/list
 *
 * Returns list of all active users for the dev user switcher.
 * Only available to authenticated users.
 */
export async function GET(request: NextRequest) {
  try {
    // Use custom auth instead of Auth0
    const authData = await getAuthenticatedUser(request);

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active users from database using admin client (bypasses RLS)
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('[API] Error fetching users:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        app_role: user.app_role || 'user', // Use app_role field
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
