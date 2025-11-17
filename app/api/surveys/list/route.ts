/**
 * GET /api/surveys/list
 *
 * Fetch all 360 surveys with role-based filtering and query parameters.
 * Replaces all loadSurveys() calls in Feedback360Dashboard.
 *
 * Query Parameters:
 * - createdBy: Filter by creator ID
 * - employeeId: Filter by subject employee ID
 * - status: Filter by status (draft|in_progress|completed|finalized|needs_review)
 *
 * Role-Based Access:
 * - Admin: See all surveys
 * - Leader: See own surveys, direct report surveys, surveys where they're reviewer/subject
 * - User: See own surveys and surveys where they're the subject (finalized only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SurveyListResponseSchema, validateSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, profile } = authData;
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const createdBy = searchParams.get('createdBy');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    // Base query - fetch all surveys with reviewers
    let query = supabaseAdmin
      .from('feedback_360_surveys')
      .select(`
        *,
        reviewers:feedback_360_survey_reviewers(
          id,
          status,
          reviewer_email,
          access_token
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (createdBy) {
      query = query.eq('created_by', createdBy);
    }
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: allSurveys, error } = await query;

    if (error) {
      console.error('Error loading surveys:', error);
      return NextResponse.json(
        { error: 'Failed to load surveys', details: error.message },
        { status: 500 }
      );
    }

    // Apply role-based filtering
    let filteredSurveys = allSurveys || [];

    if (user.app_role === 'admin') {
      // Admins see everything - no filtering needed
      filteredSurveys = allSurveys || [];
    } else if (user.app_role === 'leader') {
      // Leaders see:
      // 1. Surveys they created
      // 2. Surveys for their direct reports (if we have manager_id relationship)
      // 3. Surveys where they're the subject
      // 4. Surveys where they're a reviewer

      // Get direct report IDs (if available)
      const { data: directReports } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('manager_id', profile.id);

      const directReportIds = directReports?.map(dr => dr.id) || [];

      filteredSurveys = (allSurveys || []).filter((survey: any) => {
        // Created by this leader (check both ID and email for legacy support)
        const isCreator = survey.created_by === profile.id || survey.created_by === profile.email;
        if (isCreator) return true;

        // For non-creator scenarios, exclude draft surveys
        if (survey.status === 'draft') return false;

        // Subject is this leader
        if (survey.employee_id === profile.id) return true;

        // Subject is a direct report
        if (directReportIds.includes(survey.employee_id)) return true;

        // This leader is a reviewer (only for active/completed/finalized surveys)
        const isReviewer = survey.reviewers?.some(
          (r: any) => r.reviewer_email === profile.email
        );
        if (isReviewer) return true;

        return false;
      });
    } else {
      // Regular users see:
      // 1. Surveys they created
      // 2. Surveys where they're the subject (finalized only)
      // 3. Surveys where they're a reviewer

      filteredSurveys = (allSurveys || []).filter((survey: any) => {
        // Check if user is creator, subject, or reviewer
        const isCreator = survey.created_by === profile.id || survey.created_by === profile.email;
        const isSubject = survey.employee_id === profile.id;
        const isReviewer = survey.reviewers?.some(
          (r: any) => r.reviewer_email === profile.email
        );

        // User can see surveys they created (including drafts)
        if (isCreator) return true;

        // Non-creators cannot see draft surveys
        if (survey.status === 'draft') return false;

        // Subject can see their own survey if completed or finalized
        if (isSubject && (survey.status === 'completed' || survey.status === 'finalized')) {
          return true;
        }

        // Reviewers can see surveys they're assigned to (excluding drafts)
        if (isReviewer) return true;

        return false;
      });
    }

    // Prepare response
    const responseData = {
      surveys: filteredSurveys,
      count: filteredSurveys.length,
      role: user.app_role,
    };

    // Validate response before sending (observability only - doesn't block)
    const validation = validateSchema(
      SurveyListResponseSchema,
      responseData,
      'GET /api/surveys/list'
    );

    if (!validation.success) {
      // Log validation errors but still return data (passthrough mode)
      console.warn('[API /surveys/list] Response validation failed:', {
        errors: validation.error?.errors?.slice(0, 5) || [], // First 5 errors
        surveyCount: filteredSurveys.length,
      });
    } else {
      // Validation passed - log success in dev mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API /surveys/list] ✓ Response validation passed (${filteredSurveys.length} surveys)`);
      }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in /api/surveys/list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
