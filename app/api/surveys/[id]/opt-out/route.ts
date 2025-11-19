/**
 * POST /api/surveys/[id]/opt-out
 *
 * Allows SLT members to opt out of a 360 survey they previously opted into.
 * Only works if they opted in themselves (relationship='slt').
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
    console.log('[SLT Opt-Out] ===== Starting opt-out request =====');

    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      console.log('[SLT Opt-Out] ❌ No auth data');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const surveyId = params.id;

    console.log('[SLT Opt-Out] User:', {
      email: user.email,
      role: user.app_role,
      surveyId
    });

    // Verify user is SLT
    if (user.app_role !== 'slt') {
      console.log('[SLT Opt-Out] ❌ User is not SLT, role:', user.app_role);
      return NextResponse.json(
        { error: 'Only SLT members can opt out of surveys' },
        { status: 403 }
      );
    }

    // Find the reviewer record
    const { data: reviewer, error: reviewerError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('id, relationship, status, assigned_by_sponsor')
      .eq('survey_id', surveyId)
      .eq('reviewer_email', profile.email)
      .single();

    if (reviewerError || !reviewer) {
      console.log('[SLT Opt-Out] ❌ Reviewer not found:', reviewerError);
      return NextResponse.json(
        { error: 'You are not a reviewer for this survey' },
        { status: 404 }
      );
    }

    console.log('[SLT Opt-Out] Reviewer found:', reviewer);

    // Verify this reviewer was NOT assigned by sponsor (they opted in themselves)
    if (reviewer.assigned_by_sponsor === true) {
      console.log('[SLT Opt-Out] ❌ Reviewer was assigned by sponsor, cannot opt out');
      return NextResponse.json(
        { error: 'You cannot opt out of surveys you were assigned to by the sponsor' },
        { status: 400 }
      );
    }

    // Verify survey has not been completed by this reviewer
    if (reviewer.status === 'completed') {
      console.log('[SLT Opt-Out] ❌ Survey already completed');
      return NextResponse.json(
        { error: 'Cannot opt out of a survey you have already completed' },
        { status: 400 }
      );
    }

    // Delete the reviewer record
    const { error: deleteError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .delete()
      .eq('id', reviewer.id);

    if (deleteError) {
      console.error('[SLT Opt-Out] ❌ Delete error:', {
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code,
      });
      return NextResponse.json(
        { error: 'Failed to remove you as a reviewer', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log('[SLT Opt-Out] ✅ Successfully removed reviewer');

    return NextResponse.json({
      success: true,
      message: 'Successfully opted out of survey',
    });

  } catch (error) {
    console.error('[SLT Opt-Out] ❌❌❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
