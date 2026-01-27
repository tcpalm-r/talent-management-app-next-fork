/**
 * POST /api/surveys/[id]/release-to-subject
 *
 * Release a finalized survey to the subject:
 * - Sets released_to_subject_at timestamp
 * - Only sponsors or admins can release
 * - Survey must be in 'finalized' status
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

    // Check permission - admins and survey creators (sponsors) can release
    const canRelease =
      user.app_role === 'admin' ||
      user.app_role === 'slt' ||
      survey.created_by === profile.id ||
      survey.created_by_email?.toLowerCase() === profile.email?.toLowerCase();

    if (!canRelease) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to release this survey' },
        { status: 403 }
      );
    }

    // Check if survey is finalized
    if (survey.status !== 'finalized') {
      return NextResponse.json(
        { error: 'Survey must be finalized before releasing to subject' },
        { status: 400 }
      );
    }

    // Check if already released
    if (survey.released_to_subject_at) {
      return NextResponse.json(
        { error: 'Survey has already been released to subject' },
        { status: 400 }
      );
    }

    // Update survey to released
    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        released_to_subject_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error releasing survey to subject:', updateError);
      return NextResponse.json(
        { error: 'Failed to release survey', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      survey: updatedSurvey,
      message: 'Survey released to subject successfully',
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/release-to-subject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
