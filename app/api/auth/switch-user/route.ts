import { NextRequest, NextResponse } from 'next/server';
import { AUTH_DISABLED, USER_COOKIE, SESSION_DURATION, TEST_USERS } from '@/lib/auth';

/**
 * Switch User API - Local Development Only
 *
 * Allows switching between test users for local development testing.
 * Only works when DISABLE_AUTH=true. Returns 403 in production.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Only allow user switching in development mode
  if (!AUTH_DISABLED) {
    console.error('[User Switcher] Attempted to use in production - BLOCKED');
    return NextResponse.json(
      { error: 'User switching is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user in hardcoded TEST_USERS array
    const user = TEST_USERS.find(u => u.email === email);

    if (!user) {
      console.error('[User Switcher] User not found:', email);
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    console.log(`[User Switcher] Switching to user:`, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role,
    });

    // Create response with user cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        app_role: user.app_role,
      }
    });

    // Set user cookie (matches middleware.ts and lib/auth.ts format)
    // Don't use encodeURIComponent - Next.js handles encoding automatically
    response.cookies.set(USER_COOKIE, JSON.stringify(user), {
      httpOnly: false, // Accessible to JavaScript for client-side use
      secure: false, // Not secure in development
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[User Switcher] Error switching user:', error);
    return NextResponse.json(
      { error: 'Failed to switch user' },
      { status: 500 }
    );
  }
}

/**
 * Get test users from database - Local Development Only
 */
export async function GET(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (!AUTH_DISABLED) {
    return NextResponse.json(
      { error: 'User switching is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    // Return hardcoded test users
    const users = TEST_USERS.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role,
      department: user.department,
      title: user.title,
    }));

    console.log('[User Switcher] Returning hardcoded test users:', users.length);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[User Switcher] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test users' },
      { status: 500 }
    );
  }
}
