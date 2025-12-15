/**
 * Dry Run: Compare Two Narrative Generations for Rigo Lopez Survey
 *
 * This script:
 * 1. Fetches Rigo Lopez's survey data from Supabase
 * 2. Runs narrative generation TWICE
 * 3. Compares results side-by-side
 * 4. Does NOT write to database
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !anthropicKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// Config from generate-narrative.ts
const generateNarrativeConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
  temperature: 0.2,
};

// Helper functions from generate-narrative.ts
function extractItemText(item) {
  if (typeof item === 'string') return item;
  return item.text || '';
}

function extractCitationSnippets(item) {
  if (typeof item === 'string') return [];
  return item.citations?.map(c => c.snippet).filter(Boolean) || [];
}

function formatSectionWithCitations(items, sectionName) {
  if (!items || items.length === 0) return '';

  const formattedItems = items.map((item, i) => {
    const text = extractItemText(item);
    const snippets = extractCitationSnippets(item);

    if (snippets.length > 0) {
      const snippetText = snippets.slice(0, 2).map(s => `"${s}"`).join(', ');
      return `${i + 1}. ${text}\n   [Grounded in feedback: ${snippetText}]`;
    }
    return `${i + 1}. ${text}`;
  }).join('\n');

  return `${sectionName}:\n${formattedItems}`;
}

function buildGenerateNarrativePrompt({ subjectName, rawResponses, reportData, citationContext }) {
  const rawResponsesText = rawResponses
    .map((item, idx) => {
      const responsesText = item.responses
        .filter((r) => r && r.trim())
        .map((r, i) => `   ${i + 1}. ${r}`)
        .join('\n');
      return `${idx + 1}. ${item.question}\n${responsesText || '   (No responses)'}`;
    })
    .join('\n\n');

  const reportSections = [];

  if (reportData.executive_summary) {
    reportSections.push(`EXECUTIVE SUMMARY:\n${reportData.executive_summary}`);
  }

  if (reportData.themes && reportData.themes.length > 0) {
    const themesText = reportData.themes.map((t, i) => {
      const baseText = `${i + 1}. ${t.theme}`;
      const meta = [];
      if (t.sentiment) meta.push(`sentiment: ${t.sentiment}`);
      if (t.frequency && t.frequency > 0) meta.push(`mentioned by ${t.frequency} reviewers`);

      let evidenceText = '';
      if (t.supporting_evidence && t.supporting_evidence.length > 0) {
        const evidenceItems = t.supporting_evidence
          .map(ev => extractItemText(ev))
          .filter(Boolean)
          .slice(0, 3);
        if (evidenceItems.length > 0) {
          evidenceText = `\n   Evidence: ${evidenceItems.join('; ')}`;
        }
      } else if (t.description) {
        evidenceText = `: ${t.description}`;
      }

      const metaText = meta.length > 0 ? ` (${meta.join(', ')})` : '';
      return `${baseText}${metaText}${evidenceText}`;
    }).join('\n');
    reportSections.push(`KEY THEMES:\n${themesText}`);
  }

  const strengthsSection = formatSectionWithCitations(reportData.strengths, 'STRENGTHS');
  if (strengthsSection) reportSections.push(strengthsSection);

  const devAreasSection = formatSectionWithCitations(reportData.development_areas, 'DEVELOPMENT AREAS');
  if (devAreasSection) reportSections.push(devAreasSection);

  if (reportData.key_insights && reportData.key_insights.length > 0) {
    const insightsText = reportData.key_insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n');
    reportSections.push(`KEY INSIGHTS:\n${insightsText}`);
  }

  const recsSection = formatSectionWithCitations(reportData.recommendations, 'RECOMMENDED ACTIONS');
  if (recsSection) reportSections.push(recsSection);

  const reportDataText = reportSections.join('\n\n');

  const citationGuidance = citationContext
    ? `\n\nCITATION CONTEXT: This analysis is grounded in ${citationContext.totalCitations} citations from the raw feedback, with ${citationContext.citationCoverage}% coverage. Themes with higher frequency (more reviewers mentioning them) should be given more prominence in the narrative.`
    : '';

  return `You are an expert executive coach and leadership development specialist. You have been asked to create a comprehensive one-page narrative for ${subjectName}'s 360-degree feedback report.

This narrative will be the first page of the final report that ${subjectName} receives. It should be professionally written, developmental in tone, balanced, and approximately 550-750 words.

Your narrative should synthesize both the raw feedback data AND the analyzed report sections to create a cohesive, insightful summary that will help ${subjectName} understand their strengths, growth opportunities, and recommended next steps.${citationGuidance}

---

RAW FEEDBACK RESPONSES:
${rawResponsesText}

---

ANALYZED REPORT DATA:
${reportDataText}

---

INSTRUCTIONS:
1. Write a compelling, professionally crafted narrative (550-750 words) that synthesizes ALL the data above
2. Begin with an opening paragraph that sets a positive, developmental tone
3. Weave together themes, strengths, and development areas into a cohesive story
4. Reference specific feedback points from the raw responses as your PRIMARY source of examples. Use exact details (names of initiatives, metrics, specific situations) from the raw feedback. The analyzed report data provides structure; the raw responses provide the authentic voice and specifics.
5. Include concrete, actionable insights and recommendations
6. End with an encouraging closing that emphasizes growth and potential
7. Use third person perspective (e.g., "${subjectName} demonstrates...")
8. Maintain a professional yet warm tone - this should be motivating and constructive
9. DO NOT use section headers, titles, bullet points, or markdown formatting (no **, ##, etc.) - this should be flowing narrative prose only
10. DO NOT include any title like "Executive Summary" or "360-Degree Feedback Report" - start directly with the narrative content
11. Make it feel personalized and specific to ${subjectName}, not generic
12. GROUNDING: When the analyzed data includes citation snippets (shown as [Grounded in feedback: "..."]), use those exact phrases or close paraphrases to ensure the narrative stays true to actual reviewer feedback
13. PRIORITIZATION: Give more weight to themes mentioned by more reviewers (higher frequency) - these represent stronger consensus
14. COVERAGE: Include at least one specific example from EACH of the raw feedback questions above. Every question category (value creation, skills to develop, "I wish they knew", systems/processes) should have representation in the narrative.
15. SPECIFICITY: When the raw feedback mentions specific metrics (e.g., "60% reduction", "double the impact"), project names, or concrete outcomes, prefer including these over generic statements. Specifics make the narrative more credible and actionable.
16. BALANCE: Ensure the narrative doesn't over-index on a few dramatic examples. Include at least one reference to process/systems improvements and learning/knowledge-sharing behaviors.

Write the narrative now (plain text only, no formatting):`;
}

async function generateNarrative(prompt, runNumber) {
  console.log(`\n   Running narrative generation #${runNumber}...`);
  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: generateNarrativeConfig.model,
    max_tokens: generateNarrativeConfig.maxTokens,
    temperature: generateNarrativeConfig.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const elapsed = Date.now() - startTime;
  console.log(`   Completed in ${elapsed}ms`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let narrative = content.text.trim();
  narrative = narrative
    .replace(/^\*\*360-Degree Feedback Report:?\s*Executive Summary\*\*\s*/i, '')
    .replace(/^\*\*Executive Summary\*\*\s*/i, '')
    .replace(/^#+ .*\n/gm, '')
    .trim();

  return { narrative, elapsed };
}

function compareNarratives(narrative1, narrative2) {
  // Word count
  const words1 = narrative1.split(/\s+/).length;
  const words2 = narrative2.split(/\s+/).length;

  // Character count
  const chars1 = narrative1.length;
  const chars2 = narrative2.length;

  // Sentence count (rough)
  const sentences1 = narrative1.split(/[.!?]+/).filter(s => s.trim()).length;
  const sentences2 = narrative2.split(/[.!?]+/).filter(s => s.trim()).length;

  // Paragraph count
  const paragraphs1 = narrative1.split(/\n\n+/).filter(p => p.trim()).length;
  const paragraphs2 = narrative2.split(/\n\n+/).filter(p => p.trim()).length;

  // Simple similarity check - count common words
  const wordsSet1 = new Set(narrative1.toLowerCase().match(/\b\w+\b/g) || []);
  const wordsSet2 = new Set(narrative2.toLowerCase().match(/\b\w+\b/g) || []);
  const commonWords = [...wordsSet1].filter(w => wordsSet2.has(w)).length;
  const totalUniqueWords = new Set([...wordsSet1, ...wordsSet2]).size;
  const wordOverlap = Math.round((commonWords / totalUniqueWords) * 100);

  // Check if narratives are identical
  const identical = narrative1 === narrative2;

  // Extract key phrases (4+ word sequences)
  function extractPhrases(text) {
    const phrases = [];
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    for (let i = 0; i <= words.length - 4; i++) {
      phrases.push(words.slice(i, i + 4).join(' '));
    }
    return new Set(phrases);
  }

  const phrases1 = extractPhrases(narrative1);
  const phrases2 = extractPhrases(narrative2);
  const commonPhrases = [...phrases1].filter(p => phrases2.has(p)).length;
  const phraseOverlap = Math.round((commonPhrases / Math.max(phrases1.size, phrases2.size)) * 100);

  return {
    words1,
    words2,
    chars1,
    chars2,
    sentences1,
    sentences2,
    paragraphs1,
    paragraphs2,
    wordOverlap,
    phraseOverlap,
    identical,
    commonWords,
    totalUniqueWords,
    commonPhrases,
  };
}

async function main() {
  console.log('Narrative Generation Dry Run Comparison');
  console.log('='.repeat(60));

  // Known survey ID (User 2 TEST - has responses)
  const surveyId = 'e1d4fe45-dc01-4495-b3fd-34e9a8066044';

  console.log('\n1. Fetching survey data...');

  // Fetch survey
  const { data: survey, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (surveyError || !survey) {
    console.error('Could not find survey:', surveyError?.message);
    process.exit(1);
  }

  console.log(`   Survey: ${survey.survey_name}`);
  console.log(`   Status: ${survey.status}`);

  // Fetch employee
  const { data: employee } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .eq('id', survey.employee_id)
    .single();

  console.log(`   Subject: ${employee?.full_name || 'Unknown'}`);

  // Fetch responses
  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId);

  console.log(`   Total responses: ${responses?.length || 0}`);

  // Fetch questions
  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select(`
      *,
      question:feedback_360_questions(*)
    `)
    .eq('survey_id', surveyId)
    .order('question_order');

  console.log(`   Questions: ${surveyQuestions?.length || 0}`);

  // Check for existing analysis data in DB or load from previous comparison file
  let reportData = null;
  if (survey.ai_analysis) {
    try {
      reportData = typeof survey.ai_analysis === 'string'
        ? JSON.parse(survey.ai_analysis)
        : survey.ai_analysis;
      console.log(`   Analysis data: Found in database`);
    } catch (e) {
      console.log(`   Analysis data: Invalid JSON in database`);
    }
  }

  // If no analysis in DB, try to load from previous comparison file
  if (!reportData) {
    const previousComparisonPath = path.join(__dirname, 'dry-run-results', 'comparison-2025-12-12T20-01-25-286Z.json');
    if (fs.existsSync(previousComparisonPath)) {
      try {
        const previousData = JSON.parse(fs.readFileSync(previousComparisonPath, 'utf8'));
        // Use the newAnalysis from the previous comparison (most recent prompt version)
        reportData = previousData.newAnalysis;
        console.log(`   Analysis data: Loaded from previous comparison file`);
      } catch (e) {
        console.log(`   Analysis data: Could not load from file`);
      }
    }
  }

  if (!reportData) {
    console.error('\n   No AI analysis found. Please run the survey analysis first.');
    process.exit(1);
  }

  // Build raw responses for the prompt
  console.log('\n2. Building prompt data...');

  const rawResponses = (surveyQuestions || []).map(sq => {
    const questionText = sq.question?.question_text || 'Question not found';
    const questionResponses = (responses || [])
      .filter(r => r.question_id === sq.question_id)
      .map(r => r.response_text || '')
      .filter(r => r);

    return {
      question: questionText,
      responses: questionResponses,
    };
  });

  // Calculate citation context
  let citationContext = null;
  if (reportData.themes) {
    let totalCitations = 0;
    const allResponseIds = new Set(responses.map(r => r.id));

    const citedIds = new Set();
    const countCitations = (items) => {
      if (!items) return;
      items.forEach(item => {
        if (item.supporting_evidence) {
          item.supporting_evidence.forEach(ev => {
            if (ev.citations) {
              ev.citations.forEach(c => {
                totalCitations++;
                citedIds.add(c.response_id);
              });
            }
          });
        }
        if (item.citations) {
          item.citations.forEach(c => {
            totalCitations++;
            citedIds.add(c.response_id);
          });
        }
      });
    };

    countCitations(reportData.themes);
    countCitations(reportData.overall_strengths);
    countCitations(reportData.development_areas);
    countCitations(reportData.recommendations);
    countCitations(reportData.consensus_areas);
    countCitations(reportData.outlier_opinions);

    citationContext = {
      totalCitations,
      citationCoverage: Math.round((citedIds.size / allResponseIds.size) * 100),
    };

    console.log(`   Citation context: ${totalCitations} citations, ${citationContext.citationCoverage}% coverage`);
  }

  // Build the report data structure
  const promptReportData = {
    executive_summary: reportData.executive_summary,
    themes: reportData.themes,
    strengths: reportData.overall_strengths,
    development_areas: reportData.development_areas,
    recommendations: reportData.recommendations,
  };

  const prompt = buildGenerateNarrativePrompt({
    subjectName: employee?.full_name || 'Unknown',
    rawResponses,
    reportData: promptReportData,
    citationContext,
  });

  console.log(`   Prompt length: ${prompt.length} characters`);

  // Run two generations
  console.log('\n3. Running narrative generations...');

  const result1 = await generateNarrative(prompt, 1);
  const result2 = await generateNarrative(prompt, 2);

  // Compare results
  console.log('\n4. Comparing results...');

  const comparison = compareNarratives(result1.narrative, result2.narrative);

  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(60));

  console.log('\nMETRICS:');
  console.log('-'.repeat(60));
  console.log('Metric'.padEnd(25), 'Run 1'.padEnd(15), 'Run 2'.padEnd(15), 'Diff');
  console.log('-'.repeat(60));
  console.log('Word count'.padEnd(25), String(comparison.words1).padEnd(15), String(comparison.words2).padEnd(15), comparison.words2 - comparison.words1);
  console.log('Character count'.padEnd(25), String(comparison.chars1).padEnd(15), String(comparison.chars2).padEnd(15), comparison.chars2 - comparison.chars1);
  console.log('Sentence count'.padEnd(25), String(comparison.sentences1).padEnd(15), String(comparison.sentences2).padEnd(15), comparison.sentences2 - comparison.sentences1);
  console.log('Paragraph count'.padEnd(25), String(comparison.paragraphs1).padEnd(15), String(comparison.paragraphs2).padEnd(15), comparison.paragraphs2 - comparison.paragraphs1);
  console.log('Generation time (ms)'.padEnd(25), String(result1.elapsed).padEnd(15), String(result2.elapsed).padEnd(15), result2.elapsed - result1.elapsed);
  console.log('-'.repeat(60));

  console.log('\nSIMILARITY:');
  console.log(`   Identical: ${comparison.identical ? 'YES' : 'NO'}`);
  console.log(`   Word overlap: ${comparison.wordOverlap}% (${comparison.commonWords}/${comparison.totalUniqueWords} unique words)`);
  console.log(`   4-word phrase overlap: ${comparison.phraseOverlap}% (${comparison.commonPhrases} common phrases)`);

  // Output full narratives
  console.log('\n' + '='.repeat(60));
  console.log('NARRATIVE #1:');
  console.log('='.repeat(60));
  console.log(result1.narrative);

  console.log('\n' + '='.repeat(60));
  console.log('NARRATIVE #2:');
  console.log('='.repeat(60));
  console.log(result2.narrative);

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'dry-run-results');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputData = {
    survey: {
      id: survey.id,
      name: survey.survey_name,
      employee: employee?.full_name,
    },
    config: generateNarrativeConfig,
    comparison,
    narratives: {
      run1: {
        text: result1.narrative,
        elapsed: result1.elapsed,
      },
      run2: {
        text: result2.narrative,
        elapsed: result2.elapsed,
      },
    },
    prompt,
  };

  const outputPath = path.join(outputDir, `narrative-comparison-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Results saved to: ${outputPath}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
