import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { clamp } from '@/lib/validation';

const SYSTEM_PROMPT = `You are a nutrition and exercise assistant for an Indonesian user. Parse the user's natural language input and extract:

1. **Food items** with estimated calories and macros. You know common Indonesian foods well:
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

2. **Exercise items** with estimated duration and calories burned:
   - Running: ~100 cal per 10 min
   - Walking: ~40 cal per 10 min
   - Cycling: ~80 cal per 10 min
   - Swimming: ~100 cal per 10 min
   - Gym/weights: ~60 cal per 10 min
   - Yoga: ~30 cal per 10 min
   - For running distances: assume ~6 min/km pace

Determine meal_type based on context or time mentioned. Default to "lunch" if unclear.

RESPOND ONLY WITH VALID JSON in this exact format:
{
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
  ]
}

If the input doesn't contain food or exercise info, return empty arrays. Never include explanation text, only JSON.`;

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
    const { message } = await request.json();

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

    // --- Call Gemini ---
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nUser input: ${message}` }],
        },
      ],
    });

    const text = response.text ?? '';

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // --- Validate and clamp parsed output ---
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

    return NextResponse.json({ foods, exercises });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse input', foods: [], exercises: [] },
      { status: 500 }
    );
  }
}
