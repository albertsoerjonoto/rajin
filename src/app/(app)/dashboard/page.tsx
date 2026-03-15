'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, formatDisplayDate, addDays, cn } from '@/lib/utils';
import { computeNutritionTargets } from '@/lib/nutrition';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import EmojiPicker from '@/components/EmojiPicker';
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
  const [newHabitEmoji, setNewHabitEmoji] = useState('⭐');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

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

    // Optimistic update
    const wasCompleted = habit.completed;
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, completed: !h.completed } : h))
    );

    try {
      if (wasCompleted && habit.log_id) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', habit.log_id);
        if (error) throw error;
        // Clear the log_id locally
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
        // Store the new log_id locally
        if (data) {
          setHabits((prev) =>
            prev.map((h) => (h.id === habit.id ? { ...h, log_id: data.id } : h))
          );
        }
      }
    } catch {
      // Revert optimistic update on error
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
      emoji: newHabitEmoji || '⭐',
      sort_order: habits.length,
    });

    if (error) {
      showToast('error', 'Failed to add habit');
      return;
    }

    setNewHabitName('');
    setNewHabitEmoji('⭐');
    setShowAddHabit(false);
    fetchData();
  };

  const startEditing = (habit: HabitWithLog) => {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditEmoji(habit.emoji);
  };

  const saveEdit = async () => {
    if (!user || !editingId || !editName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('habits')
      .update({ name: editName.trim(), emoji: editEmoji || '⭐' })
      .eq('id', editingId);
    if (error) {
      showToast('error', 'Failed to update habit');
      return;
    }
    setEditingId(null);
    fetchData();
  };

  const deleteHabit = async (id: string) => {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      showToast('error', 'Failed to delete habit');
      return;
    }
    setEditingId(null);
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

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {ToastContainer}

      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="p-2 rounded-xl hover:bg-surface-hover transition-all duration-200 active:scale-[0.98]"
          aria-label="Previous day"
        >
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-text-primary">{formatDisplayDate(date)}</h1>
          {date !== getToday() && (
            <button onClick={() => setDate(getToday())} className="text-xs text-accent-text font-medium mt-0.5 transition-all duration-200">
              Go to today
            </button>
          )}
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="p-2 rounded-xl hover:bg-surface-hover transition-all duration-200 active:scale-[0.98]"
          aria-label="Next day"
        >
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Habits Section */}
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary">Habits</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowAddHabit(true); setEditMode(false); setEditingId(null); }} className="text-accent-text text-sm font-medium transition-all duration-200">
                  Add
                </button>
                {habits.length > 0 && (
                  <button
                    onClick={() => { setEditMode(!editMode); setEditingId(null); }}
                    className="text-accent-text text-sm font-medium transition-all duration-200"
                  >
                    {editMode ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>
            </div>

            {showAddHabit && (
              <div className="bg-surface rounded-2xl p-5 border border-border mb-3 animate-fade-in">
                <div className="flex gap-2 mb-3">
                  <EmojiPicker value={newHabitEmoji} onChange={setNewHabitEmoji} />
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring"
                    placeholder="Habit name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddHabit(false)} className="flex-1 py-2 text-sm text-text-secondary rounded-xl hover:bg-surface-hover transition-all duration-200">
                    Cancel
                  </button>
                  <button onClick={addHabit} className="flex-1 py-2 text-sm text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 active:scale-[0.98]">
                    Add Habit
                  </button>
                </div>
              </div>
            )}

            {habits.length === 0 && !showAddHabit ? (
              <div className="bg-surface rounded-2xl p-6 border border-border text-center">
                <p className="text-text-tertiary text-sm">No habits yet. Tap Add to create one!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {habits.map((habit) =>
                  editingId === habit.id ? (
                    <div
                      key={habit.id}
                      className="bg-surface rounded-2xl p-4 border border-accent-border animate-fade-in"
                    >
                      <div className="flex gap-2 mb-3">
                        <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="py-2 px-3 text-sm text-danger-text rounded-xl hover:bg-danger-surface transition-all duration-200"
                        >
                          Delete
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => setEditingId(null)}
                          className="py-2 px-3 text-sm text-text-secondary rounded-xl hover:bg-surface-hover transition-all duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="py-2 px-4 text-sm text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 active:scale-[0.98]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={habit.id}
                      onClick={() => editMode ? startEditing(habit) : toggleHabit(habit)}
                      disabled={!editMode && togglingId === habit.id}
                      className={cn(
                        'w-full bg-surface rounded-2xl p-4 border text-left transition-all duration-200 active:scale-[0.97]',
                        habit.completed ? 'border-positive-border bg-positive-surface' : 'border-border hover:border-border-strong',
                        !editMode && togglingId === habit.id && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn('text-2xl leading-none', habit.completed && !editMode && 'animate-checkmark inline-block')}>
                          {habit.emoji}
                        </span>
                        <span className={cn('text-sm font-medium flex-1 min-w-0 truncate', habit.completed ? 'text-positive-text' : 'text-text-secondary')}>
                          {habit.name}
                        </span>
                        {editMode ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--c-border-strong)" strokeWidth="1.5" />
                            {habit.completed && (
                              <g>
                                <circle cx="12" cy="12" r="10" fill="var(--c-positive)" className="animate-circle-fill" />
                                <path
                                  d="M7 12.5l3.5 3.5 6.5-7"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="animate-check-draw"
                                />
                              </g>
                            )}
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          {/* Food Summary */}
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '50ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Food</h2>
            <div className="bg-surface rounded-2xl p-5 border border-border">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-2xl font-bold text-text-primary">{totalCalories}</p>
                  <p className="text-xs text-text-tertiary">of {calorieGoal} cal goal</p>
                </div>
                <p className={cn('text-sm font-medium', caloriePercent >= 100 ? 'text-warning' : 'text-positive-text')}>
                  {Math.round(caloriePercent)}%
                </p>
              </div>
              <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 animate-progress',
                    caloriePercent >= 100 ? 'bg-warning-bar' : 'bg-positive-bar'
                  )}
                  style={{ width: `${caloriePercent}%` }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                  <div key={meal} className="text-center">
                    <p className="text-xs text-text-tertiary capitalize">{meal}</p>
                    <p className="text-sm font-semibold text-text-label">{mealBreakdown[meal]}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Nutrition Targets — only shown when body stats are filled */}
          {targets?.hasData && (
            <section className="mb-6 animate-stagger-in" style={{ animationDelay: '100ms' }}>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Nutrition</h2>
              <div className="bg-surface rounded-2xl p-5 border border-border">
                {/* TDEE & Deficit/Surplus */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-text-tertiary">TDEE (est.)</p>
                    <p className="text-lg font-bold text-text-primary">{targets.tdee} cal</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-tertiary">Your goal</p>
                    <p className={cn(
                      'text-sm font-semibold',
                      targets.calorieDelta < -50 ? 'text-info' :
                      targets.calorieDelta > 50 ? 'text-warning' : 'text-positive-text'
                    )}>
                      {targets.deltaLabel}
                    </p>
                  </div>
                </div>

                {/* Net calories when exercise is logged */}
                {totalCaloriesBurned > 0 && (
                  <div className="bg-bg rounded-xl px-3 py-2 mb-3">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Eaten: {totalCalories}</span>
                      <span>Burned: {totalCaloriesBurned}</span>
                      <span className="font-semibold text-text-label">Net: {netCalories} cal</span>
                    </div>
                  </div>
                )}

                {/* Macro Recommendations with progress bars */}
                <div className="space-y-2.5">
                  {[
                    { ...targets.protein, eaten: totalProtein, color: 'bg-info-bar' },
                    { ...targets.carbs, eaten: totalCarbs, color: 'bg-macro-carbs' },
                    { ...targets.fat, eaten: totalFat, color: 'bg-macro-fat' },
                  ].map((macro) => {
                    const midTarget = (macro.min + macro.max) / 2;
                    const percent = midTarget > 0 ? Math.min((macro.eaten / midTarget) * 100, 100) : 0;
                    const inRange = macro.eaten >= macro.min && macro.eaten <= macro.max;
                    const over = macro.eaten > macro.max;

                    return (
                      <div key={macro.label}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-xs font-medium text-text-muted">{macro.label}</span>
                          <span className="text-xs text-text-tertiary">
                            <span className={cn(
                              'font-semibold',
                              inRange ? 'text-positive-text' : over ? 'text-warning' : 'text-text-label'
                            )}>
                              {macro.eaten}g
                            </span>
                            {' / '}
                            {macro.min}–{macro.max}g
                          </span>
                        </div>
                        <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              inRange ? 'bg-positive-bar' : over ? 'bg-warning-bar' : macro.color
                            )}
                            style={{ width: `${percent}%` }}
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
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '150ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Exercise</h2>
            <div className="bg-surface rounded-2xl p-5 border border-border">
              {exerciseLogs.length === 0 ? (
                <p className="text-text-tertiary text-sm text-center py-2">No exercise logged today</p>
              ) : (
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{totalExerciseMinutes}</p>
                    <p className="text-xs text-text-tertiary">minutes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{totalCaloriesBurned}</p>
                    <p className="text-xs text-text-tertiary">cal burned</p>
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
