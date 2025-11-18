import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL FIX: Add authentication check
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;

    // CRITICAL FIX: Only admin, SLT, and leader can load drafts
    if (user.app_role !== 'admin' && user.app_role !== 'slt' && user.app_role !== 'leader') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins, SLT, and leaders can access draft surveys' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // CRITICAL FIX: Verify survey ownership (fetch survey first)
    // Also fetch all survey fields including draft_partial_reviewers for wizard state restoration
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // CRITICAL FIX: Authorization - only draft creator or admin/SLT can load
    const isCreator = survey.created_by === profile.id || survey.created_by === profile.email;
    const isAdminOrSLT = user.app_role === 'admin' || user.app_role === 'slt';

    if (!isAdminOrSLT && !isCreator) {
      return NextResponse.json(
        { error: 'Forbidden: You can only load your own draft surveys' },
        { status: 403 }
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
      survey: survey, // Include full survey object with draft_partial_reviewers
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
