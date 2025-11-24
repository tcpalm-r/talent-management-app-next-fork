import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Mock user for local development
 * Structure matches production session format exactly
 */
const MOCK_USER = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f', // Real DB ID
  auth0_id: 'thomas.palmer@sonance.com',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  given_name: 'Thomas',
  family_name: 'Palmer',
  picture: null,
  app_role: 'leader', // Updated to match database value
  app_permissions: {
    manage_users: true,
    manage_reviews: true,
    manage_surveys: true,
    view_analytics: true,
  },
  global_role: 'admin',
  capabilities: [],
  app_access: true,
  department: 'Engineering',
  title: 'Developer',
  timestamp: Date.now()
};

/**
 * Get Supabase client for querying user_profiles
 * Uses service role key to bypass RLS
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get user's app_role from LOCAL user_profiles table
 * This is the source of truth for project-level permissions
 */
async function getLocalUserRole(email: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('app_role, app_permissions')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.log('[Sonance Auth] No local user_profiles entry for:', email);
      return null;
    }

    console.log('[Sonance Auth] Found local role for', email, ':', data.app_role);
    return {
      app_role: data.app_role || 'user',
      app_permissions: data.app_permissions || {},
    };
  } catch (error) {
    console.error('[Sonance Auth] Error fetching local user role:', error);
    return null;
  }
}

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
    // IMPORTANT: Only skip public auth endpoints (login, logout, callback)
    // DO NOT skip /api/auth/me, /api/auth/sync, /api/auth/switch-user - they need auth!
    const skipPaths = [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/callback',
      '/api/auth/validate-token',
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

      // Check if there's an existing user cookie from user switcher
      const existingUserCookie = request.cookies.get('ai-intranet-user');
      let currentUser = MOCK_USER;

      if (existingUserCookie) {
        try {
          const parsedUser = JSON.parse(existingUserCookie.value);
          console.log('[Sonance Auth] Found existing user cookie:', parsedUser.email);
          currentUser = parsedUser;
        } catch (error) {
          console.error('[Sonance Auth] Failed to parse existing user cookie, using MOCK_USER');
        }
      }

      // Create request headers with current user data
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(currentUser));
      requestHeaders.set('x-user-id', currentUser.auth0_id || currentUser.id);
      requestHeaders.set('x-user-role', currentUser.app_role);
      requestHeaders.set('x-user-email', currentUser.email);

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Set cookie if there wasn't one already
      if (!existingUserCookie) {
        console.log('[Sonance Auth] No existing cookie, setting MOCK_USER');
        response.cookies.set('ai-intranet-user', JSON.stringify(MOCK_USER), {
          httpOnly: false, // Accessible to JavaScript for client-side auth checks
          secure: false, // Not secure in development
          sameSite: 'lax',
          maxAge: 86400 // 24 hours
        });
      }

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

            // Get app_role from LOCAL user_profiles table (source of truth)
            const localRole = await getLocalUserRole(user.email);

            // Map user fields - use LOCAL role if available, fallback to AI Intranet
            const appPermissions = user.app_permissions?.['Talent Management'] || {};
            const mappedUser = {
              id: user.id,
              auth0_id: user.auth0_id,
              email: user.email,
              full_name: user.full_name,
              given_name: user.given_name,
              family_name: user.family_name,
              picture: user.picture || user.avatar_url,
              // IMPORTANT: Use LOCAL database role, NOT AI Intranet role
              app_role: localRole?.app_role || appPermissions.role || user.app_role || user.role || 'user',
              app_permissions: localRole?.app_permissions || appPermissions.permissions || user.permissions || {},
              global_role: user.global_role || user.role,
              capabilities: user.capabilities || [],
              app_access: true,
              department: user.department,
              title: user.title,
              timestamp: Date.now()
            };

            console.log('[Sonance Auth] Created session for user:', mappedUser.email,
              'with LOCAL role:', mappedUser.app_role,
              localRole ? '(from user_profiles)' : '(fallback to AI Intranet)');

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
            // Use request.url as base to preserve query parameters (e.g. survey IDs)
            const cleanUrl = new URL(request.url);
            cleanUrl.searchParams.delete('auth_token');

            const response = NextResponse.redirect(cleanUrl);

            // Store user data in cookie (expires in 24 hours) - matches lib/auth.ts USER_COOKIE
            response.cookies.set('ai-intranet-user', JSON.stringify(mappedUser), {
              httpOnly: false, // Accessible to JavaScript for client-side auth checks
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

    // Check for existing session cookie (matches lib/auth.ts USER_COOKIE)
    // In dev mode with user switcher, this will contain the switched user
    // In production, this contains the real authenticated session
    const sessionCookie = request.cookies.get('ai-intranet-user');

    if (sessionCookie) {
      console.log('[Sonance Auth] Session cookie found, checking validity');

      try {
        const session = JSON.parse(sessionCookie.value);

        // Check if session is still valid (24 hour expiry)
        if (session.timestamp && Date.now() - session.timestamp < 86400000) {
          console.log('[Sonance Auth] Valid session found for user:', session.email);
          console.log('[Sonance Auth] Session age:', Math.floor((Date.now() - session.timestamp) / 1000 / 60), 'minutes');

          // IMPORTANT: Re-query local database to get latest app_role
          // This ensures role changes take effect immediately without logout/login
          const localRole = await getLocalUserRole(session.email);

          // Override cached role with fresh database value
          if (localRole) {
            console.log('[Sonance Auth] Refreshed role from DB:', localRole.app_role);
            session.app_role = localRole.app_role;
            session.app_permissions = localRole.app_permissions;
          }

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

          // Update cookie with fresh role if it changed
          if (localRole) {
            response.cookies.set('ai-intranet-user', JSON.stringify(session), {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 86400
            });
          }

          console.log('[Sonance Auth] Using existing session for:', session.email, 'with role:', session.app_role);
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
        
        // Clean auth_token from return URL to prevent loops
        const returnTo = new URL(request.url);
        returnTo.searchParams.delete('auth_token');
        
        loginUrl.searchParams.set('returnTo', returnTo.toString());
        loginUrl.searchParams.set('app', process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID || '');
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

      // Get app_role from LOCAL user_profiles table (source of truth)
      const localRole = await getLocalUserRole(user.email);

      // Map user fields - use LOCAL role if available
      const appPermissions = user.app_permissions?.['Talent Management'] || {};
      const mappedUser = {
        id: user.id,
        auth0_id: user.auth0_id,
        email: user.email,
        full_name: user.full_name,
        given_name: user.given_name,
        family_name: user.family_name,
        picture: user.picture,
        // IMPORTANT: Use LOCAL database role, NOT AI Intranet role
        app_role: localRole?.app_role || appPermissions.role || user.app_role || user.role || 'user',
        app_permissions: localRole?.app_permissions || appPermissions.permissions || user.permissions || {},
        global_role: user.global_role || user.role,
        capabilities: user.capabilities || [],
        app_access: true,
        department: user.department,
        title: user.title,
        timestamp: Date.now()
      };

      console.log('[Sonance Auth] Mapped user:', mappedUser.email,
        'with LOCAL role:', mappedUser.app_role,
        localRole ? '(from user_profiles)' : '(fallback to AI Intranet)');

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

      // Store user data in session cookie (matches lib/auth.ts USER_COOKIE)
      response.cookies.set('ai-intranet-user', JSON.stringify(mappedUser), {
        httpOnly: false, // Accessible to JavaScript for client-side auth checks
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

      // Redirect to AI Intranet login if all auth methods fail
      console.log('[Sonance Auth] No valid session, redirecting to AI Intranet login');
      const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
      
      // Clean auth_token from return URL to prevent loops
      const returnTo = new URL(request.url);
      returnTo.searchParams.delete('auth_token');
      const returnToString = returnTo.toString();
      
      const appId = process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID || '';
      
      console.log('[Sonance Auth] Debug Redirect Params:', {
        returnTo: returnToString,
        appId: appId,
        intranetUrl: process.env.AI_INTRANET_URL
      });

      loginUrl.searchParams.set('returnTo', returnToString);
      loginUrl.searchParams.set('app', appId);
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    console.error('[Sonance Auth] Unexpected middleware error:', error);
    const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
    
    // Clean auth_token from return URL to prevent loops
    const returnTo = new URL(request.url);
    returnTo.searchParams.delete('auth_token');
    const returnToString = returnTo.toString();
    
    const appId = process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID || '';
    
    console.log('[Sonance Auth] Error Recovery Redirect Params:', {
      returnTo: returnToString,
      appId: appId
    });
    
    loginUrl.searchParams.set('returnTo', returnToString);
    loginUrl.searchParams.set('app', appId);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
  ],
};
