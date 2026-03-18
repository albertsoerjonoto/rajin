import { createClient } from '@/lib/supabase/client';
import { computeNutritionTargets } from '@/lib/nutrition';
import type { FeedEventType, Profile } from '@/lib/types';

/**
 * Emit a feed event, but only if no matching event exists for this user+type+date.
 * Returns true if event was created.
 */
async function emitOncePerDay(
  userId: string,
  date: string,
  eventType: FeedEventType,
  data: Record<string, unknown>
): Promise<boolean> {
  const sb = createClient();
  const dayStart = new Date(date + 'T00:00:00').toISOString();
  const dayEnd = new Date(date + 'T23:59:59').toISOString();

  // Check if already emitted today
  const { count } = await sb
    .from('feed_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if ((count ?? 0) > 0) return false;

  await sb.from('feed_events').insert({
    user_id: userId,
    event_type: eventType,
    data,
    is_private: false,
  });
  return true;
}

/**
 * Emit an exercise_completed feed event.
 */
export async function emitExerciseEvent(
  userId: string,
  exerciseType: string,
  durationMinutes: number,
  caloriesBurned: number
): Promise<void> {
  const sb = createClient();
  await sb.from('feed_events').insert({
    user_id: userId,
    event_type: 'exercise_completed',
    data: { exercise_type: exerciseType, duration_minutes: durationMinutes, calories_burned: caloriesBurned },
    is_private: false,
  });
}

/**
 * Check daily totals against goals and emit feed events for any newly-met goals.
 * Call this after saving food, drink, or exercise logs.
 */
export async function checkAndEmitGoalEvents(userId: string, date: string): Promise<void> {
  const sb = createClient();

  // Fetch profile for goals
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) return;

  const targets = computeNutritionTargets(profile as Profile);

  // Fetch today's food logs
  const { data: foodLogs } = await sb
    .from('food_logs')
    .select('calories, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .eq('date', date);

  // Fetch today's drink logs
  const { data: drinkLogs } = await sb
    .from('drink_logs')
    .select('calories, protein_g, carbs_g, fat_g, volume_ml, drink_type')
    .eq('user_id', userId)
    .eq('date', date);

  const totalCalories = (foodLogs ?? []).reduce((s, l) => s + (l.calories ?? 0), 0)
    + (drinkLogs ?? []).reduce((s, l) => s + (l.calories ?? 0), 0);
  const totalProtein = (foodLogs ?? []).reduce((s, l) => s + (l.protein_g ?? 0), 0)
    + (drinkLogs ?? []).reduce((s, l) => s + (l.protein_g ?? 0), 0);
  const totalCarbs = (foodLogs ?? []).reduce((s, l) => s + (l.carbs_g ?? 0), 0)
    + (drinkLogs ?? []).reduce((s, l) => s + (l.carbs_g ?? 0), 0);
  const totalFat = (foodLogs ?? []).reduce((s, l) => s + (l.fat_g ?? 0), 0)
    + (drinkLogs ?? []).reduce((s, l) => s + (l.fat_g ?? 0), 0);
  const totalWaterMl = (drinkLogs ?? [])
    .filter(l => l.drink_type === 'water')
    .reduce((s, l) => s + (l.volume_ml ?? 0), 0);

  const waterGoal = (profile as Profile).daily_water_goal_ml ?? 2000;

  // Check calorie goal: within range (min <= total <= max)
  if (targets.hasData && totalCalories >= targets.calorieRange.min && totalCalories <= targets.calorieRange.max) {
    await emitOncePerDay(userId, date, 'calorie_goal_met', {
      calories: totalCalories,
      target: targets.calorieTarget,
      range_min: targets.calorieRange.min,
      range_max: targets.calorieRange.max,
    });
  }

  // Check protein goal: >= min target
  if (targets.hasData && totalProtein >= targets.protein.min) {
    await emitOncePerDay(userId, date, 'protein_goal_met', {
      protein_g: Math.round(totalProtein),
      target_min: targets.protein.min,
      target_max: targets.protein.max,
    });
  }

  // Check fat goal: within range
  if (targets.hasData && totalFat >= targets.fat.min && totalFat <= targets.fat.max) {
    await emitOncePerDay(userId, date, 'fat_goal_met', {
      fat_g: Math.round(totalFat),
      target_min: targets.fat.min,
      target_max: targets.fat.max,
    });
  }

  // Check carbs goal: within range
  if (targets.hasData && totalCarbs >= targets.carbs.min && totalCarbs <= targets.carbs.max) {
    await emitOncePerDay(userId, date, 'carbs_goal_met', {
      carbs_g: Math.round(totalCarbs),
      target_min: targets.carbs.min,
      target_max: targets.carbs.max,
    });
  }

  // Check water goal
  if (totalWaterMl >= waterGoal) {
    await emitOncePerDay(userId, date, 'water_goal_met', {
      water_ml: totalWaterMl,
      goal_ml: waterGoal,
    });
  }
}
