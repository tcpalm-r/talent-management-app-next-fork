/**
 * Test script to verify verbatim citation extraction
 * Run with: npx tsx scripts/test-verbatim-citations.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { analyzeWithCitations } from '../lib/services/surveyAnalyzerService';
import { validateSnippetIsVerbatim } from '../lib/services/snippetExtractionService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SURVEY_ID = '395743b6-ac58-4936-a198-a262b7ae7969'; // Morten's survey

async function main() {
  console.log('=== Testing Verbatim Citation Extraction ===\n');

  // 1. Load survey data
  console.log('Loading survey data...');
  const { data: survey, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', SURVEY_ID)
    .single();

  if (surveyError || !survey) {
    console.error('Failed to load survey:', surveyError);
    process.exit(1);
  }

  console.log('Survey:', survey.survey_name);

  // 2. Load reviewers
  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', SURVEY_ID);

  console.log('Reviewers:', reviewers?.length || 0);

  // 3. Load responses
  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', SURVEY_ID);

  console.log('Responses:', responses?.length || 0);

  // 4. Load questions
  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select('*, feedback_360_questions(*)')
    .eq('survey_id', SURVEY_ID)
    .order('question_order');

  console.log('Questions:', surveyQuestions?.length || 0);

  // Build response text map for validation
  const responseTextMap = new Map<string, string>();
  responses?.forEach(r => {
    responseTextMap.set(r.id, r.response_text);
  });

  // 5. Transform data for analyzer
  const participants = reviewers?.map(r => ({
    id: r.id,
    survey_id: r.survey_id,
    reviewer_name: r.reviewer_name || '',
    reviewer_email: r.reviewer_email || '',
    relationship: r.relationship,
    status: r.status || 'pending',
    invited_at: r.invited_at,
    completed_at: r.completed_at,
  })) || [];

  // Group responses by reviewer
  const emailToReviewerMap = new Map(reviewers?.map(r => [r.reviewer_email, r.id]) || []);
  const groupedResponses: Record<string, any> = {};

  responses?.forEach(r => {
    const reviewerId = emailToReviewerMap.get(r.reviewer_email);
    if (!reviewerId) return;

    if (!groupedResponses[r.reviewer_email]) {
      groupedResponses[r.reviewer_email] = {
        id: r.id,
        survey_id: r.survey_id,
        participant_id: reviewerId,
        responses: {},
        response_ids: {},
        submitted_at: r.created_at,
      };
    }

    groupedResponses[r.reviewer_email].responses[r.question_id] = r.response_text || r.rating;
    groupedResponses[r.reviewer_email].response_ids[r.question_id] = r.id;
  });

  const transformedResponses = Object.values(groupedResponses);

  const questions = surveyQuestions?.map(sq => ({
    id: sq.question_id,
    question: sq.feedback_360_questions?.question_text || '',
    type: sq.feedback_360_questions?.question_type || 'text',
    scale_max: sq.feedback_360_questions?.scale_max,
  })) || [];

  // 6. Run analysis
  console.log('\n=== Running Analysis with Citation Tracking ===\n');
  console.log('This will take a few minutes...\n');

  try {
    const result = await analyzeWithCitations({
      survey: {
        id: survey.id,
        employee_id: survey.employee_id,
        employee_name: survey.subject_preferred_name || 'Unknown',
        survey_title: survey.survey_name || '360 Feedback',
        status: survey.status,
        created_by: survey.created_by,
        created_at: survey.created_at,
        due_date: survey.due_date,
      },
      responses: transformedResponses,
      participants,
      questions,
      tone: 'standard',
    });

    console.log('\n=== Analysis Complete ===\n');
    console.log('Themes:', result.report.themes?.length || 0);
    console.log('Total citations:', result.meta.totalCitations);
    console.log('Citation coverage:', result.meta.citationCoverage.toFixed(1) + '%');

    // 7. Validate citations are verbatim
    console.log('\n=== Validating Verbatim Citations ===\n');

    let validCount = 0;
    let invalidCount = 0;
    const invalidCitations: Array<{ snippet: string; source: string; responseId: string }> = [];

    result.citations.forEach(citation => {
      const sourceText = responseTextMap.get(citation.response_id) || '';
      const isValid = validateSnippetIsVerbatim(citation.snippet, sourceText);

      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
        if (invalidCitations.length < 5) {
          invalidCitations.push({
            snippet: citation.snippet.slice(0, 100),
            source: sourceText.slice(0, 150),
            responseId: citation.response_id,
          });
        }
      }
    });

    console.log('Valid (verbatim) citations:', validCount);
    console.log('Invalid (paraphrased) citations:', invalidCount);
    console.log('Verbatim rate:', ((validCount / (validCount + invalidCount)) * 100).toFixed(1) + '%');

    if (invalidCitations.length > 0) {
      console.log('\n=== Sample Invalid Citations ===\n');
      invalidCitations.forEach((c, i) => {
        console.log(`${i + 1}. Response ID: ${c.responseId}`);
        console.log(`   Snippet: "${c.snippet}..."`);
        console.log(`   Source: "${c.source}..."`);
        console.log('');
      });
    }

    // 8. Show sample of valid citations
    console.log('\n=== Sample Valid Citations ===\n');
    let shown = 0;
    for (const citation of result.citations) {
      if (shown >= 3) break;
      const sourceText = responseTextMap.get(citation.response_id) || '';
      if (validateSnippetIsVerbatim(citation.snippet, sourceText)) {
        console.log(`${shown + 1}. Response ID: ${citation.response_id}`);
        console.log(`   Snippet: "${citation.snippet.slice(0, 100)}..."`);
        console.log(`   Source contains snippet: YES`);
        console.log('');
        shown++;
      }
    }

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
