'use client';

import { useState } from 'react';
import { X, Sparkles, Loader, AlertCircle, Mic, MicOff } from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface CreateWithAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: ParsedSurveyData) => void;
  selectedEmployee?: any; // Employee being reviewed
  currentStep?: string; // Current wizard step for context
  employees?: any[]; // Available employees for reference
}

export interface ParsedSurveyData {
  employeeName: string;
  employeeId?: string;
  questions: string[];
  raters: Array<{
    name: string;
    email: string;
    relationship: 'manager' | 'peer' | 'direct_report' | 'cross_functional';
  }>;
  dueDate?: string;
  surveyTitle?: string;
}

interface Clarification {
  field: string;
  reason: string;
  options?: string[];
}

interface PartialData {
  employeeName: string | null;
  questions: string[];
  raters: Array<{
    name: string;
    email: string | null;
    relationship: 'manager' | 'peer' | 'direct_report' | 'cross_functional';
    clarification_needed?: boolean;
  }>;
  dueDate?: string | null;
  surveyTitle?: string | null;
}

interface ClarificationState {
  [key: string]: string;
}

export default function CreateWithAIModal({
  isOpen,
  onClose,
  onComplete,
  selectedEmployee,
  currentStep,
  employees,
}: CreateWithAIModalProps) {
  // Pre-populate description with employee name if available
  const initialDescription = selectedEmployee
    ? `Create a 360 review for ${selectedEmployee.name || selectedEmployee.full_name}. `
    : '';

  const [description, setDescription] = useState(initialDescription);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[] | null>(null);
  const [clarificationResponses, setClarificationResponses] = useState<ClarificationState>({});
  const [partialData, setPartialData] = useState<PartialData | null>(null);

  // Speech-to-text hook
  const {
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    toggleListening,
  } = useSpeechToText({
    onTranscribed: (text: string) => {
      setDescription((prev) => prev + text);
    },
  });


  if (!isOpen) {
    return null;
  }

  const handleDone = async () => {
    console.log('[CreateWithAIModal.handleDone] Starting - description length:', description.length);

    if (!description.trim()) {
      console.log('[CreateWithAIModal.handleDone] Error: Empty description');
      setError('Please describe the survey you want to create');
      return;
    }

    console.log('[CreateWithAIModal.handleDone] Calling API with description');
    setIsLoading(true);
    setError(null);

    try {
      // Call the Claude API to parse the survey description
      console.log('[CreateWithAIModal.handleDone] Making fetch request to /api/ai/parse-survey-description');

      // Get today's date for Claude to interpret relative dates
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('[CreateWithAIModal.handleDone] Today\'s date:', todayString);

      const requestPayload = {
        description: description.trim(),
        today: todayString,
        wizardContext: {
          selectedEmployee: selectedEmployee ? { id: selectedEmployee.id, name: selectedEmployee.name || selectedEmployee.full_name } : undefined,
          currentStep,
          availableEmployees: employees ? employees.map((e: any) => ({ id: e.id, name: e.name || e.full_name })) : undefined,
        },
      };
      console.log('[CreateWithAIModal.handleDone] Request payload:', JSON.stringify(requestPayload));

      const response = await fetch('/api/ai/parse-survey-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      console.log('[CreateWithAIModal.handleDone] Response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        console.log('[CreateWithAIModal.handleDone] API error response:', data);
        throw new Error(data.error || 'Failed to parse survey description');
      }

      const data = await response.json();
      console.log('[CreateWithAIModal.handleDone] API success response:', data);
      console.log('[CreateWithAIModal.handleDone] Parsed data:', data.parsedData || data.partialData);
      console.log('[CreateWithAIModal.handleDone] Reviewers extracted:', data.parsedData?.raters?.length || data.partialData?.raters?.length || 0);

      if (data.requiresClarification) {
        console.log('[CreateWithAIModal.handleDone] Clarifications needed:', data.clarifications);
        // Show clarification form
        setClarifications(data.clarifications);
        setPartialData(data.partialData);
        setClarificationResponses({});
      } else {
        console.log('[CreateWithAIModal.handleDone] No clarifications needed, proceeding with data:', data.parsedData);
        console.log('[CreateWithAIModal.handleDone] Reviewers to be added:', data.parsedData?.raters);
        // Proceed with the parsed data
        onComplete(data.parsedData);
        setDescription('');
        setClarifications(null);
        setPartialData(null);
        onClose();
      }
    } catch (err: any) {
      console.error('[CreateWithAIModal.handleDone] Error:', err);
      setError(err.message || 'Failed to process your survey description');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClarificationSubmit = async () => {
    // TODO: Send clarifications to Claude for refinement
    // For now, just proceed with the partial data plus user responses
    if (partialData) {
      const finalData: ParsedSurveyData = {
        employeeName: clarificationResponses.employeeName || partialData.employeeName || '',
        questions: partialData.questions,
        raters: partialData.raters
          .filter((r) => !r.clarification_needed)
          .map((r) => ({
            name: r.name,
            email: r.email || '',
            relationship: r.relationship,
          })),
        dueDate: clarificationResponses.dueDate || partialData.dueDate || undefined,
        surveyTitle: partialData.surveyTitle || undefined,
      };

      onComplete(finalData);
      setDescription('');
      setClarifications(null);
      setPartialData(null);
      onClose();
    }
  };

  const handleBackToInput = () => {
    setClarifications(null);
    setPartialData(null);
    setClarificationResponses({});
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-2xl font-bold">
              {clarifications ? 'Confirm Survey Details' : 'Create 360° Review with AI'}
            </h2>
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
          {!clarifications ? (
            <>
              {/* Initial Description Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Describe your 360° review
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Tell us who the review is for, what you want to assess, who should provide feedback, and when it's due. Be as specific as possible.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900 mb-3">
                    <strong>Example:</strong> "Create a 360 review for Sarah Chen to assess her leadership and communication skills. Get feedback from her manager (john@company.com), 2 peers (mike@company.com and anna@company.com), and 2 direct reports. Focus on leadership, collaboration, and communication. Due next Friday."
                  </p>
                  <div className="flex items-start gap-2 text-xs text-blue-800 bg-white/60 p-2 rounded border border-blue-100">
                    <span className="text-blue-600 font-semibold mt-0.5">💡 Tip:</span>
                    <span>The AI recognizes employee names from your system, nicknames, and relationships (e.g., "Bob" → finds Robert). You can also mention reviewers by role or partial names.</span>
                  </div>
                </div>

                {/* Textarea with Microphone Button */}
                <div className="relative mb-4">
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError(null);
                    }}
                    disabled={isLoading || isListening}
                    placeholder="Type your survey description here... or click the mic to speak"
                    className="w-full h-48 px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 resize-none"
                  />

                  {/* Microphone Button */}
                  {isSpeechSupported && (
                    <button
                      onClick={() => {
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
                  onClick={handleDone}
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Done
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Clarification Form */}
              <div className="mb-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-900 font-semibold text-sm mb-2">
                      We need a few more details to complete your survey
                    </p>
                    <p className="text-amber-800 text-sm">
                      Please fill in the missing information below.
                    </p>
                  </div>
                </div>

                {clarifications.map((clarification, index) => (
                  <div key={index} className="mb-6 pb-6 border-b border-gray-200 last:border-b-0">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {clarification.field === 'employeeName' && 'Who is this review for?'}
                      {clarification.field === 'questions' && 'What questions should we ask?'}
                      {clarification.field === 'raters' && 'Who should provide feedback?'}
                      {clarification.field === 'dueDate' && 'When is this review due?'}
                    </label>
                    <p className="text-sm text-gray-600 mb-3">{clarification.reason}</p>

                    {clarification.field === 'dueDate' ? (
                      <input
                        type="date"
                        value={clarificationResponses[clarification.field] || ''}
                        onChange={(e) =>
                          setClarificationResponses({
                            ...clarificationResponses,
                            [clarification.field]: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    ) : clarification.options && clarification.options.length > 0 ? (
                      <select
                        value={clarificationResponses[clarification.field] || ''}
                        onChange={(e) =>
                          setClarificationResponses({
                            ...clarificationResponses,
                            [clarification.field]: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select an option...</option>
                        {clarification.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={clarificationResponses[clarification.field] || ''}
                        onChange={(e) =>
                          setClarificationResponses({
                            ...clarificationResponses,
                            [clarification.field]: e.target.value,
                          })
                        }
                        placeholder={`Enter ${clarification.field}...`}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons for Clarification */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleBackToInput}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleClarificationSubmit}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Confirm & Create
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
