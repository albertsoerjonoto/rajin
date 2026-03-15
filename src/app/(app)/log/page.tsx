'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import { validateCalories, validateDuration, validateMacro } from '@/lib/validation';
import type { FoodLog, ExerciseLog, MealType } from '@/lib/types';

type Tab = 'food' | 'exercise';
type Modal = 'none' | 'food' | 'exercise';

export default function LogPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [tab, setTab] = useState<Tab>('food');
  const [modal, setModal] = useState<Modal>('none');
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [mealType, setMealType] = useState<MealType>('lunch');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const [exerciseType, setExerciseType] = useState('');
  const [duration, setDuration] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'food' | 'exercise'; id: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const today = getToday();

    const { data: food, error: foodError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (foodError) showToast('error', 'Failed to load food logs');
    if (food) setFoodLogs(food);

    const { data: exercise, error: exerciseError } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (exerciseError) showToast('error', 'Failed to load exercise logs');
    if (exercise) setExerciseLogs(exercise);
    setLoading(false);
  }, [user, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveFoodLog = async () => {
    if (!user || !description.trim()) return;

    const cal = validateCalories(calories);
    if (cal === null) {
      showToast('error', 'Calories must be between 0 and 20,000');
      return;
    }
    const prot = proteinG ? validateMacro(proteinG) : null;
    const carbs = carbsG ? validateMacro(carbsG) : null;
    const fat = fatG ? validateMacro(fatG) : null;

    if ((proteinG && prot === null) || (carbsG && carbs === null) || (fatG && fat === null)) {
      showToast('error', 'Macros must be between 0 and 5,000g');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date: getToday(),
      meal_type: mealType,
      description: description.trim(),
      calories: cal,
      protein_g: prot,
      carbs_g: carbs,
      fat_g: fat,
      source: 'manual',
    });

    if (error) {
      showToast('error', 'Failed to save food log');
      setSaving(false);
      return;
    }

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
    if (!user || !exerciseType.trim()) return;

    const dur = validateDuration(duration);
    if (dur === null) {
      showToast('error', 'Duration must be between 0 and 1,440 minutes');
      return;
    }
    const burned = caloriesBurned ? validateCalories(caloriesBurned) : 0;
    if (burned === null) {
      showToast('error', 'Calories burned must be between 0 and 20,000');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      date: getToday(),
      exercise_type: exerciseType.trim(),
      duration_minutes: dur,
      calories_burned: burned,
      notes: notes.trim() || null,
      source: 'manual',
    });

    if (error) {
      showToast('error', 'Failed to save exercise log');
      setSaving(false);
      return;
    }

    setExerciseType('');
    setDuration('');
    setCaloriesBurned('');
    setNotes('');
    setModal('none');
    setSaving(false);
    fetchData();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();

    const table = deleteTarget.type === 'food' ? 'food_logs' : 'exercise_logs';
    const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);

    if (error) {
      showToast('error', `Failed to delete ${deleteTarget.type} log`);
    }

    setDeleteTarget(null);
    fetchData();
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
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {ToastContainer}
      <h1 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Today&apos;s Log</h1>

      {/* Tab Switcher — pill style */}
      <div
        className="flex p-1 rounded-xl mb-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {(['food', 'exercise'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize"
            style={{
              background: tab === t ? 'var(--bg-main)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {t === 'food' ? '🍽 Food' : '🏃 Exercise'}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {tab === 'food' && (
            <div className="space-y-2.5">
              {foodLogs.length === 0 ? (
                <div
                  className="rounded-xl p-6 text-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No food logged today</p>
                </div>
              ) : (
                foodLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl p-4 animate-fade-in"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--accent)' }}
                        >
                          {log.meal_type}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {log.description}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {log.calories} cal
                          {log.protein_g && ` · ${log.protein_g}g protein`}
                          {log.carbs_g && ` · ${log.carbs_g}g carbs`}
                          {log.fat_g && ` · ${log.fat_g}g fat`}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ type: 'food', id: log.id })}
                        className="transition-colors p-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                        aria-label="Delete food log"
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

          {tab === 'exercise' && (
            <div className="space-y-2.5">
              {exerciseLogs.length === 0 ? (
                <div
                  className="rounded-xl p-6 text-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No exercise logged today</p>
                </div>
              ) : (
                exerciseLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl p-4 animate-fade-in"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {log.exercise_type}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {log.duration_minutes} min · {log.calories_burned} cal burned
                          {log.notes && ` · ${log.notes}`}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ type: 'exercise', id: log.id })}
                        className="transition-colors p-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                        aria-label="Delete exercise log"
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
        </>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => setModal(tab)}
        className="fixed bottom-24 right-6 w-12 h-12 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 z-40"
        style={{ background: 'var(--accent)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        aria-label={`Add ${tab} log`}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete log"
        message="Are you sure? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Food Modal */}
      {modal === 'food' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-6 animate-fade-in"
            style={{ background: '#1a1a1a', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border-strong)' }} />
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Food</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMealType(m)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize"
                  style={{
                    background: mealType === m ? 'var(--accent)' : 'var(--bg-surface)',
                    color: mealType === m ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${mealType === m ? 'transparent' : 'var(--border)'}`,
                  }}
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
                style={inputStyle}
                placeholder="What did you eat?"
                autoFocus
              />
              <input
                type="number"
                min="0"
                max="20000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                style={inputStyle}
                placeholder="Calories"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  style={{ ...inputStyle, padding: '10px 12px' }}
                  placeholder="Protein (g)"
                />
                <input
                  type="number"
                  min="0"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  style={{ ...inputStyle, padding: '10px 12px' }}
                  placeholder="Carbs (g)"
                />
                <input
                  type="number"
                  min="0"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  style={{ ...inputStyle, padding: '10px 12px' }}
                  placeholder="Fat (g)"
                />
              </div>
              <button
                onClick={saveFoodLog}
                disabled={saving || !description.trim() || !calories}
                className="w-full py-3 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {modal === 'exercise' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-6 animate-fade-in"
            style={{ background: '#1a1a1a', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border-strong)' }} />
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Exercise</h2>

            <div className="space-y-3">
              <input
                type="text"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                style={inputStyle}
                placeholder="Exercise type (e.g., Running)"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={inputStyle}
                  placeholder="Duration (min)"
                />
                <input
                  type="number"
                  min="0"
                  max="20000"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  style={inputStyle}
                  placeholder="Calories burned"
                />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={inputStyle}
                placeholder="Notes (optional)"
              />
              <button
                onClick={saveExerciseLog}
                disabled={saving || !exerciseType.trim() || !duration}
                className="w-full py-3 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
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
