import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // Handle both JSON and sendBeacon (which sends text/plain)
    const contentType = request.headers.get('content-type') || '';
    let body: { token: string; responses: Record<string, string> };

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // sendBeacon sends as text/plain
      const text = await request.text();
      body = JSON.parse(text);
    }

    const { token, responses } = body;

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

    // Don't save drafts for already completed surveys
    if (reviewerData.status === 'completed') {
      return NextResponse.json(
        { success: true, message: 'Survey already completed, draft not saved' },
        { status: 200 }
      );
    }

    // Convert responses object to array format for upsert
    // responses is { questionId: responseText }
    const responsesToUpsert = Object.entries(responses)
      .filter(([_, text]) => text && text.trim().length > 0) // Only save non-empty responses
      .map(([questionId, responseText]) => ({
        survey_id: reviewerData.survey_id,
        question_id: questionId,
        reviewer_email: reviewerData.reviewer_email,
        response_text: responseText,
        is_draft: true,
      }));

    if (responsesToUpsert.length === 0) {
      return NextResponse.json({
        success: true,
        savedAt: new Date().toISOString(),
        message: 'No responses to save',
      });
    }

    // Upsert draft responses
    const { error: upsertError } = await supabaseAdmin
      .from('feedback_360_responses')
      .upsert(responsesToUpsert, {
        onConflict: 'survey_id,question_id,reviewer_email',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error saving draft:', JSON.stringify(upsertError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Failed to save draft', details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in survey-completion/save-draft:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
