'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Send, Loader, Sparkles } from 'lucide-react';
import SurveyAIAssistant from '../../../../components/SurveyAIAssistant';
import { replaceNamePlaceholder } from '../../../../lib/questionUtils';

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeQuestionForAI, setActiveQuestionForAI] = useState<string | null>(null);

  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  // Autosave draft responses to localStorage
  useEffect(() => {
    if (Object.keys(responses).length > 0 && !success) {
      const draftKey = `survey-draft-${token}`;
      const saveTimer = setTimeout(() => {
        localStorage.setItem(draftKey, JSON.stringify(responses));
        console.log('[SurveyCompletionPage] Draft saved to localStorage');
      }, 500); // Debounce 500ms

      return () => clearTimeout(saveTimer);
    }
  }, [responses, token, success]);

  useEffect(() => {
    loadSurveyData();
  }, [token]);

  const loadSurveyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Start the survey (validate token and update status)
      const startResponse = await fetch('/api/survey-completion/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const startData = await startResponse.json();

      if (!startResponse.ok || !startData.success) {
        setError(startData.error || 'Invalid or expired survey link. Please contact your HR department.');
        setLoading(false);
        return;
      }

      setReviewer(startData.reviewer);

      // Check if already completed
      if (startData.reviewer.status === 'completed') {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Step 2: Load survey details
      const surveyResponse = await fetch(`/api/survey-completion/survey?token=${token}`);
      const surveyData = await surveyResponse.json();

      if (!surveyResponse.ok || !surveyData.success) {
        setError(surveyData.error || 'Survey not found. Please contact your HR department.');
        setLoading(false);
        return;
      }

      setSurvey(surveyData.survey);

      // Step 3: Load survey questions
      const questionsResponse = await fetch(`/api/survey-completion/questions?surveyId=${startData.surveyId}`);
      const questionsData = await questionsResponse.json();

      if (!questionsResponse.ok || !questionsData.success) {
        setError(questionsData.error || 'Failed to load questions. Please try again.');
        setLoading(false);
        return;
      }

      setQuestions(questionsData.questions);

      // Initialize responses - check for saved draft first
      const initialResponses: Record<string, string> = {};
      questionsData.questions.forEach((q: Question) => {
        initialResponses[q.id] = '';
      });

      // Load draft from localStorage if it exists
      const draftKey = `survey-draft-${token}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draftResponses = JSON.parse(savedDraft);
          console.log('[SurveyCompletionPage] Loaded draft from localStorage');
          // Merge saved draft with initial responses
          Object.keys(draftResponses).forEach((questionId) => {
            if (initialResponses.hasOwnProperty(questionId)) {
              initialResponses[questionId] = draftResponses[questionId];
            }
          });
        } catch (e) {
          console.error('[SurveyCompletionPage] Error loading draft:', e);
        }
      }

      setResponses(initialResponses);

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading survey:', err);
      setError('An unexpected error occurred. Please try again later.');
      setLoading(false);
    }
  };

  const handleAIAssistantComplete = (responseText: string) => {
    console.log('[SurveyCompletionPage] AI Assistant completed with response:', responseText);
    if (activeQuestionForAI) {
      setResponses(prev => ({
        ...prev,
        [activeQuestionForAI]: responseText
      }));
    }
    setActiveQuestionForAI(null);
  };

  const handleAIAssistantDraftUpdate = (draftText: string) => {
    console.log('[SurveyCompletionPage] AI Assistant draft updated:', draftText);
    if (activeQuestionForAI) {
      setResponses(prev => ({
        ...prev,
        [activeQuestionForAI]: draftText
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewer || !survey) return;

    // Clear previous validation errors
    setValidationError(null);

    // Validate all questions have responses
    const allAnswered = Object.values(responses).every(r => r.trim().length > 0);
    if (!allAnswered) {
      setValidationError('Please provide a response for all questions.');
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate word count minimum (50 words per question)
    const belowMinimum = Object.entries(responses).filter(([_, text]) => {
      return getWordCount(text) < 50;
    });
    if (belowMinimum.length > 0) {
      setValidationError(`Please provide at least 50 words for each question. ${belowMinimum.length} question(s) need more detail.`);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      // Submit all responses
      const responsesToSubmit = Object.entries(responses).map(([questionId, responseText]) => ({
        questionId,
        responseText,
      }));

      const submitResponse = await fetch('/api/survey-completion/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses: responsesToSubmit }),
      });

      const submitData = await submitResponse.json();

      if (!submitResponse.ok || !submitData.success) {
        throw new Error(submitData.error || 'Failed to submit survey');
      }

      // Clear draft from localStorage on successful submission
      const draftKey = `survey-draft-${token}`;
      localStorage.removeItem(draftKey);
      console.log('[SurveyCompletionPage] Draft cleared from localStorage');

      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting survey:', err);
      setValidationError('Failed to submit your feedback. Please try again.');
      setSubmitting(false);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateResponse = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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
              Subject: <strong>{survey?.employee_name}</strong>
            </p>
            <p className="text-blue-100 mt-1">
              Responding as: <strong>{reviewer?.reviewer_name}</strong>
            </p>
            {survey?.due_date && (
              <p className="text-sm text-blue-200 mt-2">
                Due: {new Date(survey.due_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border-b border-blue-200 px-8 py-5">
            <p className="text-sm font-semibold text-blue-900">
              🔒 Your feedback is confidential and will be aggregated with other responses for anonymity.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8">
            {/* Validation Error Message */}
            {validationError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{validationError}</p>
              </div>
            )}

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
                          {replaceNamePlaceholder(question.question_text, survey?.employee_name)} <span className="text-red-500">*</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Assistant Button */}
                  <div className="ml-11 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        console.log('[SurveyCompletionPage] Opening AI Assistant for question:', question.id);
                        setActiveQuestionForAI(question.id);
                      }}
                      disabled={submitting}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Use AI to help with this question"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Response Assistant
                    </button>
                  </div>

                  {/* Response */}
                  <div className="ml-11">
                    <textarea
                      value={responses[question.id] || ''}
                      onChange={(e) => updateResponse(question.id, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      placeholder="Can't think of what to say? Mention a specific example or tell a story!"
                      required
                    />
                    {/* Word Count Indicator */}
                    <div className="mt-2 text-sm">
                      {(() => {
                        const wordCount = getWordCount(responses[question.id] || '');
                        const meetsMinimum = wordCount >= 50;
                        return (
                          <span className={`font-medium ${meetsMinimum ? 'text-green-600' : 'text-orange-600'}`}>
                            {wordCount} / 50 words {meetsMinimum ? '✓' : ''}
                          </span>
                        );
                      })()}
                    </div>
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

      </div>

      {/* AI Response Assistant Modal */}
      {activeQuestionForAI && (
        <SurveyAIAssistant
          isOpen={activeQuestionForAI !== null}
          onClose={() => setActiveQuestionForAI(null)}
          question={questions.find(q => q.id === activeQuestionForAI)}
          subjectName={survey?.employee_name || 'the employee'}
          currentText={responses[activeQuestionForAI] || ''}
          onComplete={handleAIAssistantComplete}
          onDraftUpdate={handleAIAssistantDraftUpdate}
        />
      )}
    </div>
  );
}
