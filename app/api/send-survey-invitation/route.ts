import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase client with service role for server-side operations
// Service role bypasses RLS policies
const getSupabaseClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createClient(url, serviceRoleKey || anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { surveyId, reviewerId, isReminder } = body;

    if (!surveyId || !reviewerId) {
      return NextResponse.json(
        { error: 'Missing surveyId or reviewerId' },
        { status: 400 }
      );
    }

    // Get Supabase client with service role
    const supabase = getSupabaseClient();

    // Fetch survey and reviewer details
    const [surveyResult, reviewerResult] = await Promise.all([
      supabase
        .from('feedback_360_surveys')
        .select('*')
        .eq('id', surveyId)
        .single(),
      supabase
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('id', reviewerId)
        .single(),
    ]);

    // Fetch employee details separately from employees view
    let employeeData = null;
    if (surveyResult.data?.employee_id) {
      const { data: empData } = await supabase
        .from('employees' as any)
        .select('name, email')
        .eq('id', surveyResult.data.employee_id)
        .single();
      employeeData = empData;
    }

    if (surveyResult.error || !surveyResult.data) {
      return NextResponse.json(
        { error: 'Survey not found', details: surveyResult.error },
        { status: 404 }
      );
    }

    if (reviewerResult.error || !reviewerResult.data) {
      return NextResponse.json(
        { error: 'Reviewer not found', details: reviewerResult.error },
        { status: 404 }
      );
    }

    const survey = { ...surveyResult.data, employee: employeeData };
    const reviewer = reviewerResult.data;

    // Generate survey URL with access token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const surveyUrl = `${baseUrl}/survey/complete/${reviewer.access_token}`;

    // Format due date and calculate days remaining
    let dueDate = 'No deadline specified';
    let daysRemaining = null;
    if (survey.due_date) {
      const dueDateTime = new Date(survey.due_date);
      dueDate = dueDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Calculate days remaining
      const now = new Date();
      const timeDiff = dueDateTime.getTime() - now.getTime();
      daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }

    // Send email using Resend
    console.log('Sending email to:', reviewer.reviewer_email);
    console.log('From:', process.env.RESEND_FROM_EMAIL);
    console.log('Employee data:', survey.employee);

    // Build subject line
    const subject = isReminder && daysRemaining !== null
      ? `Reminder: 360° Feedback Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} - ${survey.employee?.name || 'Team Member'}`
      : `360° Feedback Request for ${survey.employee?.name || 'Team Member'}`;

    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'feedback@yourdomain.com',
      to: reviewer.reviewer_email,
      subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>360° Feedback Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${isReminder ? '⏰ Reminder: ' : ''}360° Feedback Request</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${reviewer.reviewer_name || 'there'},</p>

    ${isReminder && daysRemaining !== null ? `
    <div style="background: ${daysRemaining <= 3 ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${daysRemaining <= 3 ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 25px 0;">
      <p style="margin: 0; color: ${daysRemaining <= 3 ? '#7f1d1d' : '#78350f'}; font-weight: 600; font-size: 18px;">
        ⏰ ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left to complete this survey!
      </p>
      <p style="margin: 5px 0 0 0; color: ${daysRemaining <= 3 ? '#991b1b' : '#92400e'}; font-size: 14px;">
        Please take a few minutes to complete your feedback before the deadline.
      </p>
    </div>
    ` : ''}

    <p style="font-size: 16px; margin-bottom: 20px;">
      ${isReminder ? 'This is a friendly reminder that you have' : 'You\'ve been selected to provide'} 360° feedback for <strong>${survey.employee?.name || 'a team member'}</strong>.
      Your honest and constructive feedback will help them grow professionally.
    </p>

    <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 25px 0;">
      <p style="margin: 0; color: #555;"><strong>Survey:</strong> ${survey.survey_name || '360° Feedback'}</p>
      <p style="margin: 5px 0 0 0; color: #555;"><strong>Due Date:</strong> ${dueDate}</p>
      <p style="margin: 5px 0 0 0; color: #555;"><strong>Your Relationship:</strong> ${reviewer.relationship || 'Colleague'}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${surveyUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
        Complete Survey
      </a>
    </div>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin-top: 25px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>🔒 Privacy Note:</strong> Your responses will be kept confidential and aggregated with other feedback to ensure anonymity.
      </p>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      If you have any questions or need assistance, please reach out to your HR department.
    </p>

    <p style="font-size: 14px; color: #999; margin-top: 15px;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
      `,
    });

    if (emailResult.error) {
      console.error('Resend email error:', emailResult.error);

      // Update reviewer with email error
      await supabase
        .from('feedback_360_survey_reviewers')
        .update({
          email_error: JSON.stringify(emailResult.error),
        })
        .eq('id', reviewerId);

      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    // Update reviewer with successful email send
    await supabase
      .from('feedback_360_survey_reviewers')
      .update({
        email_sent_at: new Date().toISOString(),
        email_error: null,
      })
      .eq('id', reviewerId);

    return NextResponse.json({
      success: true,
      messageId: emailResult.data?.id,
      reviewerEmail: reviewer.reviewer_email,
    });
  } catch (error: any) {
    console.error('Error sending survey invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
