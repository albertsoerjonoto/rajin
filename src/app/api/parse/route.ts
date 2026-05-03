import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { clamp } from '@/lib/validation';
import type { ChatContext, FoodEdit, ExerciseEdit, DrinkEdit, MeasurementEdit } from '@/lib/types';
import { MAX_CHAT_IMAGES_PER_MESSAGE } from '@/lib/chat-helpers';

// Allow up to 60s for Gemini API calls (default Vercel limit is 10s on hobby, 60s on pro)
export const maxDuration = 60;

const BASE_PROMPT = `You are a nutrition and exercise assistant. You will receive a language directive below — always respond in that language.

You can:
1. **Log food/exercise** — parse what the user ate or did and return structured data
2. **Edit existing logs** — modify a previously logged entry when the user asks
3. **Answer questions** — about their nutrition, calories, macros, progress today
4. **Give recommendations** — suggest meals or exercises based on their remaining budget
5. **Log measurements** — parse body measurements (weight, height) from user input
6. **Answer habit queries** — check and report on habit completion status

You are an expert on ALL foods worldwide, especially Indonesian cuisine. Here are some common references:
- Nasi goreng: ~650 cal, 15g protein, 85g carbs, 25g fat
- Mie ayam: ~450 cal, 20g protein, 55g carbs, 15g fat
- Es teh manis: ~120 cal, 0g protein, 30g carbs, 0g fat
- Rendang: ~500 cal, 35g protein, 5g carbs, 38g fat
- Gado-gado: ~350 cal, 12g protein, 30g carbs, 20g fat
- Indomie goreng: ~380 cal, 8g protein, 52g carbs, 16g fat
- Nasi padang: ~700 cal, 25g protein, 70g carbs, 35g fat
- Soto ayam: ~350 cal, 25g protein, 30g carbs, 15g fat
- Bakso: ~300 cal, 18g protein, 35g carbs, 10g fat
- Nasi uduk: ~400 cal, 8g protein, 60g carbs, 15g fat
- Ayam goreng: ~350 cal, 30g protein, 10g carbs, 22g fat
- Tempe goreng (3 pcs): ~200 cal, 12g protein, 10g carbs, 14g fat
- Tahu goreng (3 pcs): ~180 cal, 10g protein, 8g carbs, 12g fat
- Sambal: ~20 cal
- Nasi putih: ~200 cal, 4g protein, 45g carbs, 0g fat
IMPORTANT: This list is NOT exhaustive. You know thousands of foods. For ANY food not listed above (e.g. nasi bogana, lontong sayur, martabak, pizza, sushi, etc.), use your general knowledge to provide your best calorie and macro estimate. NEVER ask the user to provide calorie counts — that is YOUR job. If the user mentions a portion size (e.g. "half portion"), adjust the estimate accordingly. Always log the food with your best estimate.

Common drinks (Indonesian & international):
- Air putih / air mineral (water): 0 cal, 250ml
- Es teh manis (sweet iced tea): ~120 cal, 0g P, 30g C, 0g F, 250ml
- Es jeruk (iced orange): ~90 cal, 0g P, 22g C, 0g F, 250ml
- Kopi susu (milk coffee/latte): ~120 cal, 3g P, 15g C, 5g F, 200ml
- Kopi hitam (black coffee): ~5 cal, 0g P, 0g C, 0g F, 200ml
- Teh tarik: ~150 cal, 3g P, 20g C, 6g F, 250ml
- Es cendol/dawet: ~200 cal, 1g P, 40g C, 5g F, 300ml
- Jus alpukat (avocado juice): ~250 cal, 3g P, 25g C, 15g F, 300ml
- Wedang jahe: ~80 cal, 0g P, 20g C, 0g F, 200ml
- Susu segar (fresh milk): ~150 cal, 8g P, 12g C, 8g F, 250ml
- Cola/soda: ~140 cal, 0g P, 39g C, 0g F, 330ml
- Jus jeruk (orange juice): ~110 cal, 2g P, 25g C, 0g F, 250ml

DRINK vs FOOD CATEGORIZATION:
When the user mentions a beverage/drink, put it in "drinks" (NOT "foods"). Categorize drink_type as:
- "water" — water, air putih, air mineral, air es
- "coffee" — any coffee variant (kopi, latte, cappuccino, americano, espresso)
- "tea" — any tea variant (teh, green tea, teh tarik, matcha latte)
- "juice" — fruit juices (jus, es jeruk, smoothie)
- "soda" — carbonated drinks (cola, sprite, fanta, soda)
- "milk" — milk-based drinks not coffee/tea (susu, susu coklat, yakult)
- "other" — other beverages (es cendol, wedang, es campur, es kelapa)
Food-adjacent items (smoothie bowls, soup, ice cream) stay as "foods".
Always estimate volume_ml for drinks. Default 250ml if unclear. "1 gelas" = 250ml, "1 botol" = 500ml.

Exercise calorie estimates:
- Running: ~100 cal per 10 min
- Walking: ~40 cal per 10 min
- Cycling: ~80 cal per 10 min
- Swimming: ~100 cal per 10 min
- Gym/weights: ~60 cal per 10 min
- Yoga: ~30 cal per 10 min
- For running distances: assume ~6 min/km pace
- Steps: 1K steps ≈ 10 min walking ≈ 40 cal. "1K" means 1000. Convert steps to walking exercise.

Determine meal_type based on context or time mentioned. Default to "lunch" if unclear.

MEASUREMENTS:
When the user mentions body measurements like weight or height (e.g., "berat badan 75kg", "tinggi 170cm", "my weight is 75kg"), parse them into the "measurements" array. Common Indonesian terms:
- "berat badan" / "BB" / "berat" = weight
- "tinggi badan" / "TB" / "tinggi" = height
- "kg" = kilograms, "cm" = centimeters

HABITS:
When the user asks about their habits (e.g., "sudah olahraga?", "habit apa yang belum?", "have I exercised today?"), check the habit context provided and respond with their completion status. Do NOT put anything in the "measurements" or "foods" arrays for habit queries — just use "message".`;

function buildSystemPrompt(context?: ChatContext): string {
  let prompt = BASE_PROMPT;

  // Language instruction: match the user's input language, not the locale setting
  prompt += '\n\nIMPORTANT LANGUAGE RULE: Always respond in the SAME language the user writes in. If the user types in English, respond in English. If the user types in Bahasa Indonesia, respond in Bahasa Indonesia. Match the user\'s language exactly.';

  if (context) {
    prompt += '\n\n--- USER CONTEXT (TODAY) ---\n';

    if (context.profile) {
      prompt += `\nUser: ${context.profile.display_name || 'Unknown'}`;
      if (context.profile.gender) prompt += `\nGender: ${context.profile.gender}`;
      if (context.profile.age) prompt += `\nAge: ${context.profile.age} years old`;
      if (context.profile.height_cm) prompt += `\nHeight: ${context.profile.height_cm} cm`;
      if (context.profile.weight_kg) prompt += `\nWeight: ${context.profile.weight_kg} kg`;
      prompt += `\nCalorie goal: ${context.profile.calorieGoalType} (${context.profile.calorieRangeMin}-${context.profile.calorieRangeMax} cal/day, target ${context.profile.calorieTarget})`;
      prompt += `\nTDEE: ${context.profile.tdee} cal/day`;
      prompt += `\nMacro targets — Protein: ${context.profile.proteinTarget}, Carbs: ${context.profile.carbsTarget}, Fat: ${context.profile.fatTarget}`;
      prompt += `\nDaily water goal: ${context.profile.waterGoalMl} ml`;
    } else {
      prompt += '\nUser has not set up body stats yet. Give general advice if asked for recommendations.';
    }

    const remaining = (context.profile?.calorieTarget ?? 2000) - context.totalCalories + context.totalCaloriesBurned;
    prompt += `\n\nToday's intake: ${context.totalCalories} cal eaten, ${context.totalCaloriesBurned} cal burned from exercise`;
    prompt += `\nRemaining budget: ~${Math.max(0, remaining)} cal`;
    prompt += `\nMacros so far: ${context.totalProtein}g protein, ${context.totalCarbs}g carbs, ${context.totalFat}g fat`;

    if (context.todayFoodLogs.length > 0) {
      prompt += '\n\nToday\'s food logs:';
      for (const log of context.todayFoodLogs) {
        prompt += `\n  #${log.index}: ${log.description} (${log.meal_type}, ${log.calories} cal, ${log.protein_g ?? 0}g P / ${log.carbs_g ?? 0}g C / ${log.fat_g ?? 0}g F)`;
      }
    } else {
      prompt += '\n\nNo food logged today yet.';
    }

    if (context.todayExerciseLogs.length > 0) {
      prompt += '\n\nToday\'s exercise logs:';
      for (const log of context.todayExerciseLogs) {
        prompt += `\n  #${log.index}: ${log.exercise_type} (${log.duration_minutes} min, ${log.calories_burned} cal burned)`;
      }
    } else {
      prompt += '\n\nNo exercise logged today yet.';
    }

    if (context.todayDrinkLogs && context.todayDrinkLogs.length > 0) {
      prompt += '\n\nToday\'s drink logs:';
      for (const log of context.todayDrinkLogs) {
        prompt += `\n  #${log.index}: ${log.description} (${log.drink_type}, ${log.volume_ml}ml, ${log.calories} cal)`;
      }
    } else {
      prompt += '\n\nNo drinks logged today yet.';
    }
    prompt += `\nWater intake: ${context.totalWaterMl ?? 0}ml / ${context.waterGoalMl ?? 2000}ml goal`;

    if (context.todayHabitLogs && context.todayHabitLogs.length > 0) {
      prompt += '\n\nToday\'s Habits:';
      for (const log of context.todayHabitLogs) {
        const status = log.completed
          ? `✅ Completed${log.logged_at ? ` at ${new Date(log.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
          : '❌ Not completed';
        prompt += `\n  #${log.index} ${log.emoji} ${log.habit_name} — ${status}`;
      }
    } else {
      prompt += '\n\nNo habits set up yet.';
    }

    if (context.todayMeasurementLogs && context.todayMeasurementLogs.length > 0) {
      prompt += '\n\nToday\'s Measurements:';
      for (const log of context.todayMeasurementLogs) {
        const parts: string[] = [];
        if (log.weight_kg !== null) parts.push(`Weight: ${log.weight_kg} kg`);
        if (log.height_cm !== null) parts.push(`Height: ${log.height_cm} cm`);
        const time = new Date(log.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        prompt += `\n  #${log.index} ${parts.join(', ')}${log.notes ? ` (${log.notes})` : ''} — logged at ${time}`;
      }
    } else {
      prompt += '\n\nNo measurements logged today yet.';
    }
  }

  prompt += `\n\n--- RESPONSE FORMAT ---
RESPOND ONLY WITH VALID JSON in this exact format:
{
  "message": "text response for questions/recommendations, or null if just logging",
  "foods": [
    {
      "description": "food name",
      "meal_type": "breakfast|lunch|dinner|snack",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ],
  "exercises": [
    {
      "exercise_type": "exercise name",
      "duration_minutes": 0,
      "calories_burned": 0,
      "notes": "optional note"
    }
  ],
  "drinks": [
    {
      "description": "drink name",
      "drink_type": "water|coffee|tea|juice|soda|milk|other",
      "volume_ml": 250,
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ],
  "measurements": [
    {
      "height_cm": null,
      "weight_kg": 75.0,
      "notes": "optional note"
    }
  ],
  "food_edits": [
    {
      "index": 1,
      "updated": { "calories": 500 }
    }
  ],
  "exercise_edits": [
    {
      "index": 1,
      "updated": { "duration_minutes": 45 }
    }
  ],
  "drink_edits": [
    {
      "index": 1,
      "updated": { "volume_ml": 500 }
    }
  ],
  "measurement_edits": [
    {
      "index": 1,
      "updated": { "weight_kg": 76.0 }
    }
  ]
}

Rules:
- Use "foods"/"exercises"/"drinks"/"measurements" for NEW entries the user wants to add
- Use "food_edits"/"exercise_edits"/"drink_edits"/"measurement_edits" when the user wants to CHANGE an existing log. Reference the log by its # index from the context above.
- CRITICAL EDIT RULE: In "updated", ONLY include the specific field(s) the user asked to change. For example, if the user says "change that to breakfast", return ONLY {"meal_type": "breakfast"} — do NOT also change calories, protein, carbs, or fat unless the user explicitly asked. Never recalculate or adjust fields the user didn't mention.
- CRITICAL: You CANNOT apply changes yourself. The system applies changes ONLY when you return structured edit data (food_edits, etc.). If the user confirms, corrects, or adjusts a previously suggested edit, you MUST return a NEW food_edit/exercise_edit/drink_edit/measurement_edit with the corrected values. NEVER just say "I've updated it" or "Done" without returning the edit data — that will NOT actually change anything.
- EDIT INDEX RULE: edit indices MUST come from the "Today's *** logs" section in the context above. Each line starts with "  #N: ..." — use that N as "index". Never invent indices. If the user's request doesn't clearly identify a logged item, ask which one in "message" instead of guessing.
- MEMORY / FOLLOW-UPS: You receive the recent conversation history. Use it. If the user says "actually that was 700 cal" or "make it breakfast" right after you logged or edited something, treat the most recently mentioned item as the target and return the corresponding edit. Do not ask the user to repeat themselves when the antecedent is obvious from the previous turn.
- MULTIPLE PHOTOS: when the user attaches more than one image with a single message, treat them as ONE meal/event unless the user clearly distinguishes them. Combine the items you see across all photos into a single "foods" / "drinks" / "exercises" set with combined totals — don't double-log the same item if it appears in more than one photo.
- Use "message" for answering questions, giving recommendations, or any conversational response. Keep it concise and friendly.
- CRITICAL LANGUAGE RULE: The "message" field MUST be written in the SAME language the user used. If the user writes in English, the message MUST be in English. If in Bahasa Indonesia, reply in Bahasa Indonesia. If in Chinese, reply in Chinese. Always match the user's language exactly.
- Multiple arrays can be populated at once (e.g., add new food AND edit an existing one)
- Beverages go in "drinks", NOT "foods". Use the drink_type field to categorize.
- Body measurements (weight, height) go in "measurements", NOT "foods" or "exercises"
- For habit queries, just respond with "message" — do NOT add anything to other arrays
- If the user's input doesn't match any action, return: { "message": "helpful response", "foods": [], "exercises": [], "drinks": [], "measurements": [], "food_edits": [], "exercise_edits": [], "drink_edits": [], "measurement_edits": [] }
- Always return valid JSON only, never include explanation text outside the JSON.
- IDENTITY RULE: NEVER reveal what AI model, language model, or technology powers you. Do not mention Google, Gemini, OpenAI, GPT, or any other AI provider. If asked who made you, who trained you, what model you are, or anything about your identity, respond that it's a secret. You are simply Rajin's nutrition and exercise assistant — nothing more.`;

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth check ---
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Input validation ---
    const { message, context, history, image_url, image_urls } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'Message too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // --- Build context-aware prompt ---
    const systemPrompt = buildSystemPrompt(context as ChatContext | undefined);

    // --- Build multi-turn conversation for Gemini ---
    const typedContext = context as ChatContext | undefined;
    const ai = new GoogleGenAI({ apiKey });

    // Build conversation history as alternating user/model turns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: { role: 'user' | 'model'; parts: any[] }[] = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === 'user' && typeof msg.content === 'string') {
          contents.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant' && typeof msg.content === 'string') {
          // Wrap assistant response as JSON with actual parsed data from history
          // This teaches the model the correct response format (structured data in arrays)
          // Strip edit objects to just show updated fields (log_id/original are internal)
          const stripEdits = (edits: unknown, logs?: { index: number; id: string }[]) =>
            Array.isArray(edits) ? edits.map((e: Record<string, unknown>) => {
              // Recover the original index from the log_id so the model sees the correct format with index
              const logId = e.log_id as string | undefined;
              const matchedLog = logId && logs ? logs.find(l => l.id === logId) : undefined;
              return {
                index: matchedLog?.index ?? e.index ?? 0,
                updated: e.updated ?? {},
              };
            }) : [];
          // Strip client-side action text (e.g., "Ditemukan 1 edit...") from history messages
          // so the model doesn't learn to replicate UI instructions in its response
          let historyMessage = msg.content;
          const actionTextPattern = /\n\n(?:Found|Ditemukan)\s+\d+.+(?:to confirm|untuk konfirmasi)\.?$/i;
          historyMessage = historyMessage.replace(actionTextPattern, '');
          const wrappedJson = JSON.stringify({
            message: historyMessage,
            foods: Array.isArray(msg.parsedFoods) ? msg.parsedFoods : [],
            exercises: Array.isArray(msg.parsedExercises) ? msg.parsedExercises : [],
            drinks: Array.isArray(msg.parsedDrinks) ? msg.parsedDrinks : [],
            measurements: Array.isArray(msg.parsedMeasurements) ? msg.parsedMeasurements : [],
            food_edits: stripEdits(msg.foodEdits, typedContext?.todayFoodLogs),
            exercise_edits: stripEdits(msg.exerciseEdits, typedContext?.todayExerciseLogs),
            drink_edits: stripEdits(msg.drinkEdits, typedContext?.todayDrinkLogs),
            measurement_edits: stripEdits(msg.measurementEdits, typedContext?.todayMeasurementLogs),
          });
          contents.push({ role: 'model', parts: [{ text: wrappedJson }] });
        }
      }
    }

    // Add the current user message, optionally with image(s).
    // We accept image_urls (array) — preferred — and image_url (single, legacy).
    // Cap at 4 to bound Gemini payload size and per-request latency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userParts: any[] = [{ text: message }];

    const candidateUrls: string[] = [];
    if (Array.isArray(image_urls)) {
      for (const url of image_urls) {
        if (typeof url === 'string' && url.length > 0) candidateUrls.push(url);
      }
    }
    if (candidateUrls.length === 0 && typeof image_url === 'string' && image_url.length > 0) {
      candidateUrls.push(image_url);
    }

    if (candidateUrls.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const safeUrls = candidateUrls
        .filter((u) => supabaseUrl && u.startsWith(supabaseUrl))
        .slice(0, MAX_CHAT_IMAGES_PER_MESSAGE);

      // Fetch images in parallel; preserve input order.
      const fetched = await Promise.all(
        safeUrls.map(async (url) => {
          try {
            const imgResponse = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (!imgResponse.ok) return null;
            const imgBuffer = await imgResponse.arrayBuffer();
            const base64 = Buffer.from(imgBuffer).toString('base64');
            const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
            return { mimeType, data: base64 };
          } catch {
            return null;
          }
        })
      );
      for (const part of fetched) {
        if (part) userParts.push({ inlineData: part });
      }
    }

    contents.push({ role: 'user', parts: userParts });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemPrompt,
        },
        contents,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 60000)),
    ]);

    const text = response.text ?? '';

    // Extract JSON from the response (handle markdown code blocks, or raw JSON)
    let parsed: Record<string, unknown>;
    try {
      let jsonStr = text;
      // Try markdown code block first
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Try to find JSON object in the text (Gemini sometimes adds explanation around it)
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          jsonStr = braceMatch[0];
        }
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // JSON parse failed — Gemini returned plain text. Wrap it as a message response.
      console.warn('Gemini returned non-JSON response, wrapping as message:', text.substring(0, 200));
      parsed = {
        message: text || "I couldn't process that. Could you try rephrasing?",
        foods: [],
        exercises: [],
        drinks: [],
        measurements: [],
        food_edits: [],
        exercise_edits: [],
        drink_edits: [],
        measurement_edits: [],
      };
    }

    // --- Validate and clamp parsed output ---
    const responseMessage = typeof parsed.message === 'string' ? parsed.message : null;

    const foods = Array.isArray(parsed.foods)
      ? parsed.foods.map((f: Record<string, unknown>) => ({
          description: typeof f.description === 'string' ? f.description : 'Unknown food',
          meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(f.meal_type as string)
            ? f.meal_type
            : 'lunch',
          // food_logs columns are INTEGER — round so inserts don't fail on decimals.
          calories: Math.round(clamp(Number(f.calories) || 0, 0, 20000)),
          protein_g: Math.round(clamp(Number(f.protein_g) || 0, 0, 5000)),
          carbs_g: Math.round(clamp(Number(f.carbs_g) || 0, 0, 5000)),
          fat_g: Math.round(clamp(Number(f.fat_g) || 0, 0, 5000)),
        }))
      : [];

    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises.map((e: Record<string, unknown>) => ({
          exercise_type: typeof e.exercise_type === 'string' ? e.exercise_type : 'Exercise',
          duration_minutes: clamp(Number(e.duration_minutes) || 0, 0, 1440),
          calories_burned: clamp(Number(e.calories_burned) || 0, 0, 20000),
          notes: typeof e.notes === 'string' ? e.notes : '',
        }))
      : [];

    const DRINK_TYPES = ['water', 'coffee', 'tea', 'juice', 'soda', 'milk', 'other'];
    const drinks = Array.isArray(parsed.drinks)
      ? parsed.drinks.map((d: Record<string, unknown>) => ({
          description: typeof d.description === 'string' ? d.description : 'Unknown drink',
          drink_type: DRINK_TYPES.includes(d.drink_type as string)
            ? d.drink_type
            : 'other',
          volume_ml: clamp(Number(d.volume_ml) || 250, 0, 10000),
          calories: clamp(Number(d.calories) || 0, 0, 20000),
          protein_g: clamp(Number(d.protein_g) || 0, 0, 5000),
          carbs_g: clamp(Number(d.carbs_g) || 0, 0, 5000),
          fat_g: clamp(Number(d.fat_g) || 0, 0, 5000),
        }))
      : [];

    const measurements = Array.isArray(parsed.measurements)
      ? parsed.measurements.map((m: Record<string, unknown>) => ({
          height_cm: m.height_cm !== null && m.height_cm !== undefined ? clamp(Number(m.height_cm) || 0, 50, 300) : null,
          weight_kg: m.weight_kg !== null && m.weight_kg !== undefined ? clamp(Number(m.weight_kg) || 0, 10, 500) : null,
          notes: typeof m.notes === 'string' ? m.notes : null,
        })).filter((m: { height_cm: number | null; weight_kg: number | null }) => m.height_cm !== null || m.weight_kg !== null)
      : [];

    // --- Process edits: map indices to real log IDs ---
    const foodEdits: FoodEdit[] = [];
    const exerciseEdits: ExerciseEdit[] = [];
    const drinkEdits: DrinkEdit[] = [];
    const measurementEdits: MeasurementEdit[] = [];

    if (Array.isArray(parsed.food_edits) && typedContext?.todayFoodLogs) {
      for (const edit of parsed.food_edits) {
        const idx = Number(edit.index);
        const log = typedContext.todayFoodLogs.find((l) => l.index === idx);
        if (!log || !edit.updated || typeof edit.updated !== 'object') continue;

        const updated: Record<string, unknown> = {};
        if (edit.updated.description !== undefined) updated.description = String(edit.updated.description);
        if (edit.updated.meal_type !== undefined && ['breakfast', 'lunch', 'dinner', 'snack'].includes(edit.updated.meal_type)) {
          updated.meal_type = edit.updated.meal_type;
        }
        // food_logs columns are INTEGER — round so updates don't fail on decimals.
        if (edit.updated.calories !== undefined) updated.calories = Math.round(clamp(Number(edit.updated.calories) || 0, 0, 20000));
        if (edit.updated.protein_g !== undefined) updated.protein_g = Math.round(clamp(Number(edit.updated.protein_g) || 0, 0, 5000));
        if (edit.updated.carbs_g !== undefined) updated.carbs_g = Math.round(clamp(Number(edit.updated.carbs_g) || 0, 0, 5000));
        if (edit.updated.fat_g !== undefined) updated.fat_g = Math.round(clamp(Number(edit.updated.fat_g) || 0, 0, 5000));

        if (Object.keys(updated).length > 0) {
          foodEdits.push({
            log_id: log.id,
            original: {
              description: log.description,
              meal_type: log.meal_type,
              calories: log.calories,
              protein_g: log.protein_g,
              carbs_g: log.carbs_g,
              fat_g: log.fat_g,
            },
            updated,
          });
        }
      }
    }

    if (Array.isArray(parsed.exercise_edits) && typedContext?.todayExerciseLogs) {
      for (const edit of parsed.exercise_edits) {
        const idx = Number(edit.index);
        const log = typedContext.todayExerciseLogs.find((l) => l.index === idx);
        if (!log || !edit.updated || typeof edit.updated !== 'object') continue;

        const updated: Record<string, unknown> = {};
        if (edit.updated.exercise_type !== undefined) updated.exercise_type = String(edit.updated.exercise_type);
        if (edit.updated.duration_minutes !== undefined) updated.duration_minutes = clamp(Number(edit.updated.duration_minutes) || 0, 0, 1440);
        if (edit.updated.calories_burned !== undefined) updated.calories_burned = clamp(Number(edit.updated.calories_burned) || 0, 0, 20000);
        if (edit.updated.notes !== undefined) updated.notes = String(edit.updated.notes);

        if (Object.keys(updated).length > 0) {
          exerciseEdits.push({
            log_id: log.id,
            original: {
              exercise_type: log.exercise_type,
              duration_minutes: log.duration_minutes,
              calories_burned: log.calories_burned,
            },
            updated,
          });
        }
      }
    }

    if (Array.isArray(parsed.drink_edits) && typedContext?.todayDrinkLogs) {
      for (const edit of parsed.drink_edits) {
        const idx = Number(edit.index);
        const log = typedContext.todayDrinkLogs.find((l) => l.index === idx);
        if (!log || !edit.updated || typeof edit.updated !== 'object') continue;

        const updated: Record<string, unknown> = {};
        if (edit.updated.description !== undefined) updated.description = String(edit.updated.description);
        if (edit.updated.drink_type !== undefined && DRINK_TYPES.includes(edit.updated.drink_type)) {
          updated.drink_type = edit.updated.drink_type;
        }
        if (edit.updated.volume_ml !== undefined) updated.volume_ml = clamp(Number(edit.updated.volume_ml) || 0, 0, 10000);
        if (edit.updated.calories !== undefined) updated.calories = clamp(Number(edit.updated.calories) || 0, 0, 20000);
        if (edit.updated.protein_g !== undefined) updated.protein_g = clamp(Number(edit.updated.protein_g) || 0, 0, 5000);
        if (edit.updated.carbs_g !== undefined) updated.carbs_g = clamp(Number(edit.updated.carbs_g) || 0, 0, 5000);
        if (edit.updated.fat_g !== undefined) updated.fat_g = clamp(Number(edit.updated.fat_g) || 0, 0, 5000);

        if (Object.keys(updated).length > 0) {
          drinkEdits.push({
            log_id: log.id,
            original: {
              drink_type: log.drink_type,
              description: log.description,
              volume_ml: log.volume_ml,
              calories: log.calories,
              protein_g: log.protein_g,
              carbs_g: log.carbs_g,
              fat_g: log.fat_g,
            },
            updated,
          });
        }
      }
    }

    if (Array.isArray(parsed.measurement_edits) && typedContext?.todayMeasurementLogs) {
      for (const edit of parsed.measurement_edits) {
        const idx = Number(edit.index);
        const log = typedContext.todayMeasurementLogs.find((l) => l.index === idx);
        if (!log || !edit.updated || typeof edit.updated !== 'object') continue;

        const updated: Record<string, unknown> = {};
        if (edit.updated.height_cm !== undefined) updated.height_cm = clamp(Number(edit.updated.height_cm) || 0, 50, 300);
        if (edit.updated.weight_kg !== undefined) updated.weight_kg = clamp(Number(edit.updated.weight_kg) || 0, 10, 500);
        if (edit.updated.notes !== undefined) updated.notes = typeof edit.updated.notes === 'string' ? edit.updated.notes : null;

        if (Object.keys(updated).length > 0) {
          measurementEdits.push({
            log_id: log.id,
            original: {
              height_cm: log.height_cm,
              weight_kg: log.weight_kg,
              notes: log.notes,
            },
            updated,
          });
        }
      }
    }

    return NextResponse.json({
      message: responseMessage,
      foods,
      exercises,
      drinks,
      measurements,
      food_edits: foodEdits,
      exercise_edits: exerciseEdits,
      drink_edits: drinkEdits,
      measurement_edits: measurementEdits,
    });
  } catch (error) {
    console.error('Parse error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('deadline');
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isOverloaded = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorMsg.includes('overloaded');

    let userMessage = 'Sorry, something went wrong. Please try again.';
    let statusCode = 500;
    if (isTimeout) { userMessage = 'Request timed out. Please try again.'; statusCode = 504; }
    if (isRateLimit) { userMessage = "I've hit my usage limit. Please wait a minute and try again, or try a shorter message."; statusCode = 429; }
    if (isOverloaded) { userMessage = "The AI service is busy right now. Please try again in a few seconds."; statusCode = 503; }

    return NextResponse.json({ error: userMessage }, { status: statusCode });
  }
}
