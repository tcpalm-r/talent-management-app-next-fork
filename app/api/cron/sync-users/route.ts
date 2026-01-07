/**
 * Cron Job: Sync Users from Project A
 *
 * Runs daily at 6 AM UTC to sync all user profiles from Project A.
 * This ensures user data (names, departments, managers, etc.) stays up to date
 * even for users who haven't logged in recently.
 *
 * Schedule: 0 6 * * * (daily at 6:00 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAllUsersFromProjectA,
  isProjectASyncConfigured,
} from '@/lib/sync-users';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request from Vercel
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret if configured
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] Unauthorized cron request');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON] Starting scheduled user sync from Project A');

    // Check if sync is configured
    if (!isProjectASyncConfigured()) {
      console.warn('[CRON] Project A sync not configured, skipping');
      return NextResponse.json({
        success: false,
        message: 'Project A sync not configured',
        skipped: true,
      });
    }

    // Run the sync
    const startTime = Date.now();
    const result = await syncAllUsersFromProjectA();
    const duration = Date.now() - startTime;

    if (!result.success) {
      console.error('[CRON] User sync failed:', result.message);
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errors: result.errors,
          duration: `${duration}ms`,
        },
        { status: 500 }
      );
    }

    console.log(`[CRON] User sync completed: ${result.count} users in ${duration}ms`);
    return NextResponse.json({
      success: true,
      message: result.message,
      syncedCount: result.count,
      duration: `${duration}ms`,
      warnings: result.errors,
    });
  } catch (error) {
    console.error('[CRON] Error in sync-users cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
