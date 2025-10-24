import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

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
    const { surveyId, reviewerId } = body;

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
        .select('*, employee:user_profiles!feedback_360_surveys_employee_id_fkey(full_name, email)')
        .eq('id', surveyId)
        .single(),
      supabase
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('id', reviewerId)
        .single(),
    ]);

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

    const survey = surveyResult.data;
    const reviewer = reviewerResult.data;

    // Generate survey URL with access token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const surveyUrl = `${baseUrl}/survey/complete/${reviewer.access_token}`;

    // Format due date
    const dueDate = survey.due_date
      ? new Date(survey.due_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'No deadline specified';

    // Send email using Resend
    console.log('Sending email to:', reviewer.reviewer_email);
    console.log('From:', process.env.RESEND_FROM_EMAIL);
    console.log('Employee name:', survey.employee?.full_name);

    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'feedback@yourdomain.com',
      to: reviewer.reviewer_email,
      subject: `360° Feedback Request for ${survey.employee?.full_name || 'Team Member'}`,
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
    <h1 style="color: white; margin: 0; font-size: 28px;">360° Feedback Request</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${reviewer.reviewer_name || 'there'},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been selected to provide 360° feedback for <strong>${survey.employee.full_name}</strong>.
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
