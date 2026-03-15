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

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'var(--bg-main)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  const errorInputStyle = {
    ...inputStyle,
    border: '1px solid rgba(239,68,68,0.5)',
  };

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
  };

  const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {ToastContainer}
      <h1 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      {!profile ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Account Card */}
          <div style={cardStyle} className="space-y-4 mb-3">
            <p style={sectionLabelStyle}>Account</p>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <p
                className="text-sm px-4 py-3 rounded-lg"
                style={{ background: 'var(--bg-main)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}
              >
                {user?.email}
              </p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="calorieGoal" className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                style={errors.calorieGoal ? errorInputStyle : inputStyle}
                placeholder="2000"
              />
              {errors.calorieGoal && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.calorieGoal}</p>
              )}
            </div>
          </div>

          {/* Body Stats Card */}
          <div style={cardStyle} className="space-y-4 mb-4">
            <div>
              <p style={sectionLabelStyle}>Body Stats</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Used to calculate your recommended daily intake
              </p>
            </div>

            <div>
              <label htmlFor="dob" className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                style={errors.dateOfBirth ? errorInputStyle : inputStyle}
                className="appearance-none max-w-full"
              />
              {errors.dateOfBirth && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Gender</label>
              <div className="flex gap-2">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all capitalize"
                    style={{
                      background: gender === g ? 'var(--accent)' : 'var(--bg-main)',
                      color: gender === g ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${gender === g ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="height" className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                  style={errors.heightCm ? errorInputStyle : inputStyle}
                  placeholder="170"
                />
                {errors.heightCm && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.heightCm}</p>
                )}
              </div>
              <div>
                <label htmlFor="weight" className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                  style={errors.weightKg ? errorInputStyle : inputStyle}
                  placeholder="70"
                />
                {errors.weightKg && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.weightKg}</p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-3 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </>
      )}

      {/* Danger zone */}
      <div style={{ ...cardStyle, marginTop: '16px' }} className="space-y-1">
        <p style={sectionLabelStyle}>Account Actions</p>
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 text-sm font-medium rounded-lg transition-all text-left px-0"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ececec'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        >
          Sign out
        </button>
        <div style={{ height: '1px', background: 'var(--border)' }} />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-2.5 text-sm font-medium rounded-lg transition-all text-left px-0"
          style={{ color: '#f87171' }}
        >
          Delete account
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Account"
        message="This will permanently delete your account and all your data (habits, food logs, exercise logs). This cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete Account'}
        onConfirm={handleDeleteAccount}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />

      <p className="text-center text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>Rajin v1.0</p>
    </div>
  );
}
