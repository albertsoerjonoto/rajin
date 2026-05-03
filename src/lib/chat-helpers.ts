import type {
  ChatMessage,
  ParsedFood,
  ParsedExercise,
  ParsedDrink,
  ParsedMeasurement,
  FoodEdit,
  ExerciseEdit,
  DrinkEdit,
  MeasurementEdit,
} from '@/lib/types';

// Per-message image cap. Bounds Gemini payload size, storage cost, and request
// latency. Enforced symmetrically on the client (input picker + previews) and
// the server (parse API trims its accepted image_urls list to this length).
export const MAX_CHAT_IMAGES_PER_MESSAGE = 4;

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  parsedFoods?: ParsedFood[];
  parsedExercises?: ParsedExercise[];
  parsedDrinks?: ParsedDrink[];
  parsedMeasurements?: ParsedMeasurement[];
  foodEdits?: FoodEdit[];
  exerciseEdits?: ExerciseEdit[];
  drinkEdits?: DrinkEdit[];
  measurementEdits?: MeasurementEdit[];
  saved?: boolean;
}

// food_logs columns are INTEGER. Round any integer fields in a food edit
// payload defensively, since older chat messages may have decimal macros
// stored in chat_messages.food_edits.
export function roundFoodUpdate(updated: Partial<ParsedFood>): Partial<ParsedFood> {
  const out: Partial<ParsedFood> = { ...updated };
  if (out.calories != null) out.calories = Math.round(out.calories);
  if (out.protein_g != null) out.protein_g = Math.round(out.protein_g);
  if (out.carbs_g != null) out.carbs_g = Math.round(out.carbs_g);
  if (out.fat_g != null) out.fat_g = Math.round(out.fat_g);
  return out;
}

// Convert a raw chat_messages row into the in-memory view object. Reads the
// new image_urls array first; falls back to legacy single image_url for rows
// inserted before migration 027.
export function dbRowToMessage(row: ChatMessage): ChatMessageView {
  const imageUrls = row.image_urls && row.image_urls.length > 0
    ? row.image_urls
    : row.image_url
      ? [row.image_url]
      : undefined;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    imageUrls,
    parsedFoods: row.parsed_foods ?? undefined,
    parsedExercises: row.parsed_exercises ?? undefined,
    parsedDrinks: row.parsed_drinks ?? undefined,
    parsedMeasurements: row.parsed_measurements ?? undefined,
    foodEdits: row.food_edits ?? undefined,
    exerciseEdits: row.exercise_edits ?? undefined,
    drinkEdits: row.drink_edits ?? undefined,
    measurementEdits: row.measurement_edits ?? undefined,
    saved: row.saved,
  };
}

// Build the conversation history sent to /api/parse. Drops the welcome stub and
// any transient error- bubbles (those have id "error-…" and are never persisted),
// then keeps the last `limit` messages — including text-only assistant replies,
// which the previous implementation incorrectly stripped and broke per-day memory.
export function buildHistory(
  messages: ChatMessageView[],
  limit = 20,
): Array<{
  role: 'user' | 'assistant';
  content: string;
  parsedFoods?: ParsedFood[];
  parsedExercises?: ParsedExercise[];
  parsedDrinks?: ParsedDrink[];
  parsedMeasurements?: ParsedMeasurement[];
  foodEdits?: FoodEdit[];
  exerciseEdits?: ExerciseEdit[];
  drinkEdits?: DrinkEdit[];
  measurementEdits?: MeasurementEdit[];
}> {
  return messages
    .filter((m) => {
      if (m.id === 'welcome') return false;
      if (m.id.startsWith('error-')) return false;
      return true;
    })
    .slice(-limit)
    .map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.role === 'assistant' ? {
        parsedFoods: m.parsedFoods,
        parsedExercises: m.parsedExercises,
        parsedDrinks: m.parsedDrinks,
        parsedMeasurements: m.parsedMeasurements,
        foodEdits: m.foodEdits,
        exerciseEdits: m.exerciseEdits,
        drinkEdits: m.drinkEdits,
        measurementEdits: m.measurementEdits,
      } : {}),
    }));
}
