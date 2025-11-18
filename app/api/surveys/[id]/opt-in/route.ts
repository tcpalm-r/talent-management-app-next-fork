/**
 * POST /api/surveys/[id]/opt-in
 *
 * Allows SLT members to opt into a 360 survey as a reviewer.
 * No email notification is sent - this is UI-only opt-in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

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

    // Verify user is SLT
    if (user.app_role !== 'slt') {
      return NextResponse.json(
        { error: 'Only SLT members can opt into surveys' },
        { status: 403 }
      );
    }

    // Fetch survey to verify it exists and is in_progress
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, status, employee_id')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Verify survey is in_progress
    if (survey.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Can only opt into in_progress surveys' },
        { status: 400 }
      );
    }

    // Check if user is already a reviewer
    const { data: existingReviewer } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('id')
      .eq('survey_id', surveyId)
      .eq('reviewer_email', profile.email)
      .single();

    if (existingReviewer) {
      return NextResponse.json(
        { error: 'You are already a reviewer for this survey' },
        { status: 400 }
      );
    }

    // Generate access token for survey completion
    const accessToken = uuidv4();

    // Add user as reviewer with 'slt' relationship type
    const { error: insertError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .insert({
        survey_id: surveyId,
        reviewer_email: profile.email,
        reviewer_name: profile.full_name,
        relationship: 'slt',
        status: 'pending',
        access_token: accessToken,
        invited_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error adding SLT reviewer:', insertError);
      return NextResponse.json(
        { error: 'Failed to add you as a reviewer', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully opted into survey',
      access_token: accessToken,
    });

  } catch (error) {
    console.error('Error in /api/surveys/[id]/opt-in:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
