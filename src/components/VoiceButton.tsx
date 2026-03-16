'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  lang: string;
}

export default function VoiceButton({ onTranscript, onError, disabled, lang }: VoiceButtonProps) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Use refs for callbacks to avoid stale closures in recognition event handlers
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const toggle = useCallback(() => {
    if (recording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0];
      if (result && result[0]) {
        const transcript = result[0].transcript;
        if (transcript) {
          onTranscriptRef.current(transcript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        onErrorRef.current('voice.noSpeechDetected');
      } else if (event.error === 'not-allowed') {
        onErrorRef.current('voice.micPermissionDenied');
      } else if (event.error === 'network') {
        onErrorRef.current('voice.networkError');
      } else if (event.error !== 'aborted') {
        onErrorRef.current('voice.notSupported');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
    };

    recognitionRef.current = recognition;
    setRecording(true);

    try {
      recognition.start();
    } catch {
      setRecording(false);
      recognitionRef.current = null;
      onErrorRef.current('voice.notSupported');
    }
  }, [recording, lang]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className="relative p-2 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors rounded-lg"
      aria-label={recording ? 'Stop recording' : 'Voice input'}
      type="button"
    >
      {recording && (
        <span className="absolute inset-0.5 rounded-full border-2 border-red-500 animate-pulse" />
      )}
      <svg
        className={`w-5 h-5 transition-colors ${recording ? 'text-red-500' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  );
}
