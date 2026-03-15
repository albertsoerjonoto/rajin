'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import { validateDOB, validateBodyStat } from '@/lib/validation';
import type { Gender } from '@/lib/types';

const TOTAL_STEPS = 4;

const STEPS = [
  { title: 'What should we call you?', subtitle: 'You can always change this later' },
  { title: "What's your gender?", subtitle: 'Used to calculate your daily nutrition needs' },
  { title: 'When were you born?', subtitle: 'Helps us estimate your calorie needs' },
  { title: 'Your body measurements', subtitle: 'For more accurate calorie recommendations' },
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

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

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
      if (dateOfBirth && !validateDOB(dateOfBirth)) {
        showToast('error', 'Please enter a valid date of birth');
        return;
      }
      const fields: Record<string, unknown> = { onboarding_step: nextStep };
      if (dateOfBirth) fields.date_of_birth = dateOfBirth;
      const ok = await saveStep(fields);
      if (!ok) return;
    } else if (step === 3) {
      const fields: Record<string, unknown> = { onboarding_completed: true, onboarding_step: nextStep };

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

    setDirection('forward');
    setStep(nextStep);
  };

  const handleGenderContinue = async (g: Gender) => {
    if (saving) return;
    const nextStep = step + 1;
    const ok = await saveStep({ gender: g, onboarding_step: nextStep });
    if (!ok) return;
    setDirection('forward');
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
    setDirection('forward');
    setStep(nextStep);
  };

  const handleBack = () => {
    setDirection('back');
    setStep((s) => s - 1);
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  if (authLoading || !ready) {
    return <div className="min-h-screen" style={{ background: 'var(--bg-main)' }} />;
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-8 pb-12 min-h-screen flex flex-col">
      {ToastContainer}

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= step ? 'var(--accent)' : 'var(--bg-surface)',
            }}
          />
        ))}
      </div>

      {/* Back Button */}
      <div className="h-10 mb-4">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 transition-colors text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
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
          {/* Title + Subtitle */}
          <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {STEPS[step].title}
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            {STEPS[step].subtitle}
          </p>

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
                style={inputStyle}
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
                    onClick={() => {
                      setGender(g);
                      setTimeout(() => handleGenderContinue(g), 250);
                    }}
                    className="flex-1 py-4 rounded-xl text-base font-medium transition-all capitalize"
                    style={{
                      background: gender === g ? 'var(--accent)' : 'var(--bg-surface)',
                      color: gender === g ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${gender === g ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {g === 'male' ? '👨 Male' : '👩 Female'}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <DOBPicker value={dateOfBirth} onChange={setDateOfBirth} />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Height</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="50"
                      max="300"
                      step="0.1"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="170"
                      autoFocus
                    />
                    <span className="text-sm font-medium w-6 shrink-0" style={{ color: 'var(--text-tertiary)' }}>cm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Weight</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="70"
                    />
                    <span className="text-sm font-medium w-6 shrink-0" style={{ color: 'var(--text-tertiary)' }}>kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 space-y-2">
          <button
            onClick={handleContinue}
            disabled={saving}
            className="w-full py-3.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {saving ? 'Saving...' : step === 3 ? 'Get Started' : 'Continue'}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {step === 3 ? 'Skip for now' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom DOB Picker ──────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function DOBPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = value ? { year: +value.slice(0, 4), month: +value.slice(5, 7), day: +value.slice(8, 10) } : null;

  const [pickerStep, setPickerStep] = useState<'year' | 'month' | 'day'>(parsed ? 'day' : 'year');
  const [selectedYear, setSelectedYear] = useState<number | null>(parsed?.year ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(parsed?.month ?? null);
  const yearListRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 120; y--) years.push(y);

  useEffect(() => {
    if (pickerStep !== 'year' || !yearListRef.current) return;
    const container = yearListRef.current;
    const targetYear = selectedYear ?? (currentYear - 25);
    const targetIndex = currentYear - targetYear;
    const itemHeight = 48;
    const containerHeight = container.clientHeight;
    container.scrollTop = Math.max(0, targetIndex * itemHeight - containerHeight / 2 + itemHeight / 2);
  }, [pickerStep, selectedYear, currentYear]);

  const getMonths = () => {
    if (selectedYear === currentYear) return MONTHS.slice(0, currentMonth);
    return MONTHS;
  };

  const getDays = () => {
    if (!selectedYear || !selectedMonth) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let maxDay = daysInMonth;
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      maxDay = Math.min(daysInMonth, currentDay);
    }
    const days: number[] = [];
    for (let d = 1; d <= maxDay; d++) days.push(d);
    return days;
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    if (year === currentYear && selectedMonth && selectedMonth > currentMonth) {
      setSelectedMonth(null);
    }
    setPickerStep('month');
  };

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex + 1);
    setPickerStep('day');
  };

  const handleDaySelect = (day: number) => {
    if (!selectedYear || !selectedMonth) return;
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
  };

  if (value && pickerStep === 'day' && parsed) {
    const displayDate = new Date(value + 'T12:00:00Z');
    const formatted = displayDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });

    return (
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{
          background: 'rgba(16,163,127,0.1)',
          border: '1px solid rgba(16,163,127,0.25)',
        }}
      >
        <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{formatted}</p>
        <button
          type="button"
          onClick={() => { setPickerStep('year'); onChange(''); }}
          className="text-sm font-medium"
          style={{ color: 'var(--accent)' }}
        >
          Change
        </button>
      </div>
    );
  }

  const pillStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s',
    background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
    color: isSelected ? 'white' : 'var(--text-secondary)',
    border: `1px solid ${isSelected ? 'transparent' : 'var(--border)'}`,
  });

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => setPickerStep('year')}
          style={{ color: pickerStep === 'year' ? 'var(--accent)' : selectedYear ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}
        >
          {selectedYear ?? 'Year'}
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>›</span>
        <button
          type="button"
          onClick={() => selectedYear && setPickerStep('month')}
          disabled={!selectedYear}
          style={{ color: pickerStep === 'month' ? 'var(--accent)' : selectedMonth ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}
        >
          {selectedMonth ? MONTHS[selectedMonth - 1] : 'Month'}
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>›</span>
        <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Day</span>
      </div>

      {/* Picker content */}
      <div
        className={cn(
          "rounded-xl overflow-y-auto scrollbar-hide",
          pickerStep === 'year' ? 'max-h-72' : 'p-3 max-h-60'
        )}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {pickerStep === 'year' && (
          <div ref={yearListRef} className="max-h-72 overflow-y-auto scrollbar-hide">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => handleYearSelect(y)}
                className="w-full h-12 text-center text-base font-medium transition-all"
                style={{
                  background: y === selectedYear ? 'var(--accent)' : 'transparent',
                  color: y === selectedYear ? 'white' : 'var(--text-secondary)',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {pickerStep === 'month' && (
          <div className="grid grid-cols-3 gap-2">
            {getMonths().map((m, i) => (
              <button key={m} type="button" onClick={() => handleMonthSelect(i)} style={pillStyle(i + 1 === selectedMonth)}>
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {pickerStep === 'day' && (
          <div className="grid grid-cols-7 gap-1.5">
            {getDays().map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDaySelect(d)}
                style={pillStyle(parsed?.day === d && parsed?.month === selectedMonth && parsed?.year === selectedYear)}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
