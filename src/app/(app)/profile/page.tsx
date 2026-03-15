'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { getToday } from '@/lib/utils';
import {
  validateCalorieOffset,
  validateDOB,
  validateBodyStat,
} from '@/lib/validation';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Profile, Gender } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [calorieMode, setCalorieMode] = useState<'deficit' | 'maintenance' | 'surplus'>('maintenance');
  const [calorieAmount, setCalorieAmount] = useState('500');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fetchedForUser = useRef<string | null>(null);

  const applyProfile = (p: Profile) => {
    setProfile(p);
    setDisplayName(p.display_name || '');
    const offset = p.daily_calorie_offset ?? 0;
    if (offset === 0) {
      setCalorieMode('maintenance');
      setCalorieAmount('500');
    } else if (offset < 0) {
      setCalorieMode('deficit');
      setCalorieAmount(String(Math.abs(offset)));
    } else {
      setCalorieMode('surplus');
      setCalorieAmount(String(offset));
    }
    setDateOfBirth(p.date_of_birth || '');
    setGender(p.gender || '');
    setHeightCm(p.height_cm ? String(p.height_cm) : '');
    setWeightKg(p.weight_kg ? String(p.weight_kg) : '');
  };

  useEffect(() => {
    if (!user) return;
    if (fetchedForUser.current === user.id) return;
    fetchedForUser.current = user.id;

    const fetchOrCreateProfile = async () => {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        applyProfile(data);
        return;
      }

      if (fetchError?.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            display_name: user.email!.split('@')[0],
            daily_calorie_offset: 0,
          })
          .select()
          .single();

        if (insertError) {
          showToast('error', 'Failed to create profile');
          return;
        }
        if (newProfile) applyProfile(newProfile);
      }
    };

    fetchOrCreateProfile();
  }, [user, showToast]);

  const saveProfile = async () => {
    if (!user) return;

    const newErrors: Record<string, string> = {};

    if (calorieMode !== 'maintenance') {
      const offsetVal = validateCalorieOffset(calorieAmount);
      if (offsetVal === null || offsetVal <= 0) {
        newErrors.calorieAmount = 'Must be between 1 and 2,000';
      }
    }

    if (dateOfBirth && !validateDOB(dateOfBirth)) {
      newErrors.dateOfBirth = 'Must be a valid past date (age 1–120)';
    }

    if (heightCm && validateBodyStat(heightCm, 50, 300) === null) {
      newErrors.heightCm = 'Must be between 50 and 300 cm';
    }

    if (weightKg && validateBodyStat(weightKg, 10, 500) === null) {
      newErrors.weightKg = 'Must be between 10 and 500 kg';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        daily_calorie_offset: calorieMode === 'maintenance' ? 0 :
          calorieMode === 'deficit' ? -(parseInt(calorieAmount) || 500) :
          (parseInt(calorieAmount) || 500),
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
      })
      .eq('id', user.id);

    if (updateError) {
      showToast('error', 'Failed to save. Please try again.');
      setSaving(false);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) applyProfile(data);

    setSaving(false);
    setSaved(true);
    showToast('success', 'Profile saved!');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        showToast('error', 'Failed to delete account. Please try again.');
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch {
      showToast('error', 'Failed to delete account. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const initials = (displayName || user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const rowClass = 'px-4 py-3.5 flex items-center justify-between';
  const dividerClass = 'border-b border-border';
  const inputClass = 'text-sm text-right bg-transparent focus:outline-none text-text-secondary placeholder:text-text-tertiary';

  return (
    <div className="max-w-lg mx-auto px-4">
      {ToastContainer}
      <div className="sticky top-0 z-20 bg-bg pb-4 -mx-4 px-4 pt-6">
        <h1 className="text-xl font-bold text-text-primary">Profile</h1>
      </div>

      {!profile ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Profile header */}
          <div className="flex flex-col items-center pt-2 pb-6">
            <div className="w-20 h-20 rounded-full bg-positive flex items-center justify-center mb-3">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <p className="text-xl font-semibold text-text-primary">{displayName || 'No name'}</p>
            <p className="text-sm text-text-tertiary mt-0.5">{user?.email}</p>
          </div>

          {/* Account section */}
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1 mt-4 mb-2">Account</p>
          <div className="bg-surface rounded-2xl overflow-hidden">
            {/* Display Name */}
            <div className={`${rowClass} ${dividerClass}`}>
              <label htmlFor="displayName" className="text-sm text-text-primary shrink-0 mr-4">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`${inputClass} flex-1 min-w-0`}
                placeholder="Your name"
              />
            </div>

            {/* Calorie Target */}
            <div className={calorieMode !== 'maintenance' ? dividerClass : ''}>
              <div className={`${rowClass}`}>
                <span className="text-sm text-text-primary shrink-0 mr-3">Calorie Target</span>
                <div className="flex gap-1">
                  {(['deficit', 'maintenance', 'surplus'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setCalorieMode(mode);
                        setErrors((prev) => ({ ...prev, calorieAmount: '' }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all capitalize ${
                        calorieMode === mode
                          ? 'bg-surface-hover text-text-primary font-semibold'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {mode === 'deficit' ? 'Deficit' : mode === 'maintenance' ? 'Maint.' : 'Surplus'}
                    </button>
                  ))}
                </div>
              </div>
              {calorieMode !== 'maintenance' && (
                <div className="px-4 pb-3.5 -mt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      step="50"
                      value={calorieAmount}
                      onChange={(e) => {
                        setCalorieAmount(e.target.value);
                        setErrors((prev) => ({ ...prev, calorieAmount: '' }));
                      }}
                      className={`w-20 text-sm text-right bg-surface-secondary rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 ${
                        errors.calorieAmount ? 'ring-1 ring-danger' : 'focus:ring-input-ring'
                      }`}
                      placeholder="500"
                    />
                    <span className="text-xs text-text-tertiary">
                      cal {calorieMode === 'deficit' ? 'below' : 'above'} TDEE
                    </span>
                  </div>
                  {errors.calorieAmount && (
                    <p className="text-xs text-danger-text mt-1">{errors.calorieAmount}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Body Stats section */}
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1 mt-8 mb-2">Body Stats</p>
          <div className="bg-surface rounded-2xl overflow-hidden">
            {/* Date of Birth */}
            <div className={dividerClass}>
              <div className={rowClass}>
                <label htmlFor="dob" className="text-sm text-text-primary shrink-0 mr-4">Date of Birth</label>
                <input
                  id="dob"
                  type="date"
                  max={getToday()}
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                  }}
                  className={`${inputClass} appearance-none`}
                />
              </div>
              {errors.dateOfBirth && (
                <p className="text-xs text-danger-text px-4 pb-2 -mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            {/* Gender */}
            <div className={`${rowClass} ${dividerClass}`}>
              <span className="text-sm text-text-primary shrink-0 mr-4">Gender</span>
              <div className="flex gap-1">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all capitalize ${
                      gender === g
                        ? 'bg-surface-hover text-text-primary font-semibold'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Height */}
            <div className={dividerClass}>
              <div className={rowClass}>
                <label htmlFor="height" className="text-sm text-text-primary shrink-0 mr-4">Height</label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="height"
                    type="number"
                    min="50"
                    max="300"
                    step="0.1"
                    value={heightCm}
                    onChange={(e) => {
                      setHeightCm(e.target.value);
                      setErrors((prev) => ({ ...prev, heightCm: '' }));
                    }}
                    className={`w-16 text-sm text-right bg-transparent focus:outline-none ${
                      errors.heightCm ? 'text-danger-text' : 'text-text-secondary'
                    } placeholder:text-text-tertiary`}
                    placeholder="170"
                  />
                  <span className="text-xs text-text-tertiary">cm</span>
                </div>
              </div>
              {errors.heightCm && (
                <p className="text-xs text-danger-text px-4 pb-2 -mt-1">{errors.heightCm}</p>
              )}
            </div>

            {/* Weight */}
            <div>
              <div className={rowClass}>
                <label htmlFor="weight" className="text-sm text-text-primary shrink-0 mr-4">Weight</label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="weight"
                    type="number"
                    min="10"
                    max="500"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => {
                      setWeightKg(e.target.value);
                      setErrors((prev) => ({ ...prev, weightKg: '' }));
                    }}
                    className={`w-16 text-sm text-right bg-transparent focus:outline-none ${
                      errors.weightKg ? 'text-danger-text' : 'text-text-secondary'
                    } placeholder:text-text-tertiary`}
                    placeholder="70"
                  />
                  <span className="text-xs text-text-tertiary">kg</span>
                </div>
              </div>
              {errors.weightKg && (
                <p className="text-xs text-danger-text px-4 pb-2 -mt-1">{errors.weightKg}</p>
              )}
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full mt-6 py-3 bg-accent hover:bg-accent-hover text-accent-fg font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </>
      )}

      <button
        onClick={handleSignOut}
        className="w-full mt-10 py-3 text-text-secondary hover:text-danger-text font-medium rounded-xl hover:bg-danger-surface transition-all"
      >
        Sign Out
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full mt-2 py-3 text-text-tertiary text-xs hover:text-danger-text transition-colors"
      >
        Delete Account
      </button>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Account"
        message="This will permanently delete your account and all your data (habits, food logs, exercise logs). This cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete Account'}
        onConfirm={handleDeleteAccount}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />

      <p className="text-center text-xs text-text-tertiary mt-12 mb-6">Rajin v1.0</p>
    </div>
  );
}
