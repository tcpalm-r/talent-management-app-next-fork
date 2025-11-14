import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find reviewer by access token
    const { data: reviewerData, error: reviewerError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('access_token', token)
      .single();

    if (reviewerError || !reviewerData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired survey link' },
        { status: 404 }
      );
    }

    // Ensure reviewer_name has a value
    const safeReviewerData = {
      ...reviewerData,
      reviewer_name: reviewerData.reviewer_name || 'Reviewer'
    };

    // Update status to in_progress if pending
    if (reviewerData.status === 'pending') {
      const { error: updateError } = await supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', reviewerData.id);

      if (updateError) {
        console.error('Error updating reviewer status:', updateError);
        // Don't fail the request if status update fails
      }
    }

    return NextResponse.json({
      success: true,
      reviewer: safeReviewerData,
      surveyId: reviewerData.survey_id
    });
  } catch (error) {
    console.error('Error in survey-completion/start:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
