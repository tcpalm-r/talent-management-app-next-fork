/**
 * POST /api/auth/sync
 *
 * Syncs the authenticated user with Supabase.
 * Called by middleware after successful Sonance hub authentication.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[SYNC] Syncing user profile from authentication');

    // Get user data from request body (sent by middleware)
    const body = await request.json();
    const userData = body.userData;

    if (!userData) {
      console.error('[SYNC] No userData provided');
      return NextResponse.json(
        { error: 'No user data' },
        { status: 400 }
      );
    }

    // Get the mapped user data from headers (set by middleware before calling this route)
    const userDataHeader = request.headers.get('x-user-data');

    if (!userDataHeader) {
      console.error('[SYNC] No user data in headers');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    try {
      const mappedUser = JSON.parse(userDataHeader);
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
          global_role: mappedUser.global_role,
          capabilities: mappedUser.capabilities,
          app_role: mappedUser.app_role,
          app_permissions: mappedUser.app_permissions,
          app_access: mappedUser.app_access,
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
