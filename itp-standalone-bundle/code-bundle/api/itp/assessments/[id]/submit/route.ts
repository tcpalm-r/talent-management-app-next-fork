/* @ts-nocheck - ITP tables not yet in generated Supabase types */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAllBehaviorKeys } from '@/lib/itpBehaviors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/itp/assessments/[id]/submit
 *
 * Submits an ITP assessment, changing status from 'draft' to 'submitted'.
 * Validates that all 12 behaviors have been rated.
 *
 * Authorization:
 * - User can only submit their own assessments
 * - Admin can submit any assessment
 */
export async function POST(
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
    const { data: assessment, error: fetchError } = await supabaseAdmin
      .from('itp_assessments')
      .select(`
        *,
        responses:itp_responses(behavior_key, rating)
      `)
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
        { error: 'Not authorized to submit this assessment' },
        { status: 403 }
      );
    }

    // Only drafts can be submitted
    if (assessment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Assessment has already been submitted' },
        { status: 400 }
      );
    }

    // Validate all behaviors are rated
    const allBehaviorKeys = getAllBehaviorKeys();
    const ratedBehaviorKeys = new Set(
      assessment.responses?.map((r: any) => r.behavior_key) || []
    );

    const missingBehaviors = allBehaviorKeys.filter(
      key => !ratedBehaviorKeys.has(key)
    );

    if (missingBehaviors.length > 0) {
      return NextResponse.json(
        {
          error: 'All behaviors must be rated before submitting',
          missingBehaviors,
          ratedCount: ratedBehaviorKeys.size,
          requiredCount: allBehaviorKeys.length,
        },
        { status: 400 }
      );
    }

    // Archive any previously submitted assessments for this employee
    const { error: archiveError } = await supabaseAdmin
      .from('itp_assessments')
      .update({ status: 'archived' })
      .eq('employee_id', assessment.employee_id)
      .eq('status', 'submitted');

    if (archiveError) {
      console.error('[API] Error archiving old assessments:', archiveError);
      // Continue anyway - not critical
    }

    // Submit the assessment
    const { data: updatedAssessment, error: updateError } = await supabaseAdmin
      .from('itp_assessments')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .select(`
        *,
        responses:itp_responses(*)
      `)
      .single();

    if (updateError) {
      console.error('[API] Error submitting ITP assessment:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment submitted successfully',
      assessment: updatedAssessment,
    });
  } catch (error) {
    console.error('[API] Error submitting ITP assessment:', error);
    return NextResponse.json(
      { error: 'Failed to submit assessment' },
      { status: 500 }
    );
  }
}
