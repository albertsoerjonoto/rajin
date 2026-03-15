'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { getToday, cn } from '@/lib/utils';
import { validateDOB, validateBodyStat } from '@/lib/validation';
import type { Gender } from '@/lib/types';

const TOTAL_STEPS = 4;

const STEPS = [
  { emoji: '👋', title: 'What should we call you?', subtitle: 'You can always change this later' },
  { emoji: '⚡', title: "What's your gender?", subtitle: 'Used to calculate your daily nutrition needs' },
  { emoji: '🎂', title: 'When were you born?', subtitle: 'Helps us estimate your calorie needs' },
  { emoji: '📏', title: 'Your body measurements', subtitle: 'For more accurate calorie recommendations' },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const fetchedRef = useRef(false);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // Fetch profile on mount — pre-populate and redirect if already onboarded
  useEffect(() => {
    if (authLoading || !user || fetchedRef.current) return;
    fetchedRef.current = true;

    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data?.onboarding_completed) {
        router.replace('/dashboard');
        return;
      }

      if (data) {
        setDisplayName(data.display_name || '');
        setGender(data.gender || '');
        setDateOfBirth(data.date_of_birth || '');
        setHeightCm(data.height_cm ? String(data.height_cm) : '');
        setWeightKg(data.weight_kg ? String(data.weight_kg) : '');
      }

      setReady(true);
    };

    load();
  }, [user, authLoading, router]);

  const saveStep = async (fields: Record<string, unknown>) => {
    if (!user) return false;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      showToast('error', 'Failed to save. Please try again.');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (saving) return;

    // Validate and save based on current step
    if (step === 0) {
      const ok = await saveStep({ display_name: displayName.trim() || null });
      if (!ok) return;
    } else if (step === 1) {
      if (gender) {
        const ok = await saveStep({ gender });
        if (!ok) return;
      }
    } else if (step === 2) {
      if (dateOfBirth) {
        if (!validateDOB(dateOfBirth)) {
          showToast('error', 'Please enter a valid date of birth');
          return;
        }
        const ok = await saveStep({ date_of_birth: dateOfBirth });
        if (!ok) return;
      }
    } else if (step === 3) {
      const fields: Record<string, unknown> = { onboarding_completed: true };

      if (heightCm) {
        const h = validateBodyStat(heightCm, 50, 300);
        if (h === null) {
          showToast('error', 'Height must be between 50 and 300 cm');
          return;
        }
        fields.height_cm = h;
      }
      if (weightKg) {
        const w = validateBodyStat(weightKg, 10, 500);
        if (w === null) {
          showToast('error', 'Weight must be between 10 and 500 kg');
          return;
        }
        fields.weight_kg = w;
      }

      const ok = await saveStep(fields);
      if (!ok) return;
      router.replace('/dashboard');
      return;
    }

    // Advance step
    setDirection('forward');
    setStep((s) => s + 1);
  };

  const handleSkip = async () => {
    if (step === 3) {
      // Final step — mark onboarding as complete even when skipping
      const ok = await saveStep({ onboarding_completed: true });
      if (!ok) return;
      router.replace('/dashboard');
      return;
    }
    setDirection('forward');
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setDirection('back');
    setStep((s) => s - 1);
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-lg';

  // Loading state
  if (authLoading || !ready) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-8 pb-12 min-h-screen flex flex-col">
      {ToastContainer}

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i < step ? 'bg-emerald-500' :
              i === step ? 'bg-emerald-500' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Back Button */}
      <div className="h-10 mb-4">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
        )}
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col">
        <div
          key={step}
          className={cn(
            'flex-1 flex flex-col animate-fade-in',
            direction === 'forward' ? 'motion-safe:animate-slide-in-right' : 'motion-safe:animate-slide-in-left'
          )}
        >
          {/* Emoji */}
          <div className="text-center mb-6">
            <span className="text-6xl">{STEPS[step].emoji}</span>
          </div>

          {/* Title + Subtitle */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {STEPS[step].title}
          </h1>
          <p className="text-sm text-gray-400 text-center mb-8">
            {STEPS[step].subtitle}
          </p>

          {/* Input Area */}
          <div className="flex-1">
            {step === 0 && (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
                autoFocus
              />
            )}

            {step === 1 && (
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={cn(
                      'flex-1 py-4 rounded-2xl text-base font-semibold transition-all capitalize',
                      gender === g
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                    )}
                  >
                    {g === 'male' ? '👨 Male' : '👩 Female'}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <input
                type="date"
                value={dateOfBirth}
                max={getToday()}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Height</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="50"
                      max="300"
                      step="0.1"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className={inputClass}
                      placeholder="170"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">cm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Weight</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className={inputClass}
                      placeholder="70"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleContinue}
            disabled={saving}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 text-base"
          >
            {saving ? 'Saving...' : step === 3 ? 'Get Started' : 'Continue'}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
          >
            {step === 3 ? 'Skip for now' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
