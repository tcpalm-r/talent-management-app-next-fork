'use client';

import { useState } from 'react';
import { X, Sparkles, Loader, AlertCircle, Mic, MicOff } from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface Question {
  id: string;
  text: string;
}

interface SurveyAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onComplete: (responses: { [questionId: string]: string }) => void;
}

export default function SurveyAIAssistant({
  isOpen,
  onClose,
  questions,
  onComplete,
}: SurveyAIAssistantProps) {
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Speech-to-text hook
  const {
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    toggleListening,
  } = useSpeechToText({
    onTranscribed: (text: string) => {
      console.log('[SurveyAIAssistant] Transcribed text received:', text);
      setFeedback((prev) => prev + text);
    },
  });

  console.log('[SurveyAIAssistant] Render - isOpen:', isOpen);

  if (!isOpen) {
    console.log('[SurveyAIAssistant] Not open, returning null');
    return null;
  }

  const handleProcess = async () => {
    console.log('[SurveyAIAssistant.handleProcess] Starting - feedback length:', feedback.length);

    if (!feedback.trim()) {
      console.log('[SurveyAIAssistant.handleProcess] Error: Empty feedback');
      setError('Please provide feedback before processing');
      return;
    }

    console.log('[SurveyAIAssistant.handleProcess] Calling API with feedback');
    setIsLoading(true);
    setError(null);

    try {
      console.log('[SurveyAIAssistant.handleProcess] Making fetch request to /api/ai/parse-survey-responses');
      const response = await fetch('/api/ai/parse-survey-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackText: feedback.trim(),
          questions: questions,
        }),
      });

      console.log('[SurveyAIAssistant.handleProcess] Response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        console.log('[SurveyAIAssistant.handleProcess] API error response:', data);
        throw new Error(data.error || 'Failed to parse feedback');
      }

      const data = await response.json();
      console.log('[SurveyAIAssistant.handleProcess] API success response:', data);

      if (data.parsedResponses) {
        console.log('[SurveyAIAssistant.handleProcess] Proceeding with parsed responses:', data.parsedResponses);
        onComplete(data.parsedResponses);
        setFeedback('');
        onClose();
      } else {
        throw new Error('No parsed responses returned');
      }
    } catch (err: any) {
      console.error('[SurveyAIAssistant.handleProcess] Error:', err);
      setError(err.message || 'Failed to process your feedback');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-2xl font-bold">AI Response Assistant</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Share your feedback in your own words
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Type or speak all your thoughts and observations. Our AI will intelligently map your feedback to each survey question.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-emerald-900">
                <strong>Example:</strong> "Sarah has great communication skills and leads meetings effectively. She could work on delegating more to her team instead of doing everything herself. Overall very impressed with her collaboration with other departments."
              </p>
            </div>

            {/* Textarea with Microphone Button */}
            <div className="relative mb-4">
              <textarea
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  setError(null);
                }}
                disabled={isLoading || isListening}
                placeholder="Type your feedback here... or click the mic to speak"
                className="w-full h-48 px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-100 resize-none"
              />

              {/* Microphone Button */}
              {isSpeechSupported && (
                <button
                  onClick={() => {
                    console.log('[SurveyAIAssistant] Microphone button clicked');
                    toggleListening();
                  }}
                  disabled={isLoading}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                  title={isListening ? 'Stop listening' : 'Start listening'}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* Speech Recognition Status */}
            {isListening && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <p className="text-sm text-blue-700 font-medium">🎤 Listening... Speak now</p>
              </div>
            )}

            {/* Speech Error */}
            {speechError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">{speechError}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Questions Preview */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Your feedback will be mapped to these questions:
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-700">
                    <strong>{idx + 1}.</strong> {q.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleProcess}
              disabled={isLoading}
              className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Process & Fill Responses
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
