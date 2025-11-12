import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
    const { error: updateError } = await supabase
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
