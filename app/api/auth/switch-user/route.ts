import { NextRequest, NextResponse } from 'next/server';
import { AUTH_DISABLED, USER_COOKIE, SESSION_DURATION, TEST_USERS } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// List of test user IDs that are allowed in the user switcher
const TEST_USER_IDS = TEST_USERS.map(u => u.id);

/**
 * Switch User API - Local Development Only
 *
 * Allows switching between test users for local development testing.
 * Only works when DISABLE_AUTH=true. Returns 403 in production.
 *
 * Fetches app_role dynamically from the database to reflect any changes.
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

    // Find user in hardcoded TEST_USERS array (for base structure)
    const baseUser = TEST_USERS.find(u => u.email === email);

    if (!baseUser) {
      console.error('[User Switcher] User not found in test users:', email);
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    // Fetch current user data from database to get latest app_role
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, app_role, department, title')
      .eq('id', baseUser.id)
      .single();

    if (dbError) {
      console.error('[User Switcher] Database error:', dbError);
      // Fall back to hardcoded user if database fails
      console.warn('[User Switcher] Falling back to hardcoded user data');
    }

    // Merge: use database values where available, fall back to hardcoded
    const user = {
      ...baseUser,
      app_role: dbUser?.app_role || baseUser.app_role,
      full_name: dbUser?.full_name || baseUser.full_name,
      department: dbUser?.department || baseUser.department,
      title: dbUser?.title || baseUser.title,
    };

    console.log(`[User Switcher] Switching to user:`, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role,
      source: dbUser ? 'database' : 'hardcoded',
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
 * Get test users - Local Development Only
 *
 * Returns the same list of test users, but with app_role fetched
 * dynamically from the database to reflect any changes.
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
    // Fetch current data for test users from database
    const { data: dbUsers, error: dbError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, app_role, department, title')
      .in('id', TEST_USER_IDS);

    if (dbError) {
      console.error('[User Switcher] Database error:', dbError);
      // Fall back to hardcoded users if database fails
      console.warn('[User Switcher] Falling back to hardcoded user data');
    }

    // Create a map of database users by ID for quick lookup
    const dbUserMap = new Map(
      (dbUsers || []).map(u => [u.id, u])
    );

    // Merge: use database values where available, fall back to hardcoded
    // Maintain the order from TEST_USERS
    const users = TEST_USERS.map(baseUser => {
      const dbUser = dbUserMap.get(baseUser.id);
      return {
        id: baseUser.id,
        email: dbUser?.email || baseUser.email,
        full_name: dbUser?.full_name || baseUser.full_name,
        app_role: dbUser?.app_role || baseUser.app_role,
        department: dbUser?.department || baseUser.department,
        title: dbUser?.title || baseUser.title,
      };
    });

    console.log('[User Switcher] Returning test users with dynamic roles:', users.length);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[User Switcher] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test users' },
      { status: 500 }
    );
  }
}
