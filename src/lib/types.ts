export type Frequency = 'daily' | 'weekly';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type LogSource = 'manual' | 'chat';
export type Gender = 'male' | 'female';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  daily_calorie_goal: number;
  date_of_birth: string | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  frequency: Frequency;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
  created_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: LogSource;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  date: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  notes: string | null;
  source: LogSource;
  created_at: string;
}

export interface HabitWithLog extends Habit {
  completed: boolean;
  log_id?: string;
}

// Gemini parsing types
export interface ParsedFood {
  description: string;
  meal_type: MealType;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface ParsedExercise {
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  notes: string | null;
}

export interface ParseResult {
  foods: ParsedFood[];
  exercises: ParsedExercise[];
}
