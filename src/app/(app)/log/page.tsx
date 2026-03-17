'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import DateNav from '@/components/DateNav';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import { validateCalories, validateDuration, validateMacro, validateVolume } from '@/lib/validation';
import { useLocale } from '@/lib/i18n';
import type { FoodLog, ExerciseLog, DrinkLog, MealType, DrinkType, Profile, HabitWithLog, MeasurementLog } from '@/lib/types';

type Tab = 'food' | 'exercise' | 'habits' | 'measurements';
type Modal = 'none' | 'food' | 'exercise' | 'drink' | 'measurement';

const DRINK_TYPES: { value: DrinkType; labelKey: string }[] = [
  { value: 'water', labelKey: 'drink.water' },
  { value: 'coffee', labelKey: 'drink.coffee' },
  { value: 'tea', labelKey: 'drink.tea' },
  { value: 'juice', labelKey: 'drink.juice' },
  { value: 'soda', labelKey: 'drink.soda' },
  { value: 'milk', labelKey: 'drink.milk' },
  { value: 'other', labelKey: 'drink.other' },
];

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function LogPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('food');
  const [modal, setModal] = useState<Modal>('none');
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const [habits, setHabits] = useState<HabitWithLog[]>([]);
  const [measurementLogs, setMeasurementLogs] = useState<MeasurementLog[]>([]);
  const [lastMeasurement, setLastMeasurement] = useState<{ weight_kg: number | null; date: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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

  // Drink form state
  const [drinkType, setDrinkType] = useState<DrinkType>('water');
  const [drinkDescription, setDrinkDescription] = useState('');
  const [drinkVolume, setDrinkVolume] = useState('');
  const [drinkCalories, setDrinkCalories] = useState('');
  const [drinkProtein, setDrinkProtein] = useState('');
  const [drinkCarbs, setDrinkCarbs] = useState('');
  const [drinkFat, setDrinkFat] = useState('');

  // Measurement form state
  const [measureHeightCm, setMeasureHeightCm] = useState('');
  const [measureWeightKg, setMeasureWeightKg] = useState('');
  const [measureNotes, setMeasureNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit state
  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseLog | null>(null);
  const [editingDrink, setEditingDrink] = useState<DrinkLog | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<MeasurementLog | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'food' | 'exercise' | 'drink' | 'measurement'; id: string } | null>(null);

  const mealLabel = (type: string) => {
    if (type === 'breakfast') return t('meal.breakfast');
    if (type === 'lunch') return t('meal.lunch');
    if (type === 'dinner') return t('meal.dinner');
    return t('meal.other');
  };

  const drinkTypeLabel = (type: string) => {
    const found = DRINK_TYPES.find((d) => d.value === type);
    return found ? t(found.labelKey) : type;
  };

  const mealOptions: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: t('meal.breakfast') },
    { value: 'lunch', label: t('meal.lunch') },
    { value: 'dinner', label: t('meal.dinner') },
    { value: 'snack', label: t('meal.other') },
  ];

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const [foodRes, exerciseRes, drinkRes, profileRes, habitsRes, habitLogsRes, measurementRes, lastMeasureRes] = await Promise.all([
      supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', date).order('created_at', { ascending: false }),
      supabase.from('exercise_logs').select('*').eq('user_id', user.id).eq('date', date).order('created_at', { ascending: false }),
      supabase.from('drink_logs').select('*').eq('user_id', user.id).eq('date', date).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('date', date),
      supabase.from('measurement_logs').select('*').eq('user_id', user.id).eq('date', date).order('logged_at', { ascending: false }),
      supabase.from('measurement_logs').select('weight_kg, date').eq('user_id', user.id).not('weight_kg', 'is', null).order('logged_at', { ascending: false }).limit(1),
    ]);

    if (foodRes.error) showToast('error', t('dashboard.failedLoadFood'));
    if (foodRes.data) setFoodLogs(foodRes.data);
    if (exerciseRes.error) showToast('error', t('dashboard.failedLoadExercise'));
    if (exerciseRes.data) setExerciseLogs(exerciseRes.data);
    if (drinkRes.error) showToast('error', t('dashboard.failedLoadDrinks'));
    if (drinkRes.data) setDrinkLogs(drinkRes.data);
    if (profileRes.data) setProfile(profileRes.data);

    if (habitsRes.error) showToast('error', t('log.failedLoadHabits'));
    if (habitsRes.data) {
      const habitsWithLogs: HabitWithLog[] = habitsRes.data.map((habit) => {
        const log = habitLogsRes.data?.find((l) => l.habit_id === habit.id);
        return { ...habit, completed: log?.completed ?? false, log_id: log?.id, logged_at: log?.logged_at };
      });
      setHabits(habitsWithLogs);
    }

    // measurement_logs table may not exist yet if migration hasn't been applied
    if (!measurementRes.error && measurementRes.data) setMeasurementLogs(measurementRes.data);
    if (!lastMeasureRes.error && lastMeasureRes.data && lastMeasureRes.data.length > 0) {
      setLastMeasurement(lastMeasureRes.data[0]);
    }

    setLoading(false);
  }, [user, date, showToast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
    const scrollTop = () => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollTop();
    requestAnimationFrame(scrollTop);
    setTimeout(scrollTop, 100);
  }, []);

  const saveFoodLog = async () => {
    if (!user || !description.trim()) return;

    const cal = validateCalories(calories);
    if (cal === null) {
      showToast('error', t('log.failedCalories'));
      return;
    }
    const prot = proteinG ? validateMacro(proteinG) : null;
    const carbs = carbsG ? validateMacro(carbsG) : null;
    const fat = fatG ? validateMacro(fatG) : null;

    if ((proteinG && prot === null) || (carbsG && carbs === null) || (fatG && fat === null)) {
      showToast('error', t('log.failedMacros'));
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
      showToast('error', editingFood ? t('log.failedUpdateFood') : t('log.failedSaveFood'));
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
      showToast('error', t('log.failedDuration'));
      return;
    }
    const burned = caloriesBurned ? validateCalories(caloriesBurned) : 0;
    if (burned === null) {
      showToast('error', t('log.failedCalBurned'));
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
      showToast('error', editingExercise ? t('log.failedUpdateExercise') : t('log.failedSaveExercise'));
      setSaving(false);
      return;
    }

    closeModal();
    setSaving(false);
    fetchData();
  };

  const saveDrinkLog = async () => {
    if (!user || !drinkDescription.trim()) return;

    const vol = drinkVolume ? validateVolume(drinkVolume) : 0;
    if (vol === null) {
      showToast('error', t('drink.failedVolume'));
      return;
    }
    const cal = drinkCalories ? validateCalories(drinkCalories) : 0;
    if (cal === null) {
      showToast('error', t('log.failedCalories'));
      return;
    }
    const prot = drinkProtein ? validateMacro(drinkProtein) : null;
    const carbs = drinkCarbs ? validateMacro(drinkCarbs) : null;
    const fat = drinkFat ? validateMacro(drinkFat) : null;

    setSaving(true);
    const supabase = createClient();

    const fields = {
      drink_type: drinkType,
      description: drinkDescription.trim(),
      volume_ml: vol,
      calories: cal,
      protein_g: prot,
      carbs_g: carbs,
      fat_g: fat,
    };

    const { error } = editingDrink
      ? await supabase.from('drink_logs').update(fields).eq('id', editingDrink.id)
      : await supabase.from('drink_logs').insert({ ...fields, user_id: user.id, date, source: 'manual' as const });

    if (error) {
      showToast('error', editingDrink ? t('drink.failedUpdate') : t('drink.failedSave'));
      setSaving(false);
      return;
    }

    closeModal();
    setSaving(false);
    fetchData();
  };

  const saveMeasurementLog = async () => {
    if (!user) return;
    const h = measureHeightCm ? parseFloat(measureHeightCm) : null;
    const w = measureWeightKg ? parseFloat(measureWeightKg) : null;

    if (h === null && w === null) {
      showToast('error', t('log.heightOrWeightRequired'));
      return;
    }
    if (h !== null && (isNaN(h) || h < 50 || h > 300)) {
      showToast('error', t('profile.heightError'));
      return;
    }
    if (w !== null && (isNaN(w) || w < 10 || w > 500)) {
      showToast('error', t('profile.weightError'));
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const fields = {
      height_cm: h,
      weight_kg: w,
      notes: measureNotes.trim() || null,
    };

    const { error } = editingMeasurement
      ? await supabase.from('measurement_logs').update(fields).eq('id', editingMeasurement.id)
      : await supabase.from('measurement_logs').insert({ ...fields, user_id: user.id, date, source: 'manual' as const });

    if (error) {
      showToast('error', editingMeasurement ? t('log.failedUpdateMeasurement') : t('log.failedSaveMeasurement'));
      setSaving(false);
      return;
    }

    closeModal();
    setSaving(false);
    fetchData();
  };

  const addQuickWater = async (ml: number) => {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase.from('drink_logs').insert({
      user_id: user.id,
      date,
      drink_type: 'water' as const,
      description: t('drink.water'),
      volume_ml: ml,
      calories: 0,
      source: 'manual' as const,
    });
    if (error) {
      showToast('error', t('drink.failedSave'));
      return;
    }
    fetchData();
  };

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
          prev.map((h) => (h.id === habit.id ? { ...h, log_id: undefined, logged_at: undefined } : h))
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
            prev.map((h) => (h.id === habit.id ? { ...h, log_id: data.id, logged_at: data.logged_at } : h))
          );
        }
      }
    } catch {
      setHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? { ...h, completed: wasCompleted } : h))
      );
      showToast('error', t('dashboard.failedUpdateHabit'));
    }
    setTogglingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();

    const tableMap: Record<string, string> = {
      food: 'food_logs',
      exercise: 'exercise_logs',
      drink: 'drink_logs',
      measurement: 'measurement_logs',
    };
    const table = tableMap[deleteTarget.type];
    const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);

    if (error) {
      const errKeyMap: Record<string, string> = {
        food: 'log.failedDeleteFood',
        exercise: 'log.failedDeleteExercise',
        drink: 'drink.failedDelete',
        measurement: 'log.failedDeleteMeasurement',
      };
      showToast('error', t(errKeyMap[deleteTarget.type]));
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

  const startEditDrink = (log: DrinkLog) => {
    setDrinkType(log.drink_type);
    setDrinkDescription(log.description);
    setDrinkVolume(String(log.volume_ml));
    setDrinkCalories(log.calories ? String(log.calories) : '');
    setDrinkProtein(log.protein_g ? String(log.protein_g) : '');
    setDrinkCarbs(log.carbs_g ? String(log.carbs_g) : '');
    setDrinkFat(log.fat_g ? String(log.fat_g) : '');
    setEditingDrink(log);
    setModal('drink');
  };

  const startEditMeasurement = (log: MeasurementLog) => {
    setMeasureHeightCm(log.height_cm ? String(log.height_cm) : '');
    setMeasureWeightKg(log.weight_kg ? String(log.weight_kg) : '');
    setMeasureNotes(log.notes || '');
    setEditingMeasurement(log);
    setModal('measurement');
  };

  const closeModal = () => {
    setModal('none');
    setEditingFood(null);
    setEditingExercise(null);
    setEditingDrink(null);
    setEditingMeasurement(null);
    setDescription('');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setExerciseType('');
    setDuration('');
    setCaloriesBurned('');
    setNotes('');
    setDrinkType('water');
    setDrinkDescription('');
    setDrinkVolume('');
    setDrinkCalories('');
    setDrinkProtein('');
    setDrinkCarbs('');
    setDrinkFat('');
    setMeasureHeightCm('');
    setMeasureWeightKg('');
    setMeasureNotes('');
  };

  // Derived data
  const mealLogs = foodLogs.filter((f) => f.meal_type !== 'snack');
  const snackLogs = foodLogs.filter((f) => f.meal_type === 'snack');
  const totalWaterMl = drinkLogs.filter((d) => d.drink_type === 'water').reduce((sum, d) => sum + d.volume_ml, 0);
  const waterGoalMl = profile?.daily_water_goal_ml ?? 2000;

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';

  const DeleteButton = ({ type, id }: { type: 'food' | 'exercise' | 'drink' | 'measurement'; id: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type, id }); }}
      className="text-text-tertiary hover:text-danger-text-muted transition-colors p-2.5"
      aria-label="Delete log"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  const TimeStamp = ({ time }: { time: string | null | undefined }) => {
    const formatted = formatTime(time);
    if (!formatted) return null;
    return <span className="text-[10px] text-text-tertiary ml-1">{formatted}</span>;
  };

  const tabKeys = ['food', 'exercise', 'habits', 'measurements'] as const;
  const tabLabels: Record<Tab, string> = {
    food: t('log.food'),
    exercise: t('log.exercise'),
    habits: t('log.habits'),
    measurements: t('log.measurements'),
  };

  const getFloatingButtonAction = () => {
    if (tab === 'exercise') return () => setModal('exercise');
    if (tab === 'measurements') return () => setModal('measurement');
    if (tab === 'habits') return undefined; // no FAB for habits
    return () => setModal('food');
  };
  const fabAction = getFloatingButtonAction();

  return (
    <div className="max-w-lg mx-auto px-4">
      {ToastContainer}
      <div className="sticky top-0 z-20 bg-bg -mx-4 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-text-primary">{t('log.title')}</h1>
          <DateNav date={date} onDateChange={handleDateChange} />
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-secondary rounded-xl p-1">
          {tabKeys.map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'flex-1 py-2 text-[11px] font-medium rounded-lg transition-all',
                tab === tabKey ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
              )}
            >
              {tabLabels[tabKey]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Food Tab */}
          {tab === 'food' && (
            <div className="space-y-6">
              {/* Meals Section */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('log.meals')}</h3>
                  <button
                    onClick={() => { setMealType('lunch'); setModal('food'); }}
                    className="text-accent-text text-xs font-medium"
                  >
                    + {t('common.add')}
                  </button>
                </div>
                {mealLogs.length === 0 ? (
                  <div className="bg-surface rounded-2xl p-4 text-center">
                    <p className="text-text-tertiary text-sm">{t('log.noFoodLogged')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mealLogs.map((log, i) => (
                      <div key={log.id} onClick={() => startEditFood(log)} className="bg-surface rounded-2xl p-4 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-accent-text uppercase">{mealLabel(log.meal_type)}</span>
                              <TimeStamp time={log.logged_at} />
                            </div>
                            <p className="text-sm font-medium text-text-primary mt-0.5">{log.description}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                              {log.calories} {t('common.cal')}
                              {log.protein_g && ` · ${log.protein_g}g ${t('log.protein')}`}
                              {log.carbs_g && ` · ${log.carbs_g}g ${t('log.carbs')}`}
                              {log.fat_g && ` · ${log.fat_g}g ${t('log.fat')}`}
                            </p>
                          </div>
                          <DeleteButton type="food" id={log.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Snacks Section */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('log.snacks')}</h3>
                  <button
                    onClick={() => { setMealType('snack'); setModal('food'); }}
                    className="text-accent-text text-xs font-medium"
                  >
                    + {t('common.add')}
                  </button>
                </div>
                {snackLogs.length === 0 ? (
                  <div className="bg-surface rounded-2xl p-4 text-center">
                    <p className="text-text-tertiary text-sm">{t('log.noFoodLogged')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snackLogs.map((log, i) => (
                      <div key={log.id} onClick={() => startEditFood(log)} className="bg-surface rounded-2xl p-4 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-accent-text uppercase">{mealLabel(log.meal_type)}</span>
                              <TimeStamp time={log.logged_at} />
                            </div>
                            <p className="text-sm font-medium text-text-primary mt-0.5">{log.description}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                              {log.calories} {t('common.cal')}
                              {log.protein_g && ` · ${log.protein_g}g ${t('log.protein')}`}
                            </p>
                          </div>
                          <DeleteButton type="food" id={log.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Drinks Section */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('log.drinks')}</h3>
                  <button
                    onClick={() => setModal('drink')}
                    className="text-accent-text text-xs font-medium"
                  >
                    + {t('common.add')}
                  </button>
                </div>

                {/* Water progress + quick add */}
                <div className="bg-surface rounded-2xl p-4 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">💧 {t('drink.water')}</span>
                    <span className="text-xs text-text-tertiary">
                      <span className={cn('font-semibold', totalWaterMl >= waterGoalMl ? 'text-positive-text' : 'text-text-label')}>
                        {totalWaterMl}ml
                      </span>
                      {' / '}{waterGoalMl}ml
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', totalWaterMl >= waterGoalMl ? 'bg-positive-bar' : 'bg-blue-400')}
                      style={{ width: `${Math.min((totalWaterMl / waterGoalMl) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addQuickWater(250)}
                      className="flex-1 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors active:scale-[0.97]"
                    >
                      +250ml
                    </button>
                    <button
                      onClick={() => addQuickWater(500)}
                      className="flex-1 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors active:scale-[0.97]"
                    >
                      +500ml
                    </button>
                  </div>
                </div>

                {drinkLogs.length === 0 ? (
                  <div className="bg-surface rounded-2xl p-4 text-center">
                    <p className="text-text-tertiary text-sm">{t('drink.noDrinksLogged')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drinkLogs.map((log, i) => (
                      <div key={log.id} onClick={() => startEditDrink(log)} className="bg-surface rounded-2xl p-4 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">{drinkTypeLabel(log.drink_type)}</span>
                              <TimeStamp time={log.logged_at} />
                            </div>
                            <p className="text-sm font-medium text-text-primary mt-0.5">{log.description}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                              {log.volume_ml}ml
                              {log.calories > 0 && ` · ${log.calories} ${t('common.cal')}`}
                            </p>
                          </div>
                          <DeleteButton type="drink" id={log.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Exercise Tab */}
          {tab === 'exercise' && (
            <div className="space-y-3">
              {exerciseLogs.length === 0 ? (
                <div className="bg-surface rounded-2xl p-5 text-center">
                  <p className="text-text-tertiary text-sm">{t('log.noExerciseLogged')}</p>
                </div>
              ) : (
                exerciseLogs.map((log, i) => (
                  <div key={log.id} onClick={() => startEditExercise(log)} className="bg-surface rounded-2xl p-5 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-text-primary">{log.exercise_type}</p>
                          <TimeStamp time={log.logged_at} />
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          {log.duration_minutes} {t('common.min')} · {log.calories_burned} {t('log.calBurned')}
                          {log.notes && ` · ${log.notes}`}
                        </p>
                      </div>
                      <DeleteButton type="exercise" id={log.id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Habits Tab */}
          {tab === 'habits' && (
            <div>
              {habits.length === 0 ? (
                <div className="bg-surface rounded-2xl p-6 text-center">
                  <p className="text-text-tertiary text-sm">{t('log.noHabitsLogged')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {habits.map((habit) => (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit)}
                      disabled={togglingId === habit.id}
                      className={cn(
                        'bg-surface rounded-xl px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.97]',
                        habit.completed && 'border border-positive-border bg-positive-surface',
                        togglingId === habit.id && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn('text-base leading-none shrink-0', habit.completed && 'animate-checkmark inline-block')}>
                          {habit.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={cn('text-xs font-medium leading-snug block', habit.completed ? 'text-positive-text' : 'text-text-secondary')}>
                            {habit.name}
                          </span>
                          {habit.completed && habit.logged_at && (
                            <span className="text-[10px] text-positive-text/70">{formatTime(habit.logged_at)}</span>
                          )}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
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
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Measurements Tab */}
          {tab === 'measurements' && (
            <div className="space-y-3">
              {/* Last recorded measurement */}
              {lastMeasurement && lastMeasurement.weight_kg && (
                <div className="bg-surface rounded-2xl p-4 text-center">
                  <p className="text-xs text-text-tertiary">
                    {t('log.lastMeasurement')}: <span className="font-semibold text-text-primary">{lastMeasurement.weight_kg} kg</span> {t('log.on')} {lastMeasurement.date}
                  </p>
                </div>
              )}

              {measurementLogs.length === 0 ? (
                <div className="bg-surface rounded-2xl p-5 text-center">
                  <p className="text-text-tertiary text-sm">{t('log.noMeasurements')}</p>
                </div>
              ) : (
                measurementLogs.map((log, i) => (
                  <div key={log.id} onClick={() => startEditMeasurement(log)} className="bg-surface rounded-2xl p-5 animate-stagger-in cursor-pointer hover:bg-surface-hover transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {log.weight_kg !== null && `${log.weight_kg} kg`}
                            {log.weight_kg !== null && log.height_cm !== null && ' · '}
                            {log.height_cm !== null && `${log.height_cm} cm`}
                          </span>
                          <TimeStamp time={log.logged_at} />
                        </div>
                        {log.notes && (
                          <p className="text-xs text-text-tertiary mt-1">{log.notes}</p>
                        )}
                      </div>
                      <DeleteButton type="measurement" id={log.id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Floating Add Button (hidden on Habits tab) */}
      {fabAction && (
        <button
          onClick={fabAction}
          className="fixed bottom-24 right-6 w-14 h-14 bg-accent hover:bg-accent-hover text-accent-fg rounded-full shadow-lg flex items-center justify-center transition-all active:scale-[0.98] z-40"
          aria-label={`Add ${tab} log`}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('log.deleteLog')}
        message={t('log.deleteConfirm')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.delete')}
      />

      {/* Food Modal */}
      {modal === 'food' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85dvh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingFood ? t('log.editDiet') : t('log.addDiet')}</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {mealOptions.map(({ value, label }) => (
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
                placeholder={t('log.whatDidYouEat')}
                autoFocus
              />
              <input
                type="number"
                min="0"
                max="20000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className={inputClass}
                placeholder={t('log.calories')}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.proteinG')}
                />
                <input
                  type="number"
                  min="0"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.carbsG')}
                />
                <input
                  type="number"
                  min="0"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.fatG')}
                />
              </div>
              <button
                onClick={saveFoodLog}
                disabled={saving || !description.trim() || !calories}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85dvh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingExercise ? t('log.editExercise') : t('log.addExercise')}</h2>

            <div className="space-y-3">
              <input
                type="text"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                className={inputClass}
                placeholder={t('log.exerciseType')}
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
                  placeholder={t('log.durationMin')}
                />
                <input
                  type="number"
                  min="0"
                  max="20000"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200"
                  placeholder={t('log.caloriesBurned')}
                />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                placeholder={t('log.notesOptional')}
              />
              <button
                onClick={saveExerciseLog}
                disabled={saving || !exerciseType.trim() || !duration}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drink Modal */}
      {modal === 'drink' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85dvh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingDrink ? t('drink.editDrink') : t('drink.addDrink')}</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {DRINK_TYPES.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setDrinkType(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                    drinkType === value
                      ? 'bg-blue-500 text-white'
                      : 'bg-surface-secondary text-text-muted'
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={drinkDescription}
                onChange={(e) => setDrinkDescription(e.target.value)}
                className={inputClass}
                placeholder={t('drink.whatDidYouDrink')}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={drinkVolume}
                  onChange={(e) => setDrinkVolume(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200"
                  placeholder={t('drink.volumeMl')}
                />
                <input
                  type="number"
                  min="0"
                  max="20000"
                  value={drinkCalories}
                  onChange={(e) => setDrinkCalories(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200"
                  placeholder={t('log.calories')}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  value={drinkProtein}
                  onChange={(e) => setDrinkProtein(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.proteinG')}
                />
                <input
                  type="number"
                  min="0"
                  value={drinkCarbs}
                  onChange={(e) => setDrinkCarbs(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.carbsG')}
                />
                <input
                  type="number"
                  min="0"
                  value={drinkFat}
                  onChange={(e) => setDrinkFat(e.target.value)}
                  className="px-3 py-3 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('log.fatG')}
                />
              </div>
              <button
                onClick={saveDrinkLog}
                disabled={saving || !drinkDescription.trim()}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement Modal */}
      {modal === 'measurement' && (
        <div className="fixed inset-0 bg-overlay z-[60] flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-surface w-full max-w-lg rounded-t-3xl p-6 pb-8 max-h-[85dvh] overflow-y-auto animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text-primary mb-4">{editingMeasurement ? t('log.editMeasurement') : t('log.addMeasurement')}</h2>

            <div className="space-y-3">
              <input
                type="number"
                min="50"
                max="300"
                step="0.1"
                value={measureHeightCm}
                onChange={(e) => setMeasureHeightCm(e.target.value)}
                className={inputClass}
                placeholder={t('log.heightCm')}
                autoFocus
              />
              <input
                type="number"
                min="10"
                max="500"
                step="0.1"
                value={measureWeightKg}
                onChange={(e) => setMeasureWeightKg(e.target.value)}
                className={inputClass}
                placeholder={t('log.weightKg')}
              />
              <input
                type="text"
                value={measureNotes}
                onChange={(e) => setMeasureNotes(e.target.value)}
                className={inputClass}
                placeholder={t('log.notesOptional')}
              />
              <button
                onClick={saveMeasurementLog}
                disabled={saving || (!measureHeightCm && !measureWeightKg)}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
