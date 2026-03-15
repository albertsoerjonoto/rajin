import type { Profile } from './types';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

// Activity multipliers for TDEE (Harris-Benedict convention)
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // little or no exercise
  light: 1.375,        // light exercise 1-3 days/week
  moderate: 1.55,      // moderate exercise 3-5 days/week
  active: 1.725,       // hard exercise 6-7 days/week
  very_active: 1.9,    // very hard exercise, physical job
};

/**
 * Calculate age from date of birth string (YYYY-MM-DD)
 */
export function calculateAge(dob: string): number {
  const birth = new Date(dob + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Mifflin-St Jeor BMR formula (most accurate for most people)
 * Returns kcal/day at rest
 */
export function calculateBMR(
  gender: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  ageYears: number
): number {
  // BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + s
  // where s = +5 for male, -161 for female
  const s = gender === 'male' ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + s;
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel = 'light'): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export interface MacroRange {
  label: string;
  min: number;
  max: number;
  unit: string;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  /** User's set calorie goal */
  calorieGoal: number;
  /** Difference: goal - TDEE. Negative = deficit, positive = surplus */
  calorieDelta: number;
  deltaLabel: string;
  protein: MacroRange;
  fat: MacroRange;
  carbs: MacroRange;
  /** Whether we have enough profile data to compute */
  hasData: boolean;
}

/**
 * Compute full nutrition targets from a profile.
 * Uses light activity as the default assumption.
 */
export function computeNutritionTargets(profile: Profile): NutritionTargets {
  const empty: NutritionTargets = {
    bmr: 0,
    tdee: 0,
    calorieGoal: profile.daily_calorie_goal,
    calorieDelta: 0,
    deltaLabel: '',
    protein: { label: 'Protein', min: 0, max: 0, unit: 'g' },
    fat: { label: 'Fat', min: 0, max: 0, unit: 'g' },
    carbs: { label: 'Carbs', min: 0, max: 0, unit: 'g' },
    hasData: false,
  };

  if (!profile.gender || !profile.height_cm || !profile.weight_kg || !profile.date_of_birth) {
    return empty;
  }

  const age = calculateAge(profile.date_of_birth);
  if (age < 1 || age > 120) return empty;

  const bmr = calculateBMR(profile.gender, profile.weight_kg, profile.height_cm, age);
  const tdee = calculateTDEE(bmr, 'light');
  const goal = profile.daily_calorie_goal;
  const delta = goal - tdee;

  // Macro recommendations based on the calorie goal:
  // Protein: 1.6-2.2 g per kg body weight (active range)
  // Fat: 25-35% of calories (1g fat = 9 cal)
  // Carbs: remaining calories (1g carb = 4 cal)
  const weightKg = profile.weight_kg;

  const proteinMin = Math.round(1.6 * weightKg);
  const proteinMax = Math.round(2.2 * weightKg);

  const fatMin = Math.round((goal * 0.25) / 9);
  const fatMax = Math.round((goal * 0.35) / 9);

  // Carbs = remaining after protein and fat (use midpoints)
  const proteinMidCal = ((proteinMin + proteinMax) / 2) * 4;
  const fatMidCal = ((fatMin + fatMax) / 2) * 9;
  const carbsCal = goal - proteinMidCal - fatMidCal;
  const carbsMin = Math.round(Math.max(carbsCal * 0.85, 0) / 4);
  const carbsMax = Math.round(Math.max(carbsCal * 1.15, 0) / 4);

  let deltaLabel: string;
  if (Math.abs(delta) <= 50) {
    deltaLabel = 'Maintenance';
  } else if (delta < 0) {
    deltaLabel = `${Math.abs(delta)} cal deficit`;
  } else {
    deltaLabel = `${delta} cal surplus`;
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    calorieGoal: goal,
    calorieDelta: delta,
    deltaLabel,
    protein: { label: 'Protein', min: proteinMin, max: proteinMax, unit: 'g' },
    fat: { label: 'Fat', min: fatMin, max: fatMax, unit: 'g' },
    carbs: { label: 'Carbs', min: carbsMin, max: carbsMax, unit: 'g' },
    hasData: true,
  };
}
