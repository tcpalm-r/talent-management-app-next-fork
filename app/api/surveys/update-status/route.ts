import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {

    const body = await request.json();
    const { surveyId, status } = body;

    // Validate required fields
    if (!surveyId || !status) {
      return NextResponse.json(
        { error: 'Survey ID and status are required' },
        { status: 400 }
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
