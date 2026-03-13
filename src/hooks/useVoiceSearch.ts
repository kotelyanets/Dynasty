/**
 * useVoiceSearch.ts
 * ─────────────────────────────────────────────────────────────
 * Voice-powered search using the Web Speech API.
 *
 * Provides a simple interface to start/stop speech recognition
 * and get the recognized text for the search input.
 *
 * iOS notes:
 *   • SpeechRecognition is available in Safari 14.5+
 *   • Uses webkitSpeechRecognition as the prefixed API
 *   • Requires user gesture to start
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

export function useVoiceSearch(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ??
               (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ??
               (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new (SR as new () => SpeechRecognitionInstance)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const last = results[results.length - 1];
      if (last) {
        const transcript = last[0].transcript;
        onResult(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are not real errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[VoiceSearch] Error:', event.error);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return { listening, supported, start, stop };
}
