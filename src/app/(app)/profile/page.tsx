'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('2000');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fetchedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (fetchedForUser.current === user.id) return;
    fetchedForUser.current = user.id;

    const fetchOrCreateProfile = async () => {
      const supabase = createClient();

      // Try to fetch existing profile
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setCalorieGoal(String(data.daily_calorie_goal));
        return;
      }

      // Profile doesn't exist (user created before migration) — create it
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
          console.error('Create profile error:', JSON.stringify(insertError));
          return;
        }
        if (newProfile) {
          setProfile(newProfile);
          setDisplayName(newProfile.display_name || '');
          setCalorieGoal(String(newProfile.daily_calorie_goal));
        }
      }
    };

    fetchOrCreateProfile();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        daily_calorie_goal: parseInt(calorieGoal) || 2000,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update profile error:', JSON.stringify(updateError));
      setError('Failed to save. Please try again.');
      setSaving(false);
      return;
    }

    // Re-fetch to confirm
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setCalorieGoal(String(data.daily_calorie_goal));
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profile</h1>

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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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
            value={calorieGoal}
            onChange={(e) => setCalorieGoal(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            placeholder="2000"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full mt-6 py-3 text-red-500 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-all"
      >
        Sign Out
      </button>

      <p className="text-center text-xs text-gray-300 mt-8">Rajin v1.0</p>
    </div>
  );
}
