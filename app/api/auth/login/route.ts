import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/login
 * Redirects to Auth0 login
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Auth0 Login] Initiating login flow');

    // Log all available env vars for debugging
    console.log('[Auth0 Login] AUTH0_ISSUER_BASE_URL:', process.env.AUTH0_ISSUER_BASE_URL);
    console.log('[Auth0 Login] AUTH0_CLIENT_ID:', process.env.AUTH0_CLIENT_ID);
    console.log('[Auth0 Login] AUTH0_BASE_URL:', process.env.AUTH0_BASE_URL);
    console.log('[Auth0 Login] NODE_ENV:', process.env.NODE_ENV);

    // Build Auth0 authorize URL
    const auth0IssuerUrl = process.env.AUTH0_ISSUER_BASE_URL;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const baseUrl = process.env.AUTH0_BASE_URL;

    const auth0Domain = auth0IssuerUrl?.replace('https://', '');
    const redirectUri = `${baseUrl}/api/auth/callback`;

    console.log('[Auth0 Login] Parsed values:', { auth0Domain, clientId, redirectUri });

    if (!auth0Domain || !clientId) {
      console.error('[Auth0 Login] Missing AUTH0 configuration:', {
        auth0Domain: !!auth0Domain,
        clientId: !!clientId
      });
      return NextResponse.json(
        {
          error: 'Auth0 configuration missing',
          debug: {
            auth0Domain: !!auth0Domain,
            clientId: !!clientId,
            issuerUrl: auth0IssuerUrl
          }
        },
        { status: 500 }
      );
    }

    const authorizeUrl = new URL(`https://${auth0Domain}/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'openid profile email');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);

    console.log('[Auth0 Login] Building authorize URL');
    console.log('[Auth0 Login] Auth0 Domain:', auth0Domain);
    console.log('[Auth0 Login] Client ID:', clientId);
    console.log('[Auth0 Login] Redirect URI:', redirectUri);
    console.log('[Auth0 Login] Full URL:', authorizeUrl.toString());
    console.log('[Auth0 Login] Redirecting user to Auth0...');

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('[Auth0 Login] Error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
