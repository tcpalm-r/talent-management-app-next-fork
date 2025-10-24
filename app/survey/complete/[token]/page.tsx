'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { CheckCircle, AlertCircle, Send, Loader } from 'lucide-react';

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

  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, { rating: number; text: string }>>({});

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

      setReviewer(reviewerData);

      // Check if already completed
      if (reviewerData.status === 'completed') {
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
        .select('id, survey_name, due_date, employee:user_profiles!feedback_360_surveys_employee_id_fkey(full_name)')
        .eq('id', reviewerData.survey_id)
        .single();

      if (surveyError || !surveyData) {
        setError('Survey not found. Please contact your HR department.');
        setLoading(false);
        return;
      }

      setSurvey({
        id: surveyData.id,
        survey_name: surveyData.survey_name,
        employee_name: surveyData.employee?.full_name || 'Unknown Employee',
        due_date: surveyData.due_date,
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
      const initialResponses: Record<string, { rating: number; text: string }> = {};
      loadedQuestions.forEach((q: Question) => {
        initialResponses[q.id] = { rating: 0, text: '' };
      });
      setResponses(initialResponses);

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading survey:', err);
      setError('An unexpected error occurred. Please try again later.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewer || !survey) return;

    // Validate all questions have ratings
    const allRated = Object.values(responses).every(r => r.rating > 0);
    if (!allRated) {
      setError('Please provide a rating for all questions.');
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
        rating: response.rating,
        response_text: response.text || null,
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

      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting survey:', err);
      setError('Failed to submit your feedback. Please try again.');
      setSubmitting(false);
    }
  };

  const updateResponse = (questionId: string, field: 'rating' | 'text', value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
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

          {/* Instructions */}
          <div className="bg-blue-50 border-b border-blue-200 px-8 py-4">
            <p className="text-sm text-blue-900">
              <strong>Instructions:</strong> Please rate each question on a scale of 1-5 and provide additional comments if you'd like. Your responses are confidential and will be aggregated with other feedback.
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
                        <p className="text-gray-900 font-medium">{question.question_text}</p>
                        {question.category && (
                          <p className="text-xs text-gray-500 mt-1">Category: {question.category}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="mb-4 ml-11">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rating (1 = Strongly Disagree, 5 = Strongly Agree)
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => updateResponse(question.id, 'rating', rating)}
                          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                            responses[question.id]?.rating === rating
                              ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="ml-11">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Comments (Optional)
                    </label>
                    <textarea
                      value={responses[question.id]?.text || ''}
                      onChange={(e) => updateResponse(question.id, 'text', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Share specific examples or suggestions..."
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
    </div>
  );
}
