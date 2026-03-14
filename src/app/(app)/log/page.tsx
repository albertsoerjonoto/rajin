'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import type { FoodLog, ExerciseLog, MealType } from '@/lib/types';

type Tab = 'food' | 'exercise';
type Modal = 'none' | 'food' | 'exercise';

export default function LogPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('food');
  const [modal, setModal] = useState<Modal>('none');
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);

  // Food form state
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  // Exercise form state
  const [exerciseType, setExerciseType] = useState('');
  const [duration, setDuration] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const today = getToday();

    const { data: food } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (food) setFoodLogs(food);

    const { data: exercise } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (exercise) setExerciseLogs(exercise);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveFoodLog = async () => {
    if (!user || !description.trim() || !calories) return;
    setSaving(true);
    const supabase = createClient();

    await supabase.from('food_logs').insert({
      user_id: user.id,
      date: getToday(),
      meal_type: mealType,
      description: description.trim(),
      calories: parseInt(calories),
      protein_g: proteinG ? parseInt(proteinG) : null,
      carbs_g: carbsG ? parseInt(carbsG) : null,
      fat_g: fatG ? parseInt(fatG) : null,
      source: 'manual',
    });

    setDescription('');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setModal('none');
    setSaving(false);
    fetchData();
  };

  const saveExerciseLog = async () => {
    if (!user || !exerciseType.trim() || !duration) return;
    setSaving(true);
    const supabase = createClient();

    await supabase.from('exercise_logs').insert({
      user_id: user.id,
      date: getToday(),
      exercise_type: exerciseType.trim(),
      duration_minutes: parseInt(duration),
      calories_burned: caloriesBurned ? parseInt(caloriesBurned) : 0,
      notes: notes.trim() || null,
      source: 'manual',
    });

    setExerciseType('');
    setDuration('');
    setCaloriesBurned('');
    setNotes('');
    setModal('none');
    setSaving(false);
    fetchData();
  };

  const deleteFoodLog = async (id: string) => {
    const supabase = createClient();
    await supabase.from('food_logs').delete().eq('id', id);
    fetchData();
  };

  const deleteExerciseLog = async (id: string) => {
    const supabase = createClient();
    await supabase.from('exercise_logs').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Log</h1>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {(['food', 'exercise'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            )}
          >
            {t === 'food' ? '🍽️ Food' : '🏃 Exercise'}
          </button>
        ))}
      </div>

      {/* Food Tab */}
      {tab === 'food' && (
        <div className="space-y-3">
          {foodLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <p className="text-gray-400 text-sm">No food logged today</p>
            </div>
          ) : (
            foodLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-emerald-600 uppercase">{log.meal_type}</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {log.calories} cal
                      {log.protein_g && ` · ${log.protein_g}g protein`}
                      {log.carbs_g && ` · ${log.carbs_g}g carbs`}
                      {log.fat_g && ` · ${log.fat_g}g fat`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteFoodLog(log.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Exercise Tab */}
      {tab === 'exercise' && (
        <div className="space-y-3">
          {exerciseLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <p className="text-gray-400 text-sm">No exercise logged today</p>
            </div>
          ) : (
            exerciseLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.exercise_type}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {log.duration_minutes} min · {log.calories_burned} cal burned
                      {log.notes && ` · ${log.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteExerciseLog(log.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => setModal(tab)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 z-40"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Food Modal */}
      {modal === 'food' && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center" onClick={() => setModal('none')}>
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Food</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMealType(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize',
                    mealType === m
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="What did you eat?"
                autoFocus
              />
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Calories"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="px-3 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Protein (g)"
                />
                <input
                  type="number"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="px-3 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Carbs (g)"
                />
                <input
                  type="number"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="px-3 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Fat (g)"
                />
              </div>
              <button
                onClick={saveFoodLog}
                disabled={saving || !description.trim() || !calories}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center" onClick={() => setModal('none')}>
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Exercise</h2>

            <div className="space-y-3">
              <input
                type="text"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Exercise type (e.g., Running)"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Duration (min)"
                />
                <input
                  type="number"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Calories burned"
                />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Notes (optional)"
              />
              <button
                onClick={saveExerciseLog}
                disabled={saving || !exerciseType.trim() || !duration}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
