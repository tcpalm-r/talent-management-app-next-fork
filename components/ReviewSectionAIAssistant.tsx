import { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Loader2, Sparkles, Wand2, Trash2 } from 'lucide-react';
import type { Employee } from '../types';
import {
  draftReviewSectionWithAI,
  isAnthropicConfigured,
  type ReviewSectionKey,
} from '../lib/anthropicService';

interface ReviewSectionAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  section: ReviewSectionKey;
  sectionLabel: string;
  employee: Employee;
  reviewerName: string;
  reviewType: 'self' | 'manager';
  existingText: string;
  onApplyDraft: (value: string) => void;
}

interface VoiceNote {
  id: string;
  text: string;
  createdAt: string;
}

export default function ReviewSectionAIAssistant({
  isOpen,
  onClose,
  section,
  sectionLabel,
  employee,
  reviewerName,
  reviewType,
  existingText,
  onApplyDraft,
}: ReviewSectionAIAssistantProps) {
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [manualNotes, setManualNotes] = useState('');
  const [draftText, setDraftText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [anthropicWarning, setAnthropicWarning] = useState<string | null>(null);
  const anthropicAvailable = isAnthropicConfigured();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        if (!transcript) return;

        setVoiceNotes(prev => [
          ...prev,
          {
            id: `${Date.now()}`,
            text: transcript,
            createdAt: new Date().toISOString(),
          },
        ]);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      setSpeechSupported(true);
    } else {
      setSpeechSupported(false);
    }

    if (!anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI drafting.');
    } else {
      setAnthropicWarning(null);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.warn('Speech recognition stop error', error);
        }
        recognitionRef.current = null;
      }
      setIsRecording(false);
    };
  }, [isOpen, anthropicAvailable]);

  useEffect(() => {
    if (!isOpen) {
      setVoiceNotes([]);
      setManualNotes('');
      setDraftText('');
      return;
    }

    setManualNotes('');
    setDraftText(existingText || '');
  }, [isOpen, existingText]);

  const toggleRecording = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Unable to start recording', error);
        setIsRecording(false);
      }
    }
  };

  const removeVoiceNote = (id: string) => {
    setVoiceNotes(prev => prev.filter(note => note.id !== id));
  };

  const handleGenerate = async () => {
    if (!anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI drafting.');
      return;
    }

    setIsGenerating(true);
    setAnthropicWarning(null);

    try {
      const result = await draftReviewSectionWithAI({
        section,
        reviewType,
        reviewerName,
        employee: {
          name: employee.name,
          title: employee.title,
          department: employee.department?.name ?? null,
        },
        voiceNotes: voiceNotes.map(note => note.text),
        manualNotes,
        existingText: draftText,
      });

      setDraftText(result);
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unable to generate draft.';
      setAnthropicWarning(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    onApplyDraft(draftText.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
              <Sparkles className="h-4 w-4" />
              AI Review Assistant
            </div>
            <h2 className="text-xl font-bold text-gray-900">{sectionLabel}</h2>
            <p className="text-xs text-gray-500">
              Drafting for {employee.name}
              {employee.title ? ` · ${employee.title}` : ''}
              {employee.department?.name ? ` · ${employee.department.name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          {anthropicWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {anthropicWarning}
            </div>
          )}

          <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Capture notes by voice</h3>
                <p className="text-xs text-gray-600">
                  Speak naturally; each tap records a short note. You can capture multiple snippets and remove any you
                  do not need.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleRecording}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow ${
                  isRecording ? 'bg-red-600 text-white' : 'bg-white text-gray-700'
                }`}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? 'Stop recording' : 'Record voice note'}
              </button>
            </div>

            {!speechSupported && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
                This browser does not support speech recognition. Try Chrome or Edge, or type your notes instead.
              </div>
            )}

            {voiceNotes.length > 0 && (
              <div className="space-y-2">
                {voiceNotes.map(note => (
                  <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-400">
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{note.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVoiceNote(note.id)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Delete voice note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-900" htmlFor="manual-notes">
              Add or edit written cues
            </label>
            <textarea
              id="manual-notes"
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Key accomplishments, themes, or phrases you want captured..."
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Draft output</h3>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {isGenerating ? 'Generating' : 'Generate with AI'}
              </button>
            </div>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={10}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="AI output will appear here. You can edit before applying."
            />
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4 text-sm">
          <div className="text-gray-500">
            AI suggestions accelerate drafting; review before applying.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!draftText.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Use this draft
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
