import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getValidatedAppUrl } from '@/lib/url-validator';

export const dynamic = 'force-dynamic';

// Helper to mask sensitive values in logs
const maskSecret = (value: string | undefined): string => {
  if (!value) return 'NOT SET';
  if (value === 'placeholder-key') return 'PLACEHOLDER (INVALID)';
  return `***${value.slice(-6)}`;
};

// Lazy initialize Resend - needed because API key might not be available at build time
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY || 'placeholder-key';
  
  // Log API key status (masked) for debugging
  console.log('[Resend] API Key status:', maskSecret(apiKey));
  
  if (!apiKey || apiKey === 'placeholder-key') {
    throw new Error('RESEND_API_KEY environment variable is not set or is using placeholder value');
  }
  
  return new Resend(apiKey);
};

// Use singleton supabaseAdmin client (service role, bypasses RLS)

export async function POST(request: Request) {
  try {
    // Validate environment variables at the start
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    const resendFromName = process.env.RESEND_FROM_NAME || 'Sonance 360 Feedback';

    // Format the from address with display name
    const fromAddress = `${resendFromName} <${resendFromEmail}>`;

    console.log('[Email Send] Environment check:', {
      apiKeySet: !!resendApiKey && resendApiKey !== 'placeholder-key',
      apiKeyMasked: maskSecret(resendApiKey),
      fromEmailSet: !!resendFromEmail,
      fromEmail: resendFromEmail || 'NOT SET',
      fromName: resendFromName,
    });

    if (!resendApiKey || resendApiKey === 'placeholder-key') {
      const errorMsg = 'RESEND_API_KEY environment variable is not configured. Please set it in Vercel environment variables.';
      console.error('[Email Send] Configuration error:', errorMsg);
      return NextResponse.json(
        { 
          error: 'Email service not configured',
          details: errorMsg,
          hint: 'Check Vercel environment variables: Settings → Environment Variables → RESEND_API_KEY'
        },
        { status: 500 }
      );
    }

    if (!resendFromEmail) {
      const errorMsg = 'RESEND_FROM_EMAIL environment variable is not configured. Please set it in Vercel environment variables.';
      console.error('[Email Send] Configuration error:', errorMsg);
      return NextResponse.json(
        { 
          error: 'Email service not configured',
          details: errorMsg,
          hint: 'Check Vercel environment variables: Settings → Environment Variables → RESEND_FROM_EMAIL'
        },
        { status: 500 }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('[Email Send] Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: parseError.message || 'Request body must be valid JSON',
          hint: 'Check that the request includes valid JSON with surveyId and reviewerId'
        },
        { status: 400 }
      );
    }

    const { surveyId, reviewerId, isReminder } = body;

    if (!surveyId || !reviewerId) {
      return NextResponse.json(
        { error: 'Missing surveyId or reviewerId' },
        { status: 400 }
      );
    }

    // Fetch survey and reviewer details using admin client
    const [surveyResult, reviewerResult] = await Promise.all([
      supabaseAdmin
        .from('feedback_360_surveys')
        .select('*')
        .eq('id', surveyId)
        .single(),
      supabaseAdmin
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('id', reviewerId)
        .single(),
    ]);

    // Fetch employee details from user_profiles (replaces employees materialized view)
    let employeeData = null;
    if (surveyResult.data?.employee_id) {
      const { data: empData } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', surveyResult.data.employee_id)
        .single();
      // Map full_name to name for backward compatibility
      employeeData = empData ? { name: empData.full_name, email: empData.email } : null;
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

    // Generate survey URL with access token - validate URL first
    let baseUrl: string;
    try {
      baseUrl = getValidatedAppUrl('NEXT_PUBLIC_APP_URL');
    } catch (error: any) {
      console.error('[Email Send] URL validation error:', error.message);
      return NextResponse.json(
        {
          error: 'Application URL is not configured correctly',
          details: error.message,
          hint: 'Check Vercel environment variables: Settings → Environment Variables → NEXT_PUBLIC_APP_URL'
        },
        { status: 500 }
      );
    }
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
    console.log('[Email Send] Preparing to send:', {
      to: reviewer.reviewer_email,
      from: fromAddress,
      subject: isReminder ? 'Reminder' : 'Initial invitation',
      employee: survey.employee?.name,
    });

    const subject = isReminder && daysRemaining !== null
      ? `Reminder: 360° Feedback Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} - ${survey.employee?.name || 'Team Member'}`
      : `360° Feedback Request for ${survey.employee?.name || 'Team Member'}`;

    let emailResult;
    try {
      // Initialize Resend client (will throw if API key is invalid)
      const resend = getResend();
      
      console.log('[Email Send] Resend client initialized, sending email...');
      
      emailResult = await resend.emails.send({
        from: fromAddress,
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
  <!--[if mso | IE]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #667eea;">
    <tr>
      <td style="padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-family: Arial, sans-serif;">${isReminder ? '⏰ Reminder: ' : ''}360° Feedback Request</h1>
      </td>
    </tr>
  </table>
  <![endif]-->
  <!--[if !mso]><!-->
  <div style="background-color: #667eea; background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${isReminder ? '⏰ Reminder: ' : ''}360° Feedback Request</h1>
  </div>
  <!--<![endif]-->

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

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>🔒 Privacy Note:</strong> Your responses will be kept confidential and aggregated with other feedback to ensure anonymity - your comments cannot be traced back to you.
      </p>
    </div>

    <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 25px 0;">
      <p style="margin: 0; color: #555;"><strong>Due Date:</strong> ${dueDate}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${surveyUrl}"
         style="display: inline-block; background: #6366f1; border: 2px solid #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
        Complete Survey
      </a>
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

      console.log('[Email Send] Resend API response:', {
        hasError: !!emailResult.error,
        hasData: !!emailResult.data,
        messageId: emailResult.data?.id,
        error: emailResult.error,
      });
    } catch (resendError: any) {
      // Catch errors from Resend API call (network errors, invalid API key, etc.)
      console.error('[Email Send] Resend API call failed:', {
        error: resendError.message,
        stack: resendError.stack,
        name: resendError.name,
      });

      // Try to update reviewer with email error (don't fail if this fails)
      try {
        await supabaseAdmin
          .from('feedback_360_survey_reviewers')
          .update({
            email_error: JSON.stringify({
              type: 'api_call_error',
              message: resendError.message,
              details: resendError.toString(),
            }),
          })
          .eq('id', reviewerId);
      } catch (dbError: any) {
        console.error('[Email Send] Failed to update reviewer error status:', dbError);
        // Continue anyway - we still want to return the error to the client
      }

      return NextResponse.json(
        { 
          error: 'Failed to send email via Resend API',
          details: resendError.message || 'Unknown error',
          hint: 'Check Vercel logs and verify RESEND_API_KEY is correct'
        },
        { status: 500 }
      );
    }

    if (emailResult.error) {
      console.error('[Email Send] Resend returned error:', emailResult.error);

      // Check for specific error types and provide helpful hints
      let errorMessage = emailResult.error.message || 'Failed to send email';
      let errorHint = 'Check Resend dashboard for more details';
      
      // Handle domain verification error
      if (emailResult.error.message?.includes('domain is not verified')) {
        errorMessage = `Domain not verified: ${emailResult.error.message}`;
        errorHint = 'RESEND_FROM_EMAIL is not set or uses an unverified domain. Set RESEND_FROM_EMAIL in Vercel environment variables to a verified domain (e.g., noreply@sonance.com)';
      }
      
      // Handle missing from email
      if (emailResult.error.message?.includes('yourdomain.com') || !resendFromEmail) {
        errorMessage = 'RESEND_FROM_EMAIL environment variable is not configured';
        errorHint = 'Set RESEND_FROM_EMAIL in Vercel environment variables (e.g., noreply@sonance.com)';
      }

      // Try to update reviewer with email error (don't fail if this fails)
      try {
        await supabaseAdmin
          .from('feedback_360_survey_reviewers')
          .update({
            email_error: JSON.stringify(emailResult.error),
          })
          .eq('id', reviewerId);
      } catch (dbError: any) {
        console.error('[Email Send] Failed to update reviewer error status:', dbError);
        // Continue anyway - we still want to return the error to the client
      }

      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: errorMessage,
          hint: errorHint,
          resendError: emailResult.error
        },
        { status: 500 }
      );
    }

    // Success - log and update reviewer
    console.log('[Email Send] Success:', {
      messageId: emailResult.data?.id,
      to: reviewer.reviewer_email,
    });

    // Update reviewer with successful email send (don't fail if this fails)
    try {
      await supabase
        .from('feedback_360_survey_reviewers')
        .update({
          email_sent_at: new Date().toISOString(),
          email_error: null,
        })
        .eq('id', reviewerId);
    } catch (dbError: any) {
      console.error('[Email Send] Failed to update reviewer success status:', dbError);
      // Continue anyway - email was sent successfully, just couldn't update DB
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.data?.id,
      reviewerEmail: reviewer.reviewer_email,
    });
  } catch (error: any) {
    console.error('[Email Send] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error occurred',
        hint: 'Check server logs for more details'
      },
      { status: 500 }
    );
  }
}
