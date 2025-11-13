import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DEFAULT_QUESTIONS = [
  'impact-biggest-impact',
  'growth-stop',
  'growth-start',
];

const SETTING_KEY = '360_default_questions';

// Get Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// GET: Retrieve the current default question IDs
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Query the organization_settings table
    const { data, error } = await supabase
      .from('organization_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .single();

    if (error) {
      // If setting doesn't exist, return defaults
      if (error.code === 'PGRST116') {
        console.log('[360 Default Questions] No settings found in database, returning defaults');
        return NextResponse.json({
          defaultQuestionIds: DEFAULT_QUESTIONS,
          customQuestions: {}
        });
      }

      console.error('[360 Default Questions] Database error:', error);
      throw error;
    }

    // Return the stored configuration
    const settingValue = data.setting_value as {
      defaultQuestionIds: string[];
      customQuestions: Record<string, string>;
    };

    return NextResponse.json({
      defaultQuestionIds: settingValue.defaultQuestionIds || DEFAULT_QUESTIONS,
      customQuestions: settingValue.customQuestions || {}
    });

  } catch (error) {
    console.error('Error in GET /api/360-default-questions:', error);

    // Return defaults on error to prevent UI breakage
    return NextResponse.json({
      defaultQuestionIds: DEFAULT_QUESTIONS,
      customQuestions: {}
    });
  }
}

// POST: Update the default question IDs
export async function POST(request: NextRequest) {
  try {
    const { defaultQuestionIds, customQuestions } = await request.json();

    // Validate input
    if (!Array.isArray(defaultQuestionIds) || defaultQuestionIds.length !== 3) {
      return NextResponse.json(
        { error: 'Must provide exactly 3 question IDs' },
        { status: 400 }
      );
    }

    // Get authenticated user from headers (set by middleware)
    const userEmail = request.headers.get('x-user-email') || 'unknown';

    const supabase = getSupabaseClient();

    // Prepare the setting value
    const settingValue = {
      defaultQuestionIds,
      customQuestions: customQuestions || {}
    };

    // Upsert the setting (insert or update)
    const { error } = await supabase
      .from('organization_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: settingValue,
        updated_by: userEmail,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (error) {
      console.error('[360 Default Questions] Database error:', error);
      throw error;
    }

    console.log(`[360 Default Questions] Settings updated by ${userEmail}`);

    return NextResponse.json({
      success: true,
      defaultQuestionIds,
      customQuestions: customQuestions || {}
    });

  } catch (error) {
    console.error('Error in POST /api/360-default-questions:', error);
    return NextResponse.json(
      { error: 'Failed to update settings. Please try again.' },
      { status: 500 }
    );
  }
}
