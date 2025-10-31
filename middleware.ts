import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MOCK_USER,
  SESSION_DURATION,
  isProtectedRoute,
  createAuthenticatedResponse,
} from './lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Processing request to:', pathname);

  // Get AI Intranet configuration
  const localTestingMode = process.env.LOCAL_TESTING_MODE?.trim() === 'true';
  const aiIntranetUrl = localTestingMode
    ? process.env.AI_INTRANET_URL_LOCAL || 'http://localhost:3001'
    : process.env.AI_INTRANET_URL_PROD || 'https://aiintranet.sonance.com';

  // Check if route requires authentication
  const requiresAuth = isProtectedRoute(pathname);
  const response = NextResponse.next();

  console.log('[Middleware] Route requires auth:', requiresAuth);

  // Check if authentication is disabled (mock auth mode)
  // Trim in case environment variables have trailing whitespace/newlines
  const authDisabled =
    process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
    process.env.DISABLE_AUTH?.trim() === 'true';
  console.log('[Middleware] Auth disabled (mock mode):', authDisabled);

  // If auth is disabled, automatically authenticate with mock user
  if (authDisabled) {
    console.log('[Middleware] Mock auth enabled, using mock user:', MOCK_USER.full_name);
    const authenticatedResponse = createAuthenticatedResponse(response, MOCK_USER);
    authenticatedResponse.headers.set('x-ai-intranet-url', aiIntranetUrl);
    authenticatedResponse.headers.set('x-app-id', process.env.APP_ID || '');
    authenticatedResponse.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');
    authenticatedResponse.headers.set('x-auth-disabled', 'true');
    return authenticatedResponse;
  }

  // Add AI Intranet configuration headers
  response.headers.set('x-ai-intranet-url', aiIntranetUrl);
  response.headers.set('x-app-id', process.env.APP_ID || '');
  response.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');

  // Check if user has Auth0 session cookies set by the callback handler
  // The auth0 SDK automatically sets session cookies, we just need to check if they exist
  const auth0SessionCookie = request.cookies.get('appSession')?.value;
  console.log('[Middleware] Auth0 session cookie present:', !!auth0SessionCookie);

  // Check if there's a switched user (for dev/testing)
  const switchedUserCookie = request.cookies.get('x-switched-user')?.value;
  console.log('[Middleware] Switched user cookie present:', !!switchedUserCookie);

  // If there's a switched user, use that
  if (switchedUserCookie) {
    try {
      const sessionUser = JSON.parse(decodeURIComponent(switchedUserCookie));
      console.log('[Middleware] Using switched user:', sessionUser.full_name);
      const authenticatedResponse = createAuthenticatedResponse(response, sessionUser);
      authenticatedResponse.headers.set('x-auth-disabled', 'false');
      return authenticatedResponse;
    } catch (error) {
      console.error('[Middleware] Error parsing switched user cookie:', error);
      // Fall through to check auth0 session
    }
  }

  // If Auth0 session exists, middleware will pass through
  // The actual user data is set via the Auth0 callback and stored in cookies
  // Client-side auth hooks handle fetching the actual user data
  if (auth0SessionCookie) {
    console.log('[Middleware] Auth0 session found, passing through');
    response.headers.set('x-auth-disabled', 'false');
    return response;
  }

  // Not authenticated - check if route requires auth
  if (requiresAuth) {
    console.log('[Middleware] No session and route requires auth, redirecting to login');
    // Redirect to login
    const loginUrl = new URL('/api/auth/login', request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Public route
  console.log('[Middleware] Public route, allowing access');
  response.headers.set('x-auth-disabled', 'false');
  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
