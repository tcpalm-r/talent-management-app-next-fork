/**
 * Analyze why extraction is failing
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { extractVerbatimSnippet, validateSnippetIsVerbatim } from '../lib/services/snippetExtractionService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SURVEY_ID = '395743b6-ac58-4936-a198-a262b7ae7969';

async function main() {
  console.log('=== Analyzing Extraction Results ===\n');

  // Get all responses
  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('id, response_text, reviewer_email')
    .eq('survey_id', SURVEY_ID);

  const responseMap = new Map<string, string>();
  responses?.forEach(r => responseMap.set(r.id, r.response_text));

  console.log('Total responses:', responses?.length || 0);

  // Test cases - key phrases that should be found
  const testCases = [
    {
      response_id: '2190e863-2a34-45e9-a775-a2e6bb4fe846',
      key_phrases: ['consistently makes himself available', 'nights and weekends', 'support them'],
    },
    {
      response_id: 'bd779394-37e7-45a8-93ca-f44c376d33aa',
      key_phrases: ['always makes time for me', 'quick, one on one', 'Teams meeting'],
    },
    {
      response_id: '1410b9e9-47f7-44f7-ab93-dde8b1e0ac44',
      key_phrases: ['30+ years', 'comprehensive experience', 'Pro Audio industry'],
    },
  ];

  console.log('\n=== Testing Key Phrase Extraction ===\n');

  for (const tc of testCases) {
    const sourceText = responseMap.get(tc.response_id) || '';
    console.log(`Response ID: ${tc.response_id}`);
    console.log(`Source (first 200 chars): "${sourceText.slice(0, 200)}..."`);
    console.log(`Key phrases: ${JSON.stringify(tc.key_phrases)}`);

    // Check which key phrases actually exist in source
    for (const phrase of tc.key_phrases) {
      const found = sourceText.toLowerCase().includes(phrase.toLowerCase());
      console.log(`  "${phrase}" - ${found ? '✓ FOUND' : '✗ NOT FOUND'}`);
    }

    // Run extraction
    const result = extractVerbatimSnippet(sourceText, tc.key_phrases);
    console.log(`\nExtracted snippet: "${result.snippet.slice(0, 100)}..."`);
    console.log(`Match type: ${result.matchType}`);
    console.log(`Matched phrase: ${result.matchedPhrase || 'none'}`);

    // Validate
    const isValid = validateSnippetIsVerbatim(result.snippet, sourceText);
    console.log(`Is verbatim: ${isValid ? '✓ YES' : '✗ NO'}`);

    console.log('\n---\n');
  }

  // Now test with what Claude might actually return (paraphrased phrases)
  console.log('=== Testing with Paraphrased Phrases (like Claude might return) ===\n');

  const paraphrasedCases = [
    {
      response_id: '2190e863-2a34-45e9-a775-a2e6bb4fe846',
      key_phrases: ['consistently makes himself available for his team', 'creating an environment where team members know'],
      description: 'Slightly paraphrased',
    },
    {
      response_id: 'bd779394-37e7-45a8-93ca-f44c376d33aa',
      key_phrases: ['consistently makes himself available for his team'],
      description: 'Wrong phrase (from different response)',
    },
  ];

  for (const tc of paraphrasedCases) {
    const sourceText = responseMap.get(tc.response_id) || '';
    console.log(`Response ID: ${tc.response_id}`);
    console.log(`Description: ${tc.description}`);
    console.log(`Source (first 200 chars): "${sourceText.slice(0, 200)}..."`);

    // Check which phrases exist
    for (const phrase of tc.key_phrases) {
      const found = sourceText.toLowerCase().includes(phrase.toLowerCase());
      console.log(`  "${phrase.slice(0, 50)}..." - ${found ? '✓ FOUND' : '✗ NOT FOUND'}`);
    }

    const result = extractVerbatimSnippet(sourceText, tc.key_phrases);
    const isValid = validateSnippetIsVerbatim(result.snippet, sourceText);
    console.log(`Match type: ${result.matchType}`);
    console.log(`Is verbatim: ${isValid ? '✓ YES' : '✗ NO'}`);

    console.log('\n---\n');
  }
}

main().catch(console.error);
