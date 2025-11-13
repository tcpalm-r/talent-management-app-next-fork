import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check if a user has access to this app
 * Usage: /api/debug/check-access?email=user@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // Check with AI Intranet
    const authUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}`;
    
    console.log('[Debug] Checking access for:', email);
    console.log('[Debug] Auth URL:', authUrl);
    console.log('[Debug] App ID:', process.env.APP_ID);

    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_API_KEY}`,
        'X-Check-User': email, // Pass email to check specific user
      },
      cache: 'no-store'
    });

    const responseText = await authResponse.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json({
        success: false,
        status: authResponse.status,
        rawResponse: responseText,
        error: 'Failed to parse response'
      });
    }

    const access = data.access || data.granted;
    const user = data.user || (data.users && data.users[0]) || null;

    return NextResponse.json({
      success: true,
      email,
      hasAccess: !!access,
      user: user ? {
        email: user.email,
        full_name: user.full_name,
        app_role: user.app_permissions?.['Talent Management']?.role || user.app_role || 'none',
        app_permissions: user.app_permissions?.['Talent Management'] || null,
      } : null,
      rawResponse: data,
      instructions: access ? 
        'User has access to this app' : 
        'User does NOT have access. They need to be added to the Talent Management app in AI Intranet admin panel.'
    });

  } catch (error) {
    console.error('[Debug] Error checking access:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check access',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

