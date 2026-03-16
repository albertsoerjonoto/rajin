export type Frequency = 'daily' | 'weekly';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DrinkType = 'water' | 'coffee' | 'tea' | 'juice' | 'soda' | 'milk' | 'other';
export type LogSource = 'manual' | 'chat';
export type Gender = 'male' | 'female';
export type Locale = 'id' | 'en';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  daily_calorie_offset: number;
  date_of_birth: string | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
  username: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  daily_water_goal_ml: number;
  locale: Locale;
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

export interface DrinkLog {
  id: string;
  user_id: string;
  date: string;
  drink_type: DrinkType;
  description: string;
  volume_ml: number;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
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

export interface ParsedDrink {
  description: string;
  drink_type: DrinkType;
  volume_ml: number;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface ParseResult {
  foods: ParsedFood[];
  exercises: ParsedExercise[];
  drinks: ParsedDrink[];
}

// Chat edit types
export interface FoodEdit {
  log_id: string;
  original: { description: string; meal_type: MealType; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  updated: Partial<ParsedFood>;
}

export interface ExerciseEdit {
  log_id: string;
  original: { exercise_type: string; duration_minutes: number; calories_burned: number };
  updated: Partial<ParsedExercise>;
}

export interface DrinkEdit {
  log_id: string;
  original: { drink_type: DrinkType; description: string; volume_ml: number; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  updated: Partial<ParsedDrink>;
}

export interface ChatContext {
  todayFoodLogs: { index: number; id: string; description: string; meal_type: MealType; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[];
  todayExerciseLogs: { index: number; id: string; exercise_type: string; duration_minutes: number; calories_burned: number }[];
  todayDrinkLogs: { index: number; id: string; drink_type: DrinkType; description: string; volume_ml: number; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[];
  profile: { display_name: string | null; calorieTarget: number; tdee: number; proteinTarget: string; carbsTarget: string; fatTarget: string } | null;
  totalCalories: number;
  totalCaloriesBurned: number;
  totalDrinkCalories: number;
  totalWaterMl: number;
  waterGoalMl: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  parsed_foods: ParsedFood[] | null;
  parsed_exercises: ParsedExercise[] | null;
  parsed_drinks: ParsedDrink[] | null;
  food_edits: FoodEdit[] | null;
  exercise_edits: ExerciseEdit[] | null;
  drink_edits: DrinkEdit[] | null;
  saved: boolean;
  created_at: string;
}
