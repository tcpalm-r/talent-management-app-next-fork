/**
 * GET /api/cron/send-survey-reminders
 *
 * Cron job endpoint for sending automatic survey reminders.
 * Runs daily at 9 AM UTC via Vercel Cron Jobs.
 *
 * Logic:
 * - Finds active surveys with due dates approaching
 * - Checks if auto_reminder_days_before is configured (1 or 2)
 * - Sends reminders to incomplete reviewers
 * - Simple date check: "Is today the reminder day?" + "Already sent today?"
 * - Uses existing email template from send-survey-invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Helper to calculate date difference in days
const getDaysDifference = (futureDate: Date, currentDate: Date): number => {
  const timeDiff = futureDate.getTime() - currentDate.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

// Helper to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('[Cron] Automatic survey reminders job started');

  try {
    // Step 1: Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    // In development, allow testing without secret
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment && (!authHeader || authHeader !== expectedAuth)) {
      console.error('[Cron] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (isDevelopment && !authHeader) {
      console.log('[Cron] Running in development mode without auth');
    }

    // Step 2: Query active surveys with due dates and auto-reminder configuration
    const { data: surveys, error: surveysError } = await supabaseAdmin
      .from('feedback_360_surveys')
      .select('id, survey_name, employee_id, due_date, auto_reminder_days_before, status')
      .eq('status', 'in_progress') // Only in-progress surveys
      .not('due_date', 'is', null) // Must have due date
      .not('auto_reminder_days_before', 'is', null) // Must have reminder configured
      .gte('due_date', new Date().toISOString()); // Due date hasn't passed yet

    if (surveysError) {
      console.error('[Cron] Error fetching surveys:', surveysError);
      return NextResponse.json(
        { error: 'Database error', details: surveysError.message },
        { status: 500 }
      );
    }

    if (!surveys || surveys.length === 0) {
      console.log('[Cron] No surveys found needing reminders');
      return NextResponse.json({
        success: true,
        message: 'No surveys found needing reminders',
        surveysProcessed: 0,
        remindersSent: 0,
        executionTime: Date.now() - startTime,
      });
    }

    console.log(`[Cron] Found ${surveys.length} survey(s) with auto-reminders configured`);

    const now = new Date();
    const results = {
      surveysProcessed: 0,
      remindersSent: 0,
      errors: [] as any[],
      details: [] as any[],
    };

    // Step 3: Process each survey
    for (const survey of surveys) {
      try {
        const dueDate = new Date(survey.due_date);
        const daysUntilDue = getDaysDifference(dueDate, now);
        const reminderDaysBefore = survey.auto_reminder_days_before;

        console.log(`[Cron] Processing survey ${survey.id}:`, {
          name: survey.survey_name,
          daysUntilDue,
          reminderDaysBefore,
        });

        // Check if today is the reminder day
        const shouldSendToday = daysUntilDue === reminderDaysBefore;

        if (!shouldSendToday) {
          console.log(`[Cron] Skipping survey ${survey.id}: not reminder day (${daysUntilDue} days vs ${reminderDaysBefore} days)`);
          continue;
        }

        results.surveysProcessed++;

        // Step 4: Get incomplete reviewers for this survey
        const { data: reviewers, error: reviewersError } = await supabaseAdmin
          .from('feedback_360_survey_reviewers')
          .select('id, reviewer_email, reviewer_name, status, last_reminder_at, reminder_count')
          .eq('survey_id', survey.id)
          .neq('status', 'completed'); // Only incomplete reviewers

        if (reviewersError) {
          console.error(`[Cron] Error fetching reviewers for survey ${survey.id}:`, reviewersError);
          results.errors.push({
            surveyId: survey.id,
            error: 'Failed to fetch reviewers',
            details: reviewersError.message,
          });
          continue;
        }

        if (!reviewers || reviewers.length === 0) {
          console.log(`[Cron] No incomplete reviewers for survey ${survey.id}`);
          continue;
        }

        console.log(`[Cron] Found ${reviewers.length} incomplete reviewer(s) for survey ${survey.id}`);

        // Step 5: Send reminders to each incomplete reviewer
        let sentCount = 0;
        let skippedCount = 0;

        for (const reviewer of reviewers) {
          // Simple date check: skip if we already sent a reminder today
          if (reviewer.last_reminder_at) {
            const lastReminderDate = new Date(reviewer.last_reminder_at);
            if (isSameDay(lastReminderDate, now)) {
              console.log(`[Cron] Skipping reviewer ${reviewer.id}: reminder already sent today`);
              skippedCount++;
              continue;
            }
          }

          try {
            // Call the send-survey-invitation endpoint
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';
            const emailResponse = await fetch(`${baseUrl}/api/send-survey-invitation`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                surveyId: survey.id,
                reviewerId: reviewer.id,
                isReminder: true,
              }),
            });

            if (!emailResponse.ok) {
              const errorData = await emailResponse.json();
              console.error(`[Cron] Failed to send email to ${reviewer.reviewer_email}:`, errorData);
              results.errors.push({
                surveyId: survey.id,
                reviewerId: reviewer.id,
                reviewerEmail: reviewer.reviewer_email,
                error: 'Email send failed',
                details: errorData,
              });
              continue;
            }

            // Update reviewer tracking fields
            const { error: updateError } = await supabaseAdmin
              .from('feedback_360_survey_reviewers')
              .update({
                last_reminder_at: now.toISOString(),
                reminder_count: (reviewer.reminder_count || 0) + 1,
              })
              .eq('id', reviewer.id);

            if (updateError) {
              console.error(`[Cron] Failed to update reviewer ${reviewer.id} tracking:`, updateError);
              // Don't fail the whole operation - email was sent successfully
            }

            sentCount++;
            results.remindersSent++;
            console.log(`[Cron] ✓ Sent reminder to ${reviewer.reviewer_email} for survey ${survey.id}`);

          } catch (reviewerError: any) {
            console.error(`[Cron] Error processing reviewer ${reviewer.id}:`, reviewerError);
            results.errors.push({
              surveyId: survey.id,
              reviewerId: reviewer.id,
              reviewerEmail: reviewer.reviewer_email,
              error: 'Processing failed',
              details: reviewerError.message,
            });
          }
        }

        results.details.push({
          surveyId: survey.id,
          surveyName: survey.survey_name,
          daysUntilDue,
          reviewersTotal: reviewers.length,
          remindersSent: sentCount,
          skipped: skippedCount,
        });

        console.log(`[Cron] Survey ${survey.id} complete: sent ${sentCount}, skipped ${skippedCount}`);

      } catch (surveyError: any) {
        console.error(`[Cron] Error processing survey ${survey.id}:`, surveyError);
        results.errors.push({
          surveyId: survey.id,
          error: 'Survey processing failed',
          details: surveyError.message,
        });
      }
    }

    const executionTime = Date.now() - startTime;

    console.log('[Cron] Automatic survey reminders job completed:', {
      surveysProcessed: results.surveysProcessed,
      remindersSent: results.remindersSent,
      errors: results.errors.length,
      executionTime: `${executionTime}ms`,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.surveysProcessed} survey(s), sent ${results.remindersSent} reminder(s)`,
      surveysProcessed: results.surveysProcessed,
      remindersSent: results.remindersSent,
      errors: results.errors.length > 0 ? results.errors : undefined,
      details: results.details,
      executionTime,
    });

  } catch (error: any) {
    console.error('[Cron] Unexpected error in automatic reminder job:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        executionTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
