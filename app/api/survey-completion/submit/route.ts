import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { token, responses } = await request.json();

    if (!token || !responses) {
      return NextResponse.json(
        { success: false, error: 'Token and responses are required' },
        { status: 400 }
      );
    }

    // Validate token and get reviewer info
    const { data: reviewerData, error: reviewerError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('id, survey_id, reviewer_email, status')
      .eq('access_token', token)
      .single();

    if (reviewerError || !reviewerData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired survey link' },
        { status: 404 }
      );
    }

    // Check if already completed
    if (reviewerData.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Survey already completed' },
        { status: 400 }
      );
    }

    // Upsert all responses (insert or update if already exists)
    // Uses the unique constraint on (survey_id, question_id, reviewer_email)
    // Set is_draft = false to mark as final submission
    const responsesToUpsert = responses.map((response: { questionId: string; responseText: string }) => ({
      survey_id: reviewerData.survey_id,
      question_id: response.questionId,
      reviewer_email: reviewerData.reviewer_email,
      response_text: response.responseText,
      is_draft: false, // Mark as submitted, not draft
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('feedback_360_responses')
      .upsert(responsesToUpsert, {
        onConflict: 'survey_id,question_id,reviewer_email',
        ignoreDuplicates: false, // Update existing rows instead of ignoring
      });

    if (upsertError) {
      console.error('Error upserting responses:', JSON.stringify(upsertError, null, 2));
      console.error('Attempted to upsert:', JSON.stringify(responsesToUpsert, null, 2));
      return NextResponse.json(
        { success: false, error: 'Failed to save responses', details: upsertError.message, code: upsertError.code },
        { status: 500 }
      );
    }

    // Mark reviewer as completed
    const { error: updateError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', reviewerData.id);

    if (updateError) {
      console.error('Error updating reviewer status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update reviewer status' },
        { status: 500 }
      );
    }

    // Check if all reviewers have completed and update survey status
    const { data: allReviewers } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('status')
      .eq('survey_id', reviewerData.survey_id);

    if (allReviewers) {
      const completedCount = allReviewers.filter(r => r.status === 'completed').length;

      // Update to 'in_progress' if at least one reviewer completed
      // Note: Status stays 'in_progress' until creator manually completes with AI analysis
      if (completedCount > 0) {
        await supabaseAdmin
          .from('feedback_360_surveys')
          .update({ status: 'in_progress' })
          .eq('id', reviewerData.survey_id);
      }
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error in survey-completion/submit:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
