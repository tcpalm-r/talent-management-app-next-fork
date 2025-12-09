'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader, AlertCircle, Info } from 'lucide-react';
import { replaceNamePlaceholder } from '../lib/questionUtils';
import { generateSurveyResponse } from '../lib/services/surveyResponseService';

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
  const [originalInput, setOriginalInput] = useState<string>('');
  const [apiNotice, setApiNotice] = useState<{ type: 'success' | 'fallback'; message: string } | null>(null);

  // Only show API notices in local testing mode
  const isLocalTesting = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  // Update feedback when currentText changes (e.g., when modal reopens)
  useEffect(() => {
    if (isOpen && currentText !== undefined) {
      setFeedback(currentText);
      setHasGenerated(false); // Reset generated state when modal opens
      setOriginalInput(''); // Reset original input when modal opens
      setApiNotice(null); // Clear API notice when modal opens
    }
  }, [isOpen, currentText]);

  console.log('[SurveyAIAssistant] Render - isOpen:', isOpen);

  // Calculate text similarity (word overlap percentage)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = text1.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    const words2 = text2.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    // Count overlapping words
    let overlap = 0;
    set1.forEach(word => {
      if (set2.has(word)) overlap++;
    });

    // Calculate percentage based on smaller set
    const minSize = Math.min(set1.size, set2.size);
    return (overlap / minSize) * 100;
  };

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
      setError('Can you give one or two specific examples? Claude needs enough input to create a sufficient response.');
      return;
    }

    if (!question) {
      setError('Question not found');
      return;
    }

    console.log('[SurveyAIAssistant.handleProcess] Calling API with feedback for single question');

    // Save original input before generating (only if not already saved)
    if (!originalInput) {
      setOriginalInput(feedback);
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[SurveyAIAssistant.handleProcess] Calling survey response service');

      // Prepare request
      const request = {
        questionText: question.question_text,
        userThoughts: feedback.trim(),
        subjectName: subjectName,
        originalInput: undefined as string | undefined,
      };

      // If regenerating, check similarity to determine if we should include original input
      if (hasGenerated && originalInput) {
        const similarity = calculateSimilarity(feedback, originalInput);
        console.log('[SurveyAIAssistant.handleProcess] Text similarity:', similarity.toFixed(1) + '%');

        // Only include original input if text is still similar (≥30% overlap)
        if (similarity >= 30) {
          request.originalInput = originalInput;
          console.log('[SurveyAIAssistant.handleProcess] Including original input (similar enough)');
        } else {
          console.log('[SurveyAIAssistant.handleProcess] Skipping original input (too different, treating as fresh)');
        }
      }

      // Clear any previous notice
      setApiNotice(null);

      // Call service with fallback notification callback
      const result = await generateSurveyResponse(request, (reason, originalError) => {
        console.warn('[SurveyAIAssistant] Fallback triggered:', reason, originalError);
        // Only set fallback notice in local testing mode
        if (isLocalTesting) {
          setApiNotice({ type: 'fallback', message: `Fallback to v1: ${reason}` });
        }
      });

      console.log('[SurveyAIAssistant.handleProcess] Service response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate response');
      }

      if (result.response) {
        console.log('[SurveyAIAssistant.handleProcess] Setting AI-generated response');
        console.log('[SurveyAIAssistant.handleProcess] API version used:', result.meta?.version);
        setFeedback(result.response);
        setHasGenerated(true);

        // Show API version notice (only in local testing mode)
        if (isLocalTesting) {
          if (result.meta?.fallbackUsed) {
            setApiNotice({ type: 'fallback', message: `Used v1 (fallback): ${result.meta.fallbackReason}` });
          } else if (result.meta?.version === 'v2-skill') {
            setApiNotice({ type: 'success', message: `Used v2 skill API (${result.meta.elapsedMs}ms)` });
          } else {
            setApiNotice({ type: 'success', message: `Used v1 prompt API (${result.meta?.elapsedMs}ms)` });
          }
        }
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

  const handleRevert = () => {
    // Revert to original user input
    if (originalInput) {
      setFeedback(originalInput);
      setHasGenerated(false);
      setOriginalInput(''); // Clear original input so next generation is fresh
      setError(null);
    }
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
            className="text-white hover:bg-white/20 rounded-md p-1 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Question Display */}
          {question && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
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
              Type your thoughts about this question. AI will help refine and format your response into formal feedback.
            </p>

            <textarea
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              placeholder="Type your thoughts here... (e.g., 'great communicator, needs to delegate more, very collaborative')"
              className="w-full h-48 px-4 py-3 border-2 border-gray-300 rounded-md focus:outline-none focus:border-purple-500 disabled:bg-gray-100 resize-none"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {apiNotice && !error && isLocalTesting && (
            <div className={`mb-6 p-3 rounded-md flex gap-2 items-center text-xs ${
              apiNotice.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              <Info className="w-4 h-4 flex-shrink-0" />
              <span className="font-mono">{apiNotice.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {/* Left: Revert Button (only show after generation) */}
            {hasGenerated && !isLoading && (
              <button
                onClick={handleRevert}
                className="px-6 py-3 bg-red-50 border-2 border-red-200 text-red-700 font-semibold rounded-md hover:bg-red-100 transition"
              >
                Revert
              </button>
            )}

            {/* Center: Generate/Regenerate Button */}
            <div className={`flex-1 flex justify-center ${hasGenerated ? '' : 'mr-auto'}`}>
              <button
                onClick={handleProcess}
                disabled={isLoading}
                className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {hasGenerated ? 'Regenerate' : 'Generate Response'}
                  </>
                )}
              </button>
            </div>

            {/* Right: Accept Button (only show after generation) */}
            {hasGenerated && !isLoading && (
              <button
                onClick={handleAccept}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition flex items-center gap-2"
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
