/**
 * POST /api/auth/validate-token
 *
 * Validates a session token and returns user data.
 * Used for AI Intranet integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndSyncSession } from '@/lib/auth-wrapper';
import { createAuthenticatedResponse } from '@/lib/auth';

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

    // Validate token and sync with Supabase
    const authData = await validateAndSyncSession(token);

    if (!authData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create response with user cookies
    const response = NextResponse.json({
      success: true,
      user: authData.user,
      profile: authData.profile,
    });

    // Set auth cookies
    return createAuthenticatedResponse(response, authData.user, token);
  } catch (error) {
    console.error('Error in /api/auth/validate-token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
