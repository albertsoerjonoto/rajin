'use client';

import { createContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { tourSteps, type TourStep } from '@/lib/tour-steps';

export interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  steps: TourStep[];
  currentStep: TourStep | null;
  startTour: () => void;
  nextStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  advanceToStep: (id: string) => void;
}

export const TourContext = createContext<TourState | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const completingRef = useRef(false);
  const indexRef = useRef(0);

  const markCompleted = useCallback(async () => {
    if (completingRef.current || !user) return;
    completingRef.current = true;
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ tour_completed: true })
      .eq('id', user.id);
  }, [user]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
    indexRef.current = 0;
    markCompleted();
  }, [markCompleted]);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const nextStep = useCallback(() => {
    const next = indexRef.current + 1;
    if (next >= tourSteps.length) {
      completeTour();
      return;
    }
    const step = tourSteps[next];
    if (step.navigateTo) {
      router.push(step.navigateTo);
    }
    indexRef.current = next;
    setCurrentStepIndex(next);
  }, [completeTour, router]);

  const startTour = useCallback(() => {
    completingRef.current = false;
    indexRef.current = 0;
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const advanceToStep = useCallback((id: string) => {
    const idx = tourSteps.findIndex((s) => s.id === id);
    if (idx >= 0) {
      indexRef.current = idx;
      setCurrentStepIndex(idx);
    }
  }, []);

  // Sync indexRef when currentStepIndex changes from advanceToStep
  useEffect(() => {
    indexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const currentStep = isActive ? tourSteps[currentStepIndex] ?? null : null;

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStepIndex,
        steps: tourSteps,
        currentStep,
        startTour,
        nextStep,
        skipTour,
        completeTour,
        advanceToStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}
