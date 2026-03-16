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
import { compressAvatar } from '@/lib/image';
import { useLocale } from '@/lib/i18n';
import type { Profile, Gender, Locale } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const { t, locale, setLocale } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [calorieMode, setCalorieMode] = useState<'deficit' | 'maintenance' | 'surplus'>('maintenance');
  const [calorieAmount, setCalorieAmount] = useState('500');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fetchedForUser = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyProfile = (p: Profile) => {
    setProfile(p);
    setDisplayName(p.display_name || '');
    setUsername(p.username || '');
    setAvatarUrl(p.avatar_url || null);
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
          showToast('error', t('profile.failedCreate'));
          return;
        }
        if (newProfile) applyProfile(newProfile);
      }
    };

    fetchOrCreateProfile();
  }, [user, showToast, t]);

  const saveProfile = async () => {
    if (!user) return;

    const newErrors: Record<string, string> = {};

    if (calorieMode !== 'maintenance') {
      const offsetVal = validateCalorieOffset(calorieAmount);
      if (offsetVal === null || offsetVal <= 0) {
        newErrors.calorieAmount = t('profile.calorieError');
      }
    }

    if (dateOfBirth && !validateDOB(dateOfBirth)) {
      newErrors.dateOfBirth = t('profile.dobError');
    }

    if (heightCm && validateBodyStat(heightCm, 50, 300) === null) {
      newErrors.heightCm = t('profile.heightError');
    }

    if (weightKg && validateBodyStat(weightKg, 10, 500) === null) {
      newErrors.weightKg = t('profile.weightError');
    }

    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      newErrors.username = t('profile.usernameHint');
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase() || null,
        daily_calorie_offset: calorieMode === 'maintenance' ? 0 :
          calorieMode === 'deficit' ? -(parseInt(calorieAmount) || 500) :
          (parseInt(calorieAmount) || 500),
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        locale,
      })
      .eq('id', user.id);

    if (updateError) {
      showToast('error', t('profile.failedSave'));
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
    showToast('success', t('profile.savedSuccess'));
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
        showToast('error', t('profile.failedDelete'));
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch {
      showToast('error', t('profile.failedDelete'));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const compressed = await compressAvatar(file);
      const supabase = createClient();
      const ext = compressed.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, {
          contentType: compressed.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('id', user.id);

      setAvatarUrl(urlWithCacheBust);
      showToast('success', t('profile.photoUpdated'));
    } catch {
      showToast('error', t('profile.failedUpload'));
    } finally {
      setUploading(false);
      e.target.value = '';
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
        <h1 className="text-xl font-bold text-text-primary">{t('profile.title')}</h1>
      </div>

      {!profile ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Profile header */}
          <div className="flex flex-col items-center pt-2 pb-6">
            <div className="relative mb-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-positive overflow-hidden active:scale-95 transition-transform"
                disabled={uploading}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white flex items-center justify-center w-full h-full">
                    {initials}
                  </span>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
              <div className="absolute bottom-0 right-0 w-6 h-6 bg-accent rounded-full flex items-center justify-center border-2 border-bg pointer-events-none">
                <svg className="w-3 h-3 text-accent-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-xl font-semibold text-text-primary">{displayName || t('common.noName')}</p>
            {username && (
              <p className="text-sm text-text-tertiary mt-0.5">@{username}</p>
            )}
          </div>

          {/* Language section */}
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1 mt-4 mb-2">{t('profile.language')}</p>
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className={rowClass}>
              <span className="text-sm text-text-primary shrink-0 mr-3">{t('profile.language')}</span>
              <div className="flex gap-1">
                {([['id', 'Bahasa'], ['en', 'English']] as const).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code as Locale)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                      locale === code
                        ? 'bg-surface-hover text-text-primary font-semibold'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Account section */}
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1 mt-8 mb-2">{t('profile.account')}</p>
          <div className="bg-surface rounded-2xl overflow-hidden">
            {/* Display Name */}
            <div className={`${rowClass} ${dividerClass}`}>
              <label htmlFor="displayName" className="text-sm text-text-primary shrink-0 mr-4">{t('profile.displayName')}</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`${inputClass} flex-1 min-w-0`}
                placeholder={t('profile.displayNamePlaceholder')}
              />
            </div>

            {/* Username */}
            <div className={dividerClass}>
              <div className={rowClass}>
                <label htmlFor="username" className="text-sm text-text-primary shrink-0 mr-4">{t('profile.username')}</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
                    setErrors((prev) => ({ ...prev, username: '' }));
                  }}
                  maxLength={20}
                  className={`${inputClass} flex-1 min-w-0`}
                  placeholder={t('profile.usernamePlaceholder')}
                  autoCapitalize="none"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-danger-text px-4 pb-2 -mt-1">{errors.username}</p>
              )}
            </div>

            {/* Email (read-only, only show real emails) */}
            {user?.email && !user.email.endsWith('@rajin.app') && (
              <div className={`${rowClass} ${dividerClass}`}>
                <span className="text-sm text-text-primary shrink-0 mr-4">{t('profile.email')}</span>
                <span className="text-sm text-text-tertiary truncate">{user.email}</span>
              </div>
            )}

            {/* Calorie Target */}
            <div className={calorieMode !== 'maintenance' ? dividerClass : ''}>
              <div className={`${rowClass}`}>
                <span className="text-sm text-text-primary shrink-0 mr-3">{t('profile.calorieTarget')}</span>
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
                      {mode === 'deficit' ? t('profile.deficit') : mode === 'maintenance' ? t('profile.maintenance') : t('profile.surplus')}
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
                      {calorieMode === 'deficit' ? t('profile.belowTdee') : t('profile.aboveTdee')}
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
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1 mt-8 mb-2">{t('profile.bodyStats')}</p>
          <div className="bg-surface rounded-2xl overflow-hidden">
            {/* Date of Birth */}
            <div className={dividerClass}>
              <div className={rowClass}>
                <label htmlFor="dob" className="text-sm text-text-primary shrink-0 mr-4">{t('profile.dob')}</label>
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
              <span className="text-sm text-text-primary shrink-0 mr-4">{t('profile.gender')}</span>
              <div className="flex gap-1">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all ${
                      gender === g
                        ? 'bg-surface-hover text-text-primary font-semibold'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {g === 'male' ? t('profile.male') : t('profile.female')}
                  </button>
                ))}
              </div>
            </div>

            {/* Height */}
            <div className={dividerClass}>
              <div className={rowClass}>
                <label htmlFor="height" className="text-sm text-text-primary shrink-0 mr-4">{t('profile.height')}</label>
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
                <label htmlFor="weight" className="text-sm text-text-primary shrink-0 mr-4">{t('profile.weight')}</label>
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
            {saving ? t('common.saving') : saved ? t('common.saved') : t('profile.saveChanges')}
          </button>
        </>
      )}

      <button
        onClick={handleSignOut}
        className="w-full mt-10 py-3 text-text-secondary hover:text-danger-text font-medium rounded-xl hover:bg-danger-surface transition-all"
      >
        {t('profile.signOut')}
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full mt-2 py-3 text-text-tertiary text-xs hover:text-danger-text transition-colors"
      >
        {t('profile.deleteAccount')}
      </button>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('profile.deleteAccount')}
        message={t('profile.deleteAccountMsg')}
        confirmLabel={deleting ? t('profile.deleting') : t('profile.deleteAccount')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />

      <p className="text-center text-xs text-text-tertiary mt-12 mb-6">Rajin v1.0</p>
    </div>
  );
}
