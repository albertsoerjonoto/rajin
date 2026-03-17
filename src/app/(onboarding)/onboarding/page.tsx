'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Gender } from '@/lib/types';

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const fetchedRef = useRef(false);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const steps = [
    { emoji: '👋', title: 'Siapa namamu?', subtitle: 'Biar kami bisa menyapamu' },
    { emoji: '⚡', title: 'Jenis kelamin', subtitle: 'Untuk menghitung kebutuhan kalori harianmu' },
    { emoji: '🎂', title: 'Tanggal lahir', subtitle: 'Untuk rekomendasi yang lebih akurat' },
    { emoji: '📏', title: 'Tinggi & berat badan', subtitle: 'Untuk menghitung BMI dan kebutuhan kalorimu' },
  ];

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

        const savedStep = data.onboarding_step ?? 0;
        if (savedStep > 0 && savedStep < TOTAL_STEPS) {
          setStep(savedStep);
        }
      }

      setReady(true);
    };

    load();
  }, [user, authLoading, router]);

  const saveStep = async (fields: Record<string, unknown>) => {
    if (!user) return false;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id);
    setSaving(false);
    if (updateError) {
      setError('Gagal menyimpan. Coba lagi.');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (saving) return;
    const nextStep = step + 1;

    if (step === 0) {
      const ok = await saveStep({ display_name: displayName.trim() || null, onboarding_step: nextStep });
      if (!ok) return;
    } else if (step === 1) {
      const fields: Record<string, unknown> = { onboarding_step: nextStep };
      if (gender) fields.gender = gender;
      const ok = await saveStep(fields);
      if (!ok) return;
    } else if (step === 2) {
      const fields: Record<string, unknown> = { onboarding_step: nextStep };
      if (dateOfBirth) fields.date_of_birth = dateOfBirth;
      const ok = await saveStep(fields);
      if (!ok) return;
    } else if (step === 3) {
      const fields: Record<string, unknown> = { onboarding_completed: true, onboarding_step: nextStep };

      if (heightCm) {
        const h = parseFloat(heightCm);
        if (isNaN(h) || h < 50 || h > 300) {
          setError('Tinggi harus antara 50-300 cm');
          return;
        }
        fields.height_cm = h;
      }
      if (weightKg) {
        const w = parseFloat(weightKg);
        if (isNaN(w) || w < 10 || w > 500) {
          setError('Berat harus antara 10-500 kg');
          return;
        }
        fields.weight_kg = w;
      }

      const ok = await saveStep(fields);
      if (!ok) return;
      router.replace('/dashboard');
      return;
    }

    setStep(nextStep);
  };

  const handleSkip = async () => {
    const nextStep = step + 1;
    if (step === 3) {
      const ok = await saveStep({ onboarding_completed: true, onboarding_step: nextStep });
      if (!ok) return;
      router.replace('/dashboard');
      return;
    }
    const ok = await saveStep({ onboarding_step: nextStep });
    if (!ok) return;
    setStep(nextStep);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-lg';

  if (authLoading || !ready) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-8 pb-12 min-h-screen flex flex-col">
      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i <= step ? 'bg-emerald-500' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Back Button */}
      <div className="h-10 mb-4">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span className="text-sm">Kembali</span>
          </button>
        )}
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col">
          {/* Emoji */}
          <div className="text-center mb-6">
            <span className="text-6xl">{steps[step].emoji}</span>
          </div>

          {/* Title + Subtitle */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {steps[step].title}
          </h1>
          <p className="text-sm text-gray-400 text-center mb-8">
            {steps[step].subtitle}
          </p>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="flex-1">
            {step === 0 && (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && displayName.trim()) {
                    e.preventDefault();
                    handleContinue();
                  }
                }}
                className={inputClass}
                placeholder="Nama kamu"
                autoFocus
              />
            )}

            {step === 1 && (
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGender(g);
                      setTimeout(async () => {
                        const nextStep = step + 1;
                        const ok = await saveStep({ gender: g, onboarding_step: nextStep });
                        if (ok) setStep(nextStep);
                      }, 250);
                    }}
                    className={cn(
                      'flex-1 py-4 rounded-2xl text-base font-semibold transition-all',
                      gender === g
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                    )}
                  >
                    {g === 'male' ? 'Laki-laki' : 'Perempuan'}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
                autoFocus
              />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Tinggi</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="50"
                      max="300"
                      step="0.1"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className={cn(inputClass, 'flex-1')}
                      placeholder="170"
                      autoFocus
                    />
                    <span className="text-gray-400 text-sm font-medium w-6 shrink-0">cm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Berat</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className={cn(inputClass, 'flex-1')}
                      placeholder="70"
                    />
                    <span className="text-gray-400 text-sm font-medium w-6 shrink-0">kg</span>
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
            {saving ? 'Menyimpan...' : step === 3 ? 'Mulai!' : 'Lanjut'}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
          >
            {step === 3 ? 'Lewati dulu' : 'Lewati'}
          </button>
        </div>
      </div>
    </div>
  );
}
