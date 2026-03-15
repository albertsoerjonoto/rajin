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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ToastContainer = toast ? (
    <div
      key={toast.id}
      className={`fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
        toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
      }`}
      style={{ maxWidth: '480px', margin: '0 auto' }}
    >
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastContainer };
}
