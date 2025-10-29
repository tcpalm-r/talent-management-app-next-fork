/**
 * Test Data Generator for 360 Feedback Surveys
 *
 * This script generates realistic test data for 360 feedback surveys including:
 * - Survey creation
 * - Reviewers with varied relationships
 * - Realistic qualitative responses
 * - Mix of positive/constructive feedback
 *
 * Usage:
 *   npx ts-node scripts/generate-test-360-data.ts
 *
 * Or with parameters:
 *   npx ts-node scripts/generate-test-360-data.ts <employee_email> <reviewer_count>
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// SAMPLE DATA POOLS
// ============================================================================

const SAMPLE_RESPONSES = {
  // Communication & Collaboration
  communication_positive: [
    "Excellent communicator who clearly articulates complex ideas in team meetings",
    "Always responsive to emails and Slack messages, keeps everyone in the loop",
    "Great at explaining technical concepts to non-technical stakeholders",
    "Leads meetings effectively and ensures everyone has a voice",
    "Provides clear and concise updates on project status",
    "Strong written communication skills, documentation is always thorough"
  ],
  communication_constructive: [
    "Could improve frequency of communication during critical project phases",
    "Sometimes communication style can be too direct, may benefit from more empathy",
    "Would benefit from providing more context when delegating tasks",
    "Could be more proactive in sharing blockers before they become issues",
    "Meeting presentations could be more concise and structured"
  ],

  // Technical Skills
  technical_positive: [
    "Deep technical expertise, go-to person for complex architecture decisions",
    "Consistently delivers high-quality, well-tested code",
    "Strong problem-solving skills, able to debug complex issues quickly",
    "Stays current with latest technologies and best practices",
    "Excellent code review skills, provides constructive feedback",
    "Strong understanding of system design and scalability"
  ],
  technical_constructive: [
    "Could benefit from deeper understanding of frontend frameworks",
    "Sometimes focuses too much on perfection rather than pragmatic solutions",
    "Would benefit from more documentation of technical decisions",
    "Could improve test coverage for edge cases",
    "Sometimes reinvents the wheel instead of using existing solutions"
  ],

  // Leadership & Mentorship
  leadership_positive: [
    "Exceptional mentor to junior team members, very patient and supportive",
    "Takes initiative on cross-team projects and drives them to completion",
    "Shows strong leadership during incidents and keeps team calm",
    "Great at delegating work appropriately and trusting team members",
    "Empowers others to make decisions and learn from mistakes",
    "Leads by example, sets high standards for the team"
  ],
  leadership_constructive: [
    "Could take more initiative in leading larger projects",
    "Sometimes hesitant to make decisions without consensus",
    "Would benefit from more confidence when presenting to leadership",
    "Could improve delegation skills, sometimes takes on too much",
    "Needs to be more assertive when disagreeing with senior leadership"
  ],

  // Collaboration & Teamwork
  collaboration_positive: [
    "Excellent team player, always willing to help others",
    "Creates a positive and inclusive team culture",
    "Great at building relationships across teams",
    "Handles conflict constructively and finds win-win solutions",
    "Celebrates team successes and acknowledges others' contributions",
    "Actively seeks input from diverse perspectives"
  ],
  collaboration_constructive: [
    "Could be more proactive in seeking help when blocked",
    "Sometimes works in isolation, could benefit from more pairing",
    "Would benefit from building stronger relationships with product team",
    "Could be more open to different approaches and ideas",
    "Sometimes focused more on individual goals than team goals"
  ],

  // Time Management & Delivery
  delivery_positive: [
    "Consistently meets deadlines and delivers high-quality work",
    "Excellent at breaking down large projects into manageable tasks",
    "Proactive about identifying and managing risks",
    "Strong prioritization skills, focuses on highest impact work",
    "Reliable and dependable, team can count on them",
    "Great at estimating work and managing expectations"
  ],
  delivery_constructive: [
    "Sometimes takes on too much and misses deadlines during crunch time",
    "Could improve time management during peak periods",
    "Would benefit from better prioritization of tasks",
    "Sometimes focuses on interesting work rather than urgent work",
    "Could be more realistic with time estimates"
  ],

  // Growth & Development
  growth_positive: [
    "Demonstrates strong growth mindset, always eager to learn",
    "Proactive about seeking feedback and acting on it",
    "Takes on challenging projects outside comfort zone",
    "Shows continuous improvement in technical and soft skills",
    "Shares learnings with team, helps everyone grow",
    "Embraces change and adapts quickly to new situations"
  ],
  growth_constructive: [
    "Could be more proactive about seeking stretch assignments",
    "Would benefit from more formal leadership training",
    "Sometimes resistant to feedback, could be more open-minded",
    "Could invest more time in professional development",
    "Would benefit from broader exposure to different parts of the system"
  ],

  // Start/Stop/Continue
  start: [
    "Start taking more ownership of cross-functional initiatives",
    "Start sharing knowledge more broadly through tech talks or documentation",
    "Start being more vocal in planning meetings with strategic input",
    "Start mentoring more junior team members formally",
    "Start building relationships with stakeholders outside engineering",
    "Start contributing to open source or engineering blog"
  ],
  stop: [
    "Stop working excessive hours, better work-life balance is important",
    "Stop being too perfectionistic, good enough is often sufficient",
    "Stop taking on too many projects simultaneously",
    "Stop interrupting others in meetings, give space for all voices",
    "Stop being too hard on yourself when things don't go perfectly",
    "Stop solving problems alone, involve the team more"
  ],
  continue: [
    "Continue mentoring junior engineers, you're making a real impact",
    "Continue being a positive force in team culture",
    "Continue challenging the status quo with innovative ideas",
    "Continue your excellent code review practices",
    "Continue being reliable and consistent in your delivery",
    "Continue fostering psychological safety on the team"
  ],

  // Overall Summary
  overall_positive: [
    "Outstanding performer who consistently exceeds expectations",
    "Valuable team member who makes everyone around them better",
    "Strong contributor with a bright future in the organization",
    "Exemplifies company values in their daily work",
    "Key player in the team's success this quarter"
  ],
  overall_constructive: [
    "Solid performer with room for growth in leadership",
    "Good contributor who could benefit from more strategic thinking",
    "Has potential to move to next level with focus on key development areas",
    "Reliable team member who would benefit from more initiative",
    "Strong technical skills, could improve soft skills"
  ]
};

const RELATIONSHIP_TYPES: Array<'manager' | 'peer' | 'direct_report' | 'self' | 'cross_functional'> = [
  'manager',
  'peer',
  'peer',
  'peer',
  'direct_report',
  'direct_report',
  'self',
  'cross_functional'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate realistic responses based on relationship type
 * Managers tend to be more strategic, peers more collaborative, reports more positive
 */
function generateResponses(relationship: string): {
  strengths: string;
  improvements: string;
  startStopContinue: string;
  overall: string;
} {
  let strengths: string[];
  let improvements: string[];
  let overall: string[];

  if (relationship === 'manager') {
    // Managers focus on leadership, delivery, strategic thinking
    strengths = [
      ...getRandomItems(SAMPLE_RESPONSES.leadership_positive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.delivery_positive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.technical_positive, 1)
    ];
    improvements = [
      ...getRandomItems(SAMPLE_RESPONSES.leadership_constructive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.communication_constructive, 1)
    ];
    overall = getRandomItems(SAMPLE_RESPONSES.overall_positive, 1);
  } else if (relationship === 'direct_report') {
    // Direct reports focus on mentorship, support, leadership
    strengths = [
      ...getRandomItems(SAMPLE_RESPONSES.leadership_positive, 2),
      ...getRandomItems(SAMPLE_RESPONSES.collaboration_positive, 1)
    ];
    improvements = [
      ...getRandomItems(SAMPLE_RESPONSES.leadership_constructive, 1)
    ];
    overall = getRandomItems(SAMPLE_RESPONSES.overall_positive, 1);
  } else if (relationship === 'self') {
    // Self-assessment tends to be more critical
    strengths = [
      ...getRandomItems(SAMPLE_RESPONSES.technical_positive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.collaboration_positive, 1)
    ];
    improvements = [
      ...getRandomItems(SAMPLE_RESPONSES.leadership_constructive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.delivery_constructive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.communication_constructive, 1)
    ];
    overall = getRandomItems(SAMPLE_RESPONSES.overall_constructive, 1);
  } else {
    // Peers focus on collaboration, technical skills, communication
    strengths = [
      ...getRandomItems(SAMPLE_RESPONSES.technical_positive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.collaboration_positive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.communication_positive, 1)
    ];
    improvements = [
      ...getRandomItems(SAMPLE_RESPONSES.technical_constructive, 1),
      ...getRandomItems(SAMPLE_RESPONSES.collaboration_constructive, 1)
    ];
    overall = getRandomItems(
      Math.random() > 0.3 ? SAMPLE_RESPONSES.overall_positive : SAMPLE_RESPONSES.overall_constructive,
      1
    );
  }

  return {
    strengths: strengths.join(' '),
    improvements: improvements.join(' '),
    startStopContinue: [
      getRandomItem(SAMPLE_RESPONSES.start),
      getRandomItem(SAMPLE_RESPONSES.stop),
      getRandomItem(SAMPLE_RESPONSES.continue)
    ].join(' '),
    overall: overall.join(' ')
  };
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

async function generateTest360Survey(
  employeeEmail: string,
  reviewerCount: number = 8
): Promise<string> {
  console.log('🚀 Starting 360 feedback test data generation...\n');

  try {
    // ========================================================================
    // STEP 1: Find employee
    // ========================================================================
    console.log(`📧 Looking for employee: ${employeeEmail}`);

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', employeeEmail)
      .single();

    if (empError || !employee) {
      throw new Error(`Employee not found with email: ${employeeEmail}`);
    }

    console.log(`✅ Found employee: ${employee.name} (${employee.id})\n`);

    // ========================================================================
    // STEP 2: Get default questions
    // ========================================================================
    console.log('📋 Fetching default 360 questions...');

    const { data: questions, error: questionsError } = await supabase
      .from('feedback_360_questions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (questionsError || !questions || questions.length === 0) {
      throw new Error('No active questions found in database');
    }

    console.log(`✅ Found ${questions.length} questions\n`);

    // ========================================================================
    // STEP 3: Create survey
    // ========================================================================
    console.log('📝 Creating survey...');

    const surveyName = `360 Review - ${employee.name} - ${new Date().toLocaleDateString()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks from now

    const { data: survey, error: surveyError } = await supabase
      .from('feedback_360_surveys')
      .insert({
        employee_id: employee.id,
        survey_name: surveyName,
        status: 'in_progress',
        due_date: dueDate.toISOString(),
        created_by: employee.id, // Using employee as creator for simplicity
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (surveyError || !survey) {
      throw new Error(`Failed to create survey: ${surveyError?.message}`);
    }

    console.log(`✅ Created survey: ${survey.id}`);
    console.log(`   Name: ${surveyName}\n`);

    // ========================================================================
    // STEP 4: Link questions to survey
    // ========================================================================
    console.log('🔗 Linking questions to survey...');

    const surveyQuestions = questions.map((q, idx) => ({
      survey_id: survey.id,
      question_id: q.id,
      question_order: idx
    }));

    const { error: sqError } = await supabase
      .from('feedback_360_survey_questions')
      .insert(surveyQuestions);

    if (sqError) {
      throw new Error(`Failed to link questions: ${sqError.message}`);
    }

    console.log(`✅ Linked ${questions.length} questions to survey\n`);

    // ========================================================================
    // STEP 5: Create reviewers and responses
    // ========================================================================
    console.log(`👥 Creating ${reviewerCount} reviewers with responses...\n`);

    const actualReviewerCount = Math.min(reviewerCount, RELATIONSHIP_TYPES.length);

    for (let i = 0; i < actualReviewerCount; i++) {
      const relationship = RELATIONSHIP_TYPES[i];
      const reviewerName = `${relationship.charAt(0).toUpperCase()}${relationship.slice(1).replace('_', ' ')} Reviewer ${i + 1}`;
      const reviewerEmail = `${relationship}.reviewer.${i + 1}@example.com`;

      // Create reviewer
      const { data: reviewer, error: reviewerError } = await supabase
        .from('feedback_360_survey_reviewers')
        .insert({
          survey_id: survey.id,
          reviewer_name: reviewerName,
          reviewer_email: reviewerEmail,
          relationship: relationship,
          access_token: uuidv4(),
          status: 'completed',
          invited_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          completed_at: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString() // Random within last 5 days
        })
        .select()
        .single();

      if (reviewerError || !reviewer) {
        console.error(`❌ Failed to create reviewer ${i + 1}`);
        continue;
      }

      // Generate responses for this reviewer
      const responseData = generateResponses(relationship);

      // Create responses for each question
      // We'll map questions to response data
      const responses = questions.map(q => {
        let responseText = '';
        const questionText = q.question_text.toLowerCase();

        if (questionText.includes('strength')) {
          responseText = responseData.strengths;
        } else if (questionText.includes('improv') || questionText.includes('develop')) {
          responseText = responseData.improvements;
        } else if (questionText.includes('start') || questionText.includes('stop') || questionText.includes('continue')) {
          responseText = responseData.startStopContinue;
        } else {
          responseText = responseData.overall;
        }

        return {
          survey_id: survey.id,
          reviewer_email: reviewerEmail,
          question_id: q.id,
          response_text: responseText,
          rating: null // Text-based questions
        };
      });

      const { error: responsesError } = await supabase
        .from('feedback_360_responses')
        .insert(responses);

      if (responsesError) {
        console.error(`❌ Failed to create responses for reviewer ${i + 1}`);
        continue;
      }

      console.log(`   ✅ ${reviewerName} (${relationship}) - ${responses.length} responses`);
    }

    console.log('\n✨ Test data generation complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Survey ID:       ${survey.id}`);
    console.log(`Survey Name:     ${surveyName}`);
    console.log(`Employee:        ${employee.name}`);
    console.log(`Reviewers:       ${actualReviewerCount}`);
    console.log(`Questions:       ${questions.length}`);
    console.log(`Total Responses: ${actualReviewerCount * questions.length}`);
    console.log(`Status:          in_progress (ready for AI analysis)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Go to the 360 Dashboard: http://localhost:3004');
    console.log('2. Find this survey and click "Complete Review with AI Analysis"');
    console.log('3. Wait 10-30 seconds for Claude AI to analyze the responses');
    console.log('4. View the comprehensive AI-generated report!\n');

    return survey.id;

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

// Check if this file is being run directly (ES module equivalent of require.main === module)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🎯 360 Feedback Test Data Generator

USAGE:
  npx ts-node scripts/generate-test-360-data.ts <employee_email> [reviewer_count]

PARAMETERS:
  employee_email   Email of employee to create survey for (must exist in employees table)
  reviewer_count   Number of reviewers to create (default: 8, max: 8)

EXAMPLES:
  npx ts-node scripts/generate-test-360-data.ts user1.test@example.com
  npx ts-node scripts/generate-test-360-data.ts user1.test@example.com 6

PREREQUISITES:
  - Employee must exist in 'employees' table
  - Questions must exist in 'feedback_360_questions' table
  - Environment variables must be set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
`);
    process.exit(0);
  }

  const employeeEmail = args[0];
  const reviewerCount = args[1] ? parseInt(args[1]) : 8;

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_URL environment variable not set');
    process.exit(1);
  }

  console.log('');
  generateTest360Survey(employeeEmail, reviewerCount)
    .then(() => {
      console.log('✅ SUCCESS! Test data generated.\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 FAILED:', error.message);
      process.exit(1);
    });
}

export { generateTest360Survey };
