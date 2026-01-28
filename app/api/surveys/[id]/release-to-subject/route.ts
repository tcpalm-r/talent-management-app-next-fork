/**
 * POST /api/surveys/[id]/release-to-subject
 *
 * Release a finalized survey to the subject:
 * - Sets released_to_subject_at timestamp
 * - Only sponsors or admins can release
 * - Survey must be in 'finalized' status
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'placeholder-key') {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(apiKey);
};

function generateReleaseEmailHtml(subjectName: string | null): string {
  const firstName = subjectName ? subjectName.split(' ')[0] : 'there';
  const dashboardUrl = 'https://sonance-360-review.vercel.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your 360 Feedback is Ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!--[if mso | IE]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #667eea;">
    <tr>
      <td style="padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-family: Arial, sans-serif;">Your 360 Feedback is Ready</h1>
      </td>
    </tr>
  </table>
  <![endif]-->
  <!--[if !mso]><!-->
  <div style="background-color: #667eea; background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Your 360 Feedback is Ready</h1>
  </div>
  <!--<![endif]-->

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your 360 feedback report has been finalized and is now ready for you to review.
    </p>

    <p style="font-size: 16px; margin-bottom: 25px;">
      This report contains valuable insights from your colleagues to help support your professional development.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}"
         style="display: inline-block; background: #6366f1; border: 2px solid #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
        View Your Report
      </a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      If you have any questions about your feedback, please reach out to your sponsor or HR department.
    </p>

    <p style="font-size: 14px; color: #999; margin-top: 15px;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `;
}

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
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Check permission - admins and survey creators (sponsors) can release
    const canRelease =
      user.app_role === 'admin' ||
      user.app_role === 'slt' ||
      survey.created_by === profile.id ||
      survey.created_by_email?.toLowerCase() === profile.email?.toLowerCase();

    if (!canRelease) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to release this survey' },
        { status: 403 }
      );
    }

    // Check if survey is finalized
    if (survey.status !== 'finalized') {
      return NextResponse.json(
        { error: 'Survey must be finalized before releasing to subject' },
        { status: 400 }
      );
    }

    // Check if already released
    if (survey.released_to_subject_at) {
      return NextResponse.json(
        { error: 'Survey has already been released to subject' },
        { status: 400 }
      );
    }

    // Update survey to released
    const { data: updatedSurvey, error: updateError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .update({
        released_to_subject_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error releasing survey to subject:', updateError);
      return NextResponse.json(
        { error: 'Failed to release survey', details: updateError.message },
        { status: 500 }
      );
    }

    // Send notification email to subject (non-blocking - don't fail release if email fails)
    let emailSent = false;
    let emailError: string | null = null;

    // Fetch subject's email and name
    let employeeData: { full_name: string | null; email: string | null } | null = null;
    if (survey.employee_id) {
      const { data: empData } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', survey.employee_id)
        .single();
      employeeData = empData;
    }

    if (employeeData?.email) {
      try {
        const resendFromEmail = process.env.RESEND_FROM_EMAIL;
        const resendFromName = process.env.RESEND_FROM_NAME || 'Sonance 360 Feedback';

        if (resendFromEmail) {
          const resend = getResend();
          const fromAddress = `${resendFromName} <${resendFromEmail}>`;

          const emailResult = await resend.emails.send({
            from: fromAddress,
            to: employeeData.email,
            subject: 'Your 360 Feedback Report is Ready',
            html: generateReleaseEmailHtml(employeeData.full_name),
          });

          if (emailResult.error) {
            console.error('[Release Email] Resend error:', emailResult.error);
            emailError = emailResult.error.message;
          } else {
            emailSent = true;
            console.log('[Release Email] Sent successfully:', {
              to: employeeData.email,
              messageId: emailResult.data?.id,
            });
          }
        } else {
          emailError = 'RESEND_FROM_EMAIL not configured';
          console.warn('[Release Email] Skipped - RESEND_FROM_EMAIL not configured');
        }
      } catch (error: any) {
        console.error('[Release Email] Failed:', error);
        emailError = error.message;
      }
    } else {
      console.warn('[Release Email] Skipped - no employee email found');
    }

    return NextResponse.json({
      survey: updatedSurvey,
      message: 'Survey released to subject successfully',
      emailSent,
      emailError: emailError || undefined,
    });

  } catch (error) {
    console.error('Error in POST /api/surveys/[id]/release-to-subject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
