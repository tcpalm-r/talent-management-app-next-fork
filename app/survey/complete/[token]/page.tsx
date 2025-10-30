'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { CheckCircle, AlertCircle, Send, Loader, Sparkles } from 'lucide-react';
import SurveyAIAssistant from '../../../../components/SurveyAIAssistant';

interface Question {
  id: string;
  question_text: string;
  category: string;
}

interface Survey {
  id: string;
  survey_name: string;
  employee_name: string;
  due_date: string;
}

interface Reviewer {
  id: string;
  reviewer_name: string;
  reviewer_email: string;
  relationship: string;
  status: string;
}

export default function SurveyCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSurveyData();
  }, [token]);

  const loadSurveyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find reviewer by access token
      const { data: reviewerData, error: reviewerError } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('*')
        .eq('access_token', token)
        .single();

      if (reviewerError || !reviewerData) {
        setError('Invalid or expired survey link. Please contact your HR department.');
        setLoading(false);
        return;
      }

      // Ensure reviewer_name has a value
      const safeReviewerData = {
        ...reviewerData,
        reviewer_name: reviewerData.reviewer_name || 'Reviewer'
      };

      setReviewer(safeReviewerData);

      // Check if already completed
      if (safeReviewerData.status === 'completed') {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Update status to in_progress if pending
      if (reviewerData.status === 'pending') {
        await supabase
          .from('feedback_360_survey_reviewers')
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString(),
          })
          .eq('id', reviewerData.id);
      }

      // Load survey details with employee name
      const { data: surveyData, error: surveyError } = await supabase
        .from('feedback_360_surveys')
        .select('id, survey_name, due_date, status, sent_at, employee:user_profiles!feedback_360_surveys_employee_id_fkey(full_name)')
        .eq('id', reviewerData.survey_id)
        .single();

      if (surveyError || !surveyData) {
        setError('Survey not found. Please contact your HR department.');
        setLoading(false);
        return;
      }

      // Check if survey was cancelled (sent but then moved back to draft)
      if (surveyData.status === 'draft' && surveyData.sent_at) {
        setError('The creator of this survey has decided to scrap this review draft.');
        setLoading(false);
        return;
      }

      // Check if survey is not active
      if (surveyData.status !== 'in_progress') {
        setError('This survey is no longer active.');
        setLoading(false);
        return;
      }

      setSurvey({
        id: surveyData.id,
        survey_name: surveyData.survey_name || 'Untitled Survey',
        employee_name: surveyData.employee?.full_name || 'Unknown Employee',
        due_date: surveyData.due_date || '',
      });

      // Load survey questions
      const { data: surveyQuestions, error: questionsError } = await supabase
        .from('feedback_360_survey_questions')
        .select('question:feedback_360_questions(id, question_text, category)')
        .eq('survey_id', reviewerData.survey_id)
        .order('question_order');

      if (questionsError) {
        setError('Failed to load questions. Please try again.');
        setLoading(false);
        return;
      }

      const loadedQuestions = surveyQuestions
        .map((sq: any) => sq.question)
        .filter(Boolean);

      setQuestions(loadedQuestions);

      // Initialize responses
      const initialResponses: Record<string, string> = {};
      loadedQuestions.forEach((q: Question) => {
        initialResponses[q.id] = '';
      });
      setResponses(initialResponses);

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading survey:', err);
      setError('An unexpected error occurred. Please try again later.');
      setLoading(false);
    }
  };

  const handleAIAssistantComplete = (parsedResponses: { [questionId: string]: string }) => {
    console.log('[SurveyCompletionPage] AI Assistant completed with responses:', parsedResponses);
    setResponses(parsedResponses);
    setIsAIAssistantOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewer || !survey) return;

    // Validate all questions have responses
    const allAnswered = Object.values(responses).every(r => r.trim().length > 0);
    if (!allAnswered) {
      setError('Please provide a response for all questions.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Insert all responses
      const responsesToInsert = Object.entries(responses).map(([questionId, response]) => ({
        survey_id: survey.id,
        question_id: questionId,
        reviewer_email: reviewer.reviewer_email,
        response_text: response,
      }));

      const { error: insertError } = await supabase
        .from('feedback_360_responses')
        .insert(responsesToInsert);

      if (insertError) throw insertError;

      // Mark reviewer as completed
      const { error: updateError } = await supabase
        .from('feedback_360_survey_reviewers')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', reviewer.id);

      if (updateError) throw updateError;

      // Update survey status to 'in_progress' if first reviewer completing
      const { data: allReviewers } = await supabase
        .from('feedback_360_survey_reviewers')
        .select('status')
        .eq('survey_id', survey.id);

      if (allReviewers) {
        const completedCount = allReviewers.filter(r => r.status === 'completed').length;

        // Update to 'in_progress' if at least one reviewer completed
        // Note: Status stays 'in_progress' until creator manually completes with AI analysis
        if (completedCount > 0) {
          await supabase
            .from('feedback_360_surveys')
            .update({ status: 'in_progress' })
            .eq('id', survey.id);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting survey:', err);
      setError('Failed to submit your feedback. Please try again.');
      setSubmitting(false);
    }
  };

  const updateResponse = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. Your input is valuable and will help {survey?.employee_name || 'the employee'} grow professionally.
          </p>
          <p className="text-sm text-gray-500">
            You can safely close this window.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">360° Feedback Survey</h1>
              <p className="text-blue-100">
                Providing feedback for <strong>{survey?.employee_name}</strong>
              </p>
              {survey?.due_date && (
                <p className="text-sm text-blue-200 mt-2">
                  Due: {new Date(survey.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
            {/* AI Assistant Button in Header */}
            <button
              type="button"
              onClick={() => {
                console.log('[SurveyCompletionPage] Opening AI Assistant');
                setIsAIAssistantOpen(true);
              }}
              disabled={submitting}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ml-4"
              title="Use AI to help fill in responses"
            >
              <Sparkles className="w-4 h-4" />
              Use AI for responses
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border-b border-blue-200 px-8 py-4">
            <p className="text-sm text-blue-900">
              <strong>Instructions:</strong> Please provide thoughtful responses to each question. Your feedback is confidential and will be aggregated with other responses.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-8">
              {questions.map((question, index) => (
                <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <div className="mb-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">
                          {question.question_text} <span className="text-red-500">*</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Response */}
                  <div className="ml-11">
                    <textarea
                      value={responses[question.id] || ''}
                      onChange={(e) => updateResponse(question.id, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Please provide specific examples and thoughtful feedback..."
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>🔒 Your responses are confidential and will be aggregated to protect your anonymity.</p>
        </div>
      </div>

      {/* AI Response Assistant Modal */}
      <SurveyAIAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        questions={questions.map((q) => ({
          id: q.id,
          text: q.question_text,
        }))}
        onComplete={handleAIAssistantComplete}
      />
    </div>
  );
}
