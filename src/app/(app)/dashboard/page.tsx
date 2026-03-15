'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, formatDisplayDate, addDays, cn } from '@/lib/utils';
import { computeNutritionTargets } from '@/lib/nutrition';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import type { HabitWithLog, FoodLog, ExerciseLog, Profile } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [date, setDate] = useState(getToday());
  const [habits, setHabits] = useState<HabitWithLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('✅');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    } else if (profileError?.code === 'PGRST116') {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          display_name: user.email!.split('@')[0],
          daily_calorie_goal: 2000,
        })
        .select()
        .single();
      if (newProfile) setProfile(newProfile);
    }

    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order');

    if (habitsError) {
      showToast('error', 'Failed to load habits');
    }

    const { data: logsData } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date);

    if (habitsData) {
      const habitsWithLogs: HabitWithLog[] = habitsData.map((habit) => {
        const log = logsData?.find((l) => l.habit_id === habit.id);
        return { ...habit, completed: log?.completed ?? false, log_id: log?.id };
      });
      setHabits(habitsWithLogs);
    }

    const { data: foodData, error: foodError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at');
    if (foodError) showToast('error', 'Failed to load food logs');
    if (foodData) setFoodLogs(foodData);

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at');
    if (exerciseError) showToast('error', 'Failed to load exercise logs');
    if (exerciseData) setExerciseLogs(exerciseData);

    setLoading(false);
  }, [user, date, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleHabit = async (habit: HabitWithLog) => {
    if (!user || togglingId) return;
    setTogglingId(habit.id);
    const supabase = createClient();

    const wasCompleted = habit.completed;
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, completed: !h.completed } : h))
    );

    try {
      if (wasCompleted && habit.log_id) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', habit.log_id);
        if (error) throw error;
        setHabits((prev) =>
          prev.map((h) => (h.id === habit.id ? { ...h, log_id: undefined } : h))
        );
      } else {
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            habit_id: habit.id,
            user_id: user.id,
            date: date,
            completed: true,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setHabits((prev) =>
            prev.map((h) => (h.id === habit.id ? { ...h, log_id: data.id } : h))
          );
        }
      }
    } catch {
      setHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? { ...h, completed: wasCompleted } : h))
      );
      showToast('error', 'Failed to update habit');
    }
    setTogglingId(null);
  };

  const addHabit = async () => {
    if (!user || !newHabitName.trim()) return;
    const supabase = createClient();

    const { error } = await supabase.from('habits').insert({
      user_id: user.id,
      name: newHabitName.trim(),
      emoji: newHabitEmoji || '✅',
      sort_order: habits.length,
    });

    if (error) {
      showToast('error', 'Failed to add habit');
      return;
    }

    setNewHabitName('');
    setNewHabitEmoji('✅');
    setShowAddHabit(false);
    fetchData();
  };

  const totalCalories = foodLogs.reduce((sum, f) => sum + f.calories, 0);
  const totalProtein = foodLogs.reduce((sum, f) => sum + (f.protein_g || 0), 0);
  const totalCarbs = foodLogs.reduce((sum, f) => sum + (f.carbs_g || 0), 0);
  const totalFat = foodLogs.reduce((sum, f) => sum + (f.fat_g || 0), 0);
  const calorieGoal = profile?.daily_calorie_goal ?? 2000;
  const caloriePercent = Math.min((totalCalories / calorieGoal) * 100, 100);
  const totalExerciseMinutes = exerciseLogs.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalCaloriesBurned = exerciseLogs.reduce((sum, e) => sum + e.calories_burned, 0);
  const netCalories = totalCalories - totalCaloriesBurned;

  const mealBreakdown = {
    breakfast: foodLogs.filter((f) => f.meal_type === 'breakfast').reduce((s, f) => s + f.calories, 0),
    lunch: foodLogs.filter((f) => f.meal_type === 'lunch').reduce((s, f) => s + f.calories, 0),
    dinner: foodLogs.filter((f) => f.meal_type === 'dinner').reduce((s, f) => s + f.calories, 0),
    snack: foodLogs.filter((f) => f.meal_type === 'snack').reduce((s, f) => s + f.calories, 0),
  };

  const targets = profile ? computeNutritionTargets(profile) : null;

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
  };

  const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    marginBottom: '10px',
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {ToastContainer}

      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label="Previous day"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatDisplayDate(date)}
          </h1>
          {date !== getToday() && (
            <button
              onClick={() => setDate(getToday())}
              className="text-xs font-medium mt-0.5"
              style={{ color: 'var(--accent)' }}
            >
              Go to today
            </button>
          )}
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label="Next day"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Habits Section */}
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <p style={sectionLabelStyle}>Habits</p>
              <button
                onClick={() => setShowAddHabit(true)}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                + Add
              </button>
            </div>

            {showAddHabit && (
              <div style={{ ...cardStyle, marginBottom: '10px' }} className="animate-fade-in">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newHabitEmoji}
                    onChange={(e) => setNewHabitEmoji(e.target.value)}
                    className="w-12 text-center text-xl px-2 py-2 rounded-lg"
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    placeholder="✅"
                  />
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    placeholder="Habit name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddHabit(false)}
                    className="flex-1 py-2 text-sm rounded-lg transition-colors"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-main)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addHabit}
                    className="flex-1 py-2 text-sm font-medium text-white rounded-lg"
                    style={{ background: 'var(--accent)' }}
                  >
                    Add Habit
                  </button>
                </div>
              </div>
            )}

            {habits.length === 0 && !showAddHabit ? (
              <div style={cardStyle} className="text-center py-6">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No habits yet. Tap + Add to create one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {habits.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit)}
                    disabled={togglingId === habit.id}
                    className={cn(
                      'text-left transition-all active:scale-95 rounded-xl p-4',
                      togglingId === habit.id && 'opacity-60'
                    )}
                    style={{
                      background: habit.completed ? 'rgba(16,163,127,0.12)' : 'var(--bg-surface)',
                      border: `1px solid ${habit.completed ? 'rgba(16,163,127,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="text-xl mb-1.5">
                      {habit.completed ? (
                        <span className="animate-checkmark inline-block">{habit.emoji}</span>
                      ) : (
                        <span style={{ opacity: 0.4 }}>{habit.emoji}</span>
                      )}
                    </div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: habit.completed ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {habit.name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Food Summary */}
          <section className="mb-5">
            <p style={sectionLabelStyle}>Nutrition</p>
            <div style={cardStyle}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {totalCalories}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    of {calorieGoal} cal goal
                  </p>
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: caloriePercent >= 100 ? '#f59e0b' : 'var(--accent)' }}
                >
                  {Math.round(caloriePercent)}%
                </p>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-main)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 animate-progress"
                  style={{
                    width: `${caloriePercent}%`,
                    background: caloriePercent >= 100 ? '#f59e0b' : 'var(--accent)',
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                  <div key={meal} className="text-center">
                    <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{meal}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {mealBreakdown[meal]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Nutrition Targets */}
          {targets?.hasData && (
            <section className="mb-5">
              <p style={sectionLabelStyle}>Targets</p>
              <div style={cardStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>TDEE (est.)</p>
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{targets.tdee} cal</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your goal</p>
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: targets.calorieDelta < -50 ? '#60a5fa' :
                          targets.calorieDelta > 50 ? '#f59e0b' : 'var(--accent)'
                      }}
                    >
                      {targets.deltaLabel}
                    </p>
                  </div>
                </div>

                {totalCaloriesBurned > 0 && (
                  <div
                    className="rounded-lg px-3 py-2 mb-3"
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span>Eaten: {totalCalories}</span>
                      <span>Burned: {totalCaloriesBurned}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Net: {netCalories} cal
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {[
                    { ...targets.protein, eaten: totalProtein, trackColor: '#60a5fa' },
                    { ...targets.carbs, eaten: totalCarbs, trackColor: '#fbbf24' },
                    { ...targets.fat, eaten: totalFat, trackColor: '#f87171' },
                  ].map((macro) => {
                    const midTarget = (macro.min + macro.max) / 2;
                    const percent = midTarget > 0 ? Math.min((macro.eaten / midTarget) * 100, 100) : 0;
                    const inRange = macro.eaten >= macro.min && macro.eaten <= macro.max;
                    const over = macro.eaten > macro.max;

                    return (
                      <div key={macro.label}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {macro.label}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            <span
                              className="font-semibold"
                              style={{
                                color: inRange ? 'var(--accent)' : over ? '#f59e0b' : 'var(--text-primary)'
                              }}
                            >
                              {macro.eaten}g
                            </span>
                            {' / '}
                            {macro.min}–{macro.max}g
                          </span>
                        </div>
                        <div
                          className="w-full h-1 rounded-full overflow-hidden"
                          style={{ background: 'var(--bg-main)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percent}%`,
                              background: inRange ? 'var(--accent)' : over ? '#f59e0b' : macro.trackColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Exercise Summary */}
          <section className="mb-6">
            <p style={sectionLabelStyle}>Exercise</p>
            <div style={cardStyle}>
              {exerciseLogs.length === 0 ? (
                <p className="text-sm text-center py-2" style={{ color: 'var(--text-secondary)' }}>
                  No exercise logged today
                </p>
              ) : (
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {totalExerciseMinutes}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>minutes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {totalCaloriesBurned}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>cal burned</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
