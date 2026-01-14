import { supabaseAdmin } from '@/lib/supabase-admin';

export type ReportGenerationQueueEntry = {
  survey_id: string;
  queued_at: string;
  requested_by: string | null;
  requested_by_email: string | null;
  tone: string | null;
};

type EnqueueParams = {
  surveyId: string;
  requestedBy: string | null;
  requestedByEmail: string | null;
  tone: string;
};

export async function enqueueReportGeneration({
  surveyId,
  requestedBy,
  requestedByEmail,
  tone,
}: EnqueueParams): Promise<void> {
  const queuedAt = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('feedback_360_generation_queue' as any)
    .insert({
      survey_id: surveyId,
      queued_at: queuedAt,
      requested_by: requestedBy,
      requested_by_email: requestedByEmail,
      tone,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      const { error: updateError } = await supabaseAdmin
        .from('feedback_360_generation_queue' as any)
        .update({
          requested_by: requestedBy,
          requested_by_email: requestedByEmail,
          tone,
        })
        .eq('survey_id', surveyId);

      if (updateError) {
        console.error('[report-generation-queue] Failed to update queue entry:', updateError);
        throw updateError;
      }
    } else {
      console.error('[report-generation-queue] Failed to enqueue report:', insertError);
      throw insertError;
    }
  }

  const { error: statusError } = await supabaseAdmin
    .from('feedback_360_surveys')
    .update({ status: 'queued', updated_at: queuedAt })
    .eq('id', surveyId)
    .neq('status', 'generating');

  if (statusError) {
    console.error('[report-generation-queue] Failed to mark survey queued:', statusError);
  }
}

export async function getNextQueuedReport(): Promise<ReportGenerationQueueEntry | null> {
  const { data, error } = await supabaseAdmin
    .from('feedback_360_generation_queue' as any)
    .select('*')
    .order('queued_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[report-generation-queue] Failed to fetch queued report:', error);
    throw error;
  }

  return data && data.length > 0 ? (data[0] as ReportGenerationQueueEntry) : null;
}

export async function removeQueuedReport(surveyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('feedback_360_generation_queue' as any)
    .delete()
    .eq('survey_id', surveyId);

  if (error) {
    console.error('[report-generation-queue] Failed to remove queue entry:', error);
  }
}
