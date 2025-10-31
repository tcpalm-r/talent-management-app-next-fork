import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

/**
 * POST /api/auth/switch-user
 *
 * Dev-only endpoint to switch to a different user for testing.
 * Stores the switched user ID in a cookie that the app can read.
 */
export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request);

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Fetch the user to switch to
    const user = await getUserProfile(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

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

    return response;
  } catch (error) {
    console.error('[API] Error switching user:', error);
    return NextResponse.json(
      { error: 'Failed to switch user' },
      { status: 500 }
    );
  }
}
