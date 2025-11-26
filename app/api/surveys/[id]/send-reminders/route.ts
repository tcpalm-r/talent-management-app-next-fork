/**
 * POST /api/surveys/[id]/send-reminders
 *
 * Send reminder emails to all incomplete reviewers.
 * Replaces sendReminders() in Feedback360Dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';
import { getValidatedAppUrl } from '@/lib/url-validator';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Check if survey exists
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('*, employee:user_profiles!employee_id(full_name, email)')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Check permission - admins, SLT (elevated access), and survey creators
    const canSend =
      user.app_role === 'admin' ||
      user.app_role === 'slt' || // SLT can send reminders for any survey
      survey.created_by === profile.id; // Creators can send reminders for their own surveys

    if (!canSend) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to send reminders for this survey' },
        { status: 403 }
      );
    }

    // Get incomplete reviewers
    const { data: incompleteReviewers, error: reviewersError } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .select('*')
      .eq('survey_id', surveyId)
      .neq('status', 'completed');

    if (reviewersError) {
      console.error('Error fetching incomplete reviewers:', reviewersError);
      return NextResponse.json(
        { error: 'Failed to fetch reviewers', details: reviewersError.message },
        { status: 500 }
      );
    }

    if (!incompleteReviewers || incompleteReviewers.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No incomplete reviewers to send reminders to',
      });
    }

    // Send reminder emails
    const results = [];
    const errors = [];

    // Get validated base URL
    let baseUrl: string;
    try {
      baseUrl = getValidatedAppUrl('NEXT_PUBLIC_APP_URL');
    } catch (error: any) {
      console.error('URL validation error:', error.message);
      return NextResponse.json(
        { error: 'Application URL is not configured correctly', details: error.message },
        { status: 500 }
      );
    }

    for (const reviewer of incompleteReviewers) {
      try {
        const surveyUrl = `${baseUrl}/survey/complete/${reviewer.access_token}`;

        const emailResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'feedback@aiintranet.sonance.com',
          to: reviewer.reviewer_email,
          subject: `Reminder: Please complete your 360° feedback for ${(survey.employee as any)?.full_name || 'your colleague'}`,
          html: `
            <p>Hi ${reviewer.reviewer_name},</p>

            <p>This is a friendly reminder that your feedback for <strong>${(survey.employee as any)?.full_name || 'your colleague'}</strong> is still pending.</p>

            <p>Your input is valuable and we'd appreciate if you could complete the survey at your earliest convenience.</p>

            <p><a href="${surveyUrl}" style="display: inline-block; background: #6366f1; border: 2px solid #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Complete Survey</a></p>

            ${survey.due_date ? `<p><em>Due date: ${new Date(survey.due_date).toLocaleDateString()}</em></p>` : ''}

            <p>Thank you for your time!</p>
          `,
        });

        // Update reviewer tracking fields
        await supabaseAdmin
          .from('feedback_360_survey_reviewers')
          .update({
            last_reminder_at: new Date().toISOString(),
            reminder_count: (reviewer.reminder_count || 0) + 1,
          })
          .eq('id', reviewer.id);

        results.push({
          email: reviewer.reviewer_email,
          success: true,
          id: emailResult.data?.id,
        });
      } catch (error: any) {
        console.error(`Error sending reminder to ${reviewer.reviewer_email}:`, error);
        errors.push({
          email: reviewer.reviewer_email,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sent ${results.length} reminder(s) successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/send-reminders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
