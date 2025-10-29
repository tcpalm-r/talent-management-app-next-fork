import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MOCK_USER,
  SESSION_DURATION,
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

  // For demo/deployment mode - always use mock user (enables sharing with coworkers)
  // In production deployment, we want everyone to access the demo with mock auth
  const response = NextResponse.next();

  // Add AI Intranet configuration headers
  response.headers.set('x-ai-intranet-url', aiIntranetUrl);
  response.headers.set('x-app-id', process.env.APP_ID || '');
  response.headers.set('x-local-testing-mode', localTestingMode ? 'true' : 'false');
  response.headers.set('x-auth-disabled', 'true');

  // Always inject mock user for all requests (demo mode)
  const authenticatedResponse = createAuthenticatedResponse(response, MOCK_USER);

  // Also set a flag cookie so client-side code knows auth is disabled
  authenticatedResponse.cookies.set('x-auth-disabled', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return authenticatedResponse;
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
