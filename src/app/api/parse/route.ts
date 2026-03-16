import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { clamp } from '@/lib/validation';
import type { ChatContext, FoodEdit, ExerciseEdit } from '@/lib/types';

const BASE_PROMPT = `You are a nutrition and exercise assistant. You MUST reply in the same language the user writes in. If they write in English, reply in English. If they write in Bahasa Indonesia, reply in Bahasa Indonesia. If they write in Chinese, reply in Chinese. This applies to any language — always match the user's language.

You can:
1. **Log food/exercise** — parse what the user ate or did and return structured data
2. **Edit existing logs** — modify a previously logged entry when the user asks
3. **Answer questions** — about their nutrition, calories, macros, progress today
4. **Give recommendations** — suggest meals or exercises based on their remaining budget

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
- Es jeruk: ~90 cal, 0g protein, 22g carbs, 0g fat
- Kopi susu: ~120 cal, 3g protein, 15g carbs, 5g fat

IMPORTANT: This list is NOT exhaustive. You know thousands of foods. For ANY food not listed above (e.g. nasi bogana, lontong sayur, martabak, pizza, sushi, etc.), use your general knowledge to provide your best calorie and macro estimate. NEVER ask the user to provide calorie counts — that is YOUR job. If the user mentions a portion size (e.g. "half portion"), adjust the estimate accordingly. Always log the food with your best estimate.

Exercise calorie estimates:
- Running: ~100 cal per 10 min
- Walking: ~40 cal per 10 min
- Cycling: ~80 cal per 10 min
- Swimming: ~100 cal per 10 min
- Gym/weights: ~60 cal per 10 min
- Yoga: ~30 cal per 10 min
- For running distances: assume ~6 min/km pace

Determine meal_type based on context or time mentioned. Default to "lunch" if unclear.`;

function buildSystemPrompt(context?: ChatContext): string {
  let prompt = BASE_PROMPT;

  if (context) {
    prompt += '\n\n--- USER CONTEXT (TODAY) ---\n';

    if (context.profile) {
      prompt += `\nUser: ${context.profile.display_name || 'Unknown'}`;
      prompt += `\nCalorie target: ${context.profile.calorieTarget} cal/day (TDEE: ${context.profile.tdee})`;
      prompt += `\nMacro targets — Protein: ${context.profile.proteinTarget}, Carbs: ${context.profile.carbsTarget}, Fat: ${context.profile.fatTarget}`;
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
  ]
}

Rules:
- Use "foods"/"exercises" for NEW entries the user wants to add
- Use "food_edits"/"exercise_edits" when the user wants to CHANGE an existing log. Reference the log by its # index from the context above. Only include fields that changed in "updated".
- Use "message" for answering questions, giving recommendations, or any conversational response. Keep it concise and friendly.
- CRITICAL LANGUAGE RULE: The "message" field MUST be written in the SAME language the user used. If the user writes in English, the message MUST be in English. If in Bahasa Indonesia, reply in Bahasa Indonesia. If in Chinese, reply in Chinese. Always match the user's language exactly.
- Multiple arrays can be populated at once (e.g., add new food AND edit an existing one)
- If the user's input doesn't match any action, return: { "message": "helpful response", "foods": [], "exercises": [], "food_edits": [], "exercise_edits": [] }
- Always return valid JSON only, never include explanation text outside the JSON.`;

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
    const { message, context, history } = await request.json();

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
    const ai = new GoogleGenAI({ apiKey });

    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '{"message": null, "foods": [], "exercises": [], "food_edits": [], "exercise_edits": []}' }] },
    ];

    // Add conversation history (last ~10 messages from frontend)
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === 'user' && typeof msg.content === 'string') {
          contents.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant' && typeof msg.content === 'string') {
          contents.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      }
    }

    // Add the current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
    });

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
        food_edits: [],
        exercise_edits: [],
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
          calories: clamp(Number(f.calories) || 0, 0, 20000),
          protein_g: clamp(Number(f.protein_g) || 0, 0, 5000),
          carbs_g: clamp(Number(f.carbs_g) || 0, 0, 5000),
          fat_g: clamp(Number(f.fat_g) || 0, 0, 5000),
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

    // --- Process edits: map indices to real log IDs ---
    const typedContext = context as ChatContext | undefined;
    const foodEdits: FoodEdit[] = [];
    const exerciseEdits: ExerciseEdit[] = [];

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
        if (edit.updated.calories !== undefined) updated.calories = clamp(Number(edit.updated.calories) || 0, 0, 20000);
        if (edit.updated.protein_g !== undefined) updated.protein_g = clamp(Number(edit.updated.protein_g) || 0, 0, 5000);
        if (edit.updated.carbs_g !== undefined) updated.carbs_g = clamp(Number(edit.updated.carbs_g) || 0, 0, 5000);
        if (edit.updated.fat_g !== undefined) updated.fat_g = clamp(Number(edit.updated.fat_g) || 0, 0, 5000);

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

    return NextResponse.json({
      message: responseMessage,
      foods,
      exercises,
      food_edits: foodEdits,
      exercise_edits: exerciseEdits,
    });
  } catch (error) {
    console.error('Parse error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('deadline');
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');

    let userMessage = `Sorry, something went wrong. Please try again. (Debug: ${errorMsg.substring(0, 200)})`;
    if (isTimeout) userMessage = 'The request took too long. Please try a shorter message.';
    if (isRateLimit) userMessage = "I've hit my usage limit. Please wait a minute and try again, or try a shorter message.";

    return NextResponse.json({
      message: userMessage,
      foods: [],
      exercises: [],
      food_edits: [],
      exercise_edits: [],
    });
  }
}
