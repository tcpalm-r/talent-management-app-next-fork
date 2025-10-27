/**
 * POST /api/auth/sync
 *
 * Syncs the authenticated user with Supabase.
 * Useful after user profile updates in AI Intranet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { syncUserProfile } from '@/lib/auth-supabase';

export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Re-sync user profile
    const updatedProfile = await syncUserProfile(authData.user);

    if (!updatedProfile) {
      return NextResponse.json(
        { error: 'Failed to sync user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('Error in /api/auth/sync:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
