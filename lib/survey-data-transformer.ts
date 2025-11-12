/**
 * Utility functions for transforming API survey data into UI-expected formats
 *
 * Problem: After refactoring to API routes, the API returns clean, normalized data structures
 * (e.g., separate arrays for questions, reviewers, responses with ID references).
 * However, many UI components expect denormalized/joined data where each response
 * has the full question and reviewer objects nested in it.
 *
 * These utilities handle the data transformation/joining in a consistent way.
 */

export interface SurveyQuestion {
  id: string;
  question_id: string;
  question_order: number;
  question?: {
    id: string;
    question_text: string;
    category: string;
  };
}

export interface SurveyReviewer {
  id: string;
  status: string;
  reviewer_name: string;
  reviewer_email: string;
  relationship: string;
  access_token: string;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  reviewer_email: string;
  question_id: string;
  response_text: string | null;
  rating: number | null;
  created_at: string;
}

export interface EnrichedSurveyResponse extends SurveyResponse {
  question: {
    id: string;
    question_text: string;
    category: string;
  } | null;
  reviewer: SurveyReviewer | null;
}

export interface SurveyDetailsAPIResponse {
  survey: any;
  employee: any;
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
}

/**
 * Enriches survey responses with full question and reviewer data
 * Performs a "join" operation between responses, questions, and reviewers
 *
 * @param responses - Array of responses with question_id and reviewer_email references
 * @param questions - Array of survey questions with nested question details
 * @param reviewers - Array of reviewers with full details
 * @returns Array of responses with nested question and reviewer objects
 */
export function enrichSurveyResponses(
  responses: SurveyResponse[],
  questions: SurveyQuestion[],
  reviewers: SurveyReviewer[]
): EnrichedSurveyResponse[] {
  // Create lookup maps for O(1) access
  const questionMap = new Map<string, any>();
  questions.forEach((sq) => {
    if (sq.question) {
      questionMap.set(sq.question_id, sq.question);
    }
  });

  const reviewerMap = new Map<string, SurveyReviewer>();
  reviewers.forEach((r) => {
    reviewerMap.set(r.reviewer_email, r);
  });

  // Enrich each response with full question and reviewer data
  return responses.map((response) => ({
    ...response,
    question: questionMap.get(response.question_id) || null,
    reviewer: reviewerMap.get(response.reviewer_email) || null,
  }));
}

/**
 * Transforms the API response from /api/surveys/[id]/details into the format
 * expected by UI components (e.g., raw data modal, review displays)
 *
 * @param apiData - Response from /api/surveys/[id]/details
 * @returns Transformed data with enriched responses and flattened structure
 */
export function transformSurveyDetailsForUI(apiData: SurveyDetailsAPIResponse) {
  const enrichedResponses = enrichSurveyResponses(
    apiData.responses || [],
    apiData.questions || [],
    apiData.survey.reviewers || []
  );

  // Return flattened structure with survey properties at top level
  return {
    ...apiData.survey,
    employee: apiData.employee,
    questions: apiData.questions,
    responses: enrichedResponses,
  };
}
