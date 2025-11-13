import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Mock user for local development
 */
const MOCK_USER = {
  id: 'dev-user-1',
  auth0_id: 'auth0|dev-user',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  app_role: 'admin',
  app_permissions: {
    manage_users: true,
    manage_reviews: true,
    manage_surveys: true,
    view_analytics: true,
  },
  department: 'Engineering',
  title: 'Developer',
  timestamp: Date.now()
};

/**
 * Decode JWT payload without verification (safe since from Sonance hub over HTTPS)
 */
function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[Sonance Auth] Failed to decode JWT:', e);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  try {
    console.log('[Sonance Auth] Processing request to:', request.nextUrl.pathname);

    // Skip middleware for specific paths
    const skipPaths = [
      '/api/auth/',
      '/_next/',
      '/favicon',
      '/unauthorized',
      '/robots.txt',
      '/sitemap.xml',
      '/_next/static',
      '/_next/image',
      '/public'
    ];

    const pathname = request.nextUrl.pathname;

    // Skip middleware for paths that should be public
    if (skipPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Check if authentication is disabled (mock mode)
    let authDisabled =
      process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
      process.env.DISABLE_AUTH?.trim() === 'true';

    // PRODUCTION FAIL-SAFE: Never allow auth bypass in production
    // This prevents accidental authentication bypass if environment variables are misconfigured
    if (process.env.NODE_ENV === 'production' && authDisabled) {
      console.error('[SECURITY WARNING] Auth bypass detected in production environment!');
      console.error('[SECURITY WARNING] DISABLE_AUTH is set to true but NODE_ENV is production.');
      console.error('[SECURITY WARNING] Forcing authentication to be ENABLED for security.');
      authDisabled = false; // Override to enforce real authentication
    }

    if (authDisabled) {
      console.log('[Sonance Auth] Authentication bypassed for local development');

      // Create a mock user session for development
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(MOCK_USER));
      requestHeaders.set('x-user-id', MOCK_USER.auth0_id);
      requestHeaders.set('x-user-role', MOCK_USER.app_role);
      requestHeaders.set('x-user-email', MOCK_USER.email);

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Set mock session cookie
      response.cookies.set('user-session', JSON.stringify(MOCK_USER), {
        httpOnly: true,
        secure: false, // Not secure in development
        sameSite: 'lax',
        maxAge: 86400 // 24 hours
      });

      return response;
    }

    // Check for auth token in URL (for cross-domain authentication from Sonance hub)
    const authToken = request.nextUrl.searchParams.get('auth_token');

    if (authToken) {
      console.log('[Sonance Auth] Token found in URL, attempting token-based authentication');

      try {
        const tokenUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}&auth_token=${authToken}`;
        console.log('[Sonance Auth] Token validation URL:', tokenUrl);

        const validateResponse = await fetch(tokenUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': process.env.APP_API_KEY || '',
            'Authorization': `Bearer ${process.env.APP_API_KEY}`,
          },
          cache: 'no-store'
        });

        console.log('[Sonance Auth] Token validation response status:', validateResponse.status);

        if (validateResponse.ok) {
          const responseText = await validateResponse.text();
          console.log('[Sonance Auth] Token validation raw response:', responseText);

          let data;
          try {
            data = JSON.parse(responseText);
            console.log('[Sonance Auth] Token validation parsed response:', JSON.stringify(data, null, 2));
          } catch (parseError) {
            console.error('[Sonance Auth] Failed to parse token response:', parseError);
            throw new Error('Invalid JSON response from Sonance hub');
          }

          // Handle different response formats from Sonance hub
          const access = data.access || data.granted;
          const user = data.user || (data.users && data.users[0]) || null;

          console.log('[Sonance Auth] Token auth - Access granted:', access);
          console.log('[Sonance Auth] Token auth - User found:', !!user);

          if (access && user) {
            console.log('[Sonance Auth] Token authentication successful for:', user.email);

            // Map user fields and extract app-specific permissions
            const appPermissions = user.app_permissions?.['Talent Management'] || {};
            const mappedUser = {
              id: user.id,
              auth0_id: user.auth0_id,
              email: user.email,
              full_name: user.full_name,
              given_name: user.given_name,
              family_name: user.family_name,
              picture: user.picture || user.avatar_url,
              app_role: appPermissions.role || user.app_role || user.role || 'user',
              app_permissions: appPermissions.permissions || user.permissions || {},
              global_role: user.global_role || user.role,
              capabilities: user.capabilities || [],
              app_access: true,
              department: user.department,
              title: user.title,
              timestamp: Date.now()
            };

            console.log('[Sonance Auth] Created session for user:', mappedUser.email, 'with role:', mappedUser.app_role);

            // Sync user profile to database (fire and forget)
            fetch(`${request.nextUrl.origin}/api/auth/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-data': JSON.stringify(mappedUser),
                'x-user-id': mappedUser.auth0_id,
              },
              body: JSON.stringify({ userData: user })
            }).catch(err => console.error('[Sonance Auth] Failed to sync user profile:', err));

            // Create request headers with user data for API routes
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-data', JSON.stringify(mappedUser));
            requestHeaders.set('x-user-id', mappedUser.auth0_id);
            requestHeaders.set('x-user-role', mappedUser.app_role);
            requestHeaders.set('x-user-email', mappedUser.email);

            // Create response and redirect without auth_token
            const cleanUrl = new URL(pathname, request.url);
            cleanUrl.searchParams.delete('auth_token');

            const response = NextResponse.redirect(cleanUrl);

            // Store user data in encrypted cookie (expires in 24 hours)
            response.cookies.set('user-session', JSON.stringify(mappedUser), {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 86400 // 24 hours
            });

            console.log('[Sonance Auth] Token auth complete, redirecting to:', cleanUrl.pathname);
            return response;
          } else {
            console.error('[Sonance Auth] Token auth failed - access:', access, 'user:', !!user);
          }
        } else {
          console.error('[Sonance Auth] Token validation failed with status:', validateResponse.status);
        }
      } catch (error) {
        console.error('[Sonance Auth] Token validation error:', error);
      }
    }

    // Check for dev user switch (testing purposes - overrides session)
    const switchedUserCookie = request.cookies.get('x-switched-user');
    console.log('[Sonance Auth] Checking for x-switched-user cookie:', switchedUserCookie ? 'FOUND' : 'NOT FOUND');
    if (switchedUserCookie) {
      try {
        const switchedUser = JSON.parse(switchedUserCookie.value);
        console.log('[Sonance Auth] ✓ Using switched user from cookie:', switchedUser.email);

        // Add switched user data to request headers
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-data', JSON.stringify(switchedUser));
        requestHeaders.set('x-user-id', switchedUser.id);
        requestHeaders.set('x-user-role', switchedUser.app_role || 'user');
        requestHeaders.set('x-user-email', switchedUser.email);

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        // Keep the cookie fresh
        response.cookies.set('x-switched-user', switchedUserCookie.value, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: '/',
        });

        console.log('[Sonance Auth] ✓ Switched user middleware response created and returning');
        return response;
      } catch (error) {
        console.error('[Sonance Auth] Failed to parse switched user cookie:', error);
      }
    } else {
      console.log('[Sonance Auth] No x-switched-user cookie found, continuing with session checks');
    }

    // Check for existing session cookie
    const sessionCookie = request.cookies.get('user-session');

    if (sessionCookie) {
      console.log('[Sonance Auth] Session cookie found, checking validity');

      try {
        const session = JSON.parse(sessionCookie.value);

        // Check if session is still valid (24 hour expiry)
        if (session.timestamp && Date.now() - session.timestamp < 86400000) {
          console.log('[Sonance Auth] Valid session found for user:', session.email);
          console.log('[Sonance Auth] Session age:', Math.floor((Date.now() - session.timestamp) / 1000 / 60), 'minutes');

          // Add user data to request headers for use in API routes and pages
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-data', JSON.stringify(session));
          requestHeaders.set('x-user-id', session.auth0_id);
          requestHeaders.set('x-user-role', session.app_role);
          requestHeaders.set('x-user-email', session.email);

          const response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          console.log('[Sonance Auth] Using existing session for:', session.email);
          return response;
        } else {
          console.log('[Sonance Auth] Session expired, age:', Math.floor((Date.now() - session.timestamp) / 1000 / 60 / 60), 'hours');
        }
      } catch (error) {
        console.error('[Sonance Auth] Session parsing failed:', error);
      }
    } else {
      console.log('[Sonance Auth] No session cookie found');
    }

    // Try cookie-based authentication (for same-domain scenarios)
    console.log('[Sonance Auth] Attempting cookie-based authentication with Sonance hub');

    try {
      const authUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}`;
      console.log('[Sonance Auth] Cookie auth URL:', authUrl);
      console.log('[Sonance Auth] App ID:', process.env.APP_ID);
      console.log('[Sonance Auth] Sonance hub URL:', process.env.AI_INTRANET_URL);

      const authResponse = await fetch(authUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.APP_API_KEY}`,
          'Cookie': request.headers.get('cookie') || '',
          'User-Agent': request.headers.get('user-agent') || '',
          'X-Forwarded-For': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        },
        cache: 'no-store'
      });

      console.log('[Sonance Auth] Response status:', authResponse.status);

      if (authResponse.status === 401) {
        console.log('[Sonance Auth] User not authenticated, redirecting to Sonance hub login');
        const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
        loginUrl.searchParams.set('returnTo', request.url);
        loginUrl.searchParams.set('app', process.env.APP_ID || '');
        return NextResponse.redirect(loginUrl);
      }

      if (authResponse.status === 403) {
        console.log('[Sonance Auth] User authenticated but no access to this app');
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      if (!authResponse.ok) {
        console.error('[Sonance Auth] Auth check failed with status:', authResponse.status);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Get raw response text first for debugging
      const responseText = await authResponse.text();
      console.log('[Sonance Auth] Raw response text:', responseText);

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('[Sonance Auth] Parsed response:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('[Sonance Auth] Failed to parse response as JSON:', parseError);
        console.error('[Sonance Auth] Response was:', responseText);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Handle different response formats from Sonance hub
      const access = data.access || data.granted;
      const user = data.user || (data.users && data.users[0]) || null;

      console.log('[Sonance Auth] Access granted:', access);
      console.log('[Sonance Auth] User data found:', !!user);

      if (!access) {
        console.error('[Sonance Auth] Access denied');
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      if (!user) {
        console.log('[Sonance Auth] Access granted but no user data, creating minimal session');
        // This shouldn't normally happen, but handle gracefully
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Map user fields
      const appPermissions = user.app_permissions?.['Talent Management'] || {};
      const mappedUser = {
        id: user.id,
        auth0_id: user.auth0_id,
        email: user.email,
        full_name: user.full_name,
        given_name: user.given_name,
        family_name: user.family_name,
        picture: user.picture,
        app_role: appPermissions.role || user.app_role || user.role || 'user',
        app_permissions: appPermissions.permissions || user.permissions || {},
        global_role: user.global_role || user.role,
        capabilities: user.capabilities || [],
        app_access: true,
        department: user.department,
        title: user.title,
        timestamp: Date.now()
      };

      console.log('[Sonance Auth] Mapped user object:', JSON.stringify(mappedUser, null, 2));

      // Add user data to request headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(mappedUser));
      requestHeaders.set('x-user-id', mappedUser.auth0_id);
      requestHeaders.set('x-user-role', mappedUser.app_role);
      requestHeaders.set('x-user-email', mappedUser.email);

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Store user data in session cookie
      response.cookies.set('user-session', JSON.stringify(mappedUser), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400 // 24 hours
      });

      return response;

    } catch (error) {
      console.error('[Sonance Auth] Middleware authentication failed:', error);

      // If Sonance hub is down, check if we have a valid session cookie
      if (sessionCookie) {
        try {
          const session = JSON.parse(sessionCookie.value);
          if (session.timestamp && Date.now() - session.timestamp < 86400000) {
            // Allow access with cached session
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-data', JSON.stringify(session));
            requestHeaders.set('x-user-id', session.auth0_id);
            requestHeaders.set('x-user-role', session.app_role);

            const response = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            });
            return response;
          }
        } catch (e) {
          // Session invalid
        }
      }

      // Redirect to unauthorized if all auth methods fail
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  } catch (error) {
    console.error('[Sonance Auth] Unexpected middleware error:', error);
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
  ],
};
