'use client';

import { createContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { tourSteps, type TourStep } from '@/lib/tour-steps';

const TOUR_STORAGE_KEY = 'rajin_tour_progress';

interface TourProgress {
  active: boolean;
  stepIndex: number;
}

function saveTourProgress(progress: TourProgress | null) {
  try {
    if (progress) {
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(progress));
    } else {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    }
  } catch {}
}

function loadTourProgress(): TourProgress | null {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.active === 'boolean' && typeof parsed.stepIndex === 'number') {
      return parsed;
    }
  } catch {}
  return null;
}

export interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  steps: TourStep[];
  currentStep: TourStep | null;
  /** Returns the current step ID using a ref — safe to call in async callbacks */
  getStepId: () => string | null;
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
  const restoredRef = useRef(false);

  // Restore tour progress from localStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const progress = loadTourProgress();
    if (progress?.active && progress.stepIndex < tourSteps.length) {
      indexRef.current = progress.stepIndex;
      // Restoring persisted tour state on mount; synchronous setState is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStepIndex(progress.stepIndex);
      setIsActive(true);
      // Navigate to the step's page if it has one
      const step = tourSteps[progress.stepIndex];
      if (step.navigateTo) {
        router.replace(step.navigateTo);
      }
    }
  }, [router]);

  // Persist tour progress whenever it changes
  useEffect(() => {
    if (isActive) {
      saveTourProgress({ active: true, stepIndex: currentStepIndex });
    }
  }, [isActive, currentStepIndex]);

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
    saveTourProgress(null);
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
    saveTourProgress({ active: true, stepIndex: 0 });
  }, []);

  const advanceToStep = useCallback((id: string) => {
    const idx = tourSteps.findIndex((s) => s.id === id);
    if (idx >= 0) {
      indexRef.current = idx;
      setCurrentStepIndex(idx);
    }
  }, []);

  const getStepId = useCallback(() => {
    return tourSteps[indexRef.current]?.id ?? null;
  }, []);

  // Sync indexRef when currentStepIndex changes
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
        getStepId,
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
