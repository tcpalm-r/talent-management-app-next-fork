/**
 * Test script for streaming report generation
 *
 * Usage: node scripts/test-streaming.js
 *
 * This tests the SSE streaming endpoint directly without the frontend.
 */

require('dotenv').config({ path: '.env.local' });

const SURVEY_ID = 'e1d4fe45-dc01-4495-b3fd-34e9a8066044'; // User 2 [TEST] survey
const API_URL = 'http://localhost:3004/api/360-generate-report';

async function testStreaming() {
  console.log('🧪 Testing streaming report generation...\n');
  console.log(`Survey ID: ${SURVEY_ID}`);
  console.log(`API URL: ${API_URL}`);
  console.log('─'.repeat(60));

  const startTime = Date.now();
  let charCount = 0;
  let firstDeltaTime = null;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use mock auth for local testing
        'Cookie': 'ai-intranet-session=mock-session',
      },
      body: JSON.stringify({
        survey_id: SURVEY_ID,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Request failed:', response.status, error);
      return;
    }

    console.log('✅ Connection established, streaming...\n');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'delta') {
              if (!firstDeltaTime) {
                firstDeltaTime = Date.now();
                console.log(`⏱️  First token received in ${firstDeltaTime - startTime}ms`);
                console.log('─'.repeat(60));
                console.log('Streaming output (first 500 chars):');
              }
              charCount += event.text.length;
              if (charCount <= 500) {
                process.stdout.write(event.text);
              } else if (charCount - event.text.length < 500) {
                process.stdout.write('...\n');
                console.log('─'.repeat(60));
                console.log('(Continuing to stream, output truncated...)');
              }
            } else if (event.type === 'done') {
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log('\n' + '═'.repeat(60));
              console.log('✅ STREAMING COMPLETE');
              console.log('═'.repeat(60));
              console.log(`Total time: ${elapsed}s`);
              console.log(`Time to first token: ${firstDeltaTime ? (firstDeltaTime - startTime) + 'ms' : 'N/A'}`);
              console.log(`Total characters: ${charCount}`);
              console.log(`Report themes: ${event.report?.themes?.length || 0}`);
              console.log(`Citation coverage: ${event.meta?.citationCoverage || 0}%`);
              if (event.citationInfo) {
                console.log(`Total citations: ${event.citationInfo.totalCitations}`);
              }
            } else if (event.type === 'error') {
              console.error('❌ Error:', event.message);
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }
}

testStreaming();
