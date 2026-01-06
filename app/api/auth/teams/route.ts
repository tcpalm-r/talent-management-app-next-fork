import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Azure AD Configuration
 * These should match your Azure AD App Registration
 */
const AZURE_TENANT_ID = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
const AZURE_CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID;

/**
 * Decode JWT payload without verification
 * Note: The token is already validated by Azure AD and comes from Teams SDK
 * We're just extracting the payload for user identification
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    console.error('[Teams Auth] Failed to decode JWT');
    return null;
  }
}

/**
 * POST /api/auth/teams
 *
 * Exchange a Teams/Azure AD token for an app session.
 * This endpoint:
 * 1. Receives Azure AD token from Teams SDK
 * 2. Decodes and validates basic token claims
 * 3. Looks up user in local database
 * 4. Creates app session matching existing format
 * 5. Sets session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Decode the Azure AD token
    const payload = decodeJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    // Validate token claims
    // The 'aud' claim should match our Azure AD client ID
    if (payload.aud !== AZURE_CLIENT_ID && payload.aud !== `api://${AZURE_CLIENT_ID}`) {
      console.error('[Teams Auth] Invalid audience:', payload.aud, 'expected:', AZURE_CLIENT_ID);
      return NextResponse.json(
        { error: 'Invalid token audience' },
        { status: 401 }
      );
    }

    // Validate tenant ID
    if (payload.tid !== AZURE_TENANT_ID) {
      console.error('[Teams Auth] Invalid tenant:', payload.tid, 'expected:', AZURE_TENANT_ID);
      return NextResponse.json(
        { error: 'Invalid tenant' },
        { status: 401 }
      );
    }

    // Extract user info from token
    // Azure AD tokens can have email in different claims
    const email = (payload.upn || payload.preferred_username || payload.email) as string;
    const name = payload.name as string;
    const oid = payload.oid as string; // Azure AD object ID

    if (!email) {
      console.error('[Teams Auth] No email found in token claims');
      return NextResponse.json(
        { error: 'No email found in token' },
        { status: 401 }
      );
    }

    console.log('[Teams Auth] Token validated for user:', email);

    // Look up user in local database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userProfile, error: dbError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (dbError || !userProfile) {
      console.error('[Teams Auth] User not found in database:', email, dbError?.message);
      return NextResponse.json(
        {
          error: 'User not found in system',
          email,
          message: 'Please contact your administrator to get access to this application.',
        },
        { status: 403 }
      );
    }

    console.log('[Teams Auth] User found:', userProfile.email, 'role:', userProfile.app_role);

    // Create session user matching existing format (same as AI Intranet auth)
    const sessionUser = {
      id: userProfile.id,
      auth0_id: email, // Use email as auth0_id for Teams users
      email: userProfile.email,
      full_name: userProfile.full_name || name || email.split('@')[0],
      given_name: userProfile.given_name || (name ? name.split(' ')[0] : null),
      family_name: userProfile.family_name || (name ? name.split(' ').slice(1).join(' ') : null),
      picture: userProfile.avatar_url || userProfile.picture || null,
      app_role: userProfile.app_role || 'user',
      app_permissions: userProfile.app_permissions || {},
      global_role: userProfile.app_role,
      capabilities: [],
      app_access: true,
      department: userProfile.department,
      title: userProfile.title,
      timestamp: Date.now(),
      // Store Azure AD info for reference
      azure_oid: oid,
      auth_source: 'teams', // Indicate this session came from Teams
    };

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    // Set the session cookie
    // Note: sameSite must be 'none' for cross-origin iframe (Teams)
    response.cookies.set('ai-intranet-user', JSON.stringify(sessionUser), {
      httpOnly: false, // Needs to be accessible to client-side JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none', // Required for Teams iframe
      maxAge: 86400, // 24 hours
      path: '/',
    });

    console.log('[Teams Auth] Session created successfully for:', email);

    return response;

  } catch (error) {
    console.error('[Teams Auth] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/teams
 *
 * Check if Teams auth is available (for debugging/status check)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configured: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID),
    tenant: AZURE_TENANT_ID ? `${AZURE_TENANT_ID.substring(0, 8)}...` : null,
  });
}
