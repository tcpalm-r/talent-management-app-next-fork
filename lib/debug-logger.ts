/**
 * Debug Logger - Writes logs to Supabase for serverless function debugging
 *
 * This is a temporary debugging tool. Can be safely removed after debugging.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

export interface DebugLogEntry {
  level?: 'info' | 'warn' | 'error';
  stage: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a debug logger session for tracking a single request
 */
export function createDebugSession(surveyId?: string) {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  const log = async (entry: DebugLogEntry): Promise<void> => {
    const elapsedMs = Date.now() - startTime;

    try {
      await supabaseAdmin.from('debug_logs').insert({
        session_id: sessionId,
        survey_id: surveyId,
        level: entry.level || 'info',
        stage: entry.stage,
        message: entry.message,
        metadata: entry.metadata || {},
        elapsed_ms: elapsedMs,
      });
    } catch (err) {
      // Don't let logging errors break the main flow
      console.error('[DebugLogger] Failed to write log:', err);
    }
  };

  return {
    sessionId,
    log,
    info: (stage: string, message: string, metadata?: Record<string, unknown>) =>
      log({ level: 'info', stage, message, metadata }),
    warn: (stage: string, message: string, metadata?: Record<string, unknown>) =>
      log({ level: 'warn', stage, message, metadata }),
    error: (stage: string, message: string, metadata?: Record<string, unknown>) =>
      log({ level: 'error', stage, message, metadata }),
  };
}

/**
 * Query debug logs for a session or survey
 */
export async function getDebugLogs(options: {
  sessionId?: string;
  surveyId?: string;
  limit?: number;
}) {
  let query = supabaseAdmin
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: true });

  if (options.sessionId) {
    query = query.eq('session_id', options.sessionId);
  }
  if (options.surveyId) {
    query = query.eq('survey_id', options.surveyId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DebugLogger] Failed to query logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Get recent debug sessions (last N hours)
 */
export async function getRecentSessions(hours: number = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('debug_logs')
    .select('session_id, survey_id, min(created_at) as started_at, max(elapsed_ms) as total_ms, count(*) as log_count')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DebugLogger] Failed to query sessions:', error);
    return [];
  }

  return data || [];
}
