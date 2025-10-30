import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Clears Auth0 session and redirects to logout URL
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Auth0 Logout] Processing logout');

    // Clear cookies
    const response = NextResponse.redirect(new URL('/', request.nextUrl.origin));
    response.cookies.delete('appSession');

    // TODO: Call Auth0 logout endpoint
    // returnTo should be configured in Auth0 dashboard

    console.log('[Auth0 Logout] Logged out successfully');
    return response;
  } catch (error) {
    console.error('[Auth0 Logout] Error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
