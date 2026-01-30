require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get the latest reports with theme_coherence
  const { data, error } = await supabase
    .from('feedback_360_reports')
    .select('id, survey_id, theme_coherence, created_at')
    .not('theme_coherence', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found', data.length, 'reports with theme_coherence:\n');
    for (const report of data) {
      console.log('Report ID:', report.id);
      console.log('Created:', report.created_at);
      console.log('\nTheme Coherence Analysis:');
      console.log(JSON.stringify(report.theme_coherence, null, 2));
      console.log('\n' + '='.repeat(60) + '\n');
    }
  } else {
    console.log('No reports with theme_coherence found');
  }
}

check();
