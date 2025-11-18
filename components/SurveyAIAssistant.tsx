'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader, AlertCircle } from 'lucide-react';
import { replaceNamePlaceholder } from '../lib/questionUtils';

interface Question {
  id: string;
  question_text: string;
  category: string;
}

interface SurveyAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | undefined;
  subjectName: string;
  currentText?: string;
  onComplete: (responseText: string) => void;
  onDraftUpdate?: (draftText: string) => void;
}

export default function SurveyAIAssistant({
  isOpen,
  onClose,
  question,
  subjectName,
  currentText,
  onComplete,
  onDraftUpdate,
}: SurveyAIAssistantProps) {
  const [feedback, setFeedback] = useState(currentText || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Update feedback when currentText changes (e.g., when modal reopens)
  useEffect(() => {
    if (isOpen && currentText !== undefined) {
      setFeedback(currentText);
      setHasGenerated(false); // Reset generated state when modal opens
    }
  }, [isOpen, currentText]);

  console.log('[SurveyAIAssistant] Render - isOpen:', isOpen);

  // Handle close - save draft text back to parent (only if not generated yet)
  const handleClose = () => {
    // Only save draft if we haven't generated yet (X acts as cancel after generation)
    if (!hasGenerated && onDraftUpdate && feedback !== currentText) {
      onDraftUpdate(feedback);
    }
    onClose();
  };

  if (!isOpen) {
    console.log('[SurveyAIAssistant] Not open, returning null');
    return null;
  }

  const handleProcess = async () => {
    console.log('[SurveyAIAssistant.handleProcess] Starting - feedback length:', feedback.length);

    if (!feedback.trim()) {
      console.log('[SurveyAIAssistant.handleProcess] Error: Empty feedback');
      setError('Please provide your thoughts before processing');
      return;
    }

    // Count words in the input
    const wordCount = feedback.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 30) {
      console.log('[SurveyAIAssistant.handleProcess] Error: Not enough words', wordCount);
      setError('Please provide more details, or give a specific example. Claude needs enough input to create a sufficient (50+ word) response.');
      return;
    }

    if (!question) {
      setError('Question not found');
      return;
    }

    console.log('[SurveyAIAssistant.handleProcess] Calling API with feedback for single question');
    setIsLoading(true);
    setError(null);

    try {
      console.log('[SurveyAIAssistant.handleProcess] Making fetch request to /api/ai/generate-survey-response');
      const response = await fetch('/api/ai/generate-survey-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: question.question_text,
          userThoughts: feedback.trim(),
          subjectName: subjectName,
        }),
      });

      console.log('[SurveyAIAssistant.handleProcess] Response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        console.log('[SurveyAIAssistant.handleProcess] API error response:', data);
        throw new Error(data.error || 'Failed to generate response');
      }

      const data = await response.json();
      console.log('[SurveyAIAssistant.handleProcess] API success response:', data);

      if (data.response) {
        console.log('[SurveyAIAssistant.handleProcess] Setting AI-generated response in modal textarea');
        setFeedback(data.response);
        setHasGenerated(true);
      } else {
        throw new Error('No response returned');
      }
    } catch (err: any) {
      console.error('[SurveyAIAssistant.handleProcess] Error:', err);
      setError(err.message || 'Failed to process your thoughts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    // Accept button always saves the current feedback
    if (onDraftUpdate && feedback !== currentText) {
      onDraftUpdate(feedback);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-2xl font-bold">AI Response Assistant</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Question Display */}
          {question && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="block text-sm font-semibold text-purple-900 mb-2">
                Question:
              </label>
              <p className="text-gray-900">{replaceNamePlaceholder(question.question_text, subjectName)}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Share your thoughts
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Type your thoughts about this question. AI will help refine and format your response into professional feedback.
            </p>

            <textarea
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              placeholder="Type your thoughts here... (e.g., 'great communicator, needs to delegate more, very collaborative')"
              className="w-full h-48 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 disabled:bg-gray-100 resize-none"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {/* Center: Generate/Try Again Button */}
            <div className="flex-1 flex justify-center">
              <button
                onClick={handleProcess}
                disabled={isLoading}
                className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {hasGenerated ? 'Try Again' : 'Generate Response'}
                  </>
                )}
              </button>
            </div>

            {/* Right: Accept Button (only show after generation) */}
            {hasGenerated && !isLoading && (
              <button
                onClick={handleAccept}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                Accept
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
