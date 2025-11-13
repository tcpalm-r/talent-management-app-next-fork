import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/switch-user
 *
 * Dev-only endpoint to switch to a different user for testing.
 * Stores the switched user ID in a cookie that the app can read.
 * 
 * SECURITY: Only works when DISABLE_AUTH or NEXT_PUBLIC_DISABLE_AUTH is set to 'true'.
 * This ensures it's never available in production Vercel deployments.
 */
export async function POST(request: NextRequest) {
  try {
    // Check if auth is disabled (dev mode only)
    const authDisabled =
      process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
      process.env.DISABLE_AUTH?.trim() === 'true';

    if (!authDisabled) {
      console.log('[switch-user] Blocked - not in dev mode');
      return NextResponse.json(
        { error: 'User switching is only available in development mode' },
        { status: 403 }
      );
    }

    console.log('[switch-user] Request received');
    const authData = await getAuthenticatedUser(request);

    if (!authData?.user) {
      console.log('[switch-user] Unauthorized - no auth data');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();
    console.log('[switch-user] Switching to userId:', userId);

    if (!userId) {
      console.log('[switch-user] Error - userId is required');
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Fetch the user to switch to using admin client (bypasses RLS)
    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.log('[switch-user] Error - User not found:', userId, error);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[switch-user] Found user:', user.email);

    // Create session user object
    const switchedUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role || 'user',
      app_permissions: user.app_permissions || {},
      department: user.department,
      title: user.title,
    };

    // Create response
    const response = NextResponse.json({
      success: true,
      message: `Switched to ${user.full_name}`,
      user: switchedUser,
    });

    // Set a cookie with the switched user info
    response.cookies.set('x-switched-user', JSON.stringify(switchedUser), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    console.log('[switch-user] Cookie set for user:', user.email);
    console.log('[switch-user] Cookie value:', JSON.stringify(switchedUser));
    return response;
  } catch (error) {
    console.error('[switch-user] Error switching user:', error);
    return NextResponse.json(
      { error: 'Failed to switch user' },
      { status: 500 }
    );
  }
}
