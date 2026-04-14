'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import { validateDOB, validateBodyStat } from '@/lib/validation';
import { useLocale } from '@/lib/i18n';
import type { Gender } from '@/lib/types';

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const { t } = useLocale();
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

  const steps = [
    { emoji: '👋', title: t('onboarding.nameTitle'), subtitle: t('onboarding.nameSubtitle') },
    { emoji: '⚡', title: t('onboarding.genderTitle'), subtitle: t('onboarding.genderSubtitle') },
    { emoji: '🎂', title: t('onboarding.dobTitle'), subtitle: t('onboarding.dobSubtitle') },
    { emoji: '📏', title: t('onboarding.bodyTitle'), subtitle: t('onboarding.bodySubtitle') },
  ];

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
        router.replace('/chat?tour=start');
        return;
      }

      if (data) {
        setDisplayName(data.display_name || '');
        setGender(data.gender || '');
        setDateOfBirth(data.date_of_birth || '');
        setHeightCm(data.height_cm ? String(data.height_cm) : '');
        setWeightKg(data.weight_kg ? String(data.weight_kg) : '');

        // Resume from saved step
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
      showToast('error', t('onboarding.failedSave'));
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (saving) return;

    // Validate and save based on current step
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
        showToast('error', t('onboarding.invalidDob'));
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
          showToast('error', t('onboarding.heightRange'));
          return;
        }
        fields.height_cm = h;
      }
      if (weightKg) {
        const w = validateBodyStat(weightKg, 10, 500);
        if (w === null) {
          showToast('error', t('onboarding.weightRange'));
          return;
        }
        fields.weight_kg = w;
      }

      const ok = await saveStep(fields);
      if (!ok) return;
      router.replace('/chat?tour=start');
      return;
    }

    // Advance step
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
      // Final step — mark onboarding as complete even when skipping
      const ok = await saveStep({ onboarding_completed: true, onboarding_step: nextStep });
      if (!ok) return;
      router.replace('/chat?tour=start');
      return;
    }
    // Save step progress even when skipping
    const ok = await saveStep({ onboarding_step: nextStep });
    if (!ok) return;
    setDirection('forward');
    setStep(nextStep);
  };

  const handleBack = () => {
    setDirection('back');
    setStep((s) => s - 1);
  };

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-lg';

  // Loading state
  if (authLoading || !ready) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(3rem+env(safe-area-inset-bottom,0px))] min-h-screen flex flex-col">
      {ToastContainer}

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i < step ? 'bg-accent' :
              i === step ? 'bg-accent' : 'bg-surface-secondary'
            )}
          />
        ))}
      </div>

      {/* Back Button */}
      <div className="h-10 mb-4">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span className="text-sm">{t('common.back')}</span>
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
            <span className="text-6xl">{steps[step].emoji}</span>
          </div>

          {/* Title + Subtitle */}
          <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
            {steps[step].title}
          </h1>
          <p className="text-sm text-text-tertiary text-center mb-8">
            {steps[step].subtitle}
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
                className={inputClass}
                placeholder={t('onboarding.yourName')}
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
                      // Auto-advance after a brief visual feedback
                      setTimeout(() => handleGenderContinue(g), 250);
                    }}
                    className={cn(
                      'flex-1 py-4 rounded-2xl text-base font-semibold transition-all capitalize',
                      gender === g
                        ? 'bg-accent text-accent-fg shadow-md'
                        : 'bg-surface text-text-muted border border-border-strong hover:border-accent-border'
                    )}
                  >
                    {g === 'male' ? t('onboarding.male') : t('onboarding.female')}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <DOBPicker value={dateOfBirth} onChange={setDateOfBirth} t={t} />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">{t('onboarding.height')}</label>
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
                    <span className="text-text-tertiary text-sm font-medium w-6 shrink-0">cm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">{t('onboarding.weight')}</label>
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
                    <span className="text-text-tertiary text-sm font-medium w-6 shrink-0">kg</span>
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
            className="w-full py-3.5 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 text-base"
          >
            {saving ? t('common.saving') : step === 3 ? t('common.getStarted') : t('common.continue')}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2 text-text-tertiary text-sm font-medium hover:text-text-muted transition-colors"
          >
            {step === 3 ? t('common.skipForNow') : t('common.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom DOB Picker: Year → Month → Day ──────────────────────────

function DOBPicker({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (key: string) => string }) {
  // Parse existing value
  const parsed = value ? { year: +value.slice(0, 4), month: +value.slice(5, 7), day: +value.slice(8, 10) } : null;

  const [pickerStep, setPickerStep] = useState<'year' | 'month' | 'day'>(parsed ? 'day' : 'year');
  const [selectedYear, setSelectedYear] = useState<number | null>(parsed?.year ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(parsed?.month ?? null);
  const yearListRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  // Generate years from current year down to 120 years ago
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 120; y--) years.push(y);

  // Scroll to a sensible default when year picker opens
  useEffect(() => {
    if (pickerStep !== 'year' || !yearListRef.current) return;
    const container = yearListRef.current;
    // Scroll to selected year, or default to ~25 years ago
    const targetYear = selectedYear ?? (currentYear - 25);
    const targetIndex = currentYear - targetYear;
    const itemHeight = 48; // h-12 = 48px
    const containerHeight = container.clientHeight;
    container.scrollTop = Math.max(0, targetIndex * itemHeight - containerHeight / 2 + itemHeight / 2);
  }, [pickerStep, selectedYear, currentYear]);

  // Get available month indices for selected year
  const getMonthCount = () => {
    if (selectedYear === currentYear) {
      return currentMonth;
    }
    return 12;
  };

  // Get days in selected month/year
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
    // If previously selected month is invalid for this year, reset
    if (year === currentYear && selectedMonth && selectedMonth > currentMonth) {
      setSelectedMonth(null);
    }
    setPickerStep('month');
  };

  const handleMonthSelect = (monthIndex: number) => {
    const month = monthIndex + 1;
    setSelectedMonth(month);
    setPickerStep('day');
  };

  const handleDaySelect = (day: number) => {
    if (!selectedYear || !selectedMonth) return;
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
  };

  // If a date is already selected, show it with an edit option
  if (value && pickerStep === 'day' && parsed) {
    const displayDate = new Date(value + 'T12:00:00Z');
    const monthName = t('month.' + (displayDate.getUTCMonth() + 1));
    const formatted = `${displayDate.getUTCDate()} ${monthName} ${displayDate.getUTCFullYear()}`;

    return (
      <div className="space-y-3">
        <div className="bg-surface rounded-2xl border border-accent-border p-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-text-primary">{formatted}</p>
          </div>
          <button
            type="button"
            onClick={() => { setPickerStep('year'); onChange(''); }}
            className="text-sm text-accent-text font-medium hover:underline"
          >
            {t('common.change')}
          </button>
        </div>
      </div>
    );
  }

  const pillClass = (isSelected: boolean) => cn(
    'px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
    isSelected
      ? 'bg-accent text-accent-fg shadow-sm'
      : 'bg-surface text-text-label border border-border-strong hover:border-accent-border'
  );

  const monthCount = getMonthCount();

  return (
    <div className="space-y-4">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => setPickerStep('year')}
          className={cn(
            'font-medium transition-colors',
            pickerStep === 'year' ? 'text-accent-text' : selectedYear ? 'text-text-label hover:text-accent-text' : 'text-text-tertiary'
          )}
        >
          {selectedYear ?? t('dob.year')}
        </button>
        <span className="text-text-tertiary">›</span>
        <button
          type="button"
          onClick={() => selectedYear && setPickerStep('month')}
          disabled={!selectedYear}
          className={cn(
            'font-medium transition-colors',
            pickerStep === 'month' ? 'text-accent-text' : selectedMonth ? 'text-text-label hover:text-accent-text' : 'text-text-tertiary'
          )}
        >
          {selectedMonth ? t('month.' + selectedMonth) : t('dob.month')}
        </button>
        <span className="text-text-tertiary">›</span>
        <span className="text-text-tertiary font-medium">{t('dob.day')}</span>
      </div>

      {/* Scrollable content */}
      <div className={cn(
        "bg-surface rounded-2xl border border-border-strong overflow-y-auto scrollbar-hide",
        pickerStep === 'year' ? 'max-h-72' : 'p-4 max-h-60'
      )}>
        {pickerStep === 'year' && (
          <div ref={yearListRef} className="max-h-72 overflow-y-auto scrollbar-hide">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => handleYearSelect(y)}
                className={cn(
                  'w-full h-12 text-center text-base font-medium transition-all',
                  y === selectedYear
                    ? 'bg-accent text-accent-fg'
                    : 'text-text-label hover:bg-surface-hover'
                )}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {pickerStep === 'month' && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: monthCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleMonthSelect(i)}
                className={pillClass(i + 1 === selectedMonth)}
              >
                {t('month.' + (i + 1)).slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {pickerStep === 'day' && (
          <div className="grid grid-cols-7 gap-2">
            {getDays().map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDaySelect(d)}
                className={pillClass(parsed?.day === d && parsed?.month === selectedMonth && parsed?.year === selectedYear)}
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
