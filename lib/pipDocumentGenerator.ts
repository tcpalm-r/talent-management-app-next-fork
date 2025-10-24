/**
 * PIP Document Generator
 * Creates formal letters, emails, and audit trails for legal compliance
 */

import type {
  PerformanceImprovementPlan,
  PIPExpectation,
  PIPCheckIn,
  PIPMilestoneReview,
  Employee,
} from '../types';

export interface PIPLetter {
  subject: string;
  body: string;
  footer: string;
}

/**
 * Generate formal PIP letter (for PDF or email)
 */
export function generatePIPLetter(
  pip: PerformanceImprovementPlan,
  employee: Employee,
  expectations: PIPExpectation[]
): PIPLetter {
  const startDate = new Date(pip.start_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const endDate = new Date(pip.end_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Performance Improvement Plan - ${employee.name}`;

  const body = `Date: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}

To: ${employee.name}
Position: ${employee.title || 'Employee'}
From: ${pip.manager_name}

RE: Performance Improvement Plan

Dear ${employee.name.split(' ')[0]},

This letter confirms our conversation regarding your performance and outlines a formal Performance Improvement Plan (PIP). The purpose of this plan is to clearly communicate performance expectations and provide you with support to improve your performance to an acceptable level.

**REASON FOR PERFORMANCE IMPROVEMENT PLAN**

${pip.reason_for_pip}

**PERFORMANCE EXPECTATIONS**

During this Performance Improvement Plan, you are expected to meet the following expectations:

${expectations
  .sort((a, b) => a.order_index - b.order_index)
  .map((exp, index) => `
${index + 1}. ${exp.category}: ${exp.expectation}
   Success Criteria: ${exp.success_criteria}
   Target: ${exp.phase === '30_day' ? '30-Day Review' : exp.phase === '60_day' ? '60-Day Review' : '90-Day Review'}
`)
  .join('\n')}

**TIMELINE AND MILESTONES**

This Performance Improvement Plan will be in effect from ${startDate} through ${endDate} (90 days).

Key milestone reviews:
- 30-Day Review: ${new Date(pip.day_30_review_date).toLocaleDateString()}
- 60-Day Review: ${new Date(pip.day_60_review_date).toLocaleDateString()}
- 90-Day Final Review: ${new Date(pip.day_90_review_date).toLocaleDateString()}

**SUPPORT PROVIDED**

${pip.support_provided || 'You will receive weekly coaching sessions with your manager, access to relevant training resources, and clear feedback on your progress.'}

**CHECK-IN MEETINGS**

You will meet with your manager weekly to review progress, address obstacles, and ensure you have the support needed to succeed. These meetings are mandatory and will be documented.

**CONSEQUENCES**

${pip.consequences}

**ACKNOWLEDGMENT**

I have received and reviewed this Performance Improvement Plan. I understand the expectations outlined above and the timeline for improvement. I understand that my continued employment depends on meeting these expectations.

_______________________________________     ______________
Employee Signature                           Date

_______________________________________     ______________
Manager Signature                            Date

_______________________________________     ______________
HR Representative Signature                  Date`;

  const footer = `This document is confidential and should be maintained in the employee's personnel file.`;

  return { subject, body, footer };
}

/**
 * Generate check-in notes template
 */
export function generateCheckInTemplate(
  pip: PerformanceImprovementPlan,
  employeeName: string,
  checkInNumber: number
): string {
  return `PIP CHECK-IN #${checkInNumber}
Employee: ${employeeName}
Date: ${new Date().toLocaleDateString()}
Conducted by: ${pip.manager_name}

PROGRESS REVIEW:
[For each expectation, note specific progress or lack thereof with examples]

1. Expectation 1:
   Status: [On Track / At Risk / Off Track]
   Evidence: [Specific examples from this week]
   Employee Comments: [What employee said about their progress]

2. Expectation 2:
   Status: [On Track / At Risk / Off Track]
   Evidence: [Specific examples from this week]
   Employee Comments: [What employee said about their progress]

OBSTACLES IDENTIFIED:
[What is blocking the employee from success?]

SUPPORT PROVIDED:
[What resources, training, or assistance was offered?]

EMPLOYEE ENGAGEMENT:
[Is employee engaged, defensive, improving, struggling?]

ACTION ITEMS FOR NEXT WEEK:
1. [Employee to do...]
2. [Manager to provide...]

OVERALL ASSESSMENT:
[On Track / At Risk / Off Track]

NEXT CHECK-IN: [Date and time]

Manager Notes (Private):
[Any concerns, observations, or decisions to discuss with HR]`;
}

/**
 * Generate milestone review template
 */
export function generateMilestoneReviewTemplate(
  milestone: '30_day' | '60_day' | '90_day',
  pip: PerformanceImprovementPlan,
  employee: Employee,
  expectations: PIPExpectation[]
): string {
  const milestoneLabel = milestone === '30_day' ? '30-Day' : milestone === '60_day' ? '60-Day' : '90-Day';

  return `${milestoneLabel.toUpperCase()} MILESTONE REVIEW
Performance Improvement Plan

Employee: ${employee.name}
Position: ${employee.title || 'Employee'}
Review Date: ${new Date().toLocaleDateString()}
Conducted by: ${pip.manager_name}
HR Representative: [Name]

EXPECTATIONS ASSESSMENT:

${expectations
  .filter(exp => exp.phase === milestone || milestone === '90_day')
  .map((exp, index) => `
${index + 1}. ${exp.category}
   Expectation: ${exp.expectation}
   Status: [Exceeds / Meets / Partially Meets / Does Not Meet]
   Evidence: [Specific examples and metrics]
   
`)
  .join('\n')}

OVERALL PERFORMANCE RATING:
□ Exceeds Expectations
□ Meets Expectations
□ Partially Meets Expectations
□ Does Not Meet Expectations

PROGRESS SUMMARY:
[Comprehensive narrative of progress since ${milestone === '30_day' ? 'PIP start' : 'last milestone'}]

STRENGTHS DEMONSTRATED:
1. [Specific improvements or positive behaviors]
2.

AREAS REQUIRING CONTINUED FOCUS:
1. [Gaps that still need work]
2.

${milestone === '90_day' ? `
FINAL DECISION:
□ PIP Successfully Completed - Return to Regular Performance Management
□ Extend PIP for [X] Days (Reason: ________________________)
□ Terminate Employment (Effective Date: ____________)

DECISION RATIONALE:
[Detailed explanation of decision based on evidence]
` : `
DECISION FOR NEXT PHASE:
□ Continue PIP as planned
□ Modify expectations (detail changes below)
□ Escalate to earlier termination (requires senior HR approval)

NEXT STEPS:
[What must happen in the next 30 days]
`}

EMPLOYEE COMMENTS:
[Employee's response to this review]


_______________________________________     ______________
Employee Signature                           Date

_______________________________________     ______________
Manager Signature                            Date

_______________________________________     ______________
HR Representative Signature                  Date`;
}

/**
 * Generate termination letter
 */
export function generateTerminationLetter(
  pip: PerformanceImprovementPlan,
  employee: Employee,
  expectations: PIPExpectation[],
  finalReview: PIPMilestoneReview | null
): string {
  const terminationDate = pip.outcome_date
    ? new Date(pip.outcome_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  return `TERMINATION OF EMPLOYMENT

Date: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}

To: ${employee.name}
Position: ${employee.title || 'Employee'}
From: ${pip.manager_name}

Dear ${employee.name.split(' ')[0]},

This letter is to inform you that your employment is terminated effective ${terminationDate}.

This decision follows a 90-day Performance Improvement Plan that began on ${new Date(pip.start_date).toLocaleDateString()}. Despite clear expectations, regular check-ins, and provided support, the required level of improvement has not been achieved.

Specifically, the following expectations were not met:

${expectations
  .filter(e => e.status === 'not_met' || e.status === 'pending')
  .map((exp, index) => `${index + 1}. ${exp.category}: ${exp.expectation}`)
  .join('\n')}

${finalReview?.decision_rationale || 'Over the course of the PIP, we conducted regular check-ins and formal milestone reviews. The consistent feedback indicated that the required performance standards were not being met.'}

**NEXT STEPS**

Human Resources will contact you to discuss:
- Final paycheck and accrued vacation payout
- COBRA health insurance continuation
- Return of company property
- Exit interview scheduling

You will receive a separate communication from HR regarding severance (if applicable) and benefits information.

We wish you well in your future endeavors.

Sincerely,

_______________________________________
${pip.manager_name}

CC: Human Resources
    Personnel File`;
}

/**
 * Generate success completion letter
 */
export function generateSuccessLetter(
  pip: PerformanceImprovementPlan,
  employee: Employee,
  expectations: PIPExpectation[]
): string {
  return `SUCCESSFUL COMPLETION OF PERFORMANCE IMPROVEMENT PLAN

Date: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}

To: ${employee.name}
Position: ${employee.title || 'Employee'}
From: ${pip.manager_name}

Dear ${employee.name.split(' ')[0]},

I am pleased to inform you that you have successfully completed your Performance Improvement Plan.

Over the past 90 days (${new Date(pip.start_date).toLocaleDateString()} through ${new Date().toLocaleDateString()}), you demonstrated the improvement we needed to see. Specifically:

${expectations
  .filter(e => e.status === 'met')
  .map((exp, index) => `${index + 1}. ${exp.category}: You met the expectation of "${exp.expectation}"`)
  .join('\n')}

Your hard work and commitment to improvement have been evident throughout this process. The PIP is now closed, and you will return to regular performance management.

Going forward, I expect you to maintain the performance standards you've demonstrated in recent weeks. We will continue with regular check-ins to ensure continued success.

Congratulations on your achievement.

Sincerely,

_______________________________________
${pip.manager_name}

CC: Human Resources
    Personnel File`;
}

/**
 * Generate audit trail (timeline of all PIP interactions)
 */
export interface AuditEntry {
  date: string;
  type: 'pip_created' | 'check_in' | 'milestone_review' | 'expectation_update' | 'outcome';
  description: string;
  participants: string[];
  documentation: string;
}

export function generateAuditTrail(
  pip: PerformanceImprovementPlan,
  expectations: PIPExpectation[],
  checkIns: PIPCheckIn[],
  milestoneReviews: PIPMilestoneReview[]
): AuditEntry[] {
  const entries: AuditEntry[] = [];

  // PIP Created
  entries.push({
    date: pip.created_at,
    type: 'pip_created',
    description: `PIP initiated for performance issues: ${pip.reason_for_pip.slice(0, 100)}...`,
    participants: [pip.manager_name, 'HR'],
    documentation: 'PIP letter delivered to employee',
  });

  // Check-ins
  checkIns.forEach(checkIn => {
    entries.push({
      date: checkIn.check_in_date,
      type: 'check_in',
      description: `${checkIn.check_in_type} check-in - Status: ${checkIn.overall_status || 'Not assessed'}`,
      participants: checkIn.attendees || [pip.manager_name],
      documentation: checkIn.progress_summary || 'Check-in completed',
    });
  });

  // Milestone Reviews
  milestoneReviews.forEach(review => {
    entries.push({
      date: review.review_date,
      type: 'milestone_review',
      description: `${review.milestone.replace('_', '-').toUpperCase()} Milestone Review - Rating: ${review.overall_rating || 'Not rated'}`,
      participants: review.attendees || [pip.manager_name, 'HR'],
      documentation: `Decision: ${review.decision}. ${review.decision_rationale.slice(0, 150)}...`,
    });
  });

  // Expectation Updates
  expectations.forEach(exp => {
    if (exp.reviewed_date) {
      entries.push({
        date: exp.reviewed_date,
        type: 'expectation_update',
        description: `Expectation "${exp.category}" updated to ${exp.status}`,
        participants: [pip.manager_name],
        documentation: exp.review_notes || 'Status updated',
      });
    }
  });

  // Outcome
  if (pip.outcome_date) {
    entries.push({
      date: pip.outcome_date,
      type: 'outcome',
      description: `PIP Outcome: ${pip.outcome}`,
      participants: [pip.manager_name, 'HR'],
      documentation: pip.outcome_notes || '',
    });
  }

  // Sort by date
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Format audit trail as text document
 */
export function formatAuditTrailDocument(
  entries: AuditEntry[],
  pip: PerformanceImprovementPlan,
  employee: Employee
): string {
  const header = `PERFORMANCE IMPROVEMENT PLAN - COMPLETE AUDIT TRAIL

Employee: ${employee.name}
Position: ${employee.title || 'Employee'}
PIP Start Date: ${new Date(pip.start_date).toLocaleDateString()}
PIP End Date: ${new Date(pip.end_date).toLocaleDateString()}
Manager: ${pip.manager_name}

This document provides a complete timeline of all documented interactions during the Performance Improvement Plan period. This serves as legal documentation of the process followed.

────────────────────────────────────────────────────────────

TIMELINE OF INTERACTIONS
`;

  const timeline = entries
    .map((entry, index) => {
      const date = new Date(entry.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      return `
${index + 1}. ${date} - ${entry.type.toUpperCase().replace('_', ' ')}
   ${entry.description}
   Participants: ${entry.participants.join(', ')}
   Documentation: ${entry.documentation}
   `;
    })
    .join('\n');

  const footer = `
────────────────────────────────────────────────────────────

SUMMARY

Total Interactions: ${entries.length}
Check-Ins Conducted: ${entries.filter(e => e.type === 'check_in').length}
Milestone Reviews: ${entries.filter(e => e.type === 'milestone_review').length}
Duration: ${Math.floor((new Date(pip.end_date).getTime() - new Date(pip.start_date).getTime()) / (1000 * 60 * 60 * 24))} days

This audit trail demonstrates that the employee was:
1. Given clear, specific performance expectations
2. Provided regular feedback and coaching
3. Offered support and resources to improve
4. Given adequate time to demonstrate improvement (90 days)
5. Treated fairly and consistently throughout the process

Document prepared: ${new Date().toLocaleDateString()}
Prepared by: ${pip.manager_name}

This document should be retained in the employee personnel file for legal compliance purposes.`;

  return header + timeline + footer;
}

/**
 * Email templates
 */
export function generatePIPEmail(
  pip: PerformanceImprovementPlan,
  employee: Employee,
  expectations: PIPExpectation[]
): { subject: string; body: string } {
  const letter = generatePIPLetter(pip, employee, expectations);

  return {
    subject: letter.subject,
    body: `${employee.name.split(' ')[0]},

Please find attached your Performance Improvement Plan letter that we discussed in our meeting today.

This letter outlines:
• The performance areas requiring improvement
• Specific, measurable expectations
• Timeline and milestone review dates (30/60/90 days)
• Support and resources available to you
• Next steps

Please review this document carefully. We will schedule our first weekly check-in within the next 3 days.

If you have any questions about the expectations or process, please reach out.

${pip.manager_name}

────────────────────────────────────────

${letter.body}`,
  };
}

/**
 * Generate check-in summary email
 */
export function generateCheckInSummaryEmail(
  checkIn: PIPCheckIn,
  employeeName: string,
  managerName: string
): { subject: string; body: string } {
  return {
    subject: `PIP Check-In Summary - ${new Date(checkIn.check_in_date).toLocaleDateString()}`,
    body: `${employeeName.split(' ')[0]},

Thank you for our check-in meeting today. Here's a summary of what we discussed:

PROGRESS SUMMARY:
${checkIn.progress_summary}

${checkIn.challenges ? `CHALLENGES IDENTIFIED:\n${checkIn.challenges}\n\n` : ''}

${checkIn.manager_feedback ? `MY FEEDBACK:\n${checkIn.manager_feedback}\n\n` : ''}

${checkIn.action_items ? `ACTION ITEMS FOR NEXT WEEK:\n${checkIn.action_items}\n\n` : ''}

NEXT CHECK-IN: [Date and time]

Please let me know if I've missed anything or if you have questions about next steps.

${managerName}`,
  };
}

