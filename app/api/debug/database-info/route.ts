import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check database connection and configuration
 * Shows what Supabase project is connected and sample data
 */
export async function GET() {
  try {
    // Get environment info
    const envInfo = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 40) + '...'
        : 'NOT SET',
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    };

    // Query database for surveys
    const { data: surveys, error: surveysError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, survey_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (surveysError) {
      return NextResponse.json({
        environment: envInfo,
        database: {
          connected: false,
          error: surveysError.message,
        },
      });
    }

    // Query for user profiles count
    const { count: userCount, error: countError } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      environment: envInfo,
      database: {
        connected: true,
        surveyCount: surveys?.length || 0,
        surveys: surveys?.map(s => ({
          name: s.survey_name,
          status: s.status,
          created: s.created_at,
        })),
        userProfileCount: userCount || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to connect to database',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

