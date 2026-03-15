'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import type { Period } from '@/lib/utils';
import DateNav from '@/components/DateNav';
import { computeNutritionTargets } from '@/lib/nutrition';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import EmojiPicker from '@/components/EmojiPicker';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HabitWithLog, FoodLog, ExerciseLog, Profile } from '@/lib/types';

function HabitCardContent({ habit, isDragging }: { habit: HabitWithLog; isDragging?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-text-tertiary">
        <circle cx="7" cy="5" r="1.5" fill="currentColor" />
        <circle cx="17" cy="5" r="1.5" fill="currentColor" />
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
        <circle cx="7" cy="19" r="1.5" fill="currentColor" />
        <circle cx="17" cy="19" r="1.5" fill="currentColor" />
      </svg>
      <span className="text-base leading-none shrink-0">{habit.emoji}</span>
      <span className={cn('text-xs font-medium leading-snug flex-1 min-w-0', isDragging ? 'text-text-primary' : 'text-text-secondary')}>
        {habit.name}
      </span>
    </div>
  );
}

function SortableHabitCard({ habit, onEdit }: { habit: HabitWithLog; onEdit: (h: HabitWithLog) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(habit)}
      className="bg-surface rounded-xl px-3 py-2.5 text-left transition-colors touch-manipulation cursor-grab active:cursor-grabbing"
    >
      <HabitCardContent habit={habit} />
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [date, setDate] = useState(getToday());
  const [period, setPeriod] = useState<Period>('day');
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
  const [activeHabit, setActiveHabit] = useState<HabitWithLog | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const dragged = habits.find((h) => h.id === event.active.id);
    if (dragged) setActiveHabit(dragged);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveHabit(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !user) return;

    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);

    // Optimistic update
    setHabits(reordered);

    // Persist new sort_order
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((h, i) =>
        supabase.from('habits').update({ sort_order: i }).eq('id', h.id)
      )
    );
    if (results.some((r) => r.error)) {
      showToast('error', 'Failed to save order');
      fetchData();
    }
  };

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
          daily_calorie_offset: 0,
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
  const totalExerciseMinutes = exerciseLogs.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalCaloriesBurned = exerciseLogs.reduce((sum, e) => sum + e.calories_burned, 0);
  const netCalories = totalCalories - totalCaloriesBurned;

  const mealBreakdown = {
    breakfast: foodLogs.filter((f) => f.meal_type === 'breakfast').reduce((s, f) => s + f.calories, 0),
    lunch: foodLogs.filter((f) => f.meal_type === 'lunch').reduce((s, f) => s + f.calories, 0),
    dinner: foodLogs.filter((f) => f.meal_type === 'dinner').reduce((s, f) => s + f.calories, 0),
    snack: foodLogs.filter((f) => f.meal_type === 'snack').reduce((s, f) => s + f.calories, 0),
  };

  // Filtered values when a meal is selected
  const filteredLogs = selectedMeal ? foodLogs.filter((f) => f.meal_type === selectedMeal) : foodLogs;
  const displayCalories = selectedMeal ? mealBreakdown[selectedMeal as keyof typeof mealBreakdown] : totalCalories;
  const displayProtein = filteredLogs.reduce((sum, f) => sum + (f.protein_g || 0), 0);
  const displayCarbs = filteredLogs.reduce((sum, f) => sum + (f.carbs_g || 0), 0);
  const displayFat = filteredLogs.reduce((sum, f) => sum + (f.fat_g || 0), 0);

  const targets = profile ? computeNutritionTargets(profile) : null;
  const hasBodyStats = targets?.hasData ?? false;
  const calorieTarget = targets?.calorieTarget ?? 0;
  const caloriePercent = calorieTarget > 0 ? Math.min((displayCalories / calorieTarget) * 100, 100) : 0;

  return (
    <div className="max-w-lg mx-auto px-4">
      {ToastContainer}
      <div className="sticky top-0 z-20 bg-bg flex items-center justify-between pb-4 -mx-4 px-4 pt-6">
        <h1 className="text-xl font-bold text-text-primary">Overview</h1>
        <DateNav date={date} onDateChange={setDate} period={period} onPeriodChange={setPeriod} showPeriodPicker />
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
              <div className="bg-surface rounded-2xl p-5 mb-3 animate-fade-in">
                <div className="flex gap-2 mb-3">
                  <EmojiPicker value={newHabitEmoji} onChange={setNewHabitEmoji} />
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring"
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
              <div className="bg-surface rounded-2xl p-6 text-center">
                <p className="text-text-tertiary text-sm">No habits yet. Tap Add to create one!</p>
              </div>
            ) : editMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={habits.map((h) => h.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-2">
                    {habits.map((habit) =>
                      editingId === habit.id ? (
                        <div
                          key={habit.id}
                          className="col-span-2 bg-surface rounded-2xl p-4 animate-fade-in"
                        >
                          <div className="flex gap-2 mb-3">
                            <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-xl-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring text-sm"
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
                        <SortableHabitCard key={habit.id} habit={habit} onEdit={startEditing} />
                      )
                    )}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeHabit ? (
                    <div className="bg-surface rounded-xl px-3 py-2.5 shadow-lg scale-105">
                      <HabitCardContent habit={activeHabit} isDragging />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
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
                      <span className={cn('text-xs font-medium leading-snug flex-1 min-w-0', habit.completed ? 'text-positive-text' : 'text-text-secondary')}>
                        {habit.name}
                      </span>
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
          </section>

          {/* Diet Section */}
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '50ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Diet</h2>
            <div className="bg-surface rounded-2xl p-5">
              {/* Calorie Summary */}
              {hasBodyStats ? (
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-text-primary transition-all duration-300">{displayCalories}</span>
                      <span className="text-sm text-text-tertiary">cal</span>
                    </div>
                    {selectedMeal ? (
                      <span className="text-xs text-accent-text font-medium">
                        {selectedMeal === 'snack' ? 'Other' : selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)} only
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">
                        of {targets!.calorieRange.min}–{targets!.calorieRange.max}
                      </span>
                    )}
                  </div>
                  {!selectedMeal && (
                    <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          totalCalories > targets!.calorieRange.max ? 'bg-warning-bar' :
                          totalCalories >= targets!.calorieRange.min ? 'bg-positive-bar' : 'bg-accent'
                        )}
                        style={{ width: `${caloriePercent}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-bold text-text-primary transition-all duration-300">{displayCalories}</p>
                    <span className="text-sm text-text-tertiary">cal</span>
                  </div>
                  {selectedMeal ? (
                    <p className="text-xs text-accent-text font-medium mt-0.5">
                      {selectedMeal === 'snack' ? 'Other' : selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)} only
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-text-tertiary mt-0.5">eaten today</p>
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Add your stats in Profile to see your calorie range
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Meal Breakdown */}
              <div className="grid grid-cols-4 gap-2">
                {([['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Other']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedMeal(selectedMeal === key ? null : key)}
                    className={cn(
                      'text-center rounded-lg py-1.5 transition-all duration-200',
                      selectedMeal === key
                        ? 'bg-accent text-accent-fg'
                        : 'hover:bg-surface-secondary active:scale-[0.97]'
                    )}
                  >
                    <p className={cn('text-[11px]', selectedMeal === key ? 'text-accent-fg/70' : 'text-text-tertiary')}>{label}</p>
                    <p className={cn('text-sm font-semibold', selectedMeal === key ? 'text-accent-fg' : 'text-text-label')}>{mealBreakdown[key]}</p>
                  </button>
                ))}
              </div>

              {/* Nutrition subsection */}
              {hasBodyStats && targets && (
                <div className="border-t border-border-strong mt-4 pt-4">
                  {!selectedMeal && (
                    <div className="flex items-baseline gap-1.5 mb-4 text-xs text-text-tertiary">
                      <span className="font-medium">TDEE ~{targets.tdee}</span>
                      <span>·</span>
                      <span className={cn(
                        'font-semibold',
                        targets.calorieOffset < -50 ? 'text-info' :
                        targets.calorieOffset > 50 ? 'text-warning' : 'text-positive-text'
                      )}>
                        {targets.deltaLabel}
                      </span>
                      {totalCaloriesBurned > 0 && (
                        <>
                          <span>·</span>
                          <span>{totalCalories} in · {totalCaloriesBurned} out · {netCalories} net</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Macro Bars */}
                  <div className={cn('space-y-3', selectedMeal && 'mt-0')}>
                    {[
                      { ...targets.protein, eaten: displayProtein, color: 'bg-info-bar' },
                      { ...targets.carbs, eaten: displayCarbs, color: 'bg-macro-carbs' },
                      { ...targets.fat, eaten: displayFat, color: 'bg-macro-fat' },
                    ].map((macro) => {
                      const midTarget = (macro.min + macro.max) / 2;
                      const percent = midTarget > 0 ? Math.min((macro.eaten / midTarget) * 100, 100) : 0;
                      const macroInRange = macro.eaten >= macro.min && macro.eaten <= macro.max;
                      const over = macro.eaten > macro.max;

                      return (
                        <div key={macro.label}>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-xs font-medium text-text-muted">{macro.label}</span>
                            <span className="text-xs text-text-tertiary">
                              <span className={cn(
                                'font-semibold transition-all duration-300',
                                macroInRange ? 'text-positive-text' : over ? 'text-warning' : 'text-text-label'
                              )}>
                                {macro.eaten}g
                              </span>
                              {!selectedMeal && (
                                <>
                                  {' / '}
                                  {macro.min}–{macro.max}g
                                </>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-surface-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                macroInRange ? 'bg-positive-bar' : over ? 'bg-warning-bar' : macro.color
                              )}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Exercise Section */}
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Exercise</h2>
            <div className="bg-surface rounded-2xl p-5">
              {exerciseLogs.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center">No exercise logged today</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-text-primary">
                        {totalExerciseMinutes}
                        <span className="text-sm font-normal text-text-tertiary ml-1">min</span>
                      </p>
                    </div>
                    <div className="w-px h-10 bg-border-strong" />
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-text-primary">
                        {totalCaloriesBurned}
                        <span className="text-sm font-normal text-text-tertiary ml-1">cal</span>
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-border-strong mt-4 pt-4 space-y-2">
                    {exerciseLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">{log.exercise_type}</p>
                        <p className="text-xs text-text-secondary">
                          {log.duration_minutes} min · {log.calories_burned} cal
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
