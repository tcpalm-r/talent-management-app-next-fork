/**
 * GET /api/surveys/[id]/details
 *
 * Fetch detailed information for a single 360 survey including:
 * - Survey data
 * - Employee/subject details
 * - Reviewers with status
 * - Survey questions
 * - All responses
 *
 * Replaces loadRawSurveyData() in Feedback360Dashboard.
 *
 * Authorization:
 * - Admins: Full access
 * - Leaders: Access to own surveys, direct reports, surveys where they're involved
 * - Users: Limited access (only finalized surveys where they're the subject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const surveyId = params.id;

    // Fetch survey with reviewers
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select(`
        *,
        reviewers:feedback_360_survey_reviewers(
          id,
          status,
          reviewer_name,
          reviewer_email,
          relationship,
          access_token,
          created_at
        )
      `)
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found', details: surveyError?.message },
        { status: 404 }
      );
    }

    // Authorization check
    const isAuthorized = await checkSurveyAccess(survey, user.app_role, profile);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this survey' },
        { status: 403 }
      );
    }

    // Fetch employee details
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, email, title')
      .eq('id', survey.employee_id)
      .single();

    if (employeeError) {
      console.error('Error loading employee:', employeeError);
    }

    // Fetch survey questions with question details
    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .select(`
        id,
        question_id,
        question_order,
        question:feedback_360_questions(
          id,
          question_text,
          category
        )
      `)
      .eq('survey_id', surveyId)
      .order('question_order');

    if (questionsError) {
      console.error('Error loading questions:', questionsError);
    }

    // Fetch all responses
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('feedback_360_responses')
      .select('id, reviewer_email, question_id, response_text, rating, created_at')
      .eq('survey_id', surveyId);

    if (responsesError) {
      console.error('Error loading responses:', responsesError);
    }

    return NextResponse.json({
      survey,
      employee,
      questions: surveyQuestions || [],
      responses: responses || [],
    });

  } catch (error) {
    console.error('Error in /api/surveys/[id]/details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has access to view this survey
 */
async function checkSurveyAccess(
  survey: any,
  role: string,
  profile: any
): Promise<boolean> {
  // Admins have full access
  if (role === 'admin') return true;

  // Check if user created the survey
  if (survey.created_by === profile.id) return true;

  // Check if user is the subject
  if (survey.employee_id === profile.id) {
    // Regular users can only see finalized surveys where they're the subject
    if (role === 'user' && survey.status !== 'finalized') {
      return false;
    }
    return true;
  }

  // Check if user is a reviewer
  const isReviewer = survey.reviewers?.some(
    (r: any) => r.reviewer_email === profile.email
  );
  if (isReviewer) return true;

  // For leaders, check if subject is a direct report
  if (role === 'leader') {
    const { data: directReports } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('manager_id', profile.id);

    const directReportIds = directReports?.map(dr => dr.id) || [];
    if (directReportIds.includes(survey.employee_id)) {
      return true;
    }
  }

  return false;
}
