/* @ts-nocheck - ITP tables not yet in generated Supabase types */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { ITPAssessment } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/itp/assessments
 *
 * Returns ITP assessments for the specified employee.
 * Query params:
 * - employee_id (required): The employee to get assessments for
 *
 * Authorization:
 * - User can view their own assessments
 * - Manager can view direct reports' assessments
 * - Admin can view all assessments
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    // Check authorization
    const isOwnAssessment = user.id === employeeId;
    const isAdmin = user.app_role === 'admin';

    // Check if user is manager of the employee
    let isManager = false;
    if (!isOwnAssessment && !isAdmin) {
      const { data: employee } = await supabaseAdmin
        .from('user_profiles')
        .select('manager_id, manager_email')
        .eq('id', employeeId)
        .single();

      if (employee) {
        isManager =
          employee.manager_id === user.id ||
          employee.manager_email === user.email;
      }
    }

    if (!isOwnAssessment && !isAdmin && !isManager) {
      return NextResponse.json(
        { error: 'Not authorized to view these assessments' },
        { status: 403 }
      );
    }

    // Fetch assessments with responses
    const { data: assessments, error } = await supabaseAdmin
      .from('itp_assessments')
      .select(`
        *,
        responses:itp_responses(*)
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Error fetching ITP assessments:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      assessments: assessments || [],
    });
  } catch (error) {
    console.error('[API] Error fetching ITP assessments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ITP assessments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/itp/assessments
 *
 * Creates a new ITP assessment in draft status.
 * Body:
 * - employee_id (required): The employee taking the assessment
 *
 * Authorization:
 * - User can only create assessments for themselves
 * - Admin can create assessments for anyone
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    // Check authorization - user can only create for themselves unless admin
    const isOwnAssessment = user.id === employee_id;
    const isAdmin = user.app_role === 'admin';

    if (!isOwnAssessment && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to create assessment for this employee' },
        { status: 403 }
      );
    }

    // Check if there's already a draft assessment
    const { data: existingDraft } = await supabaseAdmin
      .from('itp_assessments')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('status', 'draft')
      .single();

    if (existingDraft) {
      return NextResponse.json(
        { error: 'A draft assessment already exists', existingId: existingDraft.id },
        { status: 409 }
      );
    }

    // Create new assessment
    const { data: assessment, error } = await supabaseAdmin
      .from('itp_assessments')
      .insert({
        employee_id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error creating ITP assessment:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      assessment,
    });
  } catch (error) {
    console.error('[API] Error creating ITP assessment:', error);
    return NextResponse.json(
      { error: 'Failed to create ITP assessment' },
      { status: 500 }
    );
  }
}
