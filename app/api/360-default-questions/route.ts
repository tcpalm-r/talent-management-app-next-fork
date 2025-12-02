import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DEFAULT_QUESTIONS = [
  { id: 'default-1', text: 'What is the ONE thing [NAME] does that creates the most value for you, your team, or the organization? Be specific with an example.', minWords: 50 },
  { id: 'default-2', text: 'If [NAME] could change or improve ONE thing about how they work over the next 6 months, what would create the biggest positive impact? What would success look like?', minWords: 50 },
  { id: 'default-3', text: 'Complete this sentence: \'I wish [NAME] knew that when they _____, it creates _____ for me/the team.\' OR \'What do you need most from [NAME] that you\'re not currently getting?\'', minWords: 50 },
  { id: 'default-4', text: 'What is one obstacle, bottleneck, or decision that [NAME] could help remove or accelerate to increase team performance?', minWords: 50 },
];

const SETTING_KEY = '360_default_questions';

// GET: Retrieve the current default questions
export async function GET() {
  try {
    // Query the organization_settings table using admin client
    const { data, error } = await supabaseAdmin
      .from('organization_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .single();

    if (error) {
      // If setting doesn't exist, return defaults
      if (error.code === 'PGRST116') {
        console.log('[360 Default Questions] No settings found in database, returning defaults');
        return NextResponse.json({
          questions: DEFAULT_QUESTIONS
        });
      }

      // If table doesn't exist (42P01) or other database errors, return defaults
      // This ensures graceful degradation during initial deployment or migrations
      if (error.code === '42P01' || error.code === 'PGRST301') {
        console.warn('[360 Default Questions] organization_settings table not found, returning defaults. Run migrations to enable database storage.');
        return NextResponse.json({
          questions: DEFAULT_QUESTIONS
        });
      }

      console.error('[360 Default Questions] Database error:', error);
      // Return defaults instead of throwing to prevent build failures
      return NextResponse.json({
        questions: DEFAULT_QUESTIONS
      });
    }

    // Return the stored configuration
    const settingValue = data.setting_value as {
      questions: Array<{ id: string; text: string; minWords?: number }>;
    };

    return NextResponse.json({
      questions: settingValue.questions || DEFAULT_QUESTIONS
    });

  } catch (error) {
    console.error('Error in GET /api/360-default-questions:', error);

    // Return defaults on error to prevent UI breakage
    return NextResponse.json({
      questions: DEFAULT_QUESTIONS
    });
  }
}

// POST: Update the default questions
export async function POST(request: NextRequest) {
  try {
    const { questions } = await request.json();

    // Validate input
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Questions must be an array' },
        { status: 400 }
      );
    }

    // Validate question structure
    for (const question of questions) {
      if (!question.id || !question.text) {
        return NextResponse.json(
          { error: 'Each question must have an id and text' },
          { status: 400 }
        );
      }
      // Validate minWords if provided
      if (question.minWords !== undefined) {
        const minWords = Number(question.minWords);
        if (isNaN(minWords) || minWords < 10 || minWords > 500) {
          return NextResponse.json(
            { error: 'minWords must be a number between 10 and 500' },
            { status: 400 }
          );
        }
      }
    }

    // Get authenticated user from headers (set by middleware)
    const userEmail = request.headers.get('x-user-email') || 'unknown';

    // Prepare the setting value
    const settingValue = {
      questions
    };

    // Upsert the setting (insert or update) using admin client
    const { error } = await supabaseAdmin
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
      
      // If table doesn't exist, return error message with instructions
      if (error.code === '42P01' || error.code === 'PGRST301') {
        return NextResponse.json(
          { 
            error: 'Database table not found. Please run migrations to enable persistent storage.',
            questions // Return the questions anyway so UI doesn't break
          },
          { status: 500 }
        );
      }
      
      throw error;
    }

    console.log(`[360 Default Questions] Settings updated by ${userEmail} - ${questions.length} questions`);

    return NextResponse.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error('Error in POST /api/360-default-questions:', error);
    return NextResponse.json(
      { error: 'Failed to update settings. Please try again.' },
      { status: 500 }
    );
  }
}
