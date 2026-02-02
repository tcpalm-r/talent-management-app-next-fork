/**
 * GET /api/surveys/list
 *
 * Fetch all 360 surveys with role-based filtering and query parameters.
 * Replaces all loadSurveys() calls in Feedback360Dashboard.
 *
 * Query Parameters:
 * - organization_id: Organization scope (recommended)
 * - createdBy: Filter by creator ID
 * - employeeId: Filter by subject employee ID
 * - status: Filter by status (draft|in_progress|completed|finalized|needs_review)
 * - page: Page number (1-based, optional)
 * - pageSize: Page size (optional)
 * - limit/offset: Alternative pagination parameters (optional)
 *
 * Role-Based Access:
 * - Admin: See all surveys
 * - SLT: See own surveys (all statuses), all in_progress surveys, all finalized surveys, surveys where they're reviewer, surveys where they're subject (finalized only)
 * - Leader: See own surveys (all statuses), direct report surveys, surveys where they're reviewer, surveys where they're subject (finalized only)
 * - User: See own surveys (all statuses), surveys where they're reviewer, surveys where they're subject (finalized only)
 * - EA (User with delegation): Also see in_progress surveys where their assigned SLT is the sponsor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SurveyListResponseSchema, validateSchema } from '@/lib/api-schemas';
import { getEASponsorMapping } from '@/lib/ea-sponsor-config';

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
    const organizationId = searchParams.get('organization_id');
    const createdBy = searchParams.get('createdBy');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize') || searchParams.get('page_size');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const parsedPage = pageParam ? parseInt(pageParam, 10) : null;
    const parsedPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : null;
    const parsedOffset = offsetParam ? parseInt(offsetParam, 10) : null;

    if (
      (parsedPage !== null && (Number.isNaN(parsedPage) || parsedPage < 1)) ||
      (parsedPageSize !== null && (Number.isNaN(parsedPageSize) || parsedPageSize < 1)) ||
      (parsedLimit !== null && (Number.isNaN(parsedLimit) || parsedLimit < 1)) ||
      (parsedOffset !== null && (Number.isNaN(parsedOffset) || parsedOffset < 0))
    ) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const shouldPaginate =
      parsedPage !== null ||
      parsedPageSize !== null ||
      parsedLimit !== null ||
      parsedOffset !== null;

    const defaultPageSize = 50;
    const pageSize = parsedPageSize ?? parsedLimit ?? (shouldPaginate ? defaultPageSize : null);
    const page = parsedOffset !== null
      ? (parsedPage ?? Math.floor(parsedOffset / (pageSize || 1)) + 1)
      : (parsedPage ?? 1);
    const rangeStart = shouldPaginate
      ? (parsedOffset !== null ? parsedOffset : (page - 1) * (pageSize || defaultPageSize))
      : null;
    const rangeEnd = shouldPaginate
      ? (rangeStart || 0) + (pageSize || defaultPageSize) - 1
      : null;

    const baseSurveyIdQuery = () => {
      let query = supabaseAdmin
        .from('feedback_360_surveys')
        .select('id');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      return query;
    };

    const fetchSurveyIds = async (query: ReturnType<typeof baseSurveyIdQuery>, context: string) => {
      const { data, error } = await query;
      if (error) {
        console.error(`Error loading surveys for ${context}:`, error);
        throw error;
      }
      return data?.map(row => row.id) || [];
    };

    let allowedSurveyIds: string[] | null = null;
    const role = user.app_role || 'user';

    if (role !== 'admin') {
      const allowedIds = new Set<string>();

      const creatorIds = await fetchSurveyIds(
        baseSurveyIdQuery().eq('created_by', profile.id),
        'creator-id'
      );
      creatorIds.forEach(id => allowedIds.add(id));

      if (profile.email) {
        const creatorEmailIds = await fetchSurveyIds(
          baseSurveyIdQuery().ilike('created_by_email', profile.email),
          'creator-email'
        );
        creatorEmailIds.forEach(id => allowedIds.add(id));
      }

      // Subject finalized surveys - try ID match first
      // Note: released_to_subject_at filtering is done client-side after migration
      const subjectFinalIds = await fetchSurveyIds(
        baseSurveyIdQuery()
          .eq('employee_id', profile.id)
          .eq('status', 'finalized'),
        'subject-finalized'
      );
      subjectFinalIds.forEach(id => allowedIds.add(id));

      // Fallback: Also find finalized surveys by email match (handles OAuth ID mismatches)
      if (profile.email) {
        // Find user_profiles ID by email, then find surveys with that employee_id
        const { data: emailMatchProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .ilike('email', profile.email)
          .neq('id', profile.id) // Don't re-query if same ID
          .maybeSingle();

        if (emailMatchProfile?.id) {
          const subjectFinalByEmailIds = await fetchSurveyIds(
            baseSurveyIdQuery()
              .eq('employee_id', emailMatchProfile.id)
              .eq('status', 'finalized'),
            'subject-finalized-by-email'
          );
          subjectFinalByEmailIds.forEach(id => allowedIds.add(id));
        }
      }

      if (role === 'slt') {
        const inProgressIds = await fetchSurveyIds(
          baseSurveyIdQuery().eq('status', 'in_progress'),
          'slt-in-progress'
        );
        inProgressIds.forEach(id => allowedIds.add(id));

        // SLT can see all finalized surveys
        const finalizedIds = await fetchSurveyIds(
          baseSurveyIdQuery().eq('status', 'finalized'),
          'slt-finalized'
        );
        finalizedIds.forEach(id => allowedIds.add(id));
      }

      if (role === 'leader') {
        const { data: directReports, error: directReportsError } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('manager_id', profile.id);

        if (directReportsError) {
          console.error('Error loading direct reports:', directReportsError);
          return NextResponse.json(
            { error: 'Failed to load direct reports', details: directReportsError.message },
            { status: 500 }
          );
        }

        const directReportIds = directReports?.map(dr => dr.id) || [];
        if (directReportIds.length > 0) {
          const directReportSurveyIds = await fetchSurveyIds(
            baseSurveyIdQuery()
              .in('employee_id', directReportIds)
              .neq('status', 'draft'),
            'direct-reports'
          );
          directReportSurveyIds.forEach(id => allowedIds.add(id));
        }
      }

      if (profile.email) {
        const { data: reviewerRows, error: reviewerError } = await supabaseAdmin
          .from('feedback_360_survey_reviewers')
          .select('survey_id')
          .eq('reviewer_email', profile.email);

        if (reviewerError) {
          console.error('Error loading reviewer surveys:', reviewerError);
          return NextResponse.json(
            { error: 'Failed to load reviewer surveys', details: reviewerError.message },
            { status: 500 }
          );
        }

        const reviewerSurveyIds = reviewerRows?.map(row => row.survey_id) || [];
        if (reviewerSurveyIds.length > 0) {
          const reviewerSurveyIdsFiltered = await fetchSurveyIds(
            baseSurveyIdQuery()
              .in('id', reviewerSurveyIds)
              .neq('status', 'draft'),
            'reviewer-surveys'
          );
          reviewerSurveyIdsFiltered.forEach(id => allowedIds.add(id));
        }
      }

      if (role === 'user') {
        const eaSponsorMapping = getEASponsorMapping(profile.email);
        const delegatedSltEmailLower = eaSponsorMapping?.sltEmail?.toLowerCase();

        if (delegatedSltEmailLower) {
          const delegatedSurveyIds = await fetchSurveyIds(
            baseSurveyIdQuery()
              .eq('status', 'in_progress')
              .ilike('created_by_email', delegatedSltEmailLower)
              .neq('employee_id', profile.id),
            'ea-delegation'
          );
          delegatedSurveyIds.forEach(id => allowedIds.add(id));
        }
      }

      allowedSurveyIds = Array.from(allowedIds);
    }

    // Base query - fetch surveys with reviewers
    let query = supabaseAdmin
      .from('feedback_360_surveys')
      .select(`
        *,
        reviewers:feedback_360_survey_reviewers(
          id,
          status,
          reviewer_email,
          access_token,
          relationship,
          assigned_by_sponsor
        )
      `, shouldPaginate ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (allowedSurveyIds) {
      if (allowedSurveyIds.length === 0) {
        return NextResponse.json({
          surveys: [],
          count: 0,
          role: user.app_role,
          ...(shouldPaginate
            ? {
                page,
                pageSize,
                totalCount: 0,
                pageCount: 0,
              }
            : {}),
        });
      }
      query = query.in('id', allowedSurveyIds);
    }

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

    if (shouldPaginate && rangeStart !== null && rangeEnd !== null) {
      query = query.range(rangeStart, rangeEnd);
    }

    const { data: filteredSurveys, error, count } = await query;

    if (error) {
      console.error('Error loading surveys:', error);
      return NextResponse.json(
        { error: 'Failed to load surveys', details: error.message },
        { status: 500 }
      );
    }

    const resolvedSurveys = filteredSurveys || [];

    // Fetch employee names for survey subjects
    const employeeIds = [...new Set(resolvedSurveys.map((s: any) => s.employee_id).filter(Boolean))];
    let employeeNames: Record<string, string> = {};

    if (employeeIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name')
        .in('id', employeeIds);

      employeeNames = (employees || []).reduce((acc: Record<string, string>, emp: any) => {
        acc[emp.id] = emp.full_name;
        return acc;
      }, {});
    }

    // Add employee_name to each survey
    const surveysWithNames = resolvedSurveys.map((survey: any) => ({
      ...survey,
      employee_name: employeeNames[survey.employee_id] || null,
    }));

    // Prepare response
    const totalCount = shouldPaginate ? (count ?? surveysWithNames.length) : surveysWithNames.length;
    const responseData = {
      surveys: surveysWithNames,
      count: surveysWithNames.length,
      role: user.app_role,
      ...(shouldPaginate
        ? {
            page,
            pageSize,
            totalCount,
            pageCount: pageSize ? Math.ceil(totalCount / pageSize) : 1,
          }
        : {}),
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
        surveyCount: resolvedSurveys.length,
      });
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
