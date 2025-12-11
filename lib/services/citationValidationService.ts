/**
 * Citation Validation Service
 *
 * Handles background validation of AI-generated report citations.
 * This is an admin-only QA feature to verify the AI isn't hallucinating.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  analyzeWithCitations,
  AnalysisResultWithCitations,
} from './surveyAnalyzerService';
import type { ParticipantRelationship } from '@/types';

export interface ValidationResult {
  success: boolean;
  reportId: string;
  status: 'validated' | 'failed';
  totalCitations: number;
  citationCoverage: number;
  validatedAt: string;
  errors?: Array<{
    type: 'missing_response' | 'snippet_mismatch' | 'invalid_format';
    message: string;
    details?: Record<string, unknown>;
  }>;
  elapsedMs: number;
}

/**
 * Start citation validation for a report.
 * This is a long-running operation that should be called async.
 */
export async function validateReportCitations(reportId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationResult['errors'] = [];

  try {
    console.log(`[citationValidation] Starting validation for report ${reportId}`);

    // Update status to 'validating'
    await supabaseAdmin
      .from('feedback_360_reports')
      .update({
        citation_validation_status: 'validating',
      })
      .eq('id', reportId);

    // Fetch the existing report to get survey_id
    const { data: report, error: reportError } = await supabaseAdmin
      .from('feedback_360_reports')
      .select('*, feedback_360_surveys(*)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      throw new Error(`Report not found: ${reportError?.message || 'Unknown error'}`);
    }

    const surveyId = report.survey_id;
    const survey = report.feedback_360_surveys;

    if (!survey) {
      throw new Error('Survey not found for this report');
    }

    // Fetch all data needed for citation analysis
    const [reviewersResult, responsesResult, questionsResult] = await Promise.all([
      supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('survey_id', surveyId),
      supabaseAdmin
        .from('feedback_360_responses')
        .select('*')
        .eq('survey_id', surveyId),
      supabaseAdmin
        .from('feedback_360_survey_questions')
        .select('*, feedback_360_questions(*)')
        .eq('survey_id', surveyId)
        .order('question_order', { ascending: true }),
    ]);

    if (reviewersResult.error) throw new Error(`Failed to fetch reviewers: ${reviewersResult.error.message}`);
    if (responsesResult.error) throw new Error(`Failed to fetch responses: ${responsesResult.error.message}`);
    if (questionsResult.error) throw new Error(`Failed to fetch questions: ${questionsResult.error.message}`);

    const reviewers = reviewersResult.data || [];
    const responses = responsesResult.data || [];
    const surveyQuestions = questionsResult.data || [];

    // Transform data for the analyzer
    const participants = reviewers.map((r) => ({
      id: r.id,
      survey_id: r.survey_id,
      reviewer_name: r.reviewer_name || '',
      reviewer_email: r.reviewer_email || '',
      relationship: r.relationship as ParticipantRelationship,
      status: r.status || 'pending',
      invited_at: r.invited_at,
      completed_at: r.completed_at,
    }));

    // Group responses by reviewer email, preserving individual response IDs
    // Each row in feedback_360_responses is a single question-answer pair
    const emailToReviewerIdMap = new Map(reviewers.map((r) => [r.reviewer_email, r.id]));
    const groupedResponses: Record<string, {
      id: string;
      survey_id: string;
      participant_id: string;
      responses: Record<string, unknown>;
      response_ids: Record<string, string>;
      submitted_at: string;
    }> = {};

    responses.forEach((r) => {
      const reviewerId = emailToReviewerIdMap.get(r.reviewer_email);
      if (!reviewerId) return;

      if (!groupedResponses[r.reviewer_email]) {
        groupedResponses[r.reviewer_email] = {
          id: r.id, // First response ID (for backwards compat)
          survey_id: r.survey_id,
          participant_id: reviewerId,
          responses: {},
          response_ids: {},
          submitted_at: r.created_at || new Date().toISOString(),
        };
      }

      // Add this question's response and its ID for citation tracking
      groupedResponses[r.reviewer_email].responses[r.question_id] =
        r.response_text || r.rating;
      groupedResponses[r.reviewer_email].response_ids[r.question_id] = r.id;
    });

    const transformedResponses = Object.values(groupedResponses);

    const questions = surveyQuestions
      .filter((sq) => sq.feedback_360_questions)
      .map((sq) => ({
        id: sq.question_id,
        question: sq.feedback_360_questions?.question_text || '',
        type: (sq.feedback_360_questions?.question_type as 'text' | 'rating' | 'multiple_choice') || 'text',
        scale_max: sq.feedback_360_questions?.scale_max || undefined,
        options: sq.feedback_360_questions?.options || undefined,
      }));

    // Run citation-enabled analysis
    console.log(`[citationValidation] Running citation analysis for survey ${surveyId}`);
    const analysisResult = await analyzeWithCitations({
      survey: {
        id: survey.id,
        employee_id: survey.employee_id,
        employee_name: survey.employee_name || 'Unknown',
        survey_title: survey.survey_title || '360 Feedback Survey',
        status: survey.status || 'active',
        created_by: survey.created_by,
        created_at: survey.created_at,
        due_date: survey.due_date,
      },
      responses: transformedResponses,
      participants,
      questions,
      tone: 'standard',
      enableCitations: true,
    });

    // Validate citations against source responses
    const responseIds = new Set(responses.map((r) => r.id));
    for (const citation of analysisResult.citations) {
      if (!responseIds.has(citation.response_id)) {
        errors.push({
          type: 'missing_response',
          message: `Citation references non-existent response ID: ${citation.response_id}`,
          details: { response_id: citation.response_id, section: citation.section_type },
        });
      }
    }

    // Update the report with citation data
    const updateData = {
      // Store the new analysis with citations
      themes: analysisResult.report.themes,
      overall_strengths: analysisResult.report.overall_strengths,
      development_areas: analysisResult.report.development_areas,
      recommendations: analysisResult.report.recommendations,
      consensus_areas: analysisResult.report.consensus_areas,
      outlier_opinions: analysisResult.report.outlier_opinions,
      // Citation metadata
      has_citations: true,
      citation_version: '1.0',
      total_citations: analysisResult.meta.totalCitations,
      citation_coverage: analysisResult.meta.citationCoverage,
      // Validation status
      citation_validation_status: errors.length > 0 ? 'failed' : 'validated',
      citation_validated_at: new Date().toISOString(),
      validation_errors: errors.length > 0 ? errors : null,
    };

    await supabaseAdmin
      .from('feedback_360_reports')
      .update(updateData)
      .eq('id', reportId);

    // Store citations in the junction table
    if (analysisResult.citations.length > 0) {
      // Delete existing citations first
      await supabaseAdmin
        .from('feedback_360_report_citations')
        .delete()
        .eq('report_id', reportId);

      // Insert new citations
      const citationRows = analysisResult.citations.map((c) => ({
        report_id: reportId,
        response_id: c.response_id,
        section_type: c.section_type,
        section_index: c.section_index,
        statement_index: c.statement_index,
        snippet: c.snippet,
        relevance_score: c.relevance_score || null,
      }));

      await supabaseAdmin
        .from('feedback_360_report_citations')
        .insert(citationRows);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[citationValidation] Validation complete for report ${reportId} in ${elapsedMs}ms`);

    return {
      success: true,
      reportId,
      status: errors.length > 0 ? 'failed' : 'validated',
      totalCitations: analysisResult.meta.totalCitations,
      citationCoverage: analysisResult.meta.citationCoverage,
      validatedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
      elapsedMs,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[citationValidation] Validation failed for report ${reportId}:`, error);

    // Update status to failed
    await supabaseAdmin
      .from('feedback_360_reports')
      .update({
        citation_validation_status: 'failed',
        citation_validated_at: new Date().toISOString(),
        validation_errors: [{
          type: 'invalid_format',
          message: error instanceof Error ? error.message : 'Unknown error',
        }],
      })
      .eq('id', reportId);

    return {
      success: false,
      reportId,
      status: 'failed',
      totalCitations: 0,
      citationCoverage: 0,
      validatedAt: new Date().toISOString(),
      errors: [{
        type: 'invalid_format',
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
      elapsedMs,
    };
  }
}

/**
 * Get current validation status for a report
 */
export async function getValidationStatus(reportId: string): Promise<{
  status: string | null;
  validatedAt: string | null;
  totalCitations: number;
  citationCoverage: number;
  errors: unknown[] | null;
}> {
  const { data, error } = await supabaseAdmin
    .from('feedback_360_reports')
    .select('citation_validation_status, citation_validated_at, total_citations, citation_coverage, validation_errors')
    .eq('id', reportId)
    .single();

  if (error || !data) {
    throw new Error(`Report not found: ${error?.message || 'Unknown error'}`);
  }

  return {
    status: data.citation_validation_status,
    validatedAt: data.citation_validated_at,
    totalCitations: data.total_citations || 0,
    citationCoverage: data.citation_coverage || 0,
    errors: data.validation_errors as unknown[] | null,
  };
}
