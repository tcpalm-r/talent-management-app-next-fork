import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    const token = searchParams.get('token');

    if (!surveyId) {
      return NextResponse.json(
        { success: false, error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // Load survey questions
    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .select('question:feedback_360_questions(id, question_text, category, min_words)')
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

    // If token provided, also fetch any saved draft responses
    let draftResponses: Record<string, string> = {};

    if (token) {
      // Get reviewer email from token
      const { data: reviewerData } = await supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .select('reviewer_email')
        .eq('access_token', token)
        .single();

      if (reviewerData) {
        // Fetch any existing responses (draft or otherwise)
        const { data: existingResponses } = await supabaseAdmin
          .from('feedback_360_responses')
          .select('question_id, response_text, is_draft')
          .eq('survey_id', surveyId)
          .eq('reviewer_email', reviewerData.reviewer_email);

        if (existingResponses) {
          // Convert to { questionId: responseText } format
          existingResponses.forEach((r) => {
            if (r.response_text) {
              draftResponses[r.question_id] = r.response_text;
            }
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      questions,
      draftResponses, // Include saved drafts from server
    });
  } catch (error) {
    console.error('Error in survey-completion/questions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
