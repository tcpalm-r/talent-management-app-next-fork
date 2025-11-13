import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // Load survey questions
    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .select('*, feedback_360_questions(question_text, category)')
      .eq('survey_id', surveyId)
      .order('question_order', { ascending: true });

    if (questionsError) {
      console.error('[API /surveys/load-draft] Error loading questions:', questionsError);
      return NextResponse.json(
        { error: questionsError.message, details: questionsError },
        { status: 500 }
      );
    }

    // Load reviewers
    const { data: reviewers, error: reviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('survey_id', surveyId);

    if (reviewersError) {
      console.error('[API /surveys/load-draft] Error loading reviewers:', reviewersError);
      return NextResponse.json(
        { error: reviewersError.message, details: reviewersError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      surveyQuestions: surveyQuestions || [],
      reviewers: reviewers || [],
    });
  } catch (error: any) {
    console.error('[API /surveys/load-draft] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
