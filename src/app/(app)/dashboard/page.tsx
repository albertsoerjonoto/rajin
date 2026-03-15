'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, formatDisplayDate, addDays, cn } from '@/lib/utils';
import { computeNutritionTargets } from '@/lib/nutrition';
import type { HabitWithLog, FoodLog, ExerciseLog, Profile } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(getToday());
  const [habits, setHabits] = useState<HabitWithLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('✅');

  const fetchData = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileData) {
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
      profileData = newProfile;
    }
    if (profileData) setProfile(profileData);

    const { data: habitsData } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order');

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

    const { data: foodData } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at');
    if (foodData) setFoodLogs(foodData);

    const { data: exerciseData } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at');
    if (exerciseData) setExerciseLogs(exerciseData);
  }, [user, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleHabit = async (habit: HabitWithLog) => {
    if (!user) return;
    const supabase = createClient();

    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, completed: !h.completed } : h))
    );

    if (habit.completed && habit.log_id) {
      await supabase.from('habit_logs').delete().eq('id', habit.log_id);
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: user.id,
        date: date,
        completed: true,
      });
    }
    fetchData();
  };

  const addHabit = async () => {
    if (!user || !newHabitName.trim()) return;
    const supabase = createClient();

    await supabase.from('habits').insert({
      user_id: user.id,
      name: newHabitName.trim(),
      emoji: newHabitEmoji || '✅',
      sort_order: habits.length,
    });

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

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">{formatDisplayDate(date)}</h1>
          {date !== getToday() && (
            <button onClick={() => setDate(getToday())} className="text-xs text-emerald-600 font-medium mt-0.5">
              Go to today
            </button>
          )}
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Habits Section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Habits</h2>
          <button onClick={() => setShowAddHabit(true)} className="text-emerald-600 text-sm font-medium">
            + Add
          </button>
        </div>

        {showAddHabit && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 animate-fade-in">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newHabitEmoji}
                onChange={(e) => setNewHabitEmoji(e.target.value)}
                className="w-12 text-center text-xl px-2 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="✅"
              />
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Habit name"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddHabit(false)} className="flex-1 py-2 text-sm text-gray-500 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={addHabit} className="flex-1 py-2 text-sm text-white bg-emerald-500 rounded-xl hover:bg-emerald-600">
                Add Habit
              </button>
            </div>
          </div>
        )}

        {habits.length === 0 && !showAddHabit ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-sm">No habits yet. Tap + Add to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {habits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit)}
                className={cn(
                  'bg-white rounded-2xl p-4 shadow-sm border text-left transition-all active:scale-95',
                  habit.completed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:border-gray-200'
                )}
              >
                <div className="text-2xl mb-1">
                  {habit.completed ? (
                    <span className="animate-checkmark inline-block">{habit.emoji}</span>
                  ) : (
                    <span className="opacity-40">{habit.emoji}</span>
                  )}
                </div>
                <p className={cn('text-sm font-medium', habit.completed ? 'text-emerald-700' : 'text-gray-600')}>
                  {habit.name}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Food Summary */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Food</h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCalories}</p>
              <p className="text-xs text-gray-400">of {calorieGoal} cal goal</p>
            </div>
            <p className={cn('text-sm font-medium', caloriePercent >= 100 ? 'text-orange-500' : 'text-emerald-600')}>
              {Math.round(caloriePercent)}%
            </p>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 animate-progress',
                caloriePercent >= 100 ? 'bg-orange-400' : 'bg-emerald-400'
              )}
              style={{ width: `${caloriePercent}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
              <div key={meal} className="text-center">
                <p className="text-xs text-gray-400 capitalize">{meal}</p>
                <p className="text-sm font-semibold text-gray-700">{mealBreakdown[meal]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nutrition Targets — only shown when body stats are filled */}
      {targets?.hasData && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Nutrition</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {/* TDEE & Deficit/Surplus */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">TDEE (est.)</p>
                <p className="text-lg font-bold text-gray-900">{targets.tdee} cal</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Your goal</p>
                <p className={cn(
                  'text-sm font-semibold',
                  targets.calorieDelta < -50 ? 'text-blue-600' :
                  targets.calorieDelta > 50 ? 'text-orange-500' : 'text-emerald-600'
                )}>
                  {targets.deltaLabel}
                </p>
              </div>
            </div>

            {/* Net calories when exercise is logged */}
            {totalCaloriesBurned > 0 && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Eaten: {totalCalories}</span>
                  <span>Burned: {totalCaloriesBurned}</span>
                  <span className="font-semibold text-gray-700">Net: {netCalories} cal</span>
                </div>
              </div>
            )}

            {/* Macro Recommendations with progress bars */}
            <div className="space-y-2.5">
              {[
                { ...targets.protein, eaten: totalProtein, color: 'bg-blue-400' },
                { ...targets.carbs, eaten: totalCarbs, color: 'bg-amber-400' },
                { ...targets.fat, eaten: totalFat, color: 'bg-rose-400' },
              ].map((macro) => {
                const midTarget = (macro.min + macro.max) / 2;
                const percent = midTarget > 0 ? Math.min((macro.eaten / midTarget) * 100, 100) : 0;
                const inRange = macro.eaten >= macro.min && macro.eaten <= macro.max;
                const over = macro.eaten > macro.max;

                return (
                  <div key={macro.label}>
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-medium text-gray-600">{macro.label}</span>
                      <span className="text-xs text-gray-400">
                        <span className={cn(
                          'font-semibold',
                          inRange ? 'text-emerald-600' : over ? 'text-orange-500' : 'text-gray-700'
                        )}>
                          {macro.eaten}g
                        </span>
                        {' / '}
                        {macro.min}–{macro.max}g
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          inRange ? 'bg-emerald-400' : over ? 'bg-orange-400' : macro.color
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
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Exercise</h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {exerciseLogs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">No exercise logged today</p>
          ) : (
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalExerciseMinutes}</p>
                <p className="text-xs text-gray-400">minutes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalCaloriesBurned}</p>
                <p className="text-xs text-gray-400">cal burned</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
