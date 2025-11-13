#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓ Set' : '✗ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   DATA CONSISTENCY DIAGNOSTIC                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. Check all surveys
  console.log('📋 ALL SURVEYS IN DATABASE:');
  console.log('─'.repeat(60));
  const { data: surveys, error: surveysError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, employee_id, created_by, status, created_at')
    .order('created_at', { ascending: false });

  if (surveysError) {
    console.error('❌ Error fetching surveys:', surveysError);
  } else {
    console.log(`Found ${surveys.length} total surveys:\n`);
    for (const survey of surveys) {
      console.log(`📝 ${survey.survey_name || 'Untitled'}`);
      console.log(`   Status: ${survey.status}`);
      console.log(`   Survey ID: ${survey.id}`);
      console.log(`   Employee ID: ${survey.employee_id}`);
      console.log(`   Created By: ${survey.created_by}`);
      console.log(`   Created At: ${survey.created_at}`);
      console.log('');
    }
  }

  // 2. Get employee names for surveys
  console.log('\n👥 SURVEY SUBJECTS:');
  console.log('─'.repeat(60));
  const employeeIds = [...new Set(surveys.map(s => s.employee_id))];
  
  for (const empId of employeeIds) {
    const { data: emp } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, app_role')
      .eq('id', empId)
      .single();
    
    if (emp) {
      console.log(`👤 ${emp.full_name}`);
      console.log(`   ID: ${emp.id}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   Role: ${emp.app_role}`);
      
      const theirSurveys = surveys.filter(s => s.employee_id === empId);
      console.log(`   Surveys: ${theirSurveys.length}`);
      theirSurveys.forEach(s => {
        console.log(`     - ${s.survey_name || 'Untitled'} (${s.status})`);
      });
      console.log('');
    }
  }

  // 3. Check all Thomas Palmer profiles
  console.log('\n🔍 THOMAS PALMER PROFILES:');
  console.log('─'.repeat(60));
  const { data: thomasProfiles, error: thomasError } = await supabase
    .from('user_profiles')
    .select('*')
    .or('email.ilike.%thomas.palmer%,full_name.ilike.%thomas%palmer%');

  if (thomasError) {
    console.error('❌ Error fetching Thomas profiles:', thomasError);
  } else {
    console.log(`Found ${thomasProfiles.length} profile(s):\n`);
    for (let i = 0; i < thomasProfiles.length; i++) {
      const profile = thomasProfiles[i];
      console.log(`${i + 1}. ${profile.full_name}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Role: ${profile.app_role}`);
      console.log(`   Active: ${profile.is_active}`);
      console.log(`   Auth0 ID: ${profile.auth0_id || 'N/A'}`);
      
      // Check surveys created by this profile
      const createdSurveys = surveys.filter(s => s.created_by === profile.id);
      console.log(`   Surveys Created: ${createdSurveys.length}`);
      createdSurveys.forEach(s => {
        console.log(`     - ${s.survey_name || 'Untitled'} (${s.status})`);
      });
      
      // Check surveys where they're the subject
      const subjectSurveys = surveys.filter(s => s.employee_id === profile.id);
      console.log(`   Surveys as Subject: ${subjectSurveys.length}`);
      subjectSurveys.forEach(s => {
        console.log(`     - ${s.survey_name || 'Untitled'} (${s.status})`);
      });
      console.log('');
    }
  }

  // 4. Check survey creators
  console.log('\n👨‍💼 SURVEY CREATORS:');
  console.log('─'.repeat(60));
  const creatorIds = [...new Set(surveys.map(s => s.created_by))];
  
  for (const creatorId of creatorIds) {
    const { data: creator } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, app_role')
      .eq('id', creatorId)
      .single();
    
    if (creator) {
      console.log(`👤 ${creator.full_name}`);
      console.log(`   ID: ${creator.id}`);
      console.log(`   Email: ${creator.email}`);
      console.log(`   Role: ${creator.app_role}`);
      
      const createdSurveys = surveys.filter(s => s.created_by === creatorId);
      console.log(`   Surveys Created: ${createdSurveys.length}`);
      createdSurveys.forEach(s => {
        console.log(`     - ${s.survey_name || 'Untitled'} (${s.status})`);
      });
      console.log('');
    } else {
      console.log(`❌ ORPHANED SURVEYS - Creator ID not found: ${creatorId}`);
      const orphaned = surveys.filter(s => s.created_by === creatorId);
      console.log(`   ${orphaned.length} orphaned survey(s):`);
      orphaned.forEach(s => {
        console.log(`     - ${s.survey_name || 'Untitled'} (${s.status})`);
      });
      console.log('');
    }
  }

  // 5. Check reviewers for visible surveys
  console.log('\n📨 SURVEY REVIEWERS:');
  console.log('─'.repeat(60));
  
  for (const survey of surveys.slice(0, 5)) { // First 5 surveys
    const { data: reviewers } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('reviewer_name, reviewer_email, status')
      .eq('survey_id', survey.id);
    
    console.log(`📝 ${survey.survey_name || 'Untitled'}`);
    console.log(`   Reviewers: ${reviewers?.length || 0}`);
    if (reviewers && reviewers.length > 0) {
      reviewers.forEach(r => {
        console.log(`     - ${r.reviewer_name} (${r.reviewer_email}) [${r.status}]`);
      });
    }
    console.log('');
  }

  // 6. Simulate filtering for Thomas Palmer
  console.log('\n🔬 SIMULATED FILTERING:');
  console.log('─'.repeat(60));
  
  if (thomasProfiles.length > 0) {
    for (const thomasProfile of thomasProfiles) {
      console.log(`\nFiltering as: ${thomasProfile.full_name} (${thomasProfile.email})`);
      console.log(`Profile ID: ${thomasProfile.id}`);
      console.log(`Role: ${thomasProfile.app_role}\n`);
      
      const visibleSurveys = [];
      
      for (const survey of surveys) {
        const reasons = [];
        
        // Check created_by match
        if (survey.created_by === thomasProfile.id) {
          reasons.push('created by user');
        }
        
        // Check employee_id match
        if (survey.employee_id === thomasProfile.id) {
          if (thomasProfile.app_role === 'user' && survey.status !== 'finalized') {
            // Skip for regular users if not finalized
          } else {
            reasons.push('user is subject');
          }
        }
        
        // Check reviewer
        const { data: isReviewer } = await supabase
          .from('feedback_360_survey_reviewers')
          .select('id')
          .eq('survey_id', survey.id)
          .eq('reviewer_email', thomasProfile.email)
          .single();
        
        if (isReviewer) {
          reasons.push('user is reviewer');
        }
        
        if (reasons.length > 0) {
          visibleSurveys.push({ survey, reasons });
        }
      }
      
      console.log(`✅ VISIBLE SURVEYS: ${visibleSurveys.length}`);
      visibleSurveys.forEach(({ survey, reasons }) => {
        console.log(`   📝 ${survey.survey_name || 'Untitled'} (${survey.status})`);
        console.log(`      Reason: ${reasons.join(', ')}`);
      });
      console.log('');
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   DIAGNOSTIC COMPLETE                                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
}

diagnose().catch(console.error);

