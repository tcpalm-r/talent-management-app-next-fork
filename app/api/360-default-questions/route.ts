import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', '360-default-questions.json');
const DEFAULT_QUESTIONS = [
  'impact-biggest-impact',
  'growth-stop',
  'growth-start',
];

// Ensure the data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// GET: Retrieve the current default question IDs
export async function GET() {
  try {
    await ensureDataDirectory();

    // Try to read from file
    try {
      const fileContent = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const data = JSON.parse(fileContent);

      if (Array.isArray(data.defaultQuestionIds) && data.defaultQuestionIds.length === 3) {
        return NextResponse.json({
          defaultQuestionIds: data.defaultQuestionIds,
          customQuestions: data.customQuestions || {}
        });
      }
    } catch (error) {
      // File doesn't exist or is invalid, return defaults
    }

    return NextResponse.json({
      defaultQuestionIds: DEFAULT_QUESTIONS,
      customQuestions: {}
    });
  } catch (error) {
    console.error('Error in GET /api/360-default-questions:', error);
    return NextResponse.json({
      defaultQuestionIds: DEFAULT_QUESTIONS,
      customQuestions: {}
    });
  }
}

// POST: Update the default question IDs
export async function POST(request: NextRequest) {
  try {
    const { defaultQuestionIds, customQuestions } = await request.json();

    // Validate input
    if (!Array.isArray(defaultQuestionIds) || defaultQuestionIds.length !== 3) {
      return NextResponse.json(
        { error: 'Must provide exactly 3 question IDs' },
        { status: 400 }
      );
    }

    await ensureDataDirectory();

    // Write to file
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify({
        defaultQuestionIds,
        customQuestions: customQuestions || {},
        updatedAt: new Date().toISOString()
      }, null, 2),
      'utf-8'
    );

    return NextResponse.json({ success: true, defaultQuestionIds, customQuestions });
  } catch (error) {
    console.error('Error in POST /api/360-default-questions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
