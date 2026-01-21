/* @ts-nocheck - ITP tables not yet in generated Supabase types */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAllBehaviorKeys } from '@/lib/itpBehaviors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/itp/assessments/[id]/save-draft
 *
 * Auto-saves draft responses for an ITP assessment.
 * Uses upsert to create or update responses.
 *
 * Body:
 * - responses: Array of { behaviorKey: string, rating: number }
 *
 * Authorization:
 * - User can only save their own draft assessments
 * - Admin can save any draft assessment
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
    const body = await request.json();
    const { responses } = body;

    if (!responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'responses array is required' },
        { status: 400 }
      );
    }

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
        { error: 'Not authorized to edit this assessment' },
        { status: 403 }
      );
    }

    // Only drafts can be edited
    if (assessment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot edit a submitted assessment' },
        { status: 400 }
      );
    }

    // Validate behavior keys
    const validBehaviorKeys = getAllBehaviorKeys();
    const invalidResponses = responses.filter(
      (r: any) => !validBehaviorKeys.includes(r.behaviorKey)
    );

    if (invalidResponses.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid behavior keys',
          invalidKeys: invalidResponses.map((r: any) => r.behaviorKey),
        },
        { status: 400 }
      );
    }

    // Validate ratings (1-5)
    const invalidRatings = responses.filter(
      (r: any) => typeof r.rating !== 'number' || r.rating < 1 || r.rating > 5
    );

    if (invalidRatings.length > 0) {
      return NextResponse.json(
        { error: 'Ratings must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Upsert responses
    const upsertData = responses.map((r: any) => ({
      assessment_id: assessmentId,
      behavior_key: r.behaviorKey,
      rating: Math.round(r.rating), // Ensure integer
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('itp_responses')
      .upsert(upsertData, {
        onConflict: 'assessment_id,behavior_key',
      });

    if (upsertError) {
      console.error('[API] Error saving ITP responses:', upsertError);
      throw upsertError;
    }

    // Update assessment updated_at timestamp
    await supabaseAdmin
      .from('itp_assessments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', assessmentId);

    return NextResponse.json({
      success: true,
      message: 'Draft saved successfully',
      savedCount: responses.length,
    });
  } catch (error) {
    console.error('[API] Error saving ITP draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}
