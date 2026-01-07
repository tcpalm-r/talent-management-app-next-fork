/**
 * API Route: Sync Users from Project A
 *
 * POST /api/sync-users - Sync all users from Project A
 * POST /api/sync-users?email=<email> - Sync a single user by email
 *
 * This endpoint is protected and requires admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncUserFromProjectA,
  syncAllUsersFromProjectA,
  isProjectASyncConfigured,
  getProjectAUrl,
} from '@/lib/sync-users';
import { getAuthenticatedUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Check admin role
    if (user.app_role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Check if Project A sync is configured
    if (!isProjectASyncConfigured()) {
      return NextResponse.json(
        {
          error: 'Project A sync not configured',
          message: 'Set NEXT_PUBLIC_PROJECT_A_URL and NEXT_PUBLIC_PROJECT_A_ANON_KEY environment variables',
        },
        { status: 503 }
      );
    }

    // Check for single user sync
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (email) {
      // Sync single user
      console.log(`[API] Syncing single user: ${email}`);
      const result = await syncUserFromProjectA(email);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message, details: result.errors },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        syncedCount: 1,
      });
    }

    // Sync all users
    console.log('[API] Starting full user sync from Project A');
    const result = await syncAllUsersFromProjectA();

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          details: result.errors,
          partialCount: result.count,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      syncedCount: result.count,
      warnings: result.errors,
    });
  } catch (error) {
    console.error('[API] Error in sync-users:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync-users - Get sync status and configuration
 */
export async function GET() {
  try {
    const configured = isProjectASyncConfigured();
    const projectAUrl = getProjectAUrl();

    return NextResponse.json({
      configured,
      projectAUrl: projectAUrl ? `${projectAUrl.substring(0, 30)}...` : null,
      message: configured
        ? 'Project A sync is configured and ready'
        : 'Project A sync is not configured. Set environment variables.',
    });
  } catch (error) {
    console.error('[API] Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
