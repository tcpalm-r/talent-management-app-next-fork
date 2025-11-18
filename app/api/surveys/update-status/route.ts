import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { surveyId, status } = body;

    // Validate required fields
    if (!surveyId || !status) {
      return NextResponse.json(
        { error: 'Survey ID and status are required' },
        { status: 400 }
      );
    }

    // CRITICAL FIX: Fetch the survey and verify authorization
    const { data: survey, error: fetchError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, created_by, employee_id, status')
      .eq('id', surveyId)
      .single();

    if (fetchError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // CRITICAL FIX: Authorization check - only admin and survey creator can update status
    const isAdmin = user.app_role === 'admin';
    const isCreator = survey.created_by === profile.id || survey.created_by === profile.email;

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Forbidden: Only survey creators and admins can update survey status' },
        { status: 403 }
      );
    }

    // Update survey status
    const { error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({ status })
      .eq('id', surveyId);

    if (updateError) {
      console.error('[API /surveys/update-status] Error updating survey status:', updateError);
      return NextResponse.json(
        { error: updateError.message, details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('[API /surveys/update-status] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
