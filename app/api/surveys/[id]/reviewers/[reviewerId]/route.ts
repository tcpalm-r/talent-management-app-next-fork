/**
 * /api/surveys/[id]/reviewers/[reviewerId]
 *
 * PATCH: Update reviewer details (name, email, status)
 * DELETE: Remove reviewer from survey
 *
 * Replaces:
 * - removeReviewer() in Feedback360Dashboard
 * - Inline reviewer updates in Feedback360Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEASponsorMapping } from '@/lib/ea-sponsor-config';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/surveys/[id]/reviewers/[reviewerId]
 * Update reviewer details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; reviewerId: string } }
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
    const reviewerId = params.reviewerId;

    // Parse request body
    const body = await request.json();

    // Check if survey exists and user has permission
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

    // Check permission - admins, SLT, survey creators, and delegated EAs
    const eaSponsorMapping = getEASponsorMapping(profile.email);
    // EA delegation: can manage in_progress surveys where their SLT is sponsor
    // BUT exclude surveys where the EA themselves is the subject
    const isDelegatedEA = eaSponsorMapping &&
      survey.status === 'in_progress' &&
      survey.created_by_email?.toLowerCase() === eaSponsorMapping.sltEmail.toLowerCase() &&
      survey.employee_id !== profile.id;

    const canModify =
      user.app_role === 'admin' ||
      user.app_role === 'slt' ||  // HIGH PRIORITY FIX: SLT has elevated access
      survey.created_by === profile.id ||
      isDelegatedEA; // EA delegation for in_progress surveys

    if (!canModify) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this survey' },
        { status: 403 }
      );
    }

    // Build update object - only allow specific fields
    const allowedFields = ['reviewer_name', 'reviewer_email', 'relationship', 'status'];
    const updates: any = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update reviewer
    const { data: updatedReviewer, error: updateError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .update(updates)
      .eq('id', reviewerId)
      .eq('survey_id', surveyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating reviewer:', updateError);
      return NextResponse.json(
        { error: 'Failed to update reviewer', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviewer: updatedReviewer,
      message: 'Reviewer updated successfully',
    });

  } catch (error) {
    console.error('Error in PATCH /api/surveys/[id]/reviewers/[reviewerId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/surveys/[id]/reviewers/[reviewerId]
 * Remove reviewer from survey
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; reviewerId: string } }
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
    const reviewerId = params.reviewerId;

    // Check if survey exists and user has permission
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

    // Check permission - admins, SLT, survey creators, and delegated EAs
    const eaSponsorMapping = getEASponsorMapping(profile.email);
    // EA delegation: can manage in_progress surveys where their SLT is sponsor
    // BUT exclude surveys where the EA themselves is the subject
    const isDelegatedEA = eaSponsorMapping &&
      survey.status === 'in_progress' &&
      survey.created_by_email?.toLowerCase() === eaSponsorMapping.sltEmail.toLowerCase() &&
      survey.employee_id !== profile.id;

    const canModify =
      user.app_role === 'admin' ||
      user.app_role === 'slt' ||  // HIGH PRIORITY FIX: SLT has elevated access
      survey.created_by === profile.id ||
      isDelegatedEA; // EA delegation for in_progress surveys

    if (!canModify) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this survey' },
        { status: 403 }
      );
    }

    // Check current reviewer count before deletion
    const { data: currentReviewers, error: verifyCountError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('id')
      .eq('survey_id', surveyId);

    if (verifyCountError) {
      console.error('Error fetching reviewer count:', verifyCountError);
      return NextResponse.json(
        { error: 'Failed to verify reviewer count', details: verifyCountError.message },
        { status: 500 }
      );
    }

    const currentReviewerCount = currentReviewers?.length || 0;
    const MINIMUM_REVIEWERS = 4;

    // Prevent removal if it would drop below minimum
    if (currentReviewerCount <= MINIMUM_REVIEWERS) {
      return NextResponse.json(
        { error: `Cannot remove reviewer. A minimum of ${MINIMUM_REVIEWERS} reviewers is required.` },
        { status: 400 }
      );
    }

    // Delete reviewer
    const { error: deleteError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .delete()
      .eq('id', reviewerId)
      .eq('survey_id', surveyId);

    if (deleteError) {
      console.error('Error deleting reviewer:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete reviewer', details: deleteError.message },
        { status: 500 }
      );
    }

    // Get updated reviewer count and recalculate survey status
    const { data: remainingReviewers, error: countError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('status')
      .eq('survey_id', surveyId);

    if (countError) {
      console.error('Error fetching reviewer count:', countError);
    }

    const totalReviewers = remainingReviewers?.length || 0;
    const completedReviewers = remainingReviewers?.filter(r => r.status === 'completed').length || 0;

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
      success: true,
      surveyStatus: newSurveyStatus,
      message: 'Reviewer removed successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/surveys/[id]/reviewers/[reviewerId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
