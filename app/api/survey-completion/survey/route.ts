import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token and get survey_id
    const { data: reviewerData, error: reviewerError } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('survey_id')
      .eq('access_token', token)
      .single();

    if (reviewerError || !reviewerData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired survey link' },
        { status: 404 }
      );
    }

    // Load survey details with employee name
    const { data: surveyData, error: surveyError } = await supabase
      .from('feedback_360_surveys')
      .select('id, survey_name, due_date, status, sent_at, employee:user_profiles!feedback_360_surveys_employee_id_fkey(full_name)')
      .eq('id', reviewerData.survey_id)
      .single();

    if (surveyError || !surveyData) {
      return NextResponse.json(
        { success: false, error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Check if survey was cancelled (sent but then moved back to draft)
    if (surveyData.status === 'draft' && surveyData.sent_at) {
      return NextResponse.json(
        { success: false, error: 'The creator of this survey has decided to scrap this review draft.' },
        { status: 410 }
      );
    }

    // Check if survey is not active
    if (surveyData.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'This survey is no longer active.' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      survey: {
        id: surveyData.id,
        survey_name: surveyData.survey_name || 'Untitled Survey',
        employee_name: surveyData.employee?.full_name || 'Unknown Employee',
        due_date: surveyData.due_date || '',
      }
    });
  } catch (error) {
    console.error('Error in survey-completion/survey:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
