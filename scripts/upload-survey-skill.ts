/**
 * Upload Survey Response Generator Skill to Anthropic API
 *
 * Run with: npx ts-node scripts/upload-survey-skill.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_DIR = path.join(__dirname, '../skills/survey-response-generator');
const SKILL_MD_PATH = path.join(SKILL_DIR, 'SKILL.md');

async function uploadSkill() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Verify SKILL.md exists
  if (!fs.existsSync(SKILL_MD_PATH)) {
    console.error('ERROR: SKILL.md not found at:', SKILL_MD_PATH);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log('=== Survey Response Generator Skill Upload ===\n');

  try {
    // List existing custom skills
    console.log('Checking for existing custom skills...');

    const existingSkills = await client.beta.skills.list({
      source: 'custom',
      betas: ['skills-2025-10-02'],
    });

    const skillsList = [];
    for await (const skill of existingSkills) {
      skillsList.push(skill);
    }

    console.log(`Found ${skillsList.length} existing custom skill(s)`);

    // Look for our skill by display_title
    const existingSkill = skillsList.find(
      (s) =>
        s.display_title?.toLowerCase().includes('survey') ||
        s.display_title?.toLowerCase().includes('response')
    );

    if (existingSkill) {
      console.log(`\nExisting skill found:`);
      console.log(`  ID: ${existingSkill.id}`);
      console.log(`  Title: ${existingSkill.display_title}`);
      console.log(`  Version: ${existingSkill.latest_version}`);
      console.log(`  Created: ${existingSkill.created_at}`);

      console.log('\nTo update this skill, create a new version via the API.');
      console.log('\n=== Use This Skill ID ===');
      console.log(`SURVEY_SKILL_ID=${existingSkill.id}`);

      return;
    }

    // Create new skill by uploading SKILL.md file
    console.log('\nNo existing survey skill found. Creating new skill...');
    console.log(`Uploading: ${SKILL_MD_PATH}`);

    // Read the file content as a readable stream (what the SDK expects)
    const fileStream = fs.createReadStream(SKILL_MD_PATH);

    // Create the skill with file upload
    const newSkill = await client.beta.skills.create({
      display_title: 'Survey Response Generator',
      files: [fileStream],
      betas: ['skills-2025-10-02'],
    });

    console.log('\n=== Skill Created Successfully! ===');
    console.log(`  ID: ${newSkill.id}`);
    console.log(`  Title: ${newSkill.display_title}`);
    console.log(`  Version: ${newSkill.latest_version}`);
    console.log(`  Source: ${newSkill.source}`);
    console.log(`  Created: ${newSkill.created_at}`);

    // Save skill ID to config file
    const configPath = path.join(__dirname, '../.skill-config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          surveyResponseSkillId: newSkill.id,
          latestVersion: newSkill.latest_version,
          displayTitle: newSkill.display_title,
          createdAt: newSkill.created_at,
        },
        null,
        2
      )
    );
    console.log(`\nConfig saved to: ${configPath}`);

    console.log('\n=== Add to .env ===');
    console.log(`SURVEY_SKILL_ID=${newSkill.id}`);
    console.log('NEXT_PUBLIC_USE_SURVEY_SKILL=true');

  } catch (error) {
    console.error('\n=== Error ===');

    if (error instanceof Error) {
      console.error('Message:', error.message);

      // Log full error for debugging
      if ('status' in error) {
        console.error('Status:', (error as { status: number }).status);
      }
      if ('error' in error) {
        console.error('Details:', JSON.stringify((error as { error: unknown }).error, null, 2));
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

uploadSkill();
