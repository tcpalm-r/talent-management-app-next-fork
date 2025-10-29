/**
 * Create 360 Review for Leader 1 [TEST]
 * With realistic, varied responses from test users
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Reviewers with their relationships
const REVIEWERS = [
  {
    name: 'Admin [TEST]',
    email: 'admin.test@example.com',
    relationship: 'manager',
  },
  {
    name: 'Leader 2 [TEST]',
    email: 'leader2.test@example.com',
    relationship: 'peer',
  },
  {
    name: 'User 1 [TEST]',
    email: 'user1.test@example.com',
    relationship: 'direct_report',
  },
  {
    name: 'User 2 [TEST]',
    email: 'user2.test@example.com',
    relationship: 'direct_report',
  },
  {
    name: 'User 3 [TEST]',
    email: 'user3.test@example.com',
    relationship: 'direct_report',
  },
  {
    name: 'User 4 [TEST]',
    email: 'user4.test@example.com',
    relationship: 'peer',
  },
];

// Rich response templates by reviewer
const RESPONSES = {
  'admin.test@example.com': {
    strengths: `Leader 1 has demonstrated exceptional strategic thinking and vision in their role. They excel at translating high-level organizational goals into actionable team initiatives. Their ability to build consensus across departments and navigate complex organizational dynamics is particularly noteworthy. I've observed them successfully leading cross-functional initiatives that required significant stakeholder alignment. They're also excellent at developing talent - several of their direct reports have been promoted into leadership roles this year. Communication with senior leadership is clear, concise, and always well-prepared.`,

    improvements: `While Leader 1's strategic capabilities are strong, there's an opportunity to delegate more operational details to their team. Sometimes they get too involved in day-to-day execution when their time would be better spent on strategic initiatives. Additionally, I'd encourage them to be more proactive in seeking out diverse perspectives before making major decisions. While they do consult with stakeholders, expanding that circle earlier in the process could surface valuable insights and build even stronger buy-in.`,

    startStopContinue: `START: Investing more time in succession planning and identifying future leaders within the team. The organization would benefit from a clearer pipeline of talent ready for advancement.

STOP: Getting pulled into troubleshooting operational issues that the team is capable of handling. Trust the team to solve problems independently.

CONTINUE: The monthly "office hours" where anyone in the organization can book time to discuss ideas or concerns. This has created great visibility and approachability across the company.`,

    overall: `Leader 1 is a high-performing leader who has made significant contributions to the organization's strategic direction and team development. With some adjustments to delegation and decision-making processes, they have the potential to operate at an even higher level. I strongly support their continued growth in leadership roles.`
  },

  'leader2.test@example.com': {
    strengths: `Working alongside Leader 1 has been fantastic. They're collaborative, always willing to share resources and insights, and genuinely interested in the success of other teams. When we worked together on the Q3 product launch, their project management skills really shone - timelines were clear, stakeholders were aligned, and they handled unexpected roadblocks with grace. They're also great at giving constructive feedback in peer discussions. I particularly appreciate how they share both successes and failures transparently, which helps all of us learn.`,

    improvements: `One area where I think Leader 1 could improve is in setting boundaries with their team. I've noticed they sometimes respond to messages late at night or on weekends, which might be creating an unhealthy expectation for availability. As peers, we've talked about modeling better work-life balance, and this is an area where we could both improve. Also, in leadership meetings, Leader 1 could be more assertive when advocating for their team's needs - they tend to be accommodating even when their team might need more resources or support.`,

    startStopContinue: `START: Sharing your team's playbooks and processes more broadly. You've developed some excellent frameworks that other teams could benefit from learning.

STOP: Apologizing for taking up time in meetings when raising important points. Your perspective is valuable and shouldn't be minimized.

CONTINUE: The quarterly cross-team collaboration sessions you initiated. These have been excellent for breaking down silos and fostering innovation.`,

    overall: `Leader 1 is an excellent peer and collaborative leader. They contribute significantly to our leadership team's effectiveness and the broader organizational culture. I value working with them and hope we continue to partner on strategic initiatives.`
  },

  'user1.test@example.com': {
    strengths: `Leader 1 is the best manager I've had in my career. They genuinely care about my professional development and have invested significant time in coaching me through challenges. During our 1-on-1s, they ask thoughtful questions that help me think through problems rather than just giving me answers. They've also been incredibly supportive of my goal to move into a senior role - they've connected me with mentors, given me stretch assignments, and provided honest feedback on areas where I need to grow. I also appreciate how they communicate context behind decisions, which helps me understand the "why" behind our work priorities.`,

    improvements: `Sometimes Leader 1's high standards can feel overwhelming. While I appreciate the push to do excellent work, there have been times when I've worked late to meet expectations that might have been more flexible than I realized. More explicit conversation about which work absolutely must be perfect vs. where "good enough" is acceptable would be helpful. Also, when the team is under pressure, I've noticed Leader 1 can become less available for quick questions, which can slow us down when we need guidance.`,

    startStopContinue: `START: Celebrating small wins more often. The team works hard and would benefit from more frequent recognition, not just at project completion.

STOP: Sending detailed messages after hours. It makes me feel like I should also be working late, even when that's probably not the intention.

CONTINUE: The monthly 1-on-1s with clear agendas and action items. These have been incredibly valuable for my growth and I appreciate the consistency.`,

    overall: `I feel fortunate to have Leader 1 as my manager. They've significantly accelerated my career growth and created an environment where I feel challenged and supported. With some minor adjustments around workload management and communication expectations, this would be a perfect working relationship.`
  },

  'user2.test@example.com': {
    strengths: `Leader 1 creates a really positive team culture where everyone feels heard and valued. In team meetings, they make sure quieter team members have opportunities to contribute, and they genuinely consider all perspectives before making decisions. I've learned a lot about project management and stakeholder communication by watching how they operate. They're also great at shielding the team from organizational politics and noise, which allows us to focus on our work. When I made a significant mistake last quarter, Leader 1's response was to help me learn from it rather than make me feel badly about it.`,

    improvements: `I wish Leader 1 would push back more on unrealistic timelines from stakeholders. Sometimes we end up taking on commitments that stress the team unnecessarily. I understand the need to be responsive to business needs, but there are times when a more assertive stance would benefit team morale and work quality. Additionally, some team members have mentioned feeling unsure about how their work contributes to broader company goals - more regular communication about strategy and vision would be helpful.`,

    startStopContinue: `START: Regular team updates about organizational news and strategy. We sometimes hear things through the grapevine that would be better coming from you.

STOP: Saying "yes" to every request without first checking with the team about capacity. We want to support you, but need to be involved in these decisions.

CONTINUE: The team retrospectives after major projects. These have been great for continuous improvement and team bonding.`,

    overall: `Leader 1 is a supportive and thoughtful manager who has built a strong team culture. I'm happy to be part of this team and would recommend Leader 1 as a manager to others in the organization.`
  },

  'user3.test@example.com': {
    strengths: `I really appreciate Leader 1's technical knowledge and their willingness to roll up their sleeves when needed. When we were struggling with a complex technical challenge last month, they jumped in to pair program with me, which not only helped solve the problem but was a great learning experience. They trust the team to make decisions within our areas of expertise, which is empowering. I also value how they prioritize our professional development - they've been supportive of me attending conferences and have even helped me prepare presentations. Their door is always open for questions or concerns.`,

    improvements: `While I appreciate Leader 1's technical involvement, sometimes they can get too deep in the weeds of implementation details. There have been instances where they've suggested approaches that, while technically sound, might not be the best use of time given our priorities. Trusting the team's judgment on technical implementation choices would allow them to focus more on strategic work. Also, feedback on my performance tends to come up during review cycles rather than in real-time, so I sometimes wonder if I'm meeting expectations between formal reviews.`,

    startStopContinue: `START: Providing more frequent informal feedback, both positive and constructive. Even just quick comments like "great job on X" or "next time consider Y" would be helpful.

STOP: Overriding technical decisions that the team has thoughtfully made. Trust that we've considered the tradeoffs unless there's a critical issue.

CONTINUE: Advocating for learning and development budget. The team really benefits from courses, conferences, and training opportunities you've secured for us.`,

    overall: `Leader 1 is a knowledgeable and supportive manager who has created a good environment for growth and learning. With some adjustments to feedback frequency and technical delegation, this would be an even more effective leadership relationship.`
  },

  'user4.test@example.com': {
    strengths: `I don't directly report to Leader 1, but we collaborate frequently on cross-functional projects, and they're excellent to work with. They're organized, responsive, and always come prepared to meetings with clear agendas and objectives. When we've had differing opinions on approach, they've been open to discussion and willing to find compromise solutions. I also appreciate that they follow through on commitments reliably - if Leader 1 says they'll do something, it gets done. They're also good at giving credit to collaborators and highlighting team contributions in broader forums.`,

    improvements: `In some of our joint initiatives, I've felt that decision-making could move faster. Leader 1 sometimes wants to gather extensive input before proceeding, which is thorough but can slow momentum. There's a balance between being consultative and being decisive that could be calibrated. Also, in a few instances, communication about changes or decisions could have been more proactive - I've learned about shifts in direction second-hand that would have been better coming directly from Leader 1.`,

    startStopContinue: `START: Setting clearer decision-making frameworks upfront in collaborative projects. Knowing who has final say on what would help things move more smoothly.

STOP: Trying to achieve perfect consensus before moving forward. Sometimes it's okay to make a decision and adjust based on feedback.

CONTINUE: The collaborative approach and willingness to partner across teams. It makes working together productive and enjoyable.`,

    overall: `Leader 1 is a strong collaborator and partner on cross-functional work. They bring good judgment, organization, and a team-oriented mindset to everything they do. I look forward to future opportunities to work together.`
  },
};

async function createLeader1Survey() {
  try {
    console.log('\n🚀 Creating 360 Review for Leader 1 [TEST]...\n');

    // Get Leader 1's employee record
    const { data: leader1, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', 'leader1.test@example.com')
      .single();

    if (empError || !leader1) {
      throw new Error('Leader 1 [TEST] not found in employees table');
    }

    console.log(`✅ Found employee: ${leader1.name} (${leader1.id})\n`);

    // Get questions
    const { data: questions, error: qError } = await supabase
      .from('feedback_360_questions')
      .select('*')
      .order('created_at')
      .limit(13);

    if (qError || !questions || questions.length === 0) {
      throw new Error('No questions found in feedback_360_questions table');
    }

    console.log(`✅ Found ${questions.length} questions\n`);

    // Create survey
    const surveyName = `360 Review - Leader 1 [TEST] - ${new Date().toLocaleDateString()}`;
    const { data: survey, error: surveyError } = await supabase
      .from('feedback_360_surveys')
      .insert({
        employee_id: leader1.id,
        survey_name: surveyName,
        status: 'in_progress',
        created_by: 'thomas.palmer@sonance.com',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (surveyError || !survey) {
      throw new Error(`Failed to create survey: ${surveyError?.message}`);
    }

    console.log(`✅ Created survey: ${survey.id}`);
    console.log(`   Name: ${surveyName}\n`);

    // Link questions to survey
    const surveyQuestions = questions.map((q, idx) => ({
      survey_id: survey.id,
      question_id: q.id,
      question_order: idx,
    }));

    const { error: sqError } = await supabase
      .from('feedback_360_survey_questions')
      .insert(surveyQuestions);

    if (sqError) {
      throw new Error(`Failed to link questions: ${sqError.message}`);
    }

    console.log(`✅ Linked ${questions.length} questions to survey\n`);

    // Create reviewers and responses
    console.log(`👥 Creating ${REVIEWERS.length} reviewers with detailed responses...\n`);

    for (const reviewer of REVIEWERS) {
      // Create reviewer
      const { data: reviewerRecord, error: reviewerError } = await supabase
        .from('feedback_360_survey_reviewers')
        .insert({
          survey_id: survey.id,
          reviewer_name: reviewer.name,
          reviewer_email: reviewer.email,
          relationship: reviewer.relationship,
          access_token: uuidv4(),
          status: 'completed',
          invited_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (reviewerError || !reviewerRecord) {
        console.error(`❌ Failed to create reviewer ${reviewer.name}`);
        continue;
      }

      // Get response templates for this reviewer
      const responseTemplate = RESPONSES[reviewer.email as keyof typeof RESPONSES];

      // Map questions to responses
      const responses = questions.map(q => {
        let responseText = '';
        const questionText = q.question_text.toLowerCase();

        if (questionText.includes('strength') || questionText.includes('excel')) {
          responseText = responseTemplate.strengths;
        } else if (questionText.includes('improv') || questionText.includes('develop') || questionText.includes('growth')) {
          responseText = responseTemplate.improvements;
        } else if (questionText.includes('start') || questionText.includes('stop') || questionText.includes('continue')) {
          responseText = responseTemplate.startStopContinue;
        } else {
          responseText = responseTemplate.overall;
        }

        return {
          survey_id: survey.id,
          reviewer_email: reviewer.email,
          question_id: q.id,
          response_text: responseText,
          rating: null,
        };
      });

      const { error: responsesError } = await supabase
        .from('feedback_360_responses')
        .insert(responses);

      if (responsesError) {
        console.error(`❌ Failed to create responses for ${reviewer.name}`);
        continue;
      }

      console.log(`   ✅ ${reviewer.name} (${reviewer.relationship}) - ${responses.length} detailed responses`);
    }

    console.log('\n✨ Survey creation complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Survey ID:       ${survey.id}`);
    console.log(`Survey Name:     ${surveyName}`);
    console.log(`Employee:        Leader 1 [TEST]`);
    console.log(`Reviewers:       ${REVIEWERS.length}`);
    console.log(`  - Manager:     Admin [TEST]`);
    console.log(`  - Peers:       Leader 2 [TEST], User 4 [TEST]`);
    console.log(`  - Reports:     User 1, 2, 3 [TEST]`);
    console.log(`Questions:       ${questions.length}`);
    console.log(`Total Responses: ${REVIEWERS.length * questions.length} (${REVIEWERS.length * questions.length * 150} avg words)`);
    console.log(`Status:          in_progress (ready for AI analysis)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Go to: http://localhost:3004');
    console.log('2. Find "360 Review - Leader 1 [TEST]" survey');
    console.log('3. Click "Complete Review with AI Analysis"');
    console.log('4. Wait for Claude AI to analyze all responses');
    console.log('5. View the comprehensive AI-generated report!');
    console.log('6. Test the "Export PDF" functionality\n');

    return survey.id;

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  }
}

// Run the script
createLeader1Survey()
  .then(() => {
    console.log('✅ SUCCESS!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 FAILED:', error.message);
    process.exit(1);
  });
