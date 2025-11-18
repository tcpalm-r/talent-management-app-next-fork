/**
 * POST /api/surveys/[id]/finalize
 *
 * Finalize a survey:
 * - Set status to 'finalized'
 * - Clear flagged_for_admin flag
 *
 * Replaces finalizeSurvey() in Feedback360Dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Check if survey exists
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

    // Check permission - admins, SLT, and survey creators can finalize their own surveys
    const canFinalize =
      user.app_role === 'admin' ||
      user.app_role === 'slt' || // SLT can finalize any survey (same elevated access as admin)
      survey.created_by === profile.id; // Creators (leaders/SLT) can finalize their own surveys

    if (!canFinalize) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to finalize this survey' },
        { status: 403 }
      );
    }

    // Check if survey is already finalized
    if (survey.status === 'finalized') {
      return NextResponse.json(
        { error: 'Survey is already finalized' },
        { status: 400 }
      );
    }

    // Update survey to finalized
    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        status: 'finalized',
        flagged_for_admin: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error finalizing survey:', updateError);
      return NextResponse.json(
        { error: 'Failed to finalize survey', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      survey: updatedSurvey,
      message: 'Survey finalized successfully',
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/finalize:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
