'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { getToday } from '@/lib/utils';
import {
  validateCalorieGoal,
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
  const [calorieGoal, setCalorieGoal] = useState('2000');
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
    setCalorieGoal(String(p.daily_calorie_goal));
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
            daily_calorie_goal: 2000,
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

    if (calorieGoal && validateCalorieGoal(calorieGoal) === null) {
      newErrors.calorieGoal = 'Must be between 500 and 10,000';
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
        daily_calorie_goal: parseInt(calorieGoal) || 2000,
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
    'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all';
  const errorInputClass =
    'w-full px-4 py-3 rounded-xl border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all';

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {ToastContainer}
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profile</h1>

      {!profile ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-sm text-gray-500 px-4 py-3 bg-gray-50 rounded-xl">{user?.email}</p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
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
              <label htmlFor="calorieGoal" className="block text-sm font-medium text-gray-700 mb-1">
                Daily Calorie Goal
              </label>
              <input
                id="calorieGoal"
                type="number"
                min="500"
                max="10000"
                value={calorieGoal}
                onChange={(e) => {
                  setCalorieGoal(e.target.value);
                  setErrors((prev) => ({ ...prev, calorieGoal: '' }));
                }}
                className={errors.calorieGoal ? errorInputClass : inputClass}
                placeholder="2000"
              />
              {errors.calorieGoal && (
                <p className="text-xs text-red-500 mt-1">{errors.calorieGoal}</p>
              )}
            </div>
          </div>

          {/* Body Stats Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4 mt-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Body Stats</h2>
            <p className="text-xs text-gray-400 -mt-2">Used to calculate your recommended daily intake</p>

            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">
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
                <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize ${
                      gender === g
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
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
                  <p className="text-xs text-red-500 mt-1">{errors.heightCm}</p>
                )}
              </div>
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
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
                  <p className="text-xs text-red-500 mt-1">{errors.weightKg}</p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </>
      )}

      <button
        onClick={handleSignOut}
        className="w-full mt-4 py-3 text-red-500 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-all"
      >
        Sign Out
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full mt-3 py-3 text-red-400 text-sm font-medium hover:text-red-600 transition-colors"
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

      <p className="text-center text-xs text-gray-300 mt-8 mb-4">Rajin v1.0</p>
    </div>
  );
}
