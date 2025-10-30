import { useState, useCallback, useRef } from 'react';

interface UseSpeechToTextOptions {
  onTranscribed?: (text: string) => void;
}

export function useSpeechToText(options?: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition on first use
  const initializeSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    // Get the speech recognition API (handles browser prefixes)
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      console.log('[useSpeechToText] Speech Recognition API not supported');
      setIsSupported(false);
      setError('Speech recognition is not supported in your browser');
      return null;
    }

    const recognition = new SpeechRecognition();

    // Configuration
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.language = 'en-US';

    let interimTranscript = '';

    recognition.onstart = () => {
      console.log('[useSpeechToText] Listening started');
      setIsListening(true);
      setError(null);
      interimTranscript = '';
    };

    recognition.onresult = (event: any) => {
      interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log('[useSpeechToText] Interim result:', transcript);

        if (event.results[i].isFinal) {
          console.log('[useSpeechToText] Final result:', transcript);
          setTranscript((prev) => prev + transcript + ' ');
          if (options?.onTranscribed) {
            options.onTranscribed(transcript + ' ');
          }
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[useSpeechToText] Error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[useSpeechToText] Listening stopped');
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [options]);

  const startListening = useCallback(() => {
    console.log('[useSpeechToText] Start listening called');
    const recognition = initializeSpeechRecognition();
    if (recognition) {
      recognition.start();
    }
  }, [initializeSpeechRecognition]);

  const stopListening = useCallback(() => {
    console.log('[useSpeechToText] Stop listening called');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    console.log('[useSpeechToText] Toggle listening - current state:', isListening);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    console.log('[useSpeechToText] Reset transcript');
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
