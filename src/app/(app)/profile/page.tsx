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

    // Validate all fields
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

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';
  const errorInputClass =
    'w-full px-4 py-3.5 rounded-xl border border-danger-input-border bg-surface focus:outline-none focus:ring-1 focus:ring-danger focus:border-transparent transition-all duration-200';

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
          <div className="bg-surface rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-label mb-1">Email</label>
              <p className="text-sm text-text-secondary px-4 py-3 bg-surface-secondary rounded-xl">{user?.email}</p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-text-label mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-label mb-1">
                Calorie Target
              </label>
              <div className="flex gap-2 mb-2">
                {(['deficit', 'maintenance', 'surplus'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setCalorieMode(mode);
                      setErrors((prev) => ({ ...prev, calorieAmount: '' }));
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                      calorieMode === mode
                        ? 'bg-accent text-accent-fg'
                        : 'bg-surface-secondary text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {calorieMode !== 'maintenance' && (
                <div>
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
                    className={errors.calorieAmount ? errorInputClass : inputClass}
                    placeholder="500"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Calories {calorieMode === 'deficit' ? 'below' : 'above'} your TDEE
                  </p>
                  {errors.calorieAmount && (
                    <p className="text-xs text-danger-text mt-1">{errors.calorieAmount}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Body Stats Card */}
          <div className="bg-surface rounded-2xl p-5 space-y-4 mt-4">
            <h2 className="text-lg font-semibold text-text-primary">Body Stats</h2>
            <p className="text-xs text-text-tertiary -mt-2">Used to calculate your recommended daily intake</p>

            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-text-label mb-1">
                Date of Birth
              </label>
              <input
                id="dob"
                type="date"
                max={getToday()}
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(e.target.value);
                  setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                }}
                className={`${errors.dateOfBirth ? errorInputClass : inputClass} appearance-none max-w-full`}
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-danger-text mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-label mb-1">Gender</label>
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize ${
                      gender === g
                        ? 'bg-accent text-accent-fg'
                        : 'bg-surface-secondary text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-text-label mb-1">
                  Height (cm)
                </label>
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
                  className={errors.heightCm ? errorInputClass : inputClass}
                  placeholder="170"
                />
                {errors.heightCm && (
                  <p className="text-xs text-danger-text mt-1">{errors.heightCm}</p>
                )}
              </div>
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-text-label mb-1">
                  Weight (kg)
                </label>
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
                  className={errors.weightKg ? errorInputClass : inputClass}
                  placeholder="70"
                />
                {errors.weightKg && (
                  <p className="text-xs text-danger-text mt-1">{errors.weightKg}</p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full mt-4 py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </>
      )}

      <button
        onClick={handleSignOut}
        className="w-full mt-4 py-3 text-danger-text font-medium rounded-xl hover:bg-danger-surface transition-all"
      >
        Sign Out
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full mt-3 py-3 text-danger-text-muted text-sm font-medium hover:text-danger-text transition-colors"
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

      <p className="text-center text-xs text-text-tertiary mt-8 mb-4">Rajin v1.0</p>
    </div>
  );
}
