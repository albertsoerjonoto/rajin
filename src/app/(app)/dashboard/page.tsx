'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn, getDateRange, getDatesInRange } from '@/lib/utils';
import type { Period } from '@/lib/utils';
import DateNav from '@/components/DateNav';
import { computeNutritionTargets } from '@/lib/nutrition';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import EmojiPicker from '@/components/EmojiPicker';
import { useLocale } from '@/lib/i18n';
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
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { HabitWithLog, FoodLog, ExerciseLog, DrinkLog, HabitLog, MeasurementLog, Profile, FriendProfile, SharedHabit, HabitStreak } from '@/lib/types';
import { updateHabitStreak, isStreakMilestone, calculateStreak } from '@/lib/streaks';
import { buildDayDataMap } from '@/components/analytics/types';
import type { DayData } from '@/components/analytics/types';
import StreakCard from '@/components/analytics/StreakCard';
import HabitHeatmap from '@/components/analytics/HabitHeatmap';
import CalorieBarChart from '@/components/analytics/CalorieBarChart';
import MacroDonutChart from '@/components/analytics/MacroDonutChart';
import ExerciseChart from '@/components/analytics/ExerciseChart';
import WaterProgressChart from '@/components/analytics/WaterProgressChart';
import WeightTrendChart from '@/components/analytics/WeightTrendChart';
import HabitBreakdown from '@/components/analytics/HabitBreakdown';

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
      {habit.is_private && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-tertiary">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
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

function ComparisonBadge({ current, previous, invert }: { current: number; previous: number; unit?: string; invert?: boolean }) {
  if (previous === 0 && current === 0) return null;
  const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
  if (diff === 0) return <span className="text-text-tertiary">{' '}→</span>;
  const isUp = diff > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span className={cn('text-[10px] font-medium', isGood ? 'text-positive-text' : 'text-warning')}>
      {' '}{isUp ? '↑' : '↓'} {Math.abs(diff)}%
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const { t } = useLocale();
  const [date, setDate] = useState(getToday());
  const [period, setPeriod] = useState<Period>('day');
  const [habits, setHabits] = useState<HabitWithLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('⭐');
  const [newHabitPrivate, setNewHabitPrivate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [activeHabit, setActiveHabit] = useState<HabitWithLog | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [acceptedFriends, setAcceptedFriends] = useState<FriendProfile[]>([]);
  const [sharedHabits, setSharedHabits] = useState<SharedHabit[]>([]);
  const [streakMap, setStreakMap] = useState<Record<string, HabitStreak>>({});

  // Analytics state (for period != day)
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [allHabitLogs, setAllHabitLogs] = useState<{ date: string; completed: number; total: number }[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementLog[]>([]);
  const [prevPeriodData, setPrevPeriodData] = useState<{ foodLogs: FoodLog[]; exerciseLogs: ExerciseLog[]; drinkLogs: DrinkLog[]; habitLogs: HabitLog[] } | null>(null);
  const [totalHabits, setTotalHabits] = useState(0);

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

    setHabits(reordered);

    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((h, i) =>
        supabase.from('habits').update({ sort_order: i }).eq('id', h.id)
      )
    );
    if (results.some((r) => r.error)) {
      showToast('error', t('dashboard.failedSaveOrder'));
      fetchData();
    }
  };

  const range = useMemo(() => getDateRange(date, period), [date, period]);
  const dates = useMemo(() => getDatesInRange(range.start, range.end), [range]);

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
          calorie_offset_min: -200,
          calorie_offset_max: 200,
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
      showToast('error', t('dashboard.failedLoadHabits'));
    }

    const activeHabitCount = habitsData?.length ?? 0;
    setTotalHabits(activeHabitCount);

    if (period === 'day') {
      // Single day fetch (existing behavior)
      const { data: logsData } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date);

      if (habitsData) {
        const habitsWithLogs: HabitWithLog[] = habitsData.map((habit) => {
          const log = logsData?.find((l) => l.habit_id === habit.id);
          return { ...habit, completed: log?.completed ?? false, log_id: log?.id, logged_at: log?.logged_at };
        });
        setHabits(habitsWithLogs);
      }

      const { data: foodData, error: foodError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at');
      if (foodError) showToast('error', t('dashboard.failedLoadFood'));
      if (foodData) setFoodLogs(foodData);

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at');
      if (exerciseError) showToast('error', t('dashboard.failedLoadExercise'));
      if (exerciseData) setExerciseLogs(exerciseData);

      const { data: drinkData, error: drinkError } = await supabase
        .from('drink_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at');
      if (drinkError) showToast('error', t('dashboard.failedLoadDrinks'));
      if (drinkData) setDrinkLogs(drinkData);
    } else {
      // Range fetch for analytics
      const { start, end } = range;

      const [foodRes, exerciseRes, drinkRes, habitLogRes, measurementRes] = await Promise.all([
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end).order('created_at'),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end).order('created_at'),
        supabase.from('drink_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end).order('created_at'),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('measurement_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end).order('date'),
      ]);

      if (foodRes.data) setFoodLogs(foodRes.data);
      if (exerciseRes.data) setExerciseLogs(exerciseRes.data);
      if (drinkRes.data) setDrinkLogs(drinkRes.data);
      if (habitLogRes.data) setHabitLogs(habitLogRes.data);
      if (measurementRes.data) setMeasurements(measurementRes.data);

      // Fetch all habit_logs for streak calculation (last 365 days)
      const streakStart = new Date();
      streakStart.setFullYear(streakStart.getFullYear() - 1);
      const streakStartStr = streakStart.toISOString().split('T')[0];
      const { data: allHLogs } = await supabase
        .from('habit_logs')
        .select('date, completed')
        .eq('user_id', user.id)
        .gte('date', streakStartStr)
        .eq('completed', true);

      if (allHLogs && activeHabitCount > 0) {
        // Group by date
        const dateMap = new Map<string, number>();
        for (const hl of allHLogs) {
          dateMap.set(hl.date, (dateMap.get(hl.date) ?? 0) + 1);
        }
        const sorted = [...dateMap.entries()]
          .map(([d, count]) => ({ date: d, completed: count, total: activeHabitCount }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setAllHabitLogs(sorted);
      } else {
        setAllHabitLogs([]);
      }

      // Fetch previous period data for comparisons (week/month only)
      if (period === 'week' || period === 'month') {
        let prevDateStr: string;
        if (period === 'week') {
          prevDateStr = new Date(new Date(start + 'T12:00:00Z').getTime() - 7 * 86400000).toISOString().split('T')[0];
        } else {
          const d = new Date(start + 'T12:00:00Z');
          d.setUTCMonth(d.getUTCMonth() - 1);
          prevDateStr = d.toISOString().split('T')[0];
        }
        const prevRange = getDateRange(prevDateStr, period);

        const [prevFood, prevExercise, prevDrink, prevHabit] = await Promise.all([
          supabase.from('food_logs').select('*').eq('user_id', user.id).gte('date', prevRange.start).lte('date', prevRange.end),
          supabase.from('exercise_logs').select('*').eq('user_id', user.id).gte('date', prevRange.start).lte('date', prevRange.end),
          supabase.from('drink_logs').select('*').eq('user_id', user.id).gte('date', prevRange.start).lte('date', prevRange.end),
          supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', prevRange.start).lte('date', prevRange.end),
        ]);

        setPrevPeriodData({
          foodLogs: prevFood.data ?? [],
          exerciseLogs: prevExercise.data ?? [],
          drinkLogs: prevDrink.data ?? [],
          habitLogs: prevHabit.data ?? [],
        });
      } else {
        setPrevPeriodData(null);
      }

      if (habitsData) {
        const habitsWithLogs: HabitWithLog[] = habitsData.map((habit) => ({
          ...habit,
          completed: false,
          log_id: undefined,
          logged_at: undefined,
        }));
        setHabits(habitsWithLogs);
      }
    }

    setLoading(false);
  }, [user, date, period, range, showToast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load accepted friends and shared habits for the share modal
  useEffect(() => {
    if (!user) return;
    const sb = createClient();
    sb.from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .then(async ({ data }) => {
        if (!data) return;
        const otherIds = data.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
        if (otherIds.length === 0) return;
        const { data: profiles } = await sb.from('profiles').select('id, username, display_name, avatar_url').in('id', otherIds);
        setAcceptedFriends((profiles ?? []) as FriendProfile[]);
      });
    sb.from('shared_habits')
      .select('*')
      .or(`owner_id.eq.${user.id},friend_id.eq.${user.id}`)
      .then(({ data }) => {
        setSharedHabits((data ?? []) as SharedHabit[]);
      });
    // Calculate streaks from actual habit_logs instead of cached habit_streaks
    // so that missed days correctly reset the streak to 0
    sb.from('habit_logs')
      .select('habit_id, date, completed')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('date', { ascending: false })
      .limit(5000)
      .then(({ data: logs }) => {
        if (!logs) return;
        const today = getToday();
        const logsByHabit = new Map<string, { date: string; completed: boolean }[]>();
        for (const log of logs) {
          const arr = logsByHabit.get(log.habit_id) ?? [];
          arr.push({ date: log.date, completed: log.completed });
          logsByHabit.set(log.habit_id, arr);
        }
        const map: Record<string, HabitStreak> = {};
        for (const [habitId, habitLogs] of logsByHabit) {
          const { current, longest, lastCompleted } = calculateStreak(habitLogs, today);
          map[habitId] = {
            habit_id: habitId,
            user_id: user.id,
            current_streak: current,
            longest_streak: longest,
            last_completed_date: lastCompleted,
          } as HabitStreak;
        }
        setStreakMap(map);
      });
  }, [user]);

  const shareHabit = async (habitId: string, friendId: string) => {
    if (!user) return;
    const sb = createClient();
    const { error } = await sb.from('shared_habits').insert({
      habit_id: habitId,
      owner_id: user.id,
      friend_id: friendId,
    });
    if (error) {
      showToast('error', t('friends.failedShare'));
      return;
    }
    showToast('success', t('friends.habitShared'));
    setShowShareModal(null);
    const { data } = await sb.from('shared_habits').select('*').or(`owner_id.eq.${user.id},friend_id.eq.${user.id}`);
    setSharedHabits((data ?? []) as SharedHabit[]);
  };

  const getSharedFriendsForHabit = (habitId: string): FriendProfile[] => {
    const accepted = sharedHabits.filter(sh => sh.habit_id === habitId && sh.status === 'accepted');
    const friendIds = accepted.map(sh => sh.owner_id === user?.id ? sh.friend_id : sh.owner_id);
    return acceptedFriends.filter(f => friendIds.includes(f.id));
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
          prev.map((h) => (h.id === habit.id ? { ...h, log_id: undefined } : h))
        );
        // Delete feed events for this habit today (completion + streak milestone)
        Promise.resolve(
          supabase
            .from('feed_events')
            .delete()
            .eq('user_id', user.id)
            .in('event_type', ['habit_completed', 'streak_milestone'])
            .gte('created_at', new Date(date + 'T00:00:00').toISOString())
            .lte('created_at', new Date(date + 'T23:59:59').toISOString())
            .contains('data', { habit_id: habit.id })
        ).catch(console.warn);
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
      // Update streak and create feed events in background
      updateHabitStreak(user.id, habit.id, date).then(async (streakData) => {
        if (streakData) {
          setStreakMap(prev => ({ ...prev, [habit.id]: streakData }));
        }
        // Create feed events only when completing (not uncompleting)
        if (!wasCompleted && !habit.is_private) {
          const sb = createClient();
          await sb.from('feed_events').insert({
            user_id: user.id,
            event_type: 'habit_completed',
            data: { habit_id: habit.id, habit_name: habit.name, habit_emoji: habit.emoji },
            is_private: false,
          });
          if (streakData && isStreakMilestone(streakData.current_streak)) {
            await sb.from('feed_events').insert({
              user_id: user.id,
              event_type: 'streak_milestone',
              data: { habit_id: habit.id, habit_name: habit.name, habit_emoji: habit.emoji, streak: streakData.current_streak },
              is_private: false,
            });
          }
        }
      }).catch(console.warn);
    } catch {
      setHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? { ...h, completed: wasCompleted } : h))
      );
      showToast('error', t('dashboard.failedUpdateHabit'));
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
      is_private: newHabitPrivate,
    });

    if (error) {
      showToast('error', t('dashboard.failedAddHabit'));
      return;
    }

    setNewHabitName('');
    setNewHabitEmoji('⭐');
    setNewHabitPrivate(false);
    setShowAddHabit(false);
    fetchData();
  };

  const startEditing = (habit: HabitWithLog) => {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditEmoji(habit.emoji);
    setEditPrivate(habit.is_private);
  };

  const saveEdit = async () => {
    if (!user || !editingId || !editName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('habits')
      .update({ name: editName.trim(), emoji: editEmoji || '⭐', is_private: editPrivate })
      .eq('id', editingId);
    if (error) {
      showToast('error', t('dashboard.failedUpdateHabit'));
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
      showToast('error', t('dashboard.failedDeleteHabit'));
      return;
    }
    setEditingId(null);
    fetchData();
  };

  // Day view computations
  const totalFoodCalories = foodLogs.reduce((sum, f) => sum + f.calories, 0);
  const totalDrinkCalories = drinkLogs.reduce((sum, d) => sum + d.calories, 0);
  const totalCalories = totalFoodCalories + totalDrinkCalories;
  const totalExerciseMinutes = exerciseLogs.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalCaloriesBurned = exerciseLogs.reduce((sum, e) => sum + e.calories_burned, 0);
  const netCalories = totalCalories - totalCaloriesBurned;

  const totalWaterMl = drinkLogs.filter((d) => d.drink_type === 'water').reduce((sum, d) => sum + d.volume_ml, 0);
  const waterGoalMl = profile?.daily_water_goal_ml ?? 2000;

  const categoryBreakdown = {
    breakfast: foodLogs.filter((f) => f.meal_type === 'breakfast').reduce((s, f) => s + f.calories, 0),
    lunch: foodLogs.filter((f) => f.meal_type === 'lunch').reduce((s, f) => s + f.calories, 0),
    dinner: foodLogs.filter((f) => f.meal_type === 'dinner').reduce((s, f) => s + f.calories, 0),
    snacks: foodLogs.filter((f) => f.meal_type === 'snack').reduce((s, f) => s + f.calories, 0),
    drinks: totalDrinkCalories,
  };

  const filteredLogs = selectedMeal === 'drinks'
    ? []
    : selectedMeal
      ? selectedMeal === 'snacks'
        ? foodLogs.filter((f) => f.meal_type === 'snack')
        : foodLogs.filter((f) => f.meal_type === selectedMeal)
      : foodLogs;
  const displayCalories = selectedMeal ? categoryBreakdown[selectedMeal as keyof typeof categoryBreakdown] : netCalories;
  const displayProtein = selectedMeal === 'drinks'
    ? drinkLogs.reduce((sum, d) => sum + (d.protein_g || 0), 0)
    : filteredLogs.reduce((sum, f) => sum + (f.protein_g || 0), 0);
  const displayCarbs = selectedMeal === 'drinks'
    ? drinkLogs.reduce((sum, d) => sum + (d.carbs_g || 0), 0)
    : filteredLogs.reduce((sum, f) => sum + (f.carbs_g || 0), 0);
  const displayFat = selectedMeal === 'drinks'
    ? drinkLogs.reduce((sum, d) => sum + (d.fat_g || 0), 0)
    : filteredLogs.reduce((sum, f) => sum + (f.fat_g || 0), 0);

  const targets = profile ? computeNutritionTargets(profile) : null;
  const hasBodyStats = targets?.hasData ?? false;
  const calorieTarget = targets?.calorieTarget ?? 0;
  const caloriePercent = calorieTarget > 0 ? Math.min((Math.max(displayCalories, 0) / calorieTarget) * 100, 100) : 0;
  const isOverBudget = !selectedMeal && calorieTarget > 0 && netCalories > calorieTarget;
  const remainingCalories = calorieTarget - netCalories;

  const categoryKeys = [
    { key: 'breakfast', labelKey: 'dashboard.breakfast' },
    { key: 'lunch', labelKey: 'dashboard.lunch' },
    { key: 'dinner', labelKey: 'dashboard.dinner' },
    { key: 'snacks', labelKey: 'dashboard.snacks' },
    { key: 'drinks', labelKey: 'dashboard.drinks' },
  ] as const;

  const macroLabel = (key: string) => {
    if (key === 'Protein') return t('nutrition.protein');
    if (key === 'Carbs') return t('nutrition.carbs');
    if (key === 'Fat') return t('nutrition.fat');
    return key;
  };

  const deltaLabel = targets ? (
    targets.calorieOffsetMin >= -50 && targets.calorieOffsetMax <= 50
      ? t('nutrition.maintenance')
      : targets.calorieOffsetMax <= 0
        ? (() => {
            const absMin = Math.abs(targets.calorieOffsetMin);
            const absMax = Math.abs(targets.calorieOffsetMax);
            return absMin === absMax
              ? `${absMin} ${t('nutrition.calDeficit')}`
              : `${Math.min(absMin, absMax)}–${Math.max(absMin, absMax)} ${t('nutrition.calDeficit')}`;
          })()
        : targets.calorieOffsetMin >= 0
          ? (() => {
              return targets.calorieOffsetMin === targets.calorieOffsetMax
                ? `${targets.calorieOffsetMax} ${t('nutrition.calSurplus')}`
                : `${Math.min(targets.calorieOffsetMin, targets.calorieOffsetMax)}–${Math.max(targets.calorieOffsetMin, targets.calorieOffsetMax)} ${t('nutrition.calSurplus')}`;
            })()
          : `±${Math.max(Math.abs(targets.calorieOffsetMin), Math.abs(targets.calorieOffsetMax))} ${t('common.cal')}`
  ) : '';

  // Analytics computations
  const dayDataMap = useMemo(() => {
    if (period === 'day') return new Map<string, DayData>();
    return buildDayDataMap(dates, foodLogs, exerciseLogs, drinkLogs, habitLogs, totalHabits);
  }, [period, dates, foodLogs, exerciseLogs, drinkLogs, habitLogs, totalHabits]);

  const prevDayDataMap = useMemo(() => {
    if (!prevPeriodData) return null;
    const prevDates = getDatesInRange(
      period === 'week'
        ? getDateRange(new Date(new Date(range.start + 'T12:00:00Z').getTime() - 7 * 86400000).toISOString().split('T')[0], period).start
        : (() => {
            const d = new Date(range.start + 'T12:00:00Z');
            d.setUTCMonth(d.getUTCMonth() - 1);
            return getDateRange(d.toISOString().split('T')[0], period).start;
          })(),
      period === 'week'
        ? getDateRange(new Date(new Date(range.start + 'T12:00:00Z').getTime() - 7 * 86400000).toISOString().split('T')[0], period).end
        : (() => {
            const d = new Date(range.start + 'T12:00:00Z');
            d.setUTCMonth(d.getUTCMonth() - 1);
            return getDateRange(d.toISOString().split('T')[0], period).end;
          })(),
    );
    return buildDayDataMap(prevDates, prevPeriodData.foodLogs, prevPeriodData.exerciseLogs, prevPeriodData.drinkLogs, prevPeriodData.habitLogs, totalHabits);
  }, [prevPeriodData, period, range, totalHabits]);

  const comparisonStats = useMemo(() => {
    if (!prevDayDataMap || period === 'year') return null;
    const current = Array.from(dayDataMap.values());
    const prev = Array.from(prevDayDataMap.values());
    const curCount = current.length || 1;
    const prevCount = prev.length || 1;

    const curAvgCal = Math.round(current.reduce((s, d) => s + d.totalCalories, 0) / curCount);
    const prevAvgCal = Math.round(prev.reduce((s, d) => s + d.totalCalories, 0) / prevCount);

    const curHabitPossible = current.reduce((s, d) => s + d.habitsTotal, 0);
    const curHabitDone = current.reduce((s, d) => s + d.habitsCompleted, 0);
    const prevHabitPossible = prev.reduce((s, d) => s + d.habitsTotal, 0);
    const prevHabitDone = prev.reduce((s, d) => s + d.habitsCompleted, 0);
    const curHabitPct = curHabitPossible > 0 ? Math.round((curHabitDone / curHabitPossible) * 100) : 0;
    const prevHabitPct = prevHabitPossible > 0 ? Math.round((prevHabitDone / prevHabitPossible) * 100) : 0;

    const curActiveDays = current.filter((d) => d.exerciseLogs.length > 0).length;
    const prevActiveDays = prev.filter((d) => d.exerciseLogs.length > 0).length;

    return { curAvgCal, prevAvgCal, curHabitPct, prevHabitPct, curActiveDays, prevActiveDays };
  }, [dayDataMap, prevDayDataMap, period]);

  const isAnalyticsView = period !== 'day';
  const { isExpanded } = useDesktopLayout();

  return (
    <div className={cn('max-w-lg mx-auto px-4', isExpanded && 'lg:max-w-5xl lg:px-8')}>
      {ToastContainer}
      <div className="sticky top-0 z-20 bg-bg flex items-center justify-between pb-4 -mx-4 px-4 pt-6">
        <h1 className="text-xl font-bold text-text-primary">{t('nav.overview')}</h1>
        <DateNav date={date} onDateChange={setDate} period={period} onPeriodChange={setPeriod} showPeriodPicker />
      </div>

      {loading ? (
        <PageSkeleton />
      ) : isAnalyticsView ? (
        /* ──── Analytics View (Week / Month / Year) ──── */
        <div className={cn('space-y-4 pb-6', isExpanded && 'lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0')}>
          {/* Comparison Stats */}
          {comparisonStats && (
            <div className={cn('bg-surface rounded-xl p-4 shadow-sm animate-fade-in', isExpanded && 'lg:col-span-2')}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-text-tertiary leading-tight">{t('analytics.avgDailyIntake')}</p>
                  <p className="text-lg font-bold text-text-primary">{comparisonStats.curAvgCal}</p>
                  <p className="text-[10px] text-text-tertiary">{t('common.cal')}{t('analytics.perDay')}</p>
                  <ComparisonBadge current={comparisonStats.curAvgCal} previous={comparisonStats.prevAvgCal} invert />
                </div>
                <div>
                  <p className="text-[10px] text-text-tertiary leading-tight">{t('analytics.habitCompletionRate')}</p>
                  <p className="text-lg font-bold text-text-primary">{comparisonStats.curHabitPct}%</p>
                  <p className="text-[10px] text-text-tertiary">{t('analytics.of')} {t('analytics.days')}</p>
                  <ComparisonBadge current={comparisonStats.curHabitPct} previous={comparisonStats.prevHabitPct} />
                </div>
                <div>
                  <p className="text-[10px] text-text-tertiary leading-tight">{t('analytics.activeDays')}</p>
                  <p className="text-lg font-bold text-text-primary">{comparisonStats.curActiveDays}</p>
                  <p className="text-[10px] text-text-tertiary">{t('analytics.of')} {dates.length} {t('analytics.days')}</p>
                  <ComparisonBadge current={comparisonStats.curActiveDays} previous={comparisonStats.prevActiveDays} />
                </div>
              </div>
              <p className="text-[10px] text-text-tertiary text-center mt-2">
                {period === 'week' ? t('analytics.vsLastWeek') : t('analytics.vsLastMonth')}
              </p>
            </div>
          )}

          <StreakCard dayDataMap={dayDataMap} allHabitLogs={allHabitLogs} />

          <HabitHeatmap
            dayDataMap={dayDataMap}
            dates={dates}
            period={period as 'week' | 'month' | 'year'}
          />

          <CalorieBarChart
            dayDataMap={dayDataMap}
            dates={dates}
            period={period as 'week' | 'month' | 'year'}
            calorieTarget={calorieTarget}
          />

          <MacroDonutChart dayDataMap={dayDataMap} />

          <ExerciseChart
            dayDataMap={dayDataMap}
            dates={dates}
            period={period as 'week' | 'month' | 'year'}
          />

          <WaterProgressChart
            dayDataMap={dayDataMap}
            dates={dates}
            period={period as 'week' | 'month' | 'year'}
            waterGoalMl={waterGoalMl}
          />

          {habits.length > 0 && (
            <HabitBreakdown
              habits={habits}
              habitLogs={habitLogs}
              totalDays={dates.length}
            />
          )}

          {measurements.length > 0 && (
            <WeightTrendChart
              measurements={measurements}
              period={period as 'week' | 'month' | 'year'}
            />
          )}
        </div>
      ) : (
        /* ──── Day View (unchanged) ──── */
        <>
          {/* Habits Section */}
          <section className="mb-6 animate-stagger-in" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary">{t('dashboard.habits')}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowAddHabit(true); setEditMode(false); setEditingId(null); }} className="text-accent-text text-sm font-medium transition-all duration-200">
                  {t('common.add')}
                </button>
                {habits.length > 0 && (
                  <button
                    onClick={() => { setEditMode(!editMode); setEditingId(null); }}
                    className="text-accent-text text-sm font-medium transition-all duration-200"
                  >
                    {editMode ? t('common.done') : t('common.edit')}
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
                    placeholder={t('dashboard.habitPlaceholder')}
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setNewHabitPrivate(!newHabitPrivate)}>
                  <div
                    role="switch"
                    aria-checked={newHabitPrivate}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setNewHabitPrivate(!newHabitPrivate); } }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0',
                      newHabitPrivate ? 'bg-accent' : 'bg-surface-secondary'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200',
                      newHabitPrivate && 'translate-x-4'
                    )} />
                  </div>
                  <span className="text-xs text-text-secondary">{t('dashboard.privateHabit')}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddHabit(false)} className="flex-1 py-2 text-sm text-text-secondary rounded-xl hover:bg-surface-hover transition-all duration-200">
                    {t('common.cancel')}
                  </button>
                  <button onClick={addHabit} className="flex-1 py-2 text-sm text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 active:scale-[0.98]">
                    {t('dashboard.addHabit')}
                  </button>
                </div>
              </div>
            )}

            {habits.length === 0 && !showAddHabit ? (
              <div className="bg-surface rounded-2xl p-6 text-center">
                <p className="text-text-tertiary text-sm">{t('dashboard.noHabits')}</p>
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
                          <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setEditPrivate(!editPrivate)}>
                            <div
                              role="switch"
                              aria-checked={editPrivate}
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setEditPrivate(!editPrivate); } }}
                              className={cn(
                                'relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0',
                                editPrivate ? 'bg-accent' : 'bg-surface-secondary'
                              )}
                            >
                              <span className={cn(
                                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200',
                                editPrivate && 'translate-x-4'
                              )} />
                            </div>
                            <span className="text-xs text-text-secondary">{t('dashboard.privateHabit')}</span>
                          </div>
                          {!editPrivate && acceptedFriends.length > 0 && (
                            <div className="mb-3">
                              {showShareModal === habit.id ? (
                                <div className="space-y-1">
                                  <p className="text-xs text-text-secondary mb-1">{t('friends.selectFriend')}</p>
                                  {acceptedFriends
                                    .filter(f => !sharedHabits.some(sh => sh.habit_id === habit.id && (sh.friend_id === f.id || sh.owner_id === f.id)))
                                    .map(friend => (
                                      <button
                                        key={friend.id}
                                        onClick={() => shareHabit(habit.id, friend.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-secondary transition-colors text-left"
                                      >
                                        <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                                          {friend.avatar_url ? (
                                            <img src={friend.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                          ) : (
                                            <span className="text-[10px] font-semibold text-accent">{(friend.display_name ?? '?')[0].toUpperCase()}</span>
                                          )}
                                        </div>
                                        <span className="text-xs text-text-primary">{friend.display_name ?? friend.username}</span>
                                      </button>
                                    ))}
                                  <button
                                    onClick={() => setShowShareModal(null)}
                                    className="text-xs text-text-tertiary mt-1"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowShareModal(habit.id)}
                                  className="text-xs text-accent-text font-medium"
                                >
                                  {t('friends.shareHabit')}
                                </button>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => deleteHabit(habit.id)}
                              className="py-2 px-3 text-sm text-danger-text rounded-xl hover:bg-danger-surface transition-all duration-200"
                            >
                              {t('common.delete')}
                            </button>
                            <div className="flex-1" />
                            <button
                              onClick={() => setEditingId(null)}
                              className="py-2 px-3 text-sm text-text-secondary rounded-xl hover:bg-surface-hover transition-all duration-200"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={saveEdit}
                              className="py-2 px-4 text-sm text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 active:scale-[0.98]"
                            >
                              {t('common.save')}
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
                      {streakMap[habit.id]?.current_streak > 1 && (
                        <span className="text-[10px] font-semibold text-orange-500 shrink-0">
                          🔥{streakMap[habit.id].current_streak}
                        </span>
                      )}
                      {(() => {
                        const sharedFriends = getSharedFriendsForHabit(habit.id);
                        if (sharedFriends.length === 0) return null;
                        return (
                          <div className="flex -space-x-1 shrink-0">
                            {sharedFriends.slice(0, 2).map(f => (
                              <div key={f.id} className="w-4 h-4 rounded-full bg-accent/10 border border-surface flex items-center justify-center">
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                                ) : (
                                  <span className="text-[6px] font-bold text-accent">{(f.display_name ?? '?')[0].toUpperCase()}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {habit.is_private && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-tertiary">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
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

          {/* Diet + Exercise wrapper — side by side on desktop */}
          <div className={cn(isExpanded && 'lg:grid lg:grid-cols-3 lg:gap-6')}>
          {/* Diet Section */}
          <section className={cn('mb-6 animate-stagger-in', isExpanded && 'lg:col-span-2 lg:mb-0')} style={{ animationDelay: '50ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">{t('dashboard.diet')}</h2>
            <div className="bg-surface rounded-2xl p-5" data-tour="diet-card">
              {/* Calorie Summary */}
              {hasBodyStats ? (
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        'text-3xl font-bold transition-all duration-300',
                        selectedMeal ? 'text-text-primary' : isOverBudget ? 'text-warning' : 'text-text-primary'
                      )}>{displayCalories}</span>
                      <span className="text-sm text-text-tertiary">{t('common.cal')}</span>
                    </div>
                    {selectedMeal ? (
                      <span className="text-xs text-accent-text font-medium">
                        {t(`dashboard.${selectedMeal}`)} {t('dashboard.only')}
                      </span>
                    ) : (
                      <span className={cn('text-xs font-medium', isOverBudget ? 'text-warning' : 'text-positive-text')}>
                        {isOverBudget
                          ? `${Math.abs(remainingCalories)} ${t('common.cal')} ${t('dashboard.over')}`
                          : `${remainingCalories} ${t('common.cal')} ${t('dashboard.remaining')}`
                        }
                      </span>
                    )}
                  </div>
                  {!selectedMeal && (
                    <>
                      <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            netCalories > targets!.calorieRange.max ? 'bg-warning-bar' :
                            netCalories >= targets!.calorieRange.min ? 'bg-positive-bar' : 'bg-accent'
                          )}
                          style={{ width: `${caloriePercent}%` }}
                        />
                      </div>
                      {totalCaloriesBurned > 0 && (
                        <div className="flex items-center justify-between mt-2 text-xs text-text-tertiary">
                          <span>{t('dashboard.eaten')}: {totalCalories}</span>
                          <span>{t('dashboard.burned')}: -{totalCaloriesBurned}</span>
                          <span className="font-semibold text-text-secondary">{t('dashboard.netCal')}: {netCalories}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-bold text-text-primary transition-all duration-300">{displayCalories}</p>
                    <span className="text-sm text-text-tertiary">{t('common.cal')}</span>
                  </div>
                  {selectedMeal ? (
                    <p className="text-xs text-accent-text font-medium mt-0.5">
                      {t(`dashboard.${selectedMeal}`)} {t('dashboard.only')}
                    </p>
                  ) : (
                    <>
                      {totalCaloriesBurned > 0 ? (
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                          <span>{t('dashboard.eaten')}: {totalCalories}</span>
                          <span>{t('dashboard.burned')}: -{totalCaloriesBurned}</span>
                          <span className="font-semibold text-text-secondary">{t('dashboard.netCal')}: {netCalories}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-text-tertiary mt-0.5">{t('dashboard.eatenToday')}</p>
                      )}
                      <p className="text-[11px] text-text-tertiary mt-1">
                        {t('dashboard.addStatsHint')}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Category Breakdown */}
              <div className="grid grid-cols-5 gap-1">
                {categoryKeys.map(({ key, labelKey }) => (
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
                    <p className={cn('text-[11px]', selectedMeal === key ? 'text-accent-fg/70' : 'text-text-tertiary')}>{t(labelKey)}</p>
                    <p className={cn('text-sm font-semibold', selectedMeal === key ? 'text-accent-fg' : 'text-text-label')}>{categoryBreakdown[key as keyof typeof categoryBreakdown]}</p>
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
                        targets.calorieOffsetMax <= 0 ? 'text-info' :
                        targets.calorieOffsetMin >= 0 ? 'text-warning' : 'text-positive-text'
                      )}>
                        {deltaLabel}
                      </span>
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
                            <span className="text-xs font-medium text-text-muted">{macroLabel(macro.label)}</span>
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

                  {/* Water Intake Bar */}
                  {!selectedMeal && (
                    <div className="mt-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-medium text-text-muted">{t('drink.water')}</span>
                        <span className="text-xs text-text-tertiary">
                          <span className={cn(
                            'font-semibold transition-all duration-300',
                            totalWaterMl >= waterGoalMl ? 'text-positive-text' : 'text-text-label'
                          )}>
                            {totalWaterMl}ml
                          </span>
                          {' / '}{waterGoalMl}ml
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-surface-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            totalWaterMl >= waterGoalMl ? 'bg-positive-bar' : 'bg-blue-400'
                          )}
                          style={{ width: `${Math.min((totalWaterMl / waterGoalMl) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Exercise Section */}
          <section className={cn('mb-6 animate-stagger-in', isExpanded && 'lg:col-span-1 lg:mb-0')} style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">{t('dashboard.exercise')}</h2>
            <div className="bg-surface rounded-2xl p-5">
              {exerciseLogs.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center">{t('dashboard.noExercise')}</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-text-primary">
                        {totalExerciseMinutes}
                        <span className="text-sm font-normal text-text-tertiary ml-1">{t('common.min')}</span>
                      </p>
                    </div>
                    <div className="w-px h-10 bg-border-strong" />
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-text-primary">
                        {totalCaloriesBurned}
                        <span className="text-sm font-normal text-text-tertiary ml-1">{t('common.cal')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-border-strong mt-4 pt-4 space-y-2">
                    {exerciseLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">{log.exercise_type}</p>
                        <p className="text-xs text-text-secondary">
                          {log.duration_minutes} {t('common.min')} · {log.calories_burned} {t('common.cal')}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
          </div>{/* end diet+exercise grid wrapper */}
        </>
      )}
    </div>
  );
}
