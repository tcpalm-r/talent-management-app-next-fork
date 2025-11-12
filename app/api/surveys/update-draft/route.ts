import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();
    const {
      surveyId,
      surveyName,
      dueDate,
      requiredQuestions,
      customQuestions,
      raters,
    } = body;

    // Validate required fields
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }

    // Delete existing questions
    const { error: deleteQuestionsError } = await supabase
      .from('feedback_360_survey_questions')
      .delete()
      .eq('survey_id', surveyId);

    if (deleteQuestionsError) {
      console.error('[API /surveys/update-draft] Error deleting questions:', deleteQuestionsError);
      return NextResponse.json(
        { error: deleteQuestionsError.message, details: deleteQuestionsError },
        { status: 500 }
      );
    }

    // Update survey with new data
    const { error: updateError } = await supabase
      .from('feedback_360_surveys')
      .update({
        survey_name: surveyName,
        due_date: dueDate,
      })
      .eq('id', surveyId);

    if (updateError) {
      console.error('[API /surveys/update-draft] Error updating survey:', updateError);
      return NextResponse.json(
        { error: updateError.message, details: updateError },
        { status: 500 }
      );
    }

    // Combine required and custom questions
    const allQuestions = [...(requiredQuestions || []), ...(customQuestions || [])];
    const questionUUIDs: string[] = [];

    for (const questionText of allQuestions) {
      // Check if question exists
      let { data: existingQuestion, error: checkError } = await supabase
        .from('feedback_360_questions')
        .select('id')
        .eq('question_text', questionText)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[API /surveys/update-draft] Error checking question:', checkError);
        return NextResponse.json(
          { error: checkError.message, details: checkError },
          { status: 500 }
        );
      }

      if (!existingQuestion) {
        // Create the question
        const { data: newQuestion, error: createError } = await supabase
          .from('feedback_360_questions')
          .insert({
            question_text: questionText,
            category: 'general',
            is_default: false,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[API /surveys/update-draft] Error creating question:', createError);
          return NextResponse.json(
            { error: createError.message, details: createError },
            { status: 500 }
          );
        }
        questionUUIDs.push(newQuestion.id);
      } else {
        questionUUIDs.push(existingQuestion.id);
      }
    }

    // Create survey questions with UUIDs
    if (questionUUIDs.length > 0) {
      const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
        survey_id: surveyId,
        question_id: questionUUID,
        question_order: index,
      }));

      const { error: questionsError } = await supabase
        .from('feedback_360_survey_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        console.error('[API /surveys/update-draft] Error inserting survey questions:', questionsError);
        return NextResponse.json(
          { error: questionsError.message, details: questionsError },
          { status: 500 }
        );
      }
    }

    // Delete existing reviewers before inserting new ones
    const { error: deleteReviewersError } = await supabase
      .from('feedback_360_survey_reviewers')
      .delete()
      .eq('survey_id', surveyId);

    if (deleteReviewersError) {
      console.error('[API /surveys/update-draft] Error deleting existing reviewers:', deleteReviewersError);
      return NextResponse.json(
        { error: deleteReviewersError.message, details: deleteReviewersError },
        { status: 500 }
      );
    }

    // Create reviewers
    const validRaters = (raters || []).filter((r: any) => r.name && r.name.trim());
    if (validRaters.length > 0) {
      const reviewersToInsert = validRaters.map((r: any) => ({
        survey_id: surveyId,
        reviewer_name: r.name,
        reviewer_email: r.email || 'pending-email@example.com',
        relationship: r.relationship,
        status: 'pending',
        access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const { data: insertedReviewers, error: reviewersError } = await supabase
        .from('feedback_360_survey_reviewers')
        .insert(reviewersToInsert)
        .select();

      if (reviewersError) {
        console.error('[API /surveys/update-draft] Error inserting reviewers:', reviewersError);
        return NextResponse.json(
          { error: reviewersError.message, details: reviewersError },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        reviewers: insertedReviewers,
      });
    }

    return NextResponse.json({
      success: true,
      reviewers: [],
    });
  } catch (error: any) {
    console.error('[API /surveys/update-draft] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
