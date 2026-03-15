'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import DateNav from '@/components/DateNav';
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
  const [date, setDate] = useState(getToday());

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

  // Edit state
  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseLog | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'food' | 'exercise'; id: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const { data: food, error: foodError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: false });
    if (foodError) showToast('error', 'Failed to load food logs');
    if (food) setFoodLogs(food);

    const { data: exercise, error: exerciseError } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: false });
    if (exerciseError) showToast('error', 'Failed to load exercise logs');
    if (exercise) setExerciseLogs(exercise);
    setLoading(false);
  }, [user, date, showToast]);

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

    const fields = {
      meal_type: mealType,
      description: description.trim(),
      calories: cal,
      protein_g: prot,
      carbs_g: carbs,
      fat_g: fat,
    };

    const { error } = editingFood
      ? await supabase.from('food_logs').update(fields).eq('id', editingFood.id)
      : await supabase.from('food_logs').insert({ ...fields, user_id: user.id, date, source: 'manual' as const });

    if (error) {
      showToast('error', `Failed to ${editingFood ? 'update' : 'save'} food log`);
      setSaving(false);
      return;
    }

    closeModal();
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

    const fields = {
      exercise_type: exerciseType.trim(),
      duration_minutes: dur,
      calories_burned: burned,
      notes: notes.trim() || null,
    };

    const { error } = editingExercise
      ? await supabase.from('exercise_logs').update(fields).eq('id', editingExercise.id)
      : await supabase.from('exercise_logs').insert({ ...fields, user_id: user.id, date, source: 'manual' as const });

    if (error) {
      showToast('error', `Failed to ${editingExercise ? 'update' : 'save'} exercise log`);
      setSaving(false);
      return;
    }

    closeModal();
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

  const startEditFood = (log: FoodLog) => {
    setMealType(log.meal_type);
    setDescription(log.description);
    setCalories(String(log.calories));
    setProteinG(log.protein_g ? String(log.protein_g) : '');
    setCarbsG(log.carbs_g ? String(log.carbs_g) : '');
    setFatG(log.fat_g ? String(log.fat_g) : '');
    setEditingFood(log);
    setModal('food');
  };

  const startEditExercise = (log: ExerciseLog) => {
    setExerciseType(log.exercise_type);
    setDuration(String(log.duration_minutes));
    setCaloriesBurned(log.calories_burned ? String(log.calories_burned) : '');
    setNotes(log.notes || '');
    setEditingExercise(log);
    setModal('exercise');
  };

  const closeModal = () => {
    setModal('none');
    setEditingFood(null);
    setEditingExercise(null);
    setDescription('');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setExerciseType('');
    setDuration('');
    setCaloriesBurned('');
    setNotes('');
  };

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';

  return (
    <div className="max-w-lg mx-auto px-4">
      {ToastContainer}
      <div className="sticky top-0 z-20 bg-bg flex items-center justify-between pb-4 -mx-4 px-4 pt-6">
        <h1 className="text-xl font-bold text-text-primary">Log</h1>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-surface-secondary rounded-xl p-1 mb-4">
        {(['food', 'exercise'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize',
              tab === t ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
            )}
          >
            {t === 'food' ? '🍽️ Diet' : '🏃 Exercise'}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Food Tab */}
          {tab === 'food' && (
            <div className="space-y-3">
              {foodLogs.length === 0 ? (
                <div className="bg-surface rounded-2xl p-5 text-center">
                  <p className="text-text-tertiary text-sm">No food logged today</p>
                </div>
              ) : (
                foodLogs.map((log, i) => (
                  <div key={log.id} onClick={() => startEditFood(log)} className="bg-surface rounded-2xl p-5 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-medium text-accent-text uppercase">{log.meal_type === 'snack' ? 'Other' : log.meal_type}</span>
                        <p className="text-sm font-medium text-text-primary mt-0.5">{log.description}</p>
                        <p className="text-xs text-text-tertiary mt-1">
                          {log.calories} cal
                          {log.protein_g && ` · ${log.protein_g}g protein`}
                          {log.carbs_g && ` · ${log.carbs_g}g carbs`}
                          {log.fat_g && ` · ${log.fat_g}g fat`}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'food', id: log.id }); }}
                        className="text-text-tertiary hover:text-danger-text-muted transition-colors p-2.5"
                        aria-label="Delete food log"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
                <div className="bg-surface rounded-2xl p-5 text-center">
                  <p className="text-text-tertiary text-sm">No exercise logged today</p>
                </div>
              ) : (
                exerciseLogs.map((log, i) => (
                  <div key={log.id} onClick={() => startEditExercise(log)} className="bg-surface rounded-2xl p-5 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{log.exercise_type}</p>
                        <p className="text-xs text-text-tertiary mt-1">
                          {log.duration_minutes} min · {log.calories_burned} cal burned
                          {log.notes && ` · ${log.notes}`}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'exercise', id: log.id }); }}
                        className="text-text-tertiary hover:text-danger-text-muted transition-colors p-2.5"
                        aria-label="Delete exercise log"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
        className="fixed bottom-24 right-6 w-14 h-14 bg-accent hover:bg-accent-hover text-accent-fg rounded-full shadow-lg flex items-center justify-center transition-all active:scale-[0.98] z-40"
        aria-label={`Add ${tab} log`}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete log"
        message="Are you sure? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Food Modal */}
      {modal === 'food' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingFood ? 'Edit Diet Entry' : 'Add Diet Entry'}</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {([['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Other']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMealType(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                    mealType === value
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-secondary text-text-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                placeholder="What did you eat?"
                autoFocus
              />
              <input
                type="number"
                min="0"
                max="20000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className={inputClass}
                placeholder="Calories"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder="Protein (g)"
                />
                <input
                  type="number"
                  min="0"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder="Carbs (g)"
                />
                <input
                  type="number"
                  min="0"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder="Fat (g)"
                />
              </div>
              <button
                onClick={saveFoodLog}
                disabled={saving || !description.trim() || !calories}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingExercise ? 'Edit Exercise' : 'Add Exercise'}</h2>

            <div className="space-y-3">
              <input
                type="text"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                className={inputClass}
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
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200"
                  placeholder="Duration (min)"
                />
                <input
                  type="number"
                  min="0"
                  max="20000"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200"
                  placeholder="Calories burned"
                />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                placeholder="Notes (optional)"
              />
              <button
                onClick={saveExerciseLog}
                disabled={saving || !exerciseType.trim() || !duration}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
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
