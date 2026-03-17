'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onRecordingChange: (recording: boolean) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  lang: string;
}

type VoiceState = 'idle' | 'recording' | 'transcribing';

export default function VoiceButton({ onTranscript, onRecordingChange, onError, disabled, lang }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [supported, setSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Refs for callbacks to avoid stale closures
  const onTranscriptRef = useRef(onTranscript);
  const onRecordingChangeRef = useRef(onRecordingChange);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onRecordingChangeRef.current = onRecordingChange; }, [onRecordingChange]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    setSupported(!!(navigator.mediaDevices?.getUserMedia)); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas internal resolution to display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const displayWidth = rect.width;
    const displayHeight = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw centered waveform bars
      const barCount = 40;
      const gap = 2;
      const barWidth = (displayWidth - (barCount - 1) * gap) / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const barHeight = Math.max(3, (value / 255) * displayHeight * 0.9);
        const x = i * (barWidth + gap);
        const y = (displayHeight - barHeight) / 2;

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();
  }, []);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setState('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('locale', lang === 'id-ID' ? 'id' : 'en');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.text) {
        onErrorRef.current(res.status === 422 ? 'voice.noSpeechDetected' : 'voice.transcriptionFailed');
        onRecordingChangeRef.current(false);
        setState('idle');
        return;
      }

      onTranscriptRef.current(data.text);
      onRecordingChangeRef.current(false);
      setState('idle');
    } catch {
      onErrorRef.current('voice.transcriptionFailed');
      onRecordingChangeRef.current(false);
      setState('idle');
    }
  }, [lang]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio API for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        if (blob.size > 0) {
          transcribe(blob);
        } else {
          onErrorRef.current('voice.noSpeechDetected');
          onRecordingChangeRef.current(false);
          setState('idle');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setState('recording');
      onRecordingChangeRef.current(true);

      // Start waveform after a small delay to let canvas mount
      requestAnimationFrame(() => drawWaveform());
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        onErrorRef.current('voice.micPermissionDenied');
      } else {
        onErrorRef.current('voice.networkError');
      }
    }
  }, [cleanup, drawWaveform, transcribe]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (!supported) return null;

  // Recording: waveform canvas + stop button (fills the parent flex container)
  if (state === 'recording') {
    return (
      <>
        <canvas
          ref={canvasRef}
          className="flex-1 h-8"
        />
        <button
          onClick={toggle}
          className="p-2 text-red-500 hover:text-red-400 transition-colors rounded-lg flex-shrink-0"
          aria-label="Stop recording"
          type="button"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      </>
    );
  }

  // Transcribing: spinner in place of mic button
  if (state === 'transcribing') {
    return (
      <div className="p-2 flex-shrink-0">
        <svg className="w-5 h-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // Idle: mic button
  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className="p-2 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors rounded-lg flex-shrink-0"
      aria-label="Voice input"
      type="button"
    >
      <svg
        className="w-5 h-5"
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
