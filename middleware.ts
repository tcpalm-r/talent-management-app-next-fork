import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MOCK_USER,
  getAuthenticatedUser,
  isProtectedRoute,
  createAuthenticatedResponse,
} from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get environment mode from env variable
  const localTestingMode = process.env.LOCAL_TESTING_MODE === 'true';

  // Set AI Intranet URL based on mode
  const aiIntranetUrl = localTestingMode
    ? process.env.AI_INTRANET_URL_LOCAL || 'http://localhost:3001'
    : process.env.AI_INTRANET_URL_PROD || 'https://aiintranet.sonance.com';

  // Check if route requires authentication
  const requiresAuth = isProtectedRoute(pathname);

  // Dev bypass mode - check environment variable at runtime (not build time)
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  // Dev bypass mode - allow all requests with mock user
  if (authDisabled) {
    const response = NextResponse.next();

    // Add AI Intranet configuration headers
    response.headers.set('x-ai-intranet-url', aiIntranetUrl);
    response.headers.set('x-app-id', process.env.APP_ID || '');
    response.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');
    response.headers.set('x-auth-disabled', 'true');

    // Set mock user cookie for dev mode (for ALL routes when auth is disabled)
    return createAuthenticatedResponse(response, MOCK_USER);
  }

  // Production mode - validate authentication
  if (requiresAuth) {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      // Redirect to unauthorized page
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // User is authenticated - continue with user data
    const response = NextResponse.next();

    // Add AI Intranet configuration headers
    response.headers.set('x-ai-intranet-url', aiIntranetUrl);
    response.headers.set('x-app-id', process.env.APP_ID || '');
    response.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');
    response.headers.set('x-user-email', user.email);
    response.headers.set('x-user-role', user.app_role);

    // Refresh user cookie
    return createAuthenticatedResponse(response, user);
  }

  // Public route - no auth required
  const response = NextResponse.next();
  response.headers.set('x-ai-intranet-url', aiIntranetUrl);
  response.headers.set('x-app-id', process.env.APP_ID || '');
  response.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');

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
