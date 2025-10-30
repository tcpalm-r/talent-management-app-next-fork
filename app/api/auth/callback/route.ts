import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/callback
 * Callback handler after Auth0 authentication
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Auth0 Callback] Processing callback');

    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const error_description = searchParams.get('error_description');

    if (error) {
      console.error('[Auth0 Callback] Auth0 error:', error, error_description);
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    if (!code) {
      console.error('[Auth0 Callback] No authorization code received');
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    console.log('[Auth0 Callback] Authorization code received:', code.substring(0, 20) + '...');

    // TODO: Exchange code for token with Auth0
    // For now, just redirect to home (this won't work fully without token exchange)
    console.log('[Auth0 Callback] Redirecting to home');

    return NextResponse.redirect(new URL('/', request.nextUrl.origin));
  } catch (error) {
    console.error('[Auth0 Callback] Error:', error);
    return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
  }
}
