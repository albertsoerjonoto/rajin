import { describe, it, expect } from 'vitest';
import {
  gatherCandidateImageUrls,
  isSafeImageUrl,
  extractJsonString,
  clampParsedFoods,
  clampParsedExercises,
  clampParsedDrinks,
  clampParsedMeasurements,
} from './parse-helpers';

describe('gatherCandidateImageUrls', () => {
  it('returns image_urls verbatim when present', () => {
    expect(
      gatherCandidateImageUrls({ image_urls: ['https://x/1.jpg', 'https://x/2.jpg'] }),
    ).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('falls back to image_url (legacy single) when image_urls missing', () => {
    expect(gatherCandidateImageUrls({ image_url: 'https://x/legacy.jpg' })).toEqual([
      'https://x/legacy.jpg',
    ]);
  });

  it('prefers image_urls over image_url even when both set', () => {
    expect(
      gatherCandidateImageUrls({
        image_urls: ['https://x/new.jpg'],
        image_url: 'https://x/legacy.jpg',
      }),
    ).toEqual(['https://x/new.jpg']);
  });

  it('rejects non-string entries inside image_urls', () => {
    expect(
      gatherCandidateImageUrls({ image_urls: ['https://x/1.jpg', 42, null, undefined, ''] }),
    ).toEqual(['https://x/1.jpg']);
  });

  it('returns empty list when both fields missing', () => {
    expect(gatherCandidateImageUrls({})).toEqual([]);
  });

  it('returns empty list when image_urls is empty array AND image_url is empty string', () => {
    expect(gatherCandidateImageUrls({ image_urls: [], image_url: '' })).toEqual([]);
  });

  it('rejects non-array image_urls', () => {
    expect(gatherCandidateImageUrls({ image_urls: 'https://x/wrong.jpg' as unknown })).toEqual([]);
  });
});

describe('isSafeImageUrl (SSRF guard)', () => {
  const supa = 'https://abc.supabase.co';

  it('accepts urls that begin with the configured Supabase origin', () => {
    expect(isSafeImageUrl(`${supa}/storage/v1/object/public/chat-images/foo.jpg`, supa)).toBe(true);
  });

  it('rejects http://169.254.169.254 (cloud metadata SSRF)', () => {
    expect(isSafeImageUrl('http://169.254.169.254/latest/meta-data/', supa)).toBe(false);
  });

  it('rejects file:// URLs', () => {
    expect(isSafeImageUrl('file:///etc/passwd', supa)).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeImageUrl('data:image/png;base64,iVBOR', supa)).toBe(false);
  });

  it('rejects an attacker-controlled https host', () => {
    expect(isSafeImageUrl('https://attacker.com/payload.jpg', supa)).toBe(false);
  });

  it('rejects everything when supabaseOrigin is undefined (misconfig fail-closed)', () => {
    expect(isSafeImageUrl(`${supa}/x.jpg`, undefined)).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isSafeImageUrl(undefined, supa)).toBe(false);
    expect(isSafeImageUrl(null, supa)).toBe(false);
    expect(isSafeImageUrl(42, supa)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeImageUrl('', supa)).toBe(false);
  });
});

describe('extractJsonString (Gemini response shapes)', () => {
  it('returns the raw string when it is already valid JSON-shaped', () => {
    const txt = '{"message":"hi","foods":[]}';
    expect(extractJsonString(txt)).toBe(txt);
  });

  it('strips ```json …``` code fences', () => {
    const txt = '```json\n{"message":"hi"}\n```';
    expect(extractJsonString(txt)).toBe('{"message":"hi"}');
  });

  it('strips bare ``` …``` code fences (no language tag)', () => {
    const txt = '```\n{"message":"hi"}\n```';
    expect(extractJsonString(txt)).toBe('{"message":"hi"}');
  });

  it('extracts a JSON object embedded in prose', () => {
    const txt = 'Sure! Here is the result: {"message":"hi","foods":[{"description":"x"}]} — done.';
    expect(extractJsonString(txt)).toBe('{"message":"hi","foods":[{"description":"x"}]}');
  });

  it('falls through to the original text when there is no JSON to extract', () => {
    const txt = 'plain text response with no braces';
    expect(extractJsonString(txt)).toBe(txt);
  });

  it('handles multi-line JSON with nested objects', () => {
    const txt = '```json\n{\n  "foods": [{"meal_type": "lunch"}]\n}\n```';
    expect(extractJsonString(txt)).toBe('{\n  "foods": [{"meal_type": "lunch"}]\n}');
  });

  it('returns a single substring when JSON appears once with surrounding prose', () => {
    // Greedy regex matches first `{` through last `}`. With one JSON object
    // present that's exactly what we want; if Gemini ever returned multiple
    // JSON objects the caller's JSON.parse would catch the malformed case.
    const txt = 'Pre-text {"a":1,"b":[1,2,3]} post-text';
    expect(extractJsonString(txt)).toBe('{"a":1,"b":[1,2,3]}');
  });
});

describe('clampParsedFoods', () => {
  it('rounds and clamps macros', () => {
    expect(
      clampParsedFoods([
        { description: 'pizza', meal_type: 'dinner', calories: 1234.7, protein_g: 4.4, carbs_g: 9.6, fat_g: 1.2 },
      ]),
    ).toEqual([
      { description: 'pizza', meal_type: 'dinner', calories: 1235, protein_g: 4, carbs_g: 10, fat_g: 1 },
    ]);
  });

  it('defaults invalid meal_type to lunch', () => {
    expect(clampParsedFoods([{ description: 'x', meal_type: 'midnight-feast' }])[0].meal_type).toBe('lunch');
  });

  it('clamps overflow calories to 20000', () => {
    expect(clampParsedFoods([{ description: 'x', calories: 5_000_000 }])[0].calories).toBe(20000);
  });

  it('clamps negative calories to 0', () => {
    expect(clampParsedFoods([{ description: 'x', calories: -50 }])[0].calories).toBe(0);
  });

  it('substitutes Unknown food when description is missing', () => {
    expect(clampParsedFoods([{ calories: 100 }])[0].description).toBe('Unknown food');
  });

  it('returns [] for non-array input', () => {
    expect(clampParsedFoods(undefined)).toEqual([]);
    expect(clampParsedFoods(null)).toEqual([]);
    expect(clampParsedFoods('foods')).toEqual([]);
    expect(clampParsedFoods({})).toEqual([]);
  });

  it('coerces NaN/string macros to 0', () => {
    const out = clampParsedFoods([{ description: 'x', calories: 'not-a-number', protein_g: NaN }])[0];
    expect(out.calories).toBe(0);
    expect(out.protein_g).toBe(0);
  });
});

describe('clampParsedExercises', () => {
  it('clamps duration to a 24h ceiling', () => {
    expect(clampParsedExercises([{ exercise_type: 'run', duration_minutes: 5000 }])[0].duration_minutes).toBe(1440);
  });

  it('substitutes Exercise default name', () => {
    expect(clampParsedExercises([{ duration_minutes: 30 }])[0].exercise_type).toBe('Exercise');
  });

  it('returns empty notes when not a string', () => {
    expect(clampParsedExercises([{ exercise_type: 'run', notes: 42 }])[0].notes).toBe('');
  });
});

describe('clampParsedDrinks', () => {
  it('defaults invalid drink_type to other', () => {
    expect(clampParsedDrinks([{ description: 'x', drink_type: 'soup' }])[0].drink_type).toBe('other');
  });

  it('defaults missing volume_ml to 250', () => {
    expect(clampParsedDrinks([{ description: 'x' }])[0].volume_ml).toBe(250);
  });

  it('clamps absurd volumes (10L+) to 10000', () => {
    expect(clampParsedDrinks([{ description: 'x', volume_ml: 100_000 }])[0].volume_ml).toBe(10000);
  });
});

describe('clampParsedMeasurements', () => {
  it('drops entries where both height and weight are null', () => {
    expect(clampParsedMeasurements([{ height_cm: null, weight_kg: null, notes: 'morning' }])).toEqual([]);
  });

  it('keeps entries with weight only', () => {
    const out = clampParsedMeasurements([{ height_cm: null, weight_kg: 75, notes: null }]);
    expect(out).toEqual([{ height_cm: null, weight_kg: 75, notes: null }]);
  });

  it('clamps weight to 10..500 kg', () => {
    expect(clampParsedMeasurements([{ weight_kg: 0.5 }])[0].weight_kg).toBe(10);
    expect(clampParsedMeasurements([{ weight_kg: 9999 }])[0].weight_kg).toBe(500);
  });

  it('clamps height to 50..300 cm', () => {
    expect(clampParsedMeasurements([{ height_cm: 5 }])[0].height_cm).toBe(50);
    expect(clampParsedMeasurements([{ height_cm: 9999 }])[0].height_cm).toBe(300);
  });

  it('returns [] for non-array input', () => {
    expect(clampParsedMeasurements(undefined)).toEqual([]);
    expect(clampParsedMeasurements({})).toEqual([]);
  });
});
