/**
 * Debug Logs API - Temporary endpoint for debugging serverless function logs
 *
 * GET /api/debug-logs?survey_id=xxx - Get logs for a specific survey
 * GET /api/debug-logs?session_id=xxx - Get logs for a specific session
 * GET /api/debug-logs?hours=1 - Get logs from the last N hours
 *
 * This endpoint is for debugging only and should be removed after use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Require admin authentication
  const authData = await getAuthenticatedUser(req);
  if (!authData || authData.profile.app_role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const surveyId = searchParams.get('survey_id');
  const sessionId = searchParams.get('session_id');
  const hours = parseInt(searchParams.get('hours') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    let query = supabaseAdmin
      .from('debug_logs')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (surveyId) {
      query = query.eq('survey_id', surveyId);
    } else {
      // Default: last N hours
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format logs for easy reading
    const formattedLogs = (data || []).map((log: any) => ({
      time: new Date(log.created_at).toLocaleTimeString(),
      elapsed: `${log.elapsed_ms}ms`,
      stage: log.stage,
      message: log.message,
      level: log.level,
      metadata: log.metadata,
      session_id: log.session_id,
      survey_id: log.survey_id,
    }));

    // Group by session for summary
    const sessions = new Map<string, any[]>();
    formattedLogs.forEach((log: any) => {
      const existing = sessions.get(log.session_id) || [];
      existing.push(log);
      sessions.set(log.session_id, existing);
    });

    const sessionSummaries = Array.from(sessions.entries()).map(([sessionId, logs]) => {
      const first = logs[0];
      const last = logs[logs.length - 1];
      return {
        session_id: sessionId,
        survey_id: first.survey_id,
        started: first.time,
        total_elapsed: last.elapsed,
        log_count: logs.length,
        stages: logs.map((l: any) => l.stage),
        logs,
      };
    });

    return NextResponse.json({
      success: true,
      session_count: sessionSummaries.length,
      total_logs: formattedLogs.length,
      sessions: sessionSummaries,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/debug-logs - Clear old logs
export async function DELETE(req: NextRequest) {
  const authData = await getAuthenticatedUser(req);
  if (!authData || authData.profile.app_role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const olderThanDays = parseInt(searchParams.get('older_than_days') || '7', 10);

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabaseAdmin
    .from('debug_logs')
    .delete()
    .lt('created_at', cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted_count: count,
    cutoff_date: cutoff,
  });
}
