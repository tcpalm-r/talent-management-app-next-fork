/**
 * POST /api/surveys/[id]/opt-in
 *
 * Allows SLT and Admin members to opt into a 360 survey as a reviewer.
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
    console.log('[SLT/Admin Opt-In] ===== Starting opt-in request =====');

    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      console.log('[SLT/Admin Opt-In] ❌ No auth data');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const surveyId = params.id;

    console.log('[SLT/Admin Opt-In] User:', {
      email: user.email,
      role: user.app_role,
      surveyId
    });

    // Verify user is SLT or Admin
    if (user.app_role !== 'slt' && user.app_role !== 'admin') {
      console.log('[SLT/Admin Opt-In] ❌ User is not SLT or Admin, role:', user.app_role);
      return NextResponse.json(
        { error: 'Only SLT and Admin members can opt into surveys' },
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
      console.log('[SLT/Admin Opt-In] ❌ Survey not found:', surveyError);
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    console.log('[SLT/Admin Opt-In] Survey found:', { status: survey.status });

    // Verify survey is in_progress
    if (survey.status !== 'in_progress') {
      console.log('[SLT/Admin Opt-In] ❌ Survey not in_progress, status:', survey.status);
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
      console.log('[SLT/Admin Opt-In] ❌ User already a reviewer');
      return NextResponse.json(
        { error: 'You are already a reviewer for this survey' },
        { status: 400 }
      );
    }

    // Generate access token for survey completion
    const accessToken = uuidv4();

    const reviewerData = {
      survey_id: surveyId,
      reviewer_email: profile.email,
      reviewer_name: profile.full_name,
      relationship: user.app_role, // 'slt' or 'admin'
      status: 'pending',
      access_token: accessToken,
      invited_at: new Date().toISOString(),
      assigned_by_sponsor: false, // SLT/Admin opted in themselves
    };

    console.log('[SLT/Admin Opt-In] Inserting reviewer:', reviewerData);

    // Add user as reviewer with their role as relationship type
    const { error: insertError, data: insertedData } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .insert(reviewerData)
      .select();

    if (insertError) {
      console.error('[SLT/Admin Opt-In] ❌ Insert error:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      return NextResponse.json(
        { error: 'Failed to add you as a reviewer', details: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }

    console.log('[SLT/Admin Opt-In] ✅ Successfully inserted reviewer:', insertedData);

    console.log('[SLT/Admin Opt-In] ✅ Opt-in successful');

    return NextResponse.json({
      success: true,
      message: 'Successfully opted into survey',
      access_token: accessToken,
    });

  } catch (error) {
    console.error('[SLT/Admin Opt-In] ❌❌❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
