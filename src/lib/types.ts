export type Frequency = 'daily' | 'weekly';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DrinkType = 'water' | 'coffee' | 'tea' | 'juice' | 'soda' | 'milk' | 'smoothie' | 'other';
export type LogSource = 'manual' | 'chat';
export type Gender = 'male' | 'female';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'rejected' | 'blocked';
export type SharedHabitStatus = 'pending' | 'accepted' | 'rejected';
export type FeedEventType = 'habit_completed' | 'streak_milestone' | 'friend_added' | 'shared_habit_started' | 'shared_streak' | 'shared_streak_milestone' | 'exercise_completed' | 'calorie_goal_met' | 'protein_goal_met' | 'fat_goal_met' | 'carbs_goal_met' | 'water_goal_met';
export type Locale = 'id' | 'en';
export type DesktopLayout = 'compact' | 'expanded';
export type HabitCategory = 'habit' | 'supplement' | 'skincare' | 'superfood';
export type DashboardSectionId =
  | 'habits'
  | 'supplements'
  | 'skincare'
  | 'superfoods'
  | 'diet'
  | 'exercise';

export interface DashboardSection {
  id: DashboardSectionId;
  visible: boolean;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  calorie_offset_min: number;
  calorie_offset_max: number;
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
  desktop_layout: DesktopLayout;
  dashboard_sections: DashboardSection[] | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  frequency: Frequency;
  is_active: boolean;
  is_private: boolean;
  is_optional: boolean;
  streak_interval_days: number;
  sort_order: number;
  category: HabitCategory;
  product_name: string | null;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
  logged_at: string;
  product_name: string | null;
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
  logged_at: string;
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
  logged_at: string;
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
  logged_at: string;
  source: LogSource;
  created_at: string;
}

export interface MeasurementLog {
  id: string;
  user_id: string;
  date: string;
  logged_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  notes: string | null;
  source: LogSource;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FriendActivity {
  activity_type: 'food' | 'exercise' | 'drink' | 'habit';
  friend_id: string;
  friend_display_name: string | null;
  friend_avatar_url: string | null;
  description: string;
  detail: string;
  logged_at: string;
}

export interface HabitWithLog extends Habit {
  completed: boolean;
  log_id?: string;
  logged_at?: string;
}

export interface SharedHabit {
  id: string;
  habit_id: string;
  owner_id: string;
  friend_id: string;
  friend_habit_id: string | null;
  status: SharedHabitStatus;
  created_at: string;
}

export interface SharedStreak {
  id: string;
  shared_habit_id: string;
  current_streak: number;
  longest_streak: number;
  last_both_completed_date: string | null;
  updated_at: string;
}

export interface HabitStreak {
  id: string;
  user_id: string;
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  updated_at: string;
}

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  data: Record<string, unknown>;
  is_private: boolean;
  created_at: string;
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

export interface ParsedMeasurement {
  height_cm: number | null;
  weight_kg: number | null;
  notes: string | null;
}

export interface ParseResult {
  foods: ParsedFood[];
  exercises: ParsedExercise[];
  drinks: ParsedDrink[];
  measurements: ParsedMeasurement[];
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

export interface MeasurementEdit {
  log_id: string;
  original: { height_cm: number | null; weight_kg: number | null; notes: string | null };
  updated: Partial<ParsedMeasurement>;
}

export interface ChatContext {
  todayFoodLogs: { index: number; id: string; description: string; meal_type: MealType; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[];
  todayExerciseLogs: { index: number; id: string; exercise_type: string; duration_minutes: number; calories_burned: number }[];
  todayDrinkLogs: { index: number; id: string; drink_type: DrinkType; description: string; volume_ml: number; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[];
  todayHabitLogs: { index: number; id: string; habit_name: string; emoji: string; completed: boolean; logged_at: string | null; product_name?: string | null }[];
  todayMeasurementLogs: { index: number; id: string; height_cm: number | null; weight_kg: number | null; notes: string | null; logged_at: string }[];
  profile: {
    display_name: string | null;
    gender: string | null;
    age: number | null;
    height_cm: number | null;
    weight_kg: number | null;
    calorieTarget: number;
    tdee: number;
    calorieGoalType: string;
    calorieRangeMin: number;
    calorieRangeMax: number;
    proteinTarget: string;
    carbsTarget: string;
    fatTarget: string;
    waterGoalMl: number;
  } | null;
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
  parsed_measurements: ParsedMeasurement[] | null;
  food_edits: FoodEdit[] | null;
  exercise_edits: ExerciseEdit[] | null;
  drink_edits: DrinkEdit[] | null;
  measurement_edits: MeasurementEdit[] | null;
  saved: boolean;
  created_at: string;
}
