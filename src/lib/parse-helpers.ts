// Pure helpers extracted from src/app/api/parse/route.ts so they can be unit-tested
// without spinning up the full Next request lifecycle or hitting Gemini. The route
// imports these directly — there's no duplication, just a smaller surface area
// per file and a way to pin behaviour the user reported as broken.

import { clamp } from '@/lib/validation';
import type { ParsedFood, ParsedExercise, ParsedDrink, ParsedMeasurement, MealType, DrinkType } from '@/lib/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const DRINK_TYPES: DrinkType[] = ['water', 'coffee', 'tea', 'juice', 'soda', 'milk', 'other'];

// --- Image / SSRF helpers ---

// Normalize whatever the request body sent us into a single ordered url list.
// We accept image_urls (array, preferred) and image_url (single, legacy) so a
// stale client deploy still works after the multi-image rollout.
export function gatherCandidateImageUrls(body: { image_urls?: unknown; image_url?: unknown }): string[] {
  const out: string[] = [];
  if (Array.isArray(body.image_urls)) {
    for (const url of body.image_urls) {
      if (typeof url === 'string' && url.length > 0) out.push(url);
    }
  }
  if (out.length === 0 && typeof body.image_url === 'string' && body.image_url.length > 0) {
    out.push(body.image_url);
  }
  return out;
}

// SSRF guard: only fetch URLs that begin with our Supabase project origin.
// Anything else (file://, http://169.254.169.254/, attacker-controlled hosts)
// is rejected before we ever issue a fetch. `supabaseOrigin` may be undefined
// in misconfigured environments — in that case nothing is allowed.
export function isSafeImageUrl(url: unknown, supabaseOrigin: string | undefined): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (!supabaseOrigin) return false;
  return url.startsWith(supabaseOrigin);
}

// --- Gemini text extraction ---

// Gemini occasionally wraps JSON in a markdown fence, or adds prose before/after.
// This helper deterministically pulls a JSON object out of those shapes; falls
// back to the raw text if neither pattern matches (caller handles parse failure).
export function extractJsonString(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text;
}

// --- Parsed-array clamping ---

const num = (v: unknown) => Number(v) || 0;

export function clampParsedFoods(input: unknown): ParsedFood[] {
  if (!Array.isArray(input)) return [];
  return input.map((f: Record<string, unknown>) => ({
    description: typeof f.description === 'string' ? f.description : 'Unknown food',
    meal_type: MEAL_TYPES.includes(f.meal_type as MealType) ? (f.meal_type as MealType) : 'lunch',
    // food_logs columns are INTEGER — round so inserts don't fail on decimals.
    calories: Math.round(clamp(num(f.calories), 0, 20000)),
    protein_g: Math.round(clamp(num(f.protein_g), 0, 5000)),
    carbs_g: Math.round(clamp(num(f.carbs_g), 0, 5000)),
    fat_g: Math.round(clamp(num(f.fat_g), 0, 5000)),
  }));
}

export function clampParsedExercises(input: unknown): ParsedExercise[] {
  if (!Array.isArray(input)) return [];
  return input.map((e: Record<string, unknown>) => ({
    exercise_type: typeof e.exercise_type === 'string' ? e.exercise_type : 'Exercise',
    duration_minutes: clamp(num(e.duration_minutes), 0, 1440),
    calories_burned: clamp(num(e.calories_burned), 0, 20000),
    notes: typeof e.notes === 'string' ? e.notes : '',
  }));
}

export function clampParsedDrinks(input: unknown): ParsedDrink[] {
  if (!Array.isArray(input)) return [];
  return input.map((d: Record<string, unknown>) => ({
    description: typeof d.description === 'string' ? d.description : 'Unknown drink',
    drink_type: DRINK_TYPES.includes(d.drink_type as DrinkType) ? (d.drink_type as DrinkType) : 'other',
    volume_ml: clamp(Number(d.volume_ml) || 250, 0, 10000),
    calories: clamp(num(d.calories), 0, 20000),
    protein_g: clamp(num(d.protein_g), 0, 5000),
    carbs_g: clamp(num(d.carbs_g), 0, 5000),
    fat_g: clamp(num(d.fat_g), 0, 5000),
  }));
}

export function clampParsedMeasurements(input: unknown): ParsedMeasurement[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((m: Record<string, unknown>) => ({
      height_cm: m.height_cm !== null && m.height_cm !== undefined ? clamp(num(m.height_cm), 50, 300) : null,
      weight_kg: m.weight_kg !== null && m.weight_kg !== undefined ? clamp(num(m.weight_kg), 10, 500) : null,
      notes: typeof m.notes === 'string' ? m.notes : null,
    }))
    .filter((m) => m.height_cm !== null || m.weight_kg !== null);
}
