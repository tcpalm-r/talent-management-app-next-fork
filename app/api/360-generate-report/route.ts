import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  analyzeWithCitations,
  AnalysisResultWithCitations,
} from '@/lib/services/surveyAnalyzerService';
import { filterReportForSubject } from '@/lib/filterReport';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import type { Database } from '@/types/supabase';
import type { ParticipantRelationship } from '@/types';
import type { UserProfile } from '@/lib/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes - needed for two-pass Claude API calls

/**
 * API Route: /api/360-generate-report
 *
 * POST: Generate AI analysis report for a completed 360 survey
 * GET: Retrieve existing report for a survey
 */

// Use singleton supabaseAdmin client (service role, bypasses RLS)

/**
 * Determine the viewer's role for a given survey
 *
 * @param user - The authenticated user's profile
 * @param survey - The survey being viewed
 * @returns 'sponsor' | 'subject' | 'admin' | 'unauthorized'
 */
function determineViewerRole(
  user: UserProfile,
  survey: { created_by: string; employee_id: string; status: string | null }
): 'sponsor' | 'subject' | 'admin' | 'unauthorized' {
  // Admins and SLT can see everything (elevated access)
  if (user.app_role === 'admin' || user.app_role === 'slt') {
    return 'admin';
  }

  // Check if user is the survey sponsor (creator)
  const isSponsor =
    user.id === survey.created_by ||
    (user.email && user.email === survey.created_by);

  if (isSponsor) {
    return 'sponsor';
  }

  // Check if user is the subject (employee being reviewed)
  // Subjects can only view finalized reports
  if (user.id === survey.employee_id && survey.status === 'finalized') {
    return 'subject';
  }

  // User has no authorized role for this survey
  return 'unauthorized';
}

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
  let survey_id: string | null = null;  // Declare outside try for error handling access

  try {
    const body = await req.json();
    survey_id = body.survey_id;
    const tone = body.tone || 'standard';
    // Citations are always enabled for accuracy - they're just hidden from non-admins

    if (!survey_id) {
      return NextResponse.json({ error: 'survey_id is required' }, { status: 400 });
    }

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use singleton admin client

    // ========================================================================
    // STEP 1: Fetch survey data
    // ========================================================================

    const { data: survey, error: surveyError } = await supabaseAdmin
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

    // Check authorization - only sponsors and admins can generate reports
    const viewerRole = determineViewerRole(authData.profile, survey);
    if (viewerRole !== 'sponsor' && viewerRole !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Only survey sponsors and administrators can generate reports'
      }, { status: 403 });
    }

    // ========================================================================
    // DUPLICATE GENERATION PROTECTION
    // ========================================================================
    // If survey is already in 'generating' status, reject the request
    // This prevents multiple concurrent report generation attempts
    if (survey.status === 'generating') {
      return NextResponse.json({
        error: 'Report generation already in progress',
        message: 'A report is currently being generated for this survey. Please wait for it to complete.',
        status: 'generating'
      }, { status: 409 }); // 409 Conflict
    }

    // Set status to 'generating' BEFORE starting AI call (atomic lock)
    const { error: lockError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', survey_id)
      .neq('status', 'generating'); // Only update if not already generating (race condition protection)

    if (lockError) {
      console.error('[360-generate-report] Failed to set generating status:', lockError);
      return NextResponse.json({
        error: 'Failed to start report generation',
        details: lockError.message
      }, { status: 500 });
    }

    // ========================================================================
    // STEP 2: Fetch reviewers (participants)
    // ========================================================================

    const { data: reviewers, error: reviewersError } = await supabaseAdmin
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
    // STEP 3: Fetch responses (only from current reviewers)
    // ========================================================================

    // Get list of active reviewer emails to filter responses
    const activeReviewerEmails = reviewers.map(r => r.reviewer_email);

    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('feedback_360_responses')
      .select('*')
      .eq('survey_id', survey_id)
      .in('reviewer_email', activeReviewerEmails); // Only include responses from current reviewers

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

    // Log if any responses were excluded (removed reviewers)
    const totalResponseCount = await supabaseAdmin
      .from('feedback_360_responses')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', survey_id);

    if (totalResponseCount.count && totalResponseCount.count > responses.length) {
      console.log(`[360-generate-report] Excluded ${totalResponseCount.count - responses.length} responses from removed reviewers`);
    }

    // ========================================================================
    // STEP 4: Fetch questions linked to this survey
    // ========================================================================

    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
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

    let employeeName = 'Unknown Employee';
    let employeeEmail = '';

    if (survey.employee_id) {
      const { data: employeeData } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', survey.employee_id)
        .single();

      if (employeeData) {
        employeeName = employeeData.full_name || 'Unknown Employee';
        employeeEmail = employeeData.email || '';
      }
    }

    // ========================================================================
    // STEP 6: Transform data for AI analyzer
    // ========================================================================

    // Map reviewers to participants format with relationship field
    const participants = reviewers.map(reviewer => {
      // Normalize relationship value to valid ParticipantRelationship
      let relationship: ParticipantRelationship = 'cross_functional';
      const rel = (reviewer.relationship || 'cross_functional').toLowerCase();
      if (['manager', 'slt', 'direct_report', 'cross_functional'].includes(rel)) {
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
    // For citation tracking, we also store the response_id for each question
    const groupedResponses = responses.reduce((acc, response) => {
      const reviewerEmail = response.reviewer_email;
      const reviewerId = emailToIdMap.get(reviewerEmail);

      if (!reviewerId) {
        console.warn(`No reviewer ID found for email: ${reviewerEmail}`);
        return acc;
      }

      if (!acc[reviewerEmail]) {
        acc[reviewerEmail] = {
          id: response.id, // First response ID (for backwards compat)
          survey_id: response.survey_id,
          participant_id: reviewerId, // Use reviewer ID (UUID) to match participants array
          responses: {},
          response_ids: {}, // Map of question_id -> response row ID for citation tracking
          submitted_at: response.created_at || new Date().toISOString(),
          created_at: response.created_at || new Date().toISOString(),
          updated_at: response.updated_at || new Date().toISOString(),
        };
      }

      // Add this question's response and its ID for citation tracking
      acc[reviewerEmail].responses[response.question_id] =
        response.response_text || response.rating;
      acc[reviewerEmail].response_ids[response.question_id] = response.id;

      return acc;
    }, {} as Record<string, any>);

    const transformedResponses = Object.values(groupedResponses);

    // Transform survey data
    const surveyData = {
      id: survey.id,
      organization_id: undefined, // Not in DB schema
      employee_id: survey.employee_id,
      employee_name: employeeName,
      employee_email: employeeEmail,
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
    // STEP 6b: Set survey status to 'generating' before AI call
    // ========================================================================
    // This allows the UI to show a loading state even if the user refreshes
    const previousStatus = survey.status;
    await supabaseAdmin
      .from('feedback_360_surveys')
      .update({ status: 'generating' })
      .eq('id', survey_id);
    console.log('📊 Survey status set to "generating"');

    // ========================================================================
    // STEP 7: Call AI analyzer (ALWAYS with citations for accuracy)
    // ========================================================================

    console.log('🤖 Calling AI analyzer for survey:', survey_id);
    console.log('   - Participants:', participants.length);
    console.log('   - Responses:', transformedResponses.length);
    console.log('   - Questions:', questions.length);
    console.log('   - Citations: always enabled for accuracy');

    // Always use citation-enabled analyzer to improve accuracy and reduce hallucinations
    // Citations are stored but only shown to admins in audit mode
    const citationResult = await analyzeWithCitations({
      survey: surveyData,
      responses: transformedResponses,
      participants: participants,
      questions: questions,
      tone: tone,
    });
    const analysisResult = citationResult.report;
    const analysisMeta = citationResult.meta;
    const citations = citationResult.citations;

    console.log('✅ AI analysis complete (with citations)');
    console.log(`   - API version: ${analysisMeta.version}`);
    console.log(`   - Elapsed: ${analysisMeta.elapsedMs}ms`);
    console.log(`   - Total citations: ${analysisMeta.totalCitations}`);
    console.log(`   - Citation coverage: ${analysisMeta.citationCoverage}%`);

    // ========================================================================
    // STEP 8: Save report to database
    // ========================================================================

    console.log('💾 Saving report to database...');

    // Build report data with citation metadata (always included now)
    const reportData: any = {
      survey_id: survey_id,
      themes: analysisResult.themes as any || [],
      overall_strengths: analysisResult.overall_strengths || [],
      development_areas: analysisResult.development_areas || [],
      recommendations: analysisResult.recommendations || [],
      sentiment_by_relationship: analysisResult.sentiment_by_relationship as any || {},
      // New group-level analysis structure (v2)
      consensus_areas: analysisResult.consensus_areas || [],
      varied_by_relationship: analysisResult.varied_by_relationship || [],
      outliers: analysisResult.outliers || [],
      // Keep outlier_opinions for backward compatibility with old reports
      outlier_opinions: analysisResult.outlier_opinions || [],
      generated_by: analysisResult.generated_by || 'claude-sonnet-4',
      generated_at: analysisResult.generated_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Citation metadata (always present now)
      has_citations: true,
      citation_version: '2.0', // Updated for group-level analysis
      total_citations: citations.length,
      citation_coverage: analysisMeta.citationCoverage || 0,
    };

    const { data: savedReport, error: upsertError } = await supabaseAdmin
      .from('feedback_360_reports')
      .upsert(reportData, { onConflict: 'survey_id' })
      .select('id')
      .single();

    if (upsertError) {
      console.error('Error saving report to database:', upsertError);
      // Don't fail the entire request - return the report anyway
    } else {
      console.log('✅ Report saved to database successfully');

      // ========================================================================
      // STEP 8b: Save citations to junction table
      // ========================================================================
      if (citations && citations.length > 0 && savedReport?.id) {
        console.log(`💾 Saving ${citations.length} citations...`);

        // First, delete any existing citations for this report
        await supabaseAdmin
          .from('feedback_360_report_citations')
          .delete()
          .eq('report_id', savedReport.id);

        // Insert new citations
        const citationRecords = citations.map(citation => ({
          report_id: savedReport.id,
          response_id: citation.response_id,
          section_type: citation.section_type,
          section_index: citation.section_index,
          statement_index: citation.statement_index,
          snippet: citation.snippet,
          relevance_score: citation.relevance_score || null,
        }));

        const { error: citationsError } = await supabaseAdmin
          .from('feedback_360_report_citations')
          .insert(citationRecords);

        if (citationsError) {
          console.error('Error saving citations:', citationsError);
        } else {
          console.log(`✅ ${citations.length} citations saved successfully`);
        }
      }
    }

    // ========================================================================
    // STEP 9: Update survey status to 'completed'
    // ========================================================================

    await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', survey_id);

    // ========================================================================
    // STEP 10: Apply role-based filtering and return response
    // ========================================================================

    // Determine viewer role for the person who generated the report
    const generatorRole = determineViewerRole(authData.profile, survey);

    // Filter report based on viewer role
    let filteredReport: any = analysisResult;

    if (generatorRole === 'subject') {
      // Subjects see filtered report without relationship breakdowns
      filteredReport = filterReportForSubject(analysisResult as any);
    }
    // Sponsors and admins see full report (no filtering needed)

    // Include citation info in response (only for admins, hidden from sponsors/subjects)
    const hasCitations = citations && citations.length > 0;

    return NextResponse.json({
      success: true,
      report: filteredReport,
      viewerRole: generatorRole, // Include viewer role for debugging/frontend awareness
      message: 'AI analysis completed successfully',
      meta: analysisMeta, // Include API version info for frontend notification
      // Only include citation info for admins (sponsors/subjects never see it)
      citationInfo: hasCitations && generatorRole === 'admin' ? {
        hasCitations: true,
        totalCitations: citations?.length || 0,
        citationCoverage: analysisMeta.citationCoverage || 0,
      } : undefined,
    });

  } catch (error: any) {
    console.error('Error generating 360 report:', error);

    // Revert survey status to 'in_progress' if generation failed
    // This releases the lock so the user can try again
    if (survey_id) {
      try {
        await supabaseAdmin
          .from('feedback_360_surveys')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', survey_id);
        console.log('📊 Survey status reverted to "in_progress" due to error');
      } catch (revertError) {
        console.error('Failed to revert survey status:', revertError);
      }
    }

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

    // Authenticate user
    const authData = await getAuthenticatedUser(req);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use singleton admin client

    // Fetch report with survey details
    const { data: report, error } = await supabaseAdmin
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
        // No report in database - this is expected if report was just generated
        // Return a message indicating the user should have already seen the results
        return NextResponse.json({
          error: 'No report found for this survey',
          message: 'Report data should have been displayed immediately after generation. Please regenerate the analysis if needed.'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to fetch report',
        details: error.message
      }, { status: 500 });
    }

    // Determine viewer role for authorization and filtering
    const survey = report.survey as any;
    if (!survey) {
      return NextResponse.json({
        error: 'Survey not found',
        message: 'Report exists but associated survey could not be loaded'
      }, { status: 404 });
    }

    const viewerRole = determineViewerRole(authData.profile, {
      created_by: survey.created_by,
      employee_id: survey.employee_id,
      status: survey.status
    });

    console.log('[GET /api/360-generate-report] Viewer role determined:', viewerRole);
    console.log('[GET /api/360-generate-report] User ID:', authData.profile.id);
    console.log('[GET /api/360-generate-report] Employee ID:', survey.employee_id);
    console.log('[GET /api/360-generate-report] Survey status:', survey.status);
    console.log('[GET /api/360-generate-report] Created by:', survey.created_by);

    if (viewerRole === 'unauthorized') {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'You do not have permission to view this report'
      }, { status: 403 });
    }

    // Filter report data based on viewer role
    let filteredReport: any = { ...report };

    if (viewerRole === 'subject') {
      console.log('[GET /api/360-generate-report] Filtering report for subject');
      // Subjects see filtered report without relationship breakdowns
      filteredReport = filterReportForSubject(report as any);
    }

    // Sponsors and admins see full report (no filtering needed)

    return NextResponse.json({
      success: true,
      report: filteredReport,
      viewerRole // Include viewer role for debugging/frontend awareness
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
