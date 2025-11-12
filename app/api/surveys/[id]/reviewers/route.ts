/**
 * /api/surveys/[id]/reviewers
 *
 * GET: Load all reviewers for a survey
 * POST: Add a new reviewer to a survey
 *
 * Replaces:
 * - loadReviewers() in Feedback360Dashboard
 * - addReviewer() in Feedback360Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/surveys/[id]/reviewers
 * Load all reviewers for a survey
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const surveyId = params.id;

    // Check if survey exists and user has access
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Load reviewers
    const { data: reviewers, error: reviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: true });

    if (reviewersError) {
      console.error('Error loading reviewers:', reviewersError);
      return NextResponse.json(
        { error: 'Failed to load reviewers', details: reviewersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviewers: reviewers || [],
      count: reviewers?.length || 0,
    });

  } catch (error) {
    console.error('Error in GET /api/surveys/[id]/reviewers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/surveys/[id]/reviewers
 * Add a new reviewer to a survey
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const surveyId = params.id;

    // Parse request body
    const body = await request.json();
    const { reviewer_name, reviewer_email, relationship } = body;

    // Validate required fields
    if (!reviewer_name || !reviewer_email || !relationship) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewer_name, reviewer_email, relationship' },
        { status: 400 }
      );
    }

    // Check if survey exists and user has permission to modify
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Check permission to modify survey
    const canModify =
      user.app_role === 'admin' ||
      survey.created_by === profile.id;

    if (!canModify) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this survey' },
        { status: 403 }
      );
    }

    // Generate access token for reviewer
    const accessToken = uuidv4();

    // Insert reviewer
    const { data: newReviewer, error: insertError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .insert({
        survey_id: surveyId,
        reviewer_name,
        reviewer_email,
        relationship,
        status: 'pending',
        access_token: accessToken,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding reviewer:', insertError);
      return NextResponse.json(
        { error: 'Failed to add reviewer', details: insertError.message },
        { status: 500 }
      );
    }

    // Get updated reviewer count and statuses
    const { data: allReviewers, error: countError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('status')
      .eq('survey_id', surveyId);

    if (countError) {
      console.error('Error fetching reviewer count:', countError);
    }

    // Calculate new survey status based on reviewers
    const totalReviewers = allReviewers?.length || 0;
    const completedReviewers = allReviewers?.filter(r => r.status === 'completed').length || 0;

    let newSurveyStatus = survey.status;
    if (totalReviewers === 0) {
      newSurveyStatus = 'draft';
    } else if (completedReviewers === 0) {
      newSurveyStatus = 'in_progress';
    } else if (completedReviewers === totalReviewers) {
      newSurveyStatus = 'completed';
    } else {
      newSurveyStatus = 'in_progress';
    }

    // Update survey status if it changed
    if (newSurveyStatus !== survey.status) {
      await supabaseAdmin
        .from('feedback_360_surveys')
        .update({ status: newSurveyStatus })
        .eq('id', surveyId);
    }

    return NextResponse.json({
      reviewer: newReviewer,
      surveyStatus: newSurveyStatus,
      message: 'Reviewer added successfully',
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/reviewers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
