/**
 * Email System Library
 *
 * Centralized email functionality using Resend.
 * Supports:
 * - 360 feedback notifications
 * - Performance review reminders
 * - PIP status updates
 * - Succession planning alerts
 * - General notifications
 */

import { Resend } from 'resend';

// ============================================================================
// INITIALIZATION
// ============================================================================

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'feedback@aiintranet.sonance.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';
const APP_NAME = process.env.APP_NAME || 'Sonance Talent Management';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'thomas.palmer@sonance.com';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface Feedback360NotificationData {
  reviewerName: string;
  reviewerEmail: string;
  employeeName: string;
  surveyToken: string;
  surveyTitle: string;
  dueDate?: string;
}

export interface PerformanceReviewReminderData {
  employeeName: string;
  employeeEmail: string;
  reviewerName: string;
  reviewPeriod: string;
  dueDate: string;
  reviewUrl: string;
}

export interface PIPNotificationData {
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  pipStartDate: string;
  pipEndDate: string;
  pipUrl: string;
  status: 'started' | 'progress_update' | 'completed' | 'extended';
}

export interface SuccessionPlanningAlertData {
  recipientName: string;
  positionTitle: string;
  nominatedCandidates: string[];
  alertType: 'new_plan' | 'candidate_nominated' | 'plan_updated';
  planUrl: string;
}

// ============================================================================
// CORE EMAIL FUNCTIONS
// ============================================================================

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, email not sent');
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: options.from || FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Unexpected error sending email:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// 360 FEEDBACK EMAILS
// ============================================================================

/**
 * Send 360 feedback survey invitation
 */
export async function send360FeedbackInvitation(data: Feedback360NotificationData): Promise<{ success: boolean; error?: string }> {
  const surveyUrl = `${APP_URL}/survey/complete/${data.surveyToken}`;
  const dueDateText = data.dueDate ? `by ${new Date(data.dueDate).toLocaleDateString()}` : 'soon';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${APP_NAME}</h1>
            <p>360° Feedback Request</p>
          </div>
          <div class="content">
            <p>Hi ${data.reviewerName},</p>

            <p>You have been invited to provide feedback for <strong>${data.employeeName}</strong> as part of their 360° performance review.</p>

            <p><strong>Survey:</strong> ${data.surveyTitle}</p>
            <p><strong>Due Date:</strong> Please complete ${dueDateText}</p>

            <p>Your feedback is confidential and will be aggregated with other responses to provide comprehensive insights for ${data.employeeName}'s development.</p>

            <div style="text-align: center;">
              <a href="${surveyUrl}" class="button">Complete Survey</a>
            </div>

            <p style="font-size: 14px; color: #6b7280;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${surveyUrl}">${surveyUrl}</a>
            </p>

            <p>Thank you for contributing to ${data.employeeName}'s professional development!</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${APP_NAME}</p>
            <p>If you have questions, please contact your HR representative</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${data.reviewerName},

You have been invited to provide feedback for ${data.employeeName} as part of their 360° performance review.

Survey: ${data.surveyTitle}
Due Date: Please complete ${dueDateText}

Your feedback is confidential and will be aggregated with other responses.

Complete the survey here: ${surveyUrl}

Thank you for contributing to ${data.employeeName}'s professional development!

---
This is an automated message from ${APP_NAME}
  `.trim();

  return sendEmail({
    to: data.reviewerEmail,
    subject: `360° Feedback Request for ${data.employeeName}`,
    html,
    text,
  });
}

/**
 * Send 360 feedback reminder
 */
export async function send360FeedbackReminder(data: Feedback360NotificationData): Promise<{ success: boolean; error?: string }> {
  const surveyUrl = `${APP_URL}/survey/complete/${data.surveyToken}`;
  const dueDateText = data.dueDate ? `${new Date(data.dueDate).toLocaleDateString()}` : 'soon';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button {
            display: inline-block;
            background-color: #f59e0b;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Reminder</h1>
            <p>360° Feedback Survey</p>
          </div>
          <div class="content">
            <p>Hi ${data.reviewerName},</p>

            <p>This is a friendly reminder that you have a pending 360° feedback survey for <strong>${data.employeeName}</strong>.</p>

            <p><strong>Survey:</strong> ${data.surveyTitle}</p>
            <p><strong>Due Date:</strong> ${dueDateText}</p>

            <div style="text-align: center;">
              <a href="${surveyUrl}" class="button">Complete Survey Now</a>
            </div>

            <p>Your input is valuable and helps ${data.employeeName} grow professionally.</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from ${APP_NAME}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${data.reviewerName},

This is a friendly reminder that you have a pending 360° feedback survey for ${data.employeeName}.

Survey: ${data.surveyTitle}
Due Date: ${dueDateText}

Complete the survey here: ${surveyUrl}

Your input is valuable and helps ${data.employeeName} grow professionally.

---
This is an automated reminder from ${APP_NAME}
  `.trim();

  return sendEmail({
    to: data.reviewerEmail,
    subject: `Reminder: 360° Feedback for ${data.employeeName}`,
    html,
    text,
  });
}

// ============================================================================
// PERFORMANCE REVIEW EMAILS
// ============================================================================

/**
 * Send performance review reminder
 */
export async function sendPerformanceReviewReminder(data: PerformanceReviewReminderData): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Performance Review Due</h1>
          </div>
          <div class="content">
            <p>Hi ${data.reviewerName},</p>

            <p>You have a pending performance review for <strong>${data.employeeName}</strong>.</p>

            <p><strong>Review Period:</strong> ${data.reviewPeriod}</p>
            <p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>

            <div style="text-align: center;">
              <a href="${data.reviewUrl}" class="button">Complete Review</a>
            </div>

            <p>Please complete the review by the due date to ensure timely feedback for ${data.employeeName}.</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from ${APP_NAME}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${data.reviewerName},

You have a pending performance review for ${data.employeeName}.

Review Period: ${data.reviewPeriod}
Due Date: ${new Date(data.dueDate).toLocaleDateString()}

Complete the review here: ${data.reviewUrl}

Please complete the review by the due date to ensure timely feedback.

---
This is an automated reminder from ${APP_NAME}
  `.trim();

  return sendEmail({
    to: data.employeeEmail,
    subject: `Performance Review Due: ${data.employeeName}`,
    html,
    text,
  });
}

// ============================================================================
// PIP (PERFORMANCE IMPROVEMENT PLAN) EMAILS
// ============================================================================

/**
 * Send PIP notification
 */
export async function sendPIPNotification(data: PIPNotificationData): Promise<{ success: boolean; error?: string }> {
  let subjectLine = '';
  let headerText = '';
  let bodyText = '';

  switch (data.status) {
    case 'started':
      subjectLine = 'Performance Improvement Plan Started';
      headerText = 'PIP Initiated';
      bodyText = `A Performance Improvement Plan has been created for you, starting ${new Date(data.pipStartDate).toLocaleDateString()}.`;
      break;
    case 'progress_update':
      subjectLine = 'PIP Progress Update';
      headerText = 'PIP Update';
      bodyText = 'There has been an update to your Performance Improvement Plan.';
      break;
    case 'completed':
      subjectLine = 'Performance Improvement Plan Completed';
      headerText = 'PIP Completed';
      bodyText = 'Congratulations! Your Performance Improvement Plan has been successfully completed.';
      break;
    case 'extended':
      subjectLine = 'Performance Improvement Plan Extended';
      headerText = 'PIP Extended';
      bodyText = `Your Performance Improvement Plan has been extended to ${new Date(data.pipEndDate).toLocaleDateString()}.`;
      break;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button {
            display: inline-block;
            background-color: #dc2626;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${headerText}</h1>
          </div>
          <div class="content">
            <p>Hi ${data.employeeName},</p>

            <p>${bodyText}</p>

            <p><strong>Manager:</strong> ${data.managerName}</p>
            <p><strong>Start Date:</strong> ${new Date(data.pipStartDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(data.pipEndDate).toLocaleDateString()}</p>

            <div style="text-align: center;">
              <a href="${data.pipUrl}" class="button">View PIP Details</a>
            </div>

            <p>Please review the details and reach out to your manager if you have any questions.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${APP_NAME}</p>
            <p>For questions, please contact your manager or HR</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${data.employeeName},

${bodyText}

Manager: ${data.managerName}
Start Date: ${new Date(data.pipStartDate).toLocaleDateString()}
End Date: ${new Date(data.pipEndDate).toLocaleDateString()}

View PIP details here: ${data.pipUrl}

Please review the details and reach out to your manager if you have any questions.

---
This is an automated message from ${APP_NAME}
  `.trim();

  return sendEmail({
    to: data.employeeEmail,
    subject: subjectLine,
    html,
    text,
  });
}

// ============================================================================
// SUCCESSION PLANNING EMAILS
// ============================================================================

/**
 * Send succession planning alert
 */
export async function sendSuccessionPlanningAlert(data: SuccessionPlanningAlertData): Promise<{ success: boolean; error?: string }> {
  let subjectLine = '';
  let headerText = '';
  let bodyText = '';

  switch (data.alertType) {
    case 'new_plan':
      subjectLine = `New Succession Plan Created: ${data.positionTitle}`;
      headerText = 'New Succession Plan';
      bodyText = `A new succession plan has been created for the position: <strong>${data.positionTitle}</strong>.`;
      break;
    case 'candidate_nominated':
      subjectLine = `You've Been Nominated for Succession Planning`;
      headerText = 'Succession Planning Nomination';
      bodyText = `Congratulations! You have been nominated as a potential successor for <strong>${data.positionTitle}</strong>.`;
      break;
    case 'plan_updated':
      subjectLine = `Succession Plan Updated: ${data.positionTitle}`;
      headerText = 'Succession Plan Update';
      bodyText = `The succession plan for <strong>${data.positionTitle}</strong> has been updated.`;
      break;
  }

  const candidatesList = data.nominatedCandidates.length > 0
    ? `<p><strong>Nominated Candidates:</strong> ${data.nominatedCandidates.join(', ')}</p>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button {
            display: inline-block;
            background-color: #7c3aed;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${headerText}</h1>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>

            <p>${bodyText}</p>

            ${candidatesList}

            <div style="text-align: center;">
              <a href="${data.planUrl}" class="button">View Plan Details</a>
            </div>

            <p>This information is confidential and should be treated with discretion.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${APP_NAME}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const candidatesText = data.nominatedCandidates.length > 0
    ? `\nNominated Candidates: ${data.nominatedCandidates.join(', ')}`
    : '';

  const text = `
Hi ${data.recipientName},

${bodyText.replace(/<\/?strong>/g, '')}
${candidatesText}

View plan details here: ${data.planUrl}

This information is confidential and should be treated with discretion.

---
This is an automated message from ${APP_NAME}
  `.trim();

  return sendEmail({
    to: data.recipientName, // Note: This should be an email address, not a name
    subject: subjectLine,
    html,
    text,
  });
}

// ============================================================================
// ADMIN NOTIFICATION EMAILS
// ============================================================================

/**
 * Send admin notification
 */
export async function sendAdminNotification(
  subject: string,
  message: string,
  details?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const detailsHtml = details
    ? `
    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Details:</h3>
      <pre style="white-space: pre-wrap; font-size: 13px;">${JSON.stringify(details, null, 2)}</pre>
    </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6b7280; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Admin Notification</h1>
          </div>
          <div class="content">
            <p>${message}</p>
            ${detailsHtml}
          </div>
          <div class="footer">
            <p>This is an automated admin notification from ${APP_NAME}</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const detailsText = details ? `\n\nDetails:\n${JSON.stringify(details, null, 2)}` : '';
  const text = `${message}${detailsText}\n\n---\nTimestamp: ${new Date().toISOString()}`;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Admin] ${subject}`,
    html,
    text,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sendEmail,
  send360FeedbackInvitation,
  send360FeedbackReminder,
  sendPerformanceReviewReminder,
  sendPIPNotification,
  sendSuccessionPlanningAlert,
  sendAdminNotification,
};
