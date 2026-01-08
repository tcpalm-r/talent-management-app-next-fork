/**
 * POST /api/auth/sync
 *
 * Syncs the authenticated user with Supabase.
 * Called by middleware after successful Sonance hub authentication.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

const verifyAuthSyncToken = (
  token: string,
  secret: string
): { user: Record<string, any>; iat: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    const signatureBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payloadRaw = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadRaw);
    if (!payload || typeof payload !== 'object' || !payload.user) return null;

    const iat = payload.iat;
    if (typeof iat !== 'number' || Math.abs(Date.now() - iat) > MAX_TOKEN_AGE_MS) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[SYNC] Failed to verify auth sync token:', error);
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('[SYNC] Syncing user profile from authentication');

    const authSyncSecret = process.env.AUTH_SYNC_SECRET;
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!authSyncSecret && !isDevelopment) {
      console.error('[SYNC] AUTH_SYNC_SECRET is not configured');
      return NextResponse.json(
        { error: 'Auth sync misconfigured' },
        { status: 500 }
      );
    }

    const authSyncToken = request.headers.get('x-auth-sync-token');
    if (!authSyncToken) {
      console.error('[SYNC] Missing auth sync token');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const verifiedPayload = authSyncSecret
        ? verifyAuthSyncToken(authSyncToken, authSyncSecret)
        : null;
      if (!verifiedPayload) {
        console.error('[SYNC] Invalid or expired auth sync token');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const mappedUser = verifiedPayload.user;
      console.log('[SYNC] Syncing user profile for:', mappedUser.email);

      // Try to sync user profile to database
      // This is a best-effort operation - we don't want to block auth if it fails
      try {
        const supabaseModule = await import('@/lib/auth-supabase');
        const syncResult = await supabaseModule.syncUserProfileViaSupabase({
          id: mappedUser.id,
          auth0_id: mappedUser.auth0_id,
          email: mappedUser.email,
          full_name: mappedUser.full_name,
          given_name: mappedUser.given_name,
          family_name: mappedUser.family_name,
          picture: mappedUser.picture,
          department: mappedUser.department,
          title: mappedUser.title,
        });

        if (syncResult) {
          console.log('[SYNC] Successfully synced profile for:', mappedUser.email);
          return NextResponse.json({
            success: true,
            profile: syncResult,
          });
        } else {
          console.warn('[SYNC] Profile sync returned no data, but continuing');
          return NextResponse.json({
            success: true,
            message: 'User authenticated (sync pending)',
          });
        }
      } catch (syncError) {
        console.error('[SYNC] Error during profile sync:', syncError);
        // Don't fail - authentication was successful, just sync failed
        return NextResponse.json({
          success: true,
          message: 'User authenticated (sync failed but continuing)',
        });
      }
    } catch (parseError) {
      console.error('[SYNC] Failed to parse user data:', parseError);
      return NextResponse.json(
        { error: 'Invalid user data format' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[SYNC] Error in /api/auth/sync:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
