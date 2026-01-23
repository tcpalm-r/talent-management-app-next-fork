import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  analyzeWithCitations,
  GenerationCancelledError,
  isSurveyCancelled,
  clearSurveyCancellation,
} from '@/lib/services/surveyAnalyzerService';
import {
  acquireReportGenerationLock,
  releaseReportGenerationLock,
} from '@/lib/report-generation-lock';
import { enqueueReportGeneration } from '@/lib/report-generation-queue';
import { filterReportForSubject } from '@/lib/filterReport';
import type { ParticipantRelationship } from '@/types';
import type { UserProfile } from '@/lib/schema';

/**
 * Determine the viewer's role for a given survey
 *
 * @param user - The authenticated user's profile
 * @param survey - The survey being viewed
 * @returns 'sponsor' | 'subject' | 'admin' | 'unauthorized'
 */
export function determineViewerRole(
  user: UserProfile,
  survey: { created_by: string; created_by_email?: string | null; employee_id: string; status: string | null }
): 'sponsor' | 'subject' | 'admin' | 'unauthorized' {
  // Admins can see everything (elevated access)
  if (user.app_role === 'admin') {
    return 'admin';
  }

  // Check if user is the survey sponsor (creator)
  const isSponsor =
    user.id === survey.created_by ||
    (!!user.email &&
      !!survey.created_by_email &&
      user.email.toLowerCase() === survey.created_by_email.toLowerCase());

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

type GenerateReportOptions = {
  surveyId: string;
  tone: string;
  requester: UserProfile;
  queueIfBusy?: boolean;
  allowQueuedProcessing?: boolean;
};

export async function generateReportForSurvey({
  surveyId,
  tone,
  requester,
  queueIfBusy = false,
  allowQueuedProcessing = false,
}: GenerateReportOptions): Promise<NextResponse> {
  let lockAcquired = false;

  try {
    // ========================================================================
    // STEP 1: Fetch survey data
    // ========================================================================

    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({
        error: 'Survey not found',
        details: surveyError?.message
      }, { status: 404 });
    }

    // Check authorization - only sponsors and admins can generate reports
    const viewerRole = determineViewerRole(requester, survey);
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
      }, { status: 409 });
    }

    if (survey.status === 'queued' && !allowQueuedProcessing) {
      await enqueueReportGeneration({
        surveyId,
        requestedBy: requester.id,
        requestedByEmail: requester.email || null,
        tone,
      });

      return NextResponse.json({
        error: 'Report generation queued',
        message: 'This report is queued and will start once a slot is available.',
        status: 'queued'
      }, { status: 202 });
    }

    const lockResult = await acquireReportGenerationLock(surveyId, requester.id);
    if (!lockResult.ok) {
      if (lockResult.reason === 'busy' && queueIfBusy) {
        await enqueueReportGeneration({
          surveyId,
          requestedBy: requester.id,
          requestedByEmail: requester.email || null,
          tone,
        });

        return NextResponse.json({
          error: 'Report generation queued',
          message: 'The AI analysis queue is busy. Your report was queued and will start soon.',
          status: 'queued'
        }, { status: 202 });
      }

      const statusCode = lockResult.reason === 'locked' ? 409 : 429;
      const message = lockResult.reason === 'locked'
        ? 'A report is already generating for this survey.'
        : 'The AI analysis queue is busy. Please try again in a moment.';
      return NextResponse.json(
        {
          error: 'Report generation unavailable',
          message,
          status: lockResult.reason === 'locked' ? 'generating' : 'busy',
        },
        { status: statusCode }
      );
    }
    lockAcquired = true;

    // Set status to 'generating' BEFORE starting AI call (atomic lock)
    const { data: lockUpdate, error: lockError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', surveyId)
      .neq('status', 'generating') // Only update if not already generating (race condition protection)
      .select('id');

    if (lockError) {
      console.error('[360-generate-report] Failed to set generating status:', lockError);
      return NextResponse.json({
        error: 'Failed to start report generation',
        details: lockError.message
      }, { status: 500 });
    }

    if (!lockUpdate || lockUpdate.length === 0) {
      return NextResponse.json({
        error: 'Report generation already in progress',
        message: 'A report is currently being generated for this survey. Please wait for it to complete.',
        status: 'generating'
      }, { status: 409 });
    }

    // ========================================================================
    // STEP 2: Fetch reviewers (participants)
    // ========================================================================

    const { data: reviewers, error: reviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('survey_id', surveyId);

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
    // STEP 3: Fetch responses (include all responses for this survey)
    // ========================================================================

    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('feedback_360_responses')
      .select('*')
      .eq('survey_id', surveyId);

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

    const normalizeEmail = (value: string | null | undefined) =>
      (value || '').trim().toLowerCase();

    // Map reviewers by normalized email for case-insensitive matching
    const reviewerByEmail = new Map<string, typeof reviewers[number]>();
    reviewers.forEach(reviewer => {
      const key = normalizeEmail(reviewer.reviewer_email);
      if (key && !reviewerByEmail.has(key)) {
        reviewerByEmail.set(key, reviewer);
      }
    });

    // Track response emails that don't match a reviewer row
    const missingReviewerEmails = new Set<string>();
    responses.forEach(response => {
      const responseEmailKey = normalizeEmail(response.reviewer_email) || `unknown-response-${response.id}`;
      if (!reviewerByEmail.has(responseEmailKey)) {
        missingReviewerEmails.add(responseEmailKey);
      }
    });

    // ========================================================================
    // STEP 4: Fetch questions linked to this survey
    // ========================================================================

    const { data: surveyQuestions, error: questionsError } = await supabaseAdmin
      .from('feedback_360_survey_questions')
      .select(`
        *,
        question:feedback_360_questions(*)
      `)
      .eq('survey_id', surveyId)
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

    if (missingReviewerEmails.size > 0) {
      console.warn(
        `[360-generate-report] Found ${missingReviewerEmails.size} response emails with no matching reviewer record. Including them as synthetic participants.`
      );
    }

    const nowIso = new Date().toISOString();
    const fallbackReviewers = Array.from(missingReviewerEmails).map((emailKey, index) => ({
      id: `synthetic-reviewer-${index + 1}`,
      survey_id: surveyId,
      reviewer_name: emailKey.startsWith('unknown-response-') ? 'Unknown Reviewer' : emailKey,
      reviewer_email: emailKey,
      relationship: 'cross_functional',
      status: 'completed',
      access_token: '',
      invited_at: nowIso,
      completed_at: nowIso,
      created_at: nowIso,
    }));

    const allReviewers = [...reviewers, ...fallbackReviewers];

    // Map reviewers to participants format with relationship field
    const participants = allReviewers.map(reviewer => {
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
        invited_at: reviewer.invited_at || reviewer.created_at || nowIso,
        completed_at: reviewer.completed_at || undefined,
        created_at: reviewer.created_at || nowIso,
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
    const emailToIdMap = new Map<string, string>();
    allReviewers.forEach(r => {
      const key = normalizeEmail(r.reviewer_email);
      if (key && !emailToIdMap.has(key)) {
        emailToIdMap.set(key, r.id);
      }
    });

    // Group responses by reviewer for the analyzer
    // The DB stores individual question-answer pairs, but analyzer expects grouped responses
    // For citation tracking, we also store the response_id for each question
    const groupedResponses = responses.reduce((acc, response) => {
      const reviewerEmailKey = normalizeEmail(response.reviewer_email) || `unknown-response-${response.id}`;
      const reviewerId = emailToIdMap.get(reviewerEmailKey);

      if (!reviewerId) {
        console.warn(`No reviewer ID found for response email: ${response.reviewer_email || 'unknown'}`);
        return acc;
      }

      if (!acc[reviewerEmailKey]) {
        acc[reviewerEmailKey] = {
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
      acc[reviewerEmailKey].responses[response.question_id] =
        response.response_text || response.rating;
      acc[reviewerEmailKey].response_ids[response.question_id] = response.id;

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
    // STEP 6b: Status already set to 'generating' when lock was acquired
    // ========================================================================

    // ========================================================================
    // STEP 7: Call AI analyzer (ALWAYS with citations for accuracy)
    // ========================================================================

    console.log('🤖 Calling AI analyzer for survey:', surveyId);
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

    // Check for cancellation before saving (race condition protection)
    if (await isSurveyCancelled(surveyId)) {
      console.log(`📊 Survey ${surveyId} was cancelled before saving - aborting`);
      await clearSurveyCancellation(surveyId);
      return NextResponse.json({
        success: false,
        cancelled: true,
        message: 'Report generation was cancelled',
      });
    }

    console.log('💾 Saving report to database...');

    // Build report data with citation metadata (always included now)
    const reportData: any = {
      survey_id: surveyId,
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
      // Theme coherence analysis from Pass 3
      theme_coherence: analysisResult.theme_coherence || null,
      generated_by: analysisResult.generated_by || 'claude-sonnet-4',
      generated_at: analysisResult.generated_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Citation metadata (always present now)
      has_citations: true,
      citation_version: '2.0', // Updated for group-level analysis
      total_citations: citations.length,
      citation_coverage: analysisMeta.citationCoverage || 0,
      // Clear narrative on regeneration - user must generate new narrative
      final_narrative: null,
      narrative_version: 1,
    };

    const { data: savedReport, error: upsertError } = await supabaseAdmin
      .from('feedback_360_reports')
      .upsert(reportData, { onConflict: 'survey_id' })
      .select('id')
      .single();

    if (upsertError) {
      console.error('Error saving report to database:', upsertError);
      // CRITICAL: Fail the request if we can't save the report to the database.
      // Previously this silently continued, causing the report to be displayed once
      // but never persisted - leading to "Report Not Found" on subsequent views.
      // Revert survey status to 'in_progress' so user can try again
      await supabaseAdmin
        .from('feedback_360_surveys')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', surveyId);

      return NextResponse.json({
        error: 'Failed to save report to database',
        details: upsertError.message,
        message: 'The AI analysis completed but could not be saved. Please try again.'
      }, { status: 500 });
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

    // Check if survey was cancelled during processing (race condition protection)
    // If cancelled, don't update status to 'completed' - the cancel-generation API
    // already set it to 'in_progress'
    if (await isSurveyCancelled(surveyId)) {
      console.log(`📊 Survey ${surveyId} was cancelled during generation - not updating to completed`);
      await clearSurveyCancellation(surveyId);
      return NextResponse.json({
        success: false,
        cancelled: true,
        message: 'Report generation was cancelled',
      });
    }

    await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', surveyId);

    // ========================================================================
    // STEP 10: Apply role-based filtering and return response
    // ========================================================================

    // Determine viewer role for the person who generated the report
    const generatorRole = determineViewerRole(requester, survey);

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
    // Handle cancellation gracefully - not an error, just user action
    if (error instanceof GenerationCancelledError) {
      console.log(`📊 Report generation was cancelled for survey ${surveyId}`);
      // Status already reverted by cancel-generation endpoint, just return success
      return NextResponse.json({
        success: false,
        cancelled: true,
        message: 'Report generation was cancelled',
      });
    }

    console.error('Error generating 360 report:', error);

    // Revert survey status to 'in_progress' if generation failed
    // This releases the lock so the user can try again
    try {
      await supabaseAdmin
        .from('feedback_360_surveys')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', surveyId);
      console.log('📊 Survey status reverted to "in_progress" due to error');
    } catch (revertError) {
      console.error('Failed to revert survey status:', revertError);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      await releaseReportGenerationLock(surveyId);
    }
  }
}
