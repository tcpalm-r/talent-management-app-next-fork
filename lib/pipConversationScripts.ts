/**
 * PIP Conversation Scripts and Best Practices
 * Provides managers with guidance for difficult PIP conversations
 */

export type ConversationStage = 
  | 'initial_meeting' 
  | 'weekly_checkin' 
  | 'thirty_day_review' 
  | 'sixty_day_review'
  | 'ninety_day_review'
  | 'success_completion'
  | 'termination';

export interface ConversationScript {
  stage: ConversationStage;
  title: string;
  duration: string;
  participants: string[];
  preMeetingChecklist: string[];
  openingScript: string;
  keyPoints: string[];
  avoidSaying: string[];
  doSay: string[];
  commonQuestions: Array<{ question: string; suggestedAnswer: string }>;
  postMeetingActions: string[];
  hrRequired: boolean;
  documentationRequired: string[];
}

export const CONVERSATION_SCRIPTS: Record<ConversationStage, ConversationScript> = {
  initial_meeting: {
    stage: 'initial_meeting',
    title: 'Initial PIP Meeting',
    duration: '45-60 minutes',
    participants: ['Manager', 'Employee', 'HR Representative (Required)'],
    preMeetingChecklist: [
      'Review all performance documentation with HR',
      'Have HR representative present (legally required)',
      'Book private conference room (not open area)',
      'Schedule adequate time (45-60 minutes)',
      'Prepare printed PIP letter for employee',
      'Have tissues available (employee may become emotional)',
      'Notify employee this is a "performance discussion" - no surprises',
    ],
    openingScript: `"Thank you for meeting with me today. [HR Name] is here to ensure this conversation is fair and documented properly. 

This is a difficult conversation, but I need to be direct and clear with you. Based on [specific performance issues - cite dates and examples], we need to implement a formal Performance Improvement Plan.

I want to be clear that this is not a decision I've made lightly. We've discussed these concerns in our previous meetings on [dates], and despite those conversations, we haven't seen the improvement we need to see.

The goal of this PIP is to give you a clear roadmap to success and the support you need to get there. I genuinely want to see you succeed in this role."`,
    keyPoints: [
      'State specific performance gaps with examples and dates',
      'Explain this is a formal process with timeline (30/60/90 days)',
      'Review each expectation clearly and ask for understanding',
      'Emphasize support available (training, resources, coaching)',
      'Be clear about consequences if no improvement',
      'Give employee time to ask questions and respond',
      'Schedule weekly check-ins starting immediately',
    ],
    avoidSaying: [
      '"This is your last chance" - implies pre-determined outcome',
      '"We\'re trying to fire you" - creates adversarial tone',
      '"Everyone else is doing fine" - comparison is not helpful',
      '"You should have known better" - judgmental, not constructive',
      '"I don\'t have a choice" - you do, own the decision',
      'Making promises you can\'t keep about outcomes',
    ],
    doSay: [
      '"I want to see you succeed and here\'s exactly what that looks like"',
      '"These are the specific, measurable expectations you need to meet"',
      '"I\'m committed to supporting you through this process"',
      '"Let\'s talk about what support you need from me"',
      '"Do you understand what\'s being asked of you?"',
      '"What questions do you have right now?"',
    ],
    commonQuestions: [
      {
        question: 'Why are you doing this to me?',
        suggestedAnswer: '"This isn\'t personal. The job requires [specific standards], and despite our previous conversations, we haven\'t seen that level of performance. This PIP gives us a structured way to define exactly what success looks like and support you in getting there."',
      },
      {
        question: 'Are you going to fire me?',
        suggestedAnswer: '"That\'s not the goal. The goal is improvement. If you meet these expectations, you\'ll continue in your role. If you don\'t meet them by the end of 90 days, we\'ll have to make a decision at that point. But I want to see you succeed."',
      },
      {
        question: 'This isn\'t fair!',
        suggestedAnswer: '"I understand this feels difficult. That\'s why we have specific, measurable expectations written down. Let\'s go through each one so you understand exactly what\'s expected. If anything is unclear, let\'s discuss it now."',
      },
      {
        question: 'Can I transfer to another team instead?',
        suggestedAnswer: '"Our focus right now needs to be on this PIP and these expectations. If you want to explore other options after we see how the first 30 days go, we can discuss that with HR."',
      },
    ],
    postMeetingActions: [
      'Document employee\'s reaction and any questions asked',
      'Send formal PIP letter within 24 hours (email + printed)',
      'Schedule first weekly check-in within 3 days',
      'Notify HR of meeting outcome',
      'Set calendar reminders for all milestone reviews',
      'Prepare resources and training materials',
    ],
    hrRequired: true,
    documentationRequired: [
      'Meeting notes with date, time, attendees',
      'Employee\'s verbal response to PIP',
      'Questions asked and answers given',
      'Next steps and scheduled check-in date',
    ],
  },

  weekly_checkin: {
    stage: 'weekly_checkin',
    title: 'Weekly Check-In',
    duration: '20-30 minutes',
    participants: ['Manager', 'Employee'],
    preMeetingChecklist: [
      'Review progress on each expectation since last check-in',
      'Prepare specific examples of progress or gaps',
      'Have documentation from previous week ready',
      'Identify any new resources or support needed',
    ],
    openingScript: `"Thanks for meeting. Let's review your progress on each of the PIP expectations. I want to celebrate wins and identify where we need to focus more attention.

How are you feeling about your progress this week?"`,
    keyPoints: [
      'Go through each expectation one by one',
      'Ask employee for their self-assessment first',
      'Provide specific feedback (positive and constructive)',
      'Identify obstacles and problem-solve together',
      'Clarify anything that\'s unclear',
      'Set specific goals for next week',
    ],
    avoidSaying: [
      '"You\'re still not getting it" - be specific about what\'s missing',
      '"I don\'t see any improvement" - acknowledge small wins',
      '"This should be obvious" - if it were, they\'d be doing it',
      'Comparisons to other employees',
    ],
    doSay: [
      '"I noticed improvement in [specific area] - that\'s exactly what we need"',
      '"Let\'s talk about what\'s blocking you on [expectation]"',
      '"What do you need from me to be successful this week?"',
      '"Here\'s what success looks like for [specific expectation]"',
    ],
    commonQuestions: [
      {
        question: 'Am I going to make it?',
        suggestedAnswer: '"That\'s up to you. If you continue the progress I\'m seeing in [areas], and we address [gaps], you absolutely can. Let\'s focus on this week\'s goals."',
      },
      {
        question: 'Can we extend the PIP?',
        suggestedAnswer: '"Let\'s see where you are at the 30-day review. If you\'re showing clear progress but need more time, we can discuss that. But right now, let\'s focus on these expectations."',
      },
    ],
    postMeetingActions: [
      'Document progress on each expectation',
      'Note employee\'s self-assessment and engagement level',
      'Record any obstacles or support requests',
      'Update expectation status in system',
      'Schedule next check-in',
    ],
    hrRequired: false,
    documentationRequired: [
      'Date and duration of check-in',
      'Progress on each expectation (specific examples)',
      'Employee\'s comments and concerns',
      'Action items for next week',
    ],
  },

  thirty_day_review: {
    stage: 'thirty_day_review',
    title: '30-Day Milestone Review',
    duration: '45-60 minutes',
    participants: ['Manager', 'Employee', 'HR Representative (Recommended)'],
    preMeetingChecklist: [
      'Review all weekly check-in notes',
      'Assess progress on each expectation objectively',
      'Prepare decision: Continue, Extend, or Terminate',
      'Have HR review your assessment',
      'Prepare specific examples (positive and negative)',
    ],
    openingScript: `"We're at the 30-day milestone of your PIP. Let's review your progress together. I want to be honest and direct about where things stand.

Over the past 30 days, here's what I've observed..."`,
    keyPoints: [
      'Review each expectation with current status (Met/Partially Met/Not Met)',
      'Provide specific evidence for each assessment',
      'Get employee\'s perspective on their progress',
      'If on track: Encourage and outline next 30 days',
      'If struggling: Identify what needs to change immediately',
      'Make clear decision: Continue as-is, modify PIP, or terminate',
    ],
    avoidSaying: [
      '"You\'ve made zero progress" - acknowledge any improvement',
      '"I think we should end this" - be definitive if terminating',
      'Being vague about the decision or next steps',
    ],
    doSay: [
      '"In the past 30 days, you\'ve met expectations in [areas]"',
      '"However, in [areas] we haven\'t seen the improvement needed"',
      '"For the next 30 days, here\'s what must happen..."',
      '"Based on this trajectory, here\'s my assessment of likelihood of success"',
    ],
    commonQuestions: [
      {
        question: 'Am I going to be fired?',
        suggestedAnswer: '"If we continue on the current trajectory in [struggling areas], yes, we will likely terminate employment at the 60 or 90-day mark. That\'s why the next 30 days are critical. Here\'s specifically what needs to change..."',
      },
      {
        question: 'Can I have more time?',
        suggestedAnswer: '"PIPs are typically 90 days. If you\'re showing progress but need refinement, we can discuss that at 60 or 90 days. But right now, we need to see clear improvement in [areas]."',
      },
    ],
    postMeetingActions: [
      'Complete formal 30-day review form',
      'Document decision (continue/modify/terminate)',
      'Update expectations or add new ones if needed',
      'Set goals for next 30 days',
      'Notify HR of decision and next steps',
      'If terminating: Begin offboarding process with HR',
    ],
    hrRequired: true,
    documentationRequired: [
      'Formal written assessment of each expectation',
      'Overall rating (Exceeds/Meets/Partially Meets/Does Not Meet)',
      'Employee\'s comments and reactions',
      'Decision and rationale',
      'Next steps and modified expectations if any',
    ],
  },

  sixty_day_review: {
    stage: 'sixty_day_review',
    title: '60-Day Milestone Review',
    duration: '45-60 minutes',
    participants: ['Manager', 'Employee', 'HR Representative (Required)'],
    preMeetingChecklist: [
      'Review all check-in notes from days 31-60',
      'Compare progress to 30-day review',
      'Make preliminary decision (likely to succeed or not)',
      'Involve HR in decision-making',
      'Prepare termination plan if needed',
    ],
    openingScript: `"We're at the 60-day mark. This is a critical milestone. Let's review your progress since our 30-day meeting.

At this point, I need to be able to see a clear trajectory toward meeting all expectations. Let me share what I've observed..."`,
    keyPoints: [
      'Assess trend: Improving, plateaued, or declining',
      'Compare to 30-day review (better, same, worse)',
      'If improving: Encourage and clarify final 30 days',
      'If not: Clearly state likelihood of termination',
      'Set expectations for final 30 days (last chance)',
      'Be prepared to terminate if no improvement',
    ],
    avoidSaying: [
      'Giving false hope if termination is likely',
      'Being ambiguous about the seriousness',
      'Introducing new expectations at this late stage',
    ],
    doSay: [
      '"Comparing to our 30-day review, I see [improvement/no change/decline] in..."',
      '"To be successful, the final 30 days require [specific outcomes]"',
      '"Based on the current trajectory, here\'s my honest assessment..."',
      '"If things don\'t change significantly, we will likely terminate at 90 days"',
    ],
    commonQuestions: [
      {
        question: 'Am I definitely getting fired?',
        suggestedAnswer: '"If we don\'t see significant improvement in [specific areas] in the next 30 days, yes, employment will likely end. The decision will be based on whether you meet these final expectations. You know what they are. It\'s in your hands."',
      },
    ],
    postMeetingActions: [
      'Complete formal 60-day review form',
      'If likely to terminate: Begin separation planning with HR',
      'Update documentation with latest assessment',
      'Schedule 90-day final review',
      'Notify senior leadership if termination likely',
    ],
    hrRequired: true,
    documentationRequired: [
      'Formal assessment comparing to 30-day review',
      'Trajectory analysis (improving/static/declining)',
      'Likelihood of success assessment',
      'Decision rationale',
      'Final 30-day expectations',
    ],
  },

  ninety_day_review: {
    stage: 'ninety_day_review',
    title: '90-Day Final Review',
    duration: '45-60 minutes',
    participants: ['Manager', 'Employee', 'HR Representative (Required)'],
    preMeetingChecklist: [
      'Complete comprehensive review of all 90 days',
      'Make final decision with HR (Success or Terminate)',
      'Prepare all documentation for final meeting',
      'If terminating: Have severance package ready',
      'If successful: Prepare ongoing expectations',
    ],
    openingScript: `"We're at the end of the 90-day PIP. I've reviewed your progress across all expectations, and I want to share my decision with you.

[IF SUCCESSFUL]: Over these 90 days, you've demonstrated clear improvement in [areas]. You've met the expectations we set, and I'm pleased to tell you that you've successfully completed this PIP.

[IF TERMINATING]: Over these 90 days, despite the support and clear expectations, we haven't seen the level of improvement needed in [areas]. Based on this, we've made the decision to end your employment effective [date]."`,
    keyPoints: [
      'Start with the decision (don\'t make them wait)',
      'Provide specific evidence supporting the decision',
      'If successful: Outline ongoing expectations and support',
      'If terminating: Explain severance, timing, next steps',
      'Allow employee to respond and ask questions',
      'Handle the conversation with dignity and respect',
    ],
    avoidSaying: [
      '"This is just as hard for me" - centers yourself, not them',
      '"You can use me as a reference" - legal liability',
      'Apologizing for the decision if terminating',
      'Debating the decision (it\'s final)',
    ],
    doSay: [
      '"Based on [specific evidence], you have/have not met the expectations"',
      '"Here are the specific outcomes from the past 90 days..."',
      '"I want to thank you for [positive aspects during PIP]"',
      '"HR will explain next steps regarding [severance/continuation]"',
    ],
    commonQuestions: [
      {
        question: 'Can I appeal this decision?',
        suggestedAnswer: '[TERMINATING] "HR will explain your rights and the appeals process. All of our documentation from the past 90 days will be available for review."',
      },
      {
        question: 'What happens now?',
        suggestedAnswer: '[SUCCESSFUL] "We\'ll continue with regular performance management. I\'ll be watching [specific areas] closely, but you\'re no longer on a PIP. Congratulations on your hard work." [TERMINATING] "HR will walk you through the separation process, including timing, severance, benefits, and what happens with your work."',
      },
    ],
    postMeetingActions: [
      'Complete final PIP review form with outcome',
      'Document decision rationale thoroughly',
      'If successful: Schedule 30/60/90 day follow-up check-ins',
      'If terminating: Coordinate offboarding with HR immediately',
      'Archive all PIP documentation',
      'Debrief with HR on lessons learned',
    ],
    hrRequired: true,
    documentationRequired: [
      'Comprehensive 90-day assessment',
      'Final decision (Success or Termination)',
      'Detailed rationale with evidence',
      'Employee\'s final comments',
      'Next steps documented',
      'Sign-offs from manager and HR',
    ],
  },

  success_completion: {
    stage: 'success_completion',
    title: 'PIP Success Meeting',
    duration: '30 minutes',
    participants: ['Manager', 'Employee', 'HR (Optional)'],
    preMeetingChecklist: [
      'Prepare specific examples of improvement',
      'Outline ongoing expectations',
      'Plan celebration/recognition',
    ],
    openingScript: `"Congratulations. You've successfully completed the Performance Improvement Plan. Over the past 90 days, you've demonstrated the improvement we needed to see.

Specifically, you've [list specific improvements with examples]. This is exactly what we were looking for, and I want to acknowledge the hard work you put in."`,
    keyPoints: [
      'Celebrate the achievement genuinely',
      'Highlight specific improvements',
      'Clarify ongoing expectations (not back to old habits)',
      'Express confidence in their continued success',
      'Remove PIP stigma - fresh start',
    ],
    avoidSaying: [
      '"You barely made it" - minimize their success',
      '"Don\'t mess up again" - threatening tone',
      '"Now we\'ll be watching you" - sounds punitive',
    ],
    doSay: [
      '"You demonstrated you can [specific achievement]"',
      '"I\'m proud of the work you put in"',
      '"This is a fresh start - the PIP is behind you"',
      '"Keep doing what you\'ve been doing these past few weeks"',
    ],
    commonQuestions: [
      {
        question: 'Will this be on my permanent record?',
        suggestedAnswer: '"The PIP will be in your file, but you completed it successfully. Going forward, your performance reviews will reflect your current performance, not the PIP."',
      },
    ],
    postMeetingActions: [
      'Close PIP with "Successful" outcome',
      'Update employee file',
      'Schedule regular check-ins to maintain momentum',
      'Consider recognition or praise in team setting',
    ],
    hrRequired: false,
    documentationRequired: [
      'Final outcome: Successful completion',
      'Summary of improvements achieved',
      'Ongoing expectations documented',
    ],
  },

  termination: {
    stage: 'termination',
    title: 'Termination Meeting',
    duration: '20-30 minutes',
    participants: ['Manager', 'Employee', 'HR Representative (Required)', 'Witness (Recommended)'],
    preMeetingChecklist: [
      'Have HR present (legally required)',
      'Prepare all final paperwork (severance, COBRA, etc.)',
      'Coordinate IT access removal timing',
      'Plan for return of company property',
      'Have security available if needed',
      'Prepare manager\'s own emotions (this is hard)',
    ],
    openingScript: `"Thank you for meeting with us. [HR Name] is here because we need to discuss the outcome of your Performance Improvement Plan.

Over the past 90 days, despite the clear expectations and support provided, we haven't seen the level of improvement needed in [specific areas]. Because of this, we've made the decision to end your employment, effective [date].

[HR Name] will walk you through next steps, severance, and benefits."`,
    keyPoints: [
      'State the decision clearly in first 30 seconds',
      'Be brief, professional, and factual',
      'Don\'t debate or relitigate the PIP',
      'Let HR handle logistics (severance, benefits, timing)',
      'Show respect and dignity',
      'Keep it short (15-20 minutes max)',
    ],
    avoidSaying: [
      '"I\'m sorry" - implies you made a mistake',
      '"This is really hard for me" - centers yourself',
      '"You\'re a great person but..." - mixed messages',
      'Providing detailed reasoning (opens debate)',
      'Making any promises about references or future',
    ],
    doSay: [
      '"This decision is final"',
      '"HR will explain your severance package"',
      '"We\'ll coordinate the return of company property"',
      '"I wish you well in your next opportunity"',
    ],
    commonQuestions: [
      {
        question: 'Can I have another chance?',
        suggestedAnswer: '"The decision is final. We gave this 90 days with clear expectations and support. HR will explain next steps."',
      },
      {
        question: 'Will you give me a reference?',
        suggestedAnswer: '"For reference checks, we\'ll confirm dates of employment and job title. HR can explain our reference policy."',
      },
      {
        question: 'Why are you doing this?',
        suggestedAnswer: '"We had clear expectations documented in the PIP. Those expectations weren\'t met. The decision is based on performance, not personal."',
      },
    ],
    postMeetingActions: [
      'Immediately coordinate with IT for access removal',
      'Collect company property (laptop, badge, keys)',
      'Complete termination paperwork with HR',
      'Update employee status in all systems',
      'Communicate to team (brief, professional)',
      'Debrief with HR on process and documentation',
    ],
    hrRequired: true,
    documentationRequired: [
      'Termination letter with effective date',
      'Final PIP assessment showing unmet expectations',
      'Timeline of all PIP interactions',
      'Severance agreement if applicable',
      'Separation checklist completion',
    ],
  },
};

/**
 * Get appropriate script based on PIP stage
 */
export function getConversationScript(
  daysInPIP: number,
  pipStatus: string
): ConversationScript {
  if (pipStatus === 'completed') {
    return CONVERSATION_SCRIPTS.success_completion;
  }
  
  if (pipStatus === 'terminated') {
    return CONVERSATION_SCRIPTS.termination;
  }

  if (daysInPIP < 30) {
    return CONVERSATION_SCRIPTS.weekly_checkin;
  } else if (daysInPIP >= 28 && daysInPIP <= 32) {
    return CONVERSATION_SCRIPTS.thirty_day_review;
  } else if (daysInPIP >= 58 && daysInPIP <= 62) {
    return CONVERSATION_SCRIPTS.sixty_day_review;
  } else if (daysInPIP >= 88) {
    return CONVERSATION_SCRIPTS.ninety_day_review;
  }

  return CONVERSATION_SCRIPTS.weekly_checkin;
}

/**
 * Best practices for PIP management
 */
export const PIP_BEST_PRACTICES = {
  checkin_frequency: {
    days_1_30: 'Weekly (minimum), daily for severe cases',
    days_31_60: 'Weekly',
    days_61_90: 'Weekly, with final review preparation',
  },
  documentation_guidelines: [
    'Document every interaction within 24 hours',
    'Use specific examples with dates and metrics',
    'Include employee\'s comments and reactions',
    'Note what support was provided',
    'Keep copies of all emails and communications',
  ],
  common_mistakes: [
    'Waiting too long between check-ins',
    'Not documenting conversations',
    'Being vague about expectations',
    'Adding new expectations mid-PIP',
    'Not involving HR enough',
    'Giving up on the employee too early',
    'Dragging out inevitable termination',
  ],
  success_factors: [
    'Crystal clear, measurable expectations',
    'Consistent check-in schedule',
    'Genuine manager support and coaching',
    'Employee accountability and ownership',
    'Appropriate resources provided',
    'Regular HR consultation',
    'Honest, direct feedback',
  ],
};

