import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createAuthenticatedResponse, MOCK_USER } from '@/lib/auth';
import type { SessionUser } from '@/lib/schema';

/**
 * Decode JWT payload without verification (safe since from Auth0 over HTTPS)
 */
function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[Auth0 Callback] Failed to decode JWT:', e);
    return null;
  }
}

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

    console.log('[Auth0 Callback] Authorization code received');

    // Exchange authorization code for tokens
    const auth0IssuerUrl = process.env.AUTH0_ISSUER_BASE_URL;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const baseUrl = process.env.AUTH0_BASE_URL;

    if (!auth0IssuerUrl || !clientId || !clientSecret) {
      console.error('[Auth0 Callback] Missing Auth0 configuration');
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    console.log('[Auth0 Callback] Exchanging code for tokens...');
    console.log('[Auth0 Callback] Token endpoint:', `${auth0IssuerUrl}/oauth/token`);
    console.log('[Auth0 Callback] Client ID:', clientId);
    console.log('[Auth0 Callback] Redirect URI:', `${baseUrl}/api/auth/callback`);

    const tokenResponse = await fetch(`${auth0IssuerUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `${auth0IssuerUrl}/api/v2/`,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${baseUrl}/api/auth/callback`,
      }),
    });

    console.log('[Auth0 Callback] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Auth0 Callback] Token exchange failed with status', tokenResponse.status);
      console.error('[Auth0 Callback] Error response body:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        console.error('[Auth0 Callback] Parsed error:', errorData);
      } catch (e) {
        console.error('[Auth0 Callback] Could not parse error response');
      }
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;
    const accessToken = tokenData.access_token;

    console.log('[Auth0 Callback] Tokens received successfully');
    console.log('[Auth0 Callback] ID token length:', idToken?.length);
    console.log('[Auth0 Callback] Access token length:', accessToken?.length);

    // Decode ID token to get user info
    const idTokenPayload = decodeJWT(idToken);
    if (!idTokenPayload) {
      console.error('[Auth0 Callback] Failed to decode ID token');
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    console.log('[Auth0 Callback] ID token decoded:', {
      sub: idTokenPayload.sub,
      email: idTokenPayload.email,
      name: idTokenPayload.name,
    });

    const auth0Id = idTokenPayload.sub;
    const email = idTokenPayload.email;
    const fullName = idTokenPayload.name || email;
    const givenName = idTokenPayload.given_name;
    const familyName = idTokenPayload.family_name;
    const picture = idTokenPayload.picture;

    // Check if user exists in Supabase
    console.log('[Auth0 Callback] Looking up user in Supabase with email:', email);
    const { data: existingUser, error: lookupError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    console.log('[Auth0 Callback] Lookup result:', { existingUser: !!existingUser, error: lookupError?.code });

    let user = existingUser;

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected for new users
      console.error('[Auth0 Callback] Error looking up user - unexpected error:', lookupError.code, lookupError.message);
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    if (!user) {
      // User doesn't exist - create them
      console.log('[Auth0 Callback] User not found, creating new user...');
      console.log('[Auth0 Callback] User data to insert:', {
        auth0_id: auth0Id,
        email: email,
        full_name: fullName,
      });

      const { data: newUser, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          auth0_id: auth0Id,
          email: email,
          full_name: fullName,
          given_name: givenName,
          family_name: familyName,
          picture: picture,
          app_role: 'user', // Default role for new users
          app_permissions: {
            manage_users: false,
            manage_reviews: false,
            manage_surveys: false,
            view_analytics: false,
          },
          has_logged_in: true,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
          sync_method: 'auth0',
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        console.error('[Auth0 Callback] Error creating user:', {
          code: createError.code,
          message: createError.message,
          details: createError.details,
        });
        return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
      }

      user = newUser;
      console.log('[Auth0 Callback] New user created successfully:', {
        id: user.id,
        email: user.email,
      });
    } else {
      // User exists - update last login
      console.log('[Auth0 Callback] User found in Supabase:', {
        id: user.id,
        email: user.email,
      });
      console.log('[Auth0 Callback] Updating last login...');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          auth0_id: auth0Id, // Update in case it changed
          last_login_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[Auth0 Callback] Error updating user:', updateError);
      } else {
        console.log('[Auth0 Callback] Last login updated successfully');
      }
    }

    // Create session user object
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role || 'user',
      app_permissions: user.app_permissions || {},
      department: user.department,
      title: user.title,
    };

    console.log('[Auth0 Callback] Creating authenticated response');

    // Create response with authenticated cookies
    const response = NextResponse.redirect(new URL('/', request.nextUrl.origin));
    const authenticatedResponse = createAuthenticatedResponse(response, sessionUser, accessToken);

    console.log('[Auth0 Callback] Authentication successful, redirecting to home');
    return authenticatedResponse;
  } catch (error) {
    console.error('[Auth0 Callback] Error:', error);
    return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
  }
}
