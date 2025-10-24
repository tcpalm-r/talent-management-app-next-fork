import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Sparkles, Loader, FileText, MessageSquare, ClipboardList } from 'lucide-react';
import type { Employee } from '../types';
import { getAnthropicClient, isAnthropicConfigured } from '../lib/anthropicService';
import { EmployeeNameLink } from './unified';

interface AIDraftReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  managerName: string;
  onReviewDrafted: (review: string) => void;
}

interface VoiceNote {
  id: string;
  text: string;
  timestamp: string;
}

export default function AIDraftReviewModal({
  isOpen,
  onClose,
  employee,
  managerName,
  onReviewDrafted,
}: AIDraftReviewModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedReview, setDraftedReview] = useState('');
  const [anthropicWarning, setAnthropicWarning] = useState<string | null>(null);
  const anthropicAvailable = isAnthropicConfigured();

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const note: VoiceNote = {
          id: Date.now().toString(),
          text: transcript,
          timestamp: new Date().toISOString(),
        };
        setVoiceNotes(prev => [...prev, note]);
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    if (!anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your environment to enable AI drafting.');
    } else {
      setAnthropicWarning(null);
    }
  }, [anthropicAvailable]);

  const startRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(true);
      recognitionRef.current.start();
    } else {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const removeVoiceNote = (id: string) => {
    setVoiceNotes(prev => prev.filter(note => note.id !== id));
  };

  const draftReview = async () => {
    if (!anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your environment to enable AI drafting.');
      return;
    }

    setIsDrafting(true);
    setDraftedReview('');
    setAnthropicWarning(null);

    try {
      const anthropic = getAnthropicClient();

      // Aggregate all data sources
      const contextData = {
        employee: {
          name: employee.name,
          title: employee.title,
          department: employee.department?.name,
          email: employee.email,
        },
        managerNotes: employee.manager_notes?.map(note => ({
          date: new Date(note.created_at).toLocaleDateString(),
          note: note.note,
          tags: note.tags || [],
        })) || [],
        oneOnOneMeetings: employee.one_on_one_meetings?.map(meeting => ({
          date: new Date(meeting.meeting_date).toLocaleDateString(),
          duration: meeting.duration_minutes,
          type: meeting.meeting_type,
          sharedNotes: meeting.shared_notes?.map(n => n.note) || [],
          privateNotes: meeting.private_notes?.map(n => n.note) || [],
          actionItems: meeting.action_items?.map(a => ({
            title: a.title,
            status: a.status,
          })) || [],
        })) || [],
        voiceNotes: voiceNotes.map(note => note.text),
        manualInput: manualInput.trim(),
        currentAssessment: employee.assessment ? {
          performance: employee.assessment.performance,
          potential: employee.assessment.potential,
        } : null,
      };

      const prompt = `You are drafting a performance review for ${employee.name} (${employee.title || 'Employee'}) at Sonance, a premium audio company.

MANAGER: ${managerName}

CONTEXT ABOUT THE EMPLOYEE:
${JSON.stringify(contextData, null, 2)}

MANAGER'S ADDITIONAL INPUT:
${manualInput || 'No additional input provided'}

VOICE NOTES FROM MANAGER:
${voiceNotes.map((note, i) => `${i + 1}. ${note.text}`).join('\n') || 'No voice notes'}

INSTRUCTIONS:
Draft a comprehensive, professional performance review that:
1. Uses the standard review questions/format that would have been used in previous reviews
2. Synthesizes insights from manager notes, one-on-one meetings, and voice notes
3. Highlights specific accomplishments and examples from the data
4. Addresses any concerns or development areas mentioned
5. Provides constructive feedback with specific examples
6. Includes forward-looking goals and recommendations
7. Maintains a professional, balanced tone
8. References specific conversations, meetings, or documented feedback when relevant

The review should be structured with clear sections:
- **Summary**: Overall performance assessment
- **Key Strengths**: Specific examples from the data
- **Accomplishments**: Concrete achievements mentioned in notes/meetings
- **Areas for Development**: Constructive feedback with examples
- **Goals & Action Items**: Forward-looking development plan
- **Manager's Recommendation**: Overall assessment and next steps

Make it feel authentic and personalized based on the actual data provided. Include specific dates, examples, and references to actual meetings/notes when possible.

Write the review now:`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        setDraftedReview(content.text);
      }
    } catch (error: any) {
      console.error('Error drafting review:', error);
      const message = error instanceof Error ? error.message : 'Failed to draft review.';
      setAnthropicWarning(message);
    } finally {
      setIsDrafting(false);
    }
  };

  const useReview = () => {
    onReviewDrafted(draftedReview);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI-Powered Review Draft</h2>
              <p className="text-sm text-gray-600">
                For{' '}
                <EmployeeNameLink
                  employee={employee}
                  className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
                  onClick={(event) => event.stopPropagation()}
                />
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {anthropicWarning && (
          <div className="border-b border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {anthropicWarning}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Data Sources Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <FileText className="w-5 h-5 text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-900">{employee.manager_notes?.length || 0}</div>
              <div className="text-xs text-blue-700">Manager Notes</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <MessageSquare className="w-5 h-5 text-green-600 mb-2" />
              <div className="text-2xl font-bold text-green-900">{employee.one_on_one_meetings?.length || 0}</div>
              <div className="text-xs text-green-700">One-on-Ones</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <Mic className="w-5 h-5 text-purple-600 mb-2" />
              <div className="text-2xl font-bold text-purple-900">{voiceNotes.length}</div>
              <div className="text-xs text-purple-700">Voice Notes</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <ClipboardList className="w-5 h-5 text-amber-600 mb-2" />
              <div className="text-2xl font-bold text-amber-900">{manualInput.length > 0 ? 1 : 0}</div>
              <div className="text-xs text-amber-700">Manual Input</div>
            </div>
          </div>

          {/* Voice Input */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Voice Notes</h3>
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Recording</span>
                  </>
                )}
              </button>
              {isRecording && (
                <div className="flex items-center space-x-2 text-red-600">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording...</span>
                </div>
              )}
            </div>

            {voiceNotes.length > 0 && (
              <div className="space-y-2">
                {voiceNotes.map((note) => (
                  <div key={note.id} className="flex items-start justify-between p-3 bg-purple-50 border border-purple-200 rounded">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{note.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeVoiceNote(note.id)}
                      className="ml-3 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Text Input */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Feedback (Optional)</h3>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Add any additional context, observations, or feedback that you'd like to include in the review..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
          </div>

          {/* Draft Review Button */}
          <div className="flex justify-center">
            <button
              onClick={draftReview}
              disabled={isDrafting}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isDrafting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Drafting Review...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate AI Review Draft</span>
                </>
              )}
            </button>
          </div>

          {/* Drafted Review */}
          {draftedReview && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Generated Review Draft
              </h3>
              <div className="bg-white border border-green-200 rounded p-4 mb-4">
                <div className="prose prose-sm max-w-none text-gray-900 whitespace-pre-wrap">
                  {draftedReview}
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={useReview}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Use This Review
                </button>
                <button
                  onClick={() => setDraftedReview('')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Powered by Claude Sonnet 4.5 • AI-generated reviews should be reviewed and edited before finalizing
          </p>
        </div>
      </div>
    </div>
  );
}
