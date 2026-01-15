'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Send, Loader, Sparkles, Cloud, CloudOff } from 'lucide-react';

type SaveStatus = 'idle' | 'saving-local' | 'saved-local' | 'saving-server' | 'saved-server' | 'error';
import SurveyAIAssistant from '../../../../components/SurveyAIAssistant';
import { replaceNamePlaceholder } from '../../../../lib/questionUtils';
import { Tooltip, TooltipProvider } from '../../../../components/unified';

interface Question {
  id: string;
  question_text: string;
  category: string;
  min_words?: number;
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

  // Three-tier save strategy state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const serverSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const responsesRef = useRef<Record<string, string>>({});

  // Keep responsesRef in sync with responses state (for sendBeacon)
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // Server save function
  const saveToServer = useCallback(async (responsesToSave: Record<string, string>) => {
    if (!token || Object.keys(responsesToSave).length === 0) return;

    try {
      setSaveStatus('saving-server');
      const response = await fetch('/api/survey-completion/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses: responsesToSave }),
      });

      if (response.ok) {
        setSaveStatus('saved-server');
        setHasUnsyncedChanges(false);
        console.log('[SurveyCompletionPage] Draft saved to server');
      } else {
        setSaveStatus('error');
        console.error('[SurveyCompletionPage] Server save failed');
      }
    } catch (err) {
      setSaveStatus('error');
      console.error('[SurveyCompletionPage] Server save error:', err);
    }
  }, [token]);

  // Reset server save timer (debounced 7 seconds)
  const resetServerSaveTimer = useCallback(() => {
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
    }
    serverSaveTimerRef.current = setTimeout(() => {
      saveToServer(responsesRef.current);
    }, 5000); // 5 seconds debounce
  }, [saveToServer]);

  // Instant localStorage save on every change
  useEffect(() => {
    if (Object.keys(responses).length > 0 && !success) {
      const draftKey = `survey-draft-${token}`;
      // Instant localStorage save
      localStorage.setItem(draftKey, JSON.stringify(responses));
      setSaveStatus('saved-local');
      console.log('[SurveyCompletionPage] Draft saved to localStorage');
    }
  }, [responses, token, success]);

  // visibilitychange / pagehide handler for sendBeacon
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnsyncedChanges && !success) {
        // Use sendBeacon for reliable fire-and-forget save on tab close
        const data = JSON.stringify({ token, responses: responsesRef.current });
        const sent = navigator.sendBeacon('/api/survey-completion/save-draft', data);
        if (sent) {
          console.log('[SurveyCompletionPage] Draft sent via sendBeacon');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      // Clear timer on unmount
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }
    };
  }, [token, hasUnsyncedChanges, success]);

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

      // Step 3: Load survey questions (include token to get server drafts)
      const questionsResponse = await fetch(`/api/survey-completion/questions?surveyId=${startData.surveyId}&token=${token}`);
      const questionsData = await questionsResponse.json();

      if (!questionsResponse.ok || !questionsData.success) {
        setError(questionsData.error || 'Failed to load questions. Please try again.');
        setLoading(false);
        return;
      }

      setQuestions(questionsData.questions);

      // Initialize responses - check for saved drafts
      const initialResponses: Record<string, string> = {};
      questionsData.questions.forEach((q: Question) => {
        initialResponses[q.id] = '';
      });

      // Priority: Server drafts > localStorage drafts
      // 1. First, load from localStorage (fast)
      const draftKey = `survey-draft-${token}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const localDraftResponses = JSON.parse(savedDraft);
          console.log('[SurveyCompletionPage] Loaded draft from localStorage');
          Object.keys(localDraftResponses).forEach((questionId) => {
            if (initialResponses.hasOwnProperty(questionId)) {
              initialResponses[questionId] = localDraftResponses[questionId];
            }
          });
        } catch (e) {
          console.error('[SurveyCompletionPage] Error loading localStorage draft:', e);
        }
      }

      // 2. Then, merge server drafts (server wins - they're the source of truth for cross-device)
      if (questionsData.draftResponses && Object.keys(questionsData.draftResponses).length > 0) {
        console.log('[SurveyCompletionPage] Loaded draft from server');
        Object.keys(questionsData.draftResponses).forEach((questionId) => {
          if (initialResponses.hasOwnProperty(questionId)) {
            // Server draft takes priority (cross-device sync)
            initialResponses[questionId] = questionsData.draftResponses[questionId];
          }
        });
        // Update localStorage with server state
        localStorage.setItem(draftKey, JSON.stringify(initialResponses));
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

    // Validate word count minimum per question
    const belowMinimum = Object.entries(responses).filter(([questionId, text]) => {
      const question = questions.find(q => q.id === questionId);
      const minWords = question?.min_words || 50;
      return getWordCount(text) < minWords;
    });
    if (belowMinimum.length > 0) {
      setValidationError(`Please meet the minimum word count for all questions. ${belowMinimum.length} question(s) need more detail.`);
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

      // Clear server save timer and sync state
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }
      setHasUnsyncedChanges(false);
      setSaveStatus('idle');

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
    // Mark as having unsynced changes and reset server save timer
    setHasUnsyncedChanges(true);
    resetServerSaveTimer();
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
          <p className="text-gray-600 mb-4">
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
    <TooltipProvider>
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900">
                🔒 Your feedback is confidential and will be aggregated with other responses for anonymity.
              </p>
              {/* Save Status Indicator */}
              <div className="flex items-center gap-2 text-xs">
                {saveStatus === 'saved-local' && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Cloud className="w-3 h-3" />
                    Saved locally
                  </span>
                )}
                {saveStatus === 'saving-server' && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Loader className="w-3 h-3 animate-spin" />
                    Syncing...
                  </span>
                )}
                {saveStatus === 'saved-server' && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Cloud className="w-3 h-3" />
                    Saved to server ✓
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <CloudOff className="w-3 h-3" />
                    Save failed - retrying...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8">
            {/* Validation Error Message */}
            {validationError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex gap-3">
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
                    <Tooltip content="Synthesize and format any thoughts, feelings, or examples with AI">
                      <button
                        type="button"
                        onClick={() => {
                          console.log('[SurveyCompletionPage] Opening AI Assistant for question:', question.id);
                          setActiveQuestionForAI(question.id);
                        }}
                        disabled={submitting}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white text-sm font-semibold py-2 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Response Assistant
                      </button>
                    </Tooltip>
                  </div>

                  {/* Response */}
                  <div className="ml-11">
                    <textarea
                      value={responses[question.id] || ''}
                      onChange={(e) => updateResponse(question.id, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-white text-gray-900 placeholder-gray-400"
                      placeholder="Can't think of what to say? Mention a specific example or tell a story!"
                      required
                    />
                    {/* Word Count Indicator */}
                    <div className="mt-2 text-sm">
                      {(() => {
                        const wordCount = getWordCount(responses[question.id] || '');
                        const minWords = question.min_words || 50;
                        const meetsMinimum = wordCount >= minWords;
                        return (
                          <span className={`font-medium ${meetsMinimum ? 'text-green-600' : 'text-orange-600'}`}>
                            {wordCount} / {minWords} word minimum {meetsMinimum ? '✓' : ''}
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
              <Tooltip content="Submit your responses. This action cannot be undone">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-md font-semibold text-lg flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
              </Tooltip>
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
    </TooltipProvider>
  );
}
