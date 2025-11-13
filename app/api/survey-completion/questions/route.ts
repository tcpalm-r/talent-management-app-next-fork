import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json(
        { success: false, error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // Load survey questions
    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .select('question:feedback_360_questions(id, question_text, category)')
      .eq('survey_id', surveyId)
      .order('question_order');

    if (questionsError) {
      console.error('Error loading questions:', questionsError);
      return NextResponse.json(
        { success: false, error: 'Failed to load questions' },
        { status: 500 }
      );
    }

    const questions = surveyQuestions
      .map((sq: any) => sq.question)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      questions
    });
  } catch (error) {
    console.error('Error in survey-completion/questions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
