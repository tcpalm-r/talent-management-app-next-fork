import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      surveyId,
      navigationRating,
      aiHelperRating,
      additionalComments,
    } = body;

    // Validate required fields
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // Validate navigation rating (1-5)
    if (
      navigationRating === undefined ||
      navigationRating === null ||
      navigationRating < 1 ||
      navigationRating > 5
    ) {
      return NextResponse.json(
        { error: 'Navigation rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate AI helper rating (0-5, where 0 = didn't use)
    if (
      aiHelperRating === undefined ||
      aiHelperRating === null ||
      aiHelperRating < 0 ||
      aiHelperRating > 5
    ) {
      return NextResponse.json(
        { error: 'AI helper rating must be between 0 and 5' },
        { status: 400 }
      );
    }

    // Verify survey exists
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Insert meta feedback (anonymous - no reviewer info)
    const { data: feedback, error: insertError } = await supabaseAdmin
      .from('survey_meta_feedback')
      .insert({
        survey_id: surveyId,
        navigation_rating: navigationRating,
        ai_helper_rating: aiHelperRating,
        additional_comments: additionalComments || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[API /survey-completion/meta-feedback] Insert error:', insertError);

      // Handle unique constraint violation (feedback already submitted for this survey)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Feedback already submitted for this survey' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: insertError.message, details: insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error: any) {
    console.error('[API /survey-completion/meta-feedback] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
