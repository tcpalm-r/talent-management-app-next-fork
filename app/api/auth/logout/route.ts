import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 * Clears Sonance hub session and redirects to hub login page
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Sonance Logout] Processing logout');

    // Get the hub URL from environment
    const hubUrl = process.env.AI_INTRANET_URL || process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';

    // Build login redirect URL with return path
    const loginUrl = new URL('/login', hubUrl);
    loginUrl.searchParams.set('returnTo', request.nextUrl.origin);
    loginUrl.searchParams.set('logout', 'true');

    // Create response that redirects to hub login
    const response = NextResponse.redirect(loginUrl);

    // Clear all local session cookies
    response.cookies.delete('user-session'); // Sonance hub session cookie
    response.cookies.delete('appSession'); // Legacy session cookie
    response.cookies.delete('ai-intranet-session'); // Old session cookie
    response.cookies.delete('ai-intranet-user'); // Old user cookie

    console.log('[Sonance Logout] Logged out successfully, redirecting to:', loginUrl.toString());
    return response;
  } catch (error) {
    console.error('[Sonance Logout] Error:', error);

    // Fallback: redirect to hub login on error
    const hubUrl = process.env.AI_INTRANET_URL || process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';
    const response = NextResponse.redirect(new URL('/login', hubUrl));
    response.cookies.delete('user-session');

    return response;
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
