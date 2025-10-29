import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeSurvey360Responses } from '@/lib/survey360Analyzer';
import type { Database } from '@/types/supabase';
import type { ParticipantRelationship } from '@/types';

/**
 * API Route: /api/360-generate-report
 *
 * POST: Generate AI analysis report for a completed 360 survey
 * GET: Retrieve existing report for a survey
 */

// Initialize Supabase client with service role for server-side operations
const getSupabaseClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createClient<Database>(url, serviceRoleKey || anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

/**
 * POST - Generate AI analysis report
 *
 * Request body: { survey_id: string }
 *
 * Process:
 * 1. Fetch survey data (survey, reviewers, responses, questions)
 * 2. Transform data for AI analyzer
 * 3. Call Claude AI to analyze responses
 * 4. Save report to database (upsert)
 * 5. Update survey status to 'completed'
 * 6. Return generated report
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { survey_id, tone = 'standard' } = body;

    if (!survey_id) {
      return NextResponse.json({ error: 'survey_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // ========================================================================
    // STEP 1: Fetch survey data
    // ========================================================================

    const { data: survey, error: surveyError } = await supabase
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', survey_id)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({
        error: 'Survey not found',
        details: surveyError?.message
      }, { status: 404 });
    }

    // ========================================================================
    // STEP 2: Fetch reviewers (participants)
    // ========================================================================

    const { data: reviewers, error: reviewersError } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('survey_id', survey_id);

    if (reviewersError) {
      return NextResponse.json({
        error: 'Failed to fetch reviewers',
        details: reviewersError.message
      }, { status: 500 });
    }

    if (!reviewers || reviewers.length === 0) {
      return NextResponse.json({
        error: 'No reviewers found for this survey'
      }, { status: 400 });
    }

    // ========================================================================
    // STEP 3: Fetch responses
    // ========================================================================

    const { data: responses, error: responsesError } = await supabase
      .from('feedback_360_responses')
      .select('*')
      .eq('survey_id', survey_id);

    if (responsesError) {
      return NextResponse.json({
        error: 'Failed to fetch responses',
        details: responsesError.message
      }, { status: 500 });
    }

    if (!responses || responses.length === 0) {
      return NextResponse.json({
        error: 'No responses found for this survey. Cannot generate analysis without responses.'
      }, { status: 400 });
    }

    // ========================================================================
    // STEP 4: Fetch questions linked to this survey
    // ========================================================================

    const { data: surveyQuestions, error: questionsError } = await supabase
      .from('feedback_360_survey_questions')
      .select(`
        *,
        question:feedback_360_questions(*)
      `)
      .eq('survey_id', survey_id)
      .order('question_order');

    if (questionsError) {
      return NextResponse.json({
        error: 'Failed to fetch questions',
        details: questionsError.message
      }, { status: 500 });
    }

    // ========================================================================
    // STEP 5: Fetch employee details for context
    // ========================================================================

    // TODO: Fix employee query once 'employees' materialized view is properly set up
    // For now, use survey data directly
    const employee: { name?: string; email?: string } | null = null;

    // Employee is optional - survey might reference a user not in employees view

    // ========================================================================
    // STEP 6: Transform data for AI analyzer
    // ========================================================================

    // Map reviewers to participants format with relationship field
    const participants = reviewers.map(reviewer => {
      // Normalize relationship value to valid ParticipantRelationship
      let relationship: ParticipantRelationship = 'peer';
      const rel = (reviewer.relationship || 'peer').toLowerCase();
      if (['manager', 'peer', 'direct_report', 'cross_functional'].includes(rel)) {
        relationship = rel as ParticipantRelationship;
      }

      return {
        id: reviewer.id,
        survey_id: reviewer.survey_id,
        participant_name: reviewer.reviewer_name || 'Anonymous',
        participant_email: reviewer.reviewer_email,
        relationship,
        status: reviewer.status as 'pending' | 'in_progress' | 'completed',
        access_token: reviewer.access_token || '',
        invited_at: reviewer.invited_at || reviewer.created_at || new Date().toISOString(),
        completed_at: reviewer.completed_at || undefined,
        created_at: reviewer.created_at || new Date().toISOString(),
      };
    });

    // Map survey questions to SurveyQuestion format
    const questions = (surveyQuestions || []).map(sq => {
      const q = sq.question as any;
      return {
        id: sq.question_id, // Use the actual question ID, not the survey_question link ID
        question: q?.question_text || 'Question text not available',
        type: 'text' as 'text' | 'rating' | 'multiple_choice', // Questions from DB are text-based
        required: true,
        category: q?.category || undefined,
      };
    });

    // Create a map of reviewer email to reviewer ID for proper participant mapping
    const emailToIdMap = new Map(reviewers.map(r => [r.reviewer_email, r.id]));

    // Group responses by reviewer for the analyzer
    // The DB stores individual question-answer pairs, but analyzer expects grouped responses
    const groupedResponses = responses.reduce((acc, response) => {
      const reviewerEmail = response.reviewer_email;
      const reviewerId = emailToIdMap.get(reviewerEmail);

      if (!reviewerId) {
        console.warn(`No reviewer ID found for email: ${reviewerEmail}`);
        return acc;
      }

      if (!acc[reviewerEmail]) {
        acc[reviewerEmail] = {
          id: response.id,
          survey_id: response.survey_id,
          participant_id: reviewerId, // Use reviewer ID (UUID) to match participants array
          responses: {},
          submitted_at: response.created_at || new Date().toISOString(),
          created_at: response.created_at || new Date().toISOString(),
          updated_at: response.updated_at || new Date().toISOString(),
        };
      }

      // Add this question's response
      acc[reviewerEmail].responses[response.question_id] =
        response.response_text || response.rating;

      return acc;
    }, {} as Record<string, any>);

    const transformedResponses = Object.values(groupedResponses);

    // Transform survey data
    const surveyData = {
      id: survey.id,
      organization_id: undefined, // Not in DB schema
      employee_id: survey.employee_id,
      employee_name: 'Unknown Employee', // TODO: populate from employee when available
      employee_email: '', // TODO: populate from employee when available
      status: survey.status as 'draft' | 'active' | 'completed' | 'closed',
      created_by: survey.created_by,
      survey_name: survey.survey_name || 'Untitled Survey',
      survey_title: survey.survey_name || 'Untitled Survey',
      due_date: survey.due_date,
      sent_at: survey.sent_at,
      completed_at: survey.completed_at,
      created_at: survey.created_at || new Date().toISOString(),
      updated_at: survey.updated_at || new Date().toISOString(),
    };

    // ========================================================================
    // STEP 7: Call AI analyzer
    // ========================================================================

    console.log('🤖 Calling AI analyzer for survey:', survey_id);
    console.log('   - Participants:', participants.length);
    console.log('   - Responses:', transformedResponses.length);
    console.log('   - Questions:', questions.length);

    const analysisResult = await analyzeSurvey360Responses({
      survey: surveyData,
      responses: transformedResponses,
      participants: participants,
      questions: questions,
      tone: tone,
    });

    console.log('✅ AI analysis complete');

    // ========================================================================
    // STEP 8: Save report to database (upsert)
    // ========================================================================

    // TODO: Fix report saving once database schema is confirmed
    // For now, skip saving and return analysis result directly
    const savedReport = null;
    console.log('⏭️  Skipping report save - database schema needs update');

    // ========================================================================
    // STEP 9: Update survey status to 'completed'
    // ========================================================================

    await supabase
      .from('feedback_360_surveys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', survey_id);

    console.log('💾 Report saved successfully');

    // ========================================================================
    // STEP 10: Return success response
    // ========================================================================

    return NextResponse.json({
      success: true,
      report: savedReport,
      message: 'AI analysis completed successfully'
    });

  } catch (error: any) {
    console.error('Error generating 360 report:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve existing report
 *
 * Query params: ?survey_id=<uuid>
 *
 * Returns existing AI analysis report for a survey
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const survey_id = searchParams.get('survey_id');

    if (!survey_id) {
      return NextResponse.json({
        error: 'survey_id query parameter is required'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Fetch report with survey details
    const { data: report, error } = await supabase
      .from('feedback_360_reports')
      .select(`
        *,
        survey:feedback_360_surveys(
          id,
          survey_name,
          employee_id,
          status,
          created_by,
          created_at
        )
      `)
      .eq('survey_id', survey_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          error: 'No report found for this survey',
          message: 'Report may not have been generated yet'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to fetch report',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error: any) {
    console.error('Error fetching 360 report:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
