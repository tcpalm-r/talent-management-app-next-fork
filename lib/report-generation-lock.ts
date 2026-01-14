import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_CONCURRENCY_LIMIT = 2;
const DEFAULT_LOCK_TTL_MINUTES = 30;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getConcurrencyLimit = () =>
  parsePositiveInt(process.env.AI_REPORT_CONCURRENCY_LIMIT, DEFAULT_CONCURRENCY_LIMIT);

const getLockTtlMs = () =>
  parsePositiveInt(process.env.AI_REPORT_LOCK_TTL_MINUTES, DEFAULT_LOCK_TTL_MINUTES) * 60 * 1000;

export async function cleanupExpiredReportGenerationLocks(): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('feedback_360_generation_locks' as any)
    .delete()
    .lt('expires_at', nowIso);

  if (error) {
    console.error('[report-generation-lock] Failed to clean expired locks:', error);
    throw error;
  }
}

export async function releaseReportGenerationLock(surveyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('feedback_360_generation_locks' as any)
    .delete()
    .eq('survey_id', surveyId);

  if (error) {
    console.error('[report-generation-lock] Failed to release lock:', error);
  }
}

export async function acquireReportGenerationLock(
  surveyId: string,
  lockedBy: string | null
): Promise<
  | { ok: true; activeCount: number; limit: number }
  | { ok: false; reason: 'locked' | 'busy'; activeCount?: number; limit: number }
> {
  await cleanupExpiredReportGenerationLocks();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + getLockTtlMs()).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('feedback_360_generation_locks' as any)
    .insert({
      survey_id: surveyId,
      locked_by: lockedBy,
      locked_at: now.toISOString(),
      expires_at: expiresAt,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, reason: 'locked', limit: getConcurrencyLimit() };
    }
    console.error('[report-generation-lock] Failed to acquire lock:', insertError);
    throw insertError;
  }

  const limit = getConcurrencyLimit();
  const { count, error: countError } = await supabaseAdmin
    .from('feedback_360_generation_locks' as any)
    .select('survey_id', { count: 'exact', head: true })
    .gt('expires_at', now.toISOString());

  if (countError) {
    await releaseReportGenerationLock(surveyId);
    console.error('[report-generation-lock] Failed to count active locks:', countError);
    throw countError;
  }

  if (count && count > limit) {
    await releaseReportGenerationLock(surveyId);
    return { ok: false, reason: 'busy', activeCount: count, limit };
  }

  return { ok: true, activeCount: count || 1, limit };
}
