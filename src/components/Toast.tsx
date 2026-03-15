'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'error' | 'success';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((type: ToastType, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ToastContainer = toast ? (
    <div
      key={toast.id}
      className="fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in flex items-center gap-2"
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        background: toast.type === 'error'
          ? 'rgba(239,68,68,0.12)'
          : 'rgba(16,163,127,0.12)',
        border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,163,127,0.25)'}`,
        color: toast.type === 'error' ? '#f87171' : '#10a37f',
        backdropFilter: 'blur(8px)',
      }}
    >
      {toast.type === 'error' ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastContainer };
}
