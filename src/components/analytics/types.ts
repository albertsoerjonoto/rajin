import type { FoodLog, ExerciseLog, DrinkLog, HabitLog } from '@/lib/types';

export interface DayData {
  date: string;
  totalCalories: number;
  totalCaloriesBurned: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalWaterMl: number;
  habitsCompleted: number;
  habitsTotal: number;
  foodLogs: FoodLog[];
  exerciseLogs: ExerciseLog[];
  drinkLogs: DrinkLog[];
}

export type AnalyticsPeriod = 'week' | 'month' | 'year';

export function buildDayDataMap(
  dates: string[],
  foodLogs: FoodLog[],
  exerciseLogs: ExerciseLog[],
  drinkLogs: DrinkLog[],
  habitLogs: HabitLog[],
  totalHabits: number,
): Map<string, DayData> {
  const map = new Map<string, DayData>();

  for (const date of dates) {
    map.set(date, {
      date,
      totalCalories: 0,
      totalCaloriesBurned: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalWaterMl: 0,
      habitsCompleted: 0,
      habitsTotal: totalHabits,
      foodLogs: [],
      exerciseLogs: [],
      drinkLogs: [],
    });
  }

  for (const fl of foodLogs) {
    const day = map.get(fl.date);
    if (!day) continue;
    day.totalCalories += fl.calories;
    day.totalProtein += fl.protein_g ?? 0;
    day.totalCarbs += fl.carbs_g ?? 0;
    day.totalFat += fl.fat_g ?? 0;
    day.foodLogs.push(fl);
  }

  for (const dl of drinkLogs) {
    const day = map.get(dl.date);
    if (!day) continue;
    day.totalCalories += dl.calories;
    day.totalProtein += dl.protein_g ?? 0;
    day.totalCarbs += dl.carbs_g ?? 0;
    day.totalFat += dl.fat_g ?? 0;
    if (dl.drink_type === 'water') day.totalWaterMl += dl.volume_ml;
    day.drinkLogs.push(dl);
  }

  for (const el of exerciseLogs) {
    const day = map.get(el.date);
    if (!day) continue;
    day.totalCaloriesBurned += el.calories_burned;
    day.exerciseLogs.push(el);
  }

  for (const hl of habitLogs) {
    if (!hl.completed) continue;
    const day = map.get(hl.date);
    if (day) day.habitsCompleted++;
  }

  return map;
}
