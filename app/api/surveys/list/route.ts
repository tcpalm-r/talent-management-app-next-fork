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
        // Created by this leader
        if (survey.created_by === profile.id) return true;

        // Subject is this leader
        if (survey.employee_id === profile.id) return true;

        // Subject is a direct report
        if (directReportIds.includes(survey.employee_id)) return true;

        // This leader is a reviewer
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
        // Created by this user
        if (survey.created_by === profile.id) return true;

        // Subject is this user (only if finalized)
        if (survey.employee_id === profile.id && survey.status === 'finalized') {
          return true;
        }

        // This user is a reviewer
        const isReviewer = survey.reviewers?.some(
          (r: any) => r.reviewer_email === profile.email
        );
        if (isReviewer) return true;

        return false;
      });
    }

    return NextResponse.json({
      surveys: filteredSurveys,
      count: filteredSurveys.length,
      role: user.app_role,
    });

  } catch (error) {
    console.error('Error in /api/surveys/list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
