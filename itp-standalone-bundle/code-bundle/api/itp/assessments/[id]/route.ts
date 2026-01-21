/* @ts-nocheck - ITP tables not yet in generated Supabase types */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/itp/assessments/[id]
 *
 * Returns a single ITP assessment with its responses.
 *
 * Authorization:
 * - User can view their own assessments
 * - Manager can view direct reports' assessments
 * - Admin can view all assessments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;

    // Fetch assessment with responses
    const { data: assessment, error } = await supabaseAdmin
      .from('itp_assessments')
      .select(`
        *,
        responses:itp_responses(*)
      `)
      .eq('id', assessmentId)
      .single();

    if (error || !assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isOwnAssessment = user.id === assessment.employee_id;
    const isAdmin = user.app_role === 'admin';

    // Check if user is manager of the employee
    let isManager = false;
    if (!isOwnAssessment && !isAdmin) {
      const { data: employee } = await supabaseAdmin
        .from('user_profiles')
        .select('manager_id, manager_email')
        .eq('id', assessment.employee_id)
        .single();

      if (employee) {
        isManager =
          employee.manager_id === user.id ||
          employee.manager_email === user.email;
      }
    }

    if (!isOwnAssessment && !isAdmin && !isManager) {
      return NextResponse.json(
        { error: 'Not authorized to view this assessment' },
        { status: 403 }
      );
    }

    // Transform responses to use behaviorKey
    const transformedResponses = assessment.responses?.map((r: any) => ({
      ...r,
      behaviorKey: r.behavior_key,
    })) || [];

    return NextResponse.json({
      success: true,
      assessment: {
        ...assessment,
        responses: transformedResponses,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching ITP assessment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ITP assessment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/itp/assessments/[id]
 *
 * Deletes a draft ITP assessment.
 * Only draft assessments can be deleted.
 *
 * Authorization:
 * - User can delete their own draft assessments
 * - Admin can delete any draft assessment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;

    // Fetch assessment to check ownership and status
    const { data: assessment, error: fetchError } = await supabaseAdmin
      .from('itp_assessments')
      .select('employee_id, status')
      .eq('id', assessmentId)
      .single();

    if (fetchError || !assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isOwnAssessment = user.id === assessment.employee_id;
    const isAdmin = user.app_role === 'admin';

    if (!isOwnAssessment && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to delete this assessment' },
        { status: 403 }
      );
    }

    // Only drafts can be deleted
    if (assessment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft assessments can be deleted' },
        { status: 400 }
      );
    }

    // Delete the assessment (responses will cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('itp_assessments')
      .delete()
      .eq('id', assessmentId);

    if (deleteError) {
      console.error('[API] Error deleting ITP assessment:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment deleted successfully',
    });
  } catch (error) {
    console.error('[API] Error deleting ITP assessment:', error);
    return NextResponse.json(
      { error: 'Failed to delete ITP assessment' },
      { status: 500 }
    );
  }
}
