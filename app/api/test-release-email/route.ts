/**
 * POST /api/test-release-email
 *
 * Test endpoint to preview the release-to-subject email template.
 * Admin only - sends a test email to the specified address.
 * Does NOT affect any surveys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = authData;

    // Admin only
    if (user.app_role !== 'admin' && user.app_role !== 'slt') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email in request body' },
        { status: 400 }
      );
    }

    // Check Resend configuration
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    const resendFromName = process.env.RESEND_FROM_NAME || 'Sonance 360 Feedback';

    if (!resendFromEmail) {
      return NextResponse.json(
        { error: 'RESEND_FROM_EMAIL not configured' },
        { status: 500 }
      );
    }

    const fromAddress = `${resendFromName} <${resendFromEmail}>`;

    // Send test email
    const resend = getResend();
    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: 'Your 360 Feedback Report is Ready',
      html: generateReleaseEmailHtml(name || 'Test User'),
    });

    if (emailResult.error) {
      console.error('[Test Release Email] Resend error:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error.message },
        { status: 500 }
      );
    }

    console.log('[Test Release Email] Sent successfully:', {
      to: email,
      messageId: emailResult.data?.id,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      messageId: emailResult.data?.id,
    });
  } catch (error: any) {
    console.error('[Test Release Email] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
