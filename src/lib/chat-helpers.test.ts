import { describe, it, expect } from 'vitest';
import { roundFoodUpdate, dbRowToMessage, buildHistory } from './chat-helpers';
import type { ChatMessage } from './types';

const baseRow: ChatMessage = {
  id: 'r1',
  user_id: 'u1',
  date: '2026-05-03',
  role: 'user',
  content: 'hi',
  image_url: null,
  image_urls: null,
  parsed_foods: null,
  parsed_exercises: null,
  parsed_drinks: null,
  parsed_measurements: null,
  food_edits: null,
  exercise_edits: null,
  drink_edits: null,
  measurement_edits: null,
  saved: false,
  created_at: '2026-05-03T10:00:00Z',
};

describe('roundFoodUpdate', () => {
  it('rounds integer-stored macro fields', () => {
    expect(roundFoodUpdate({ calories: 123.7, protein_g: 4.4, carbs_g: 9.6, fat_g: 1.3 })).toEqual({
      calories: 124,
      protein_g: 4,
      carbs_g: 10,
      fat_g: 1,
    });
  });

  it('preserves untouched fields and leaves undefined macros alone', () => {
    expect(roundFoodUpdate({ description: 'pizza', meal_type: 'dinner' })).toEqual({
      description: 'pizza',
      meal_type: 'dinner',
    });
  });

  it('handles a zero calorie value', () => {
    expect(roundFoodUpdate({ calories: 0 })).toEqual({ calories: 0 });
  });
});

describe('dbRowToMessage', () => {
  it('uses image_urls array when present', () => {
    const view = dbRowToMessage({
      ...baseRow,
      image_urls: ['https://x/1.jpg', 'https://x/2.jpg'],
      image_url: 'https://x/1.jpg',
    });
    expect(view.imageUrls).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('falls back to legacy image_url when image_urls is null (pre-027 rows)', () => {
    const view = dbRowToMessage({
      ...baseRow,
      image_urls: null,
      image_url: 'https://x/legacy.jpg',
    });
    expect(view.imageUrls).toEqual(['https://x/legacy.jpg']);
  });

  it('falls back to legacy image_url when image_urls is empty array', () => {
    const view = dbRowToMessage({
      ...baseRow,
      image_urls: [],
      image_url: 'https://x/legacy.jpg',
    });
    expect(view.imageUrls).toEqual(['https://x/legacy.jpg']);
  });

  it('returns undefined when no image at all', () => {
    const view = dbRowToMessage({ ...baseRow, image_urls: null, image_url: null });
    expect(view.imageUrls).toBeUndefined();
  });
});

describe('buildHistory', () => {
  it('drops the welcome stub', () => {
    const out = buildHistory([
      { id: 'welcome', role: 'assistant', content: 'hi there' },
      { id: 'm1', role: 'user', content: 'hello' },
    ]);
    expect(out).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('drops transient error- bubbles (id-prefixed) so they do not poison context', () => {
    const out = buildHistory([
      { id: 'm1', role: 'user', content: 'log a sandwich' },
      { id: 'error-123', role: 'assistant', content: 'something went wrong' },
      { id: 'm2', role: 'user', content: 'try again' },
    ]);
    expect(out.map((m) => m.content)).toEqual(['log a sandwich', 'try again']);
  });

  it('KEEPS conversational assistant replies that have no parsed data — the per-day memory bug fix', () => {
    // Before the fix, this conversational reply was dropped from history because it had no
    // parsedFoods/etc, which made the model unable to remember its own previous answer.
    const out = buildHistory([
      { id: 'm1', role: 'user', content: 'how many calories left?' },
      { id: 'm2', role: 'assistant', content: 'You have ~600 calories left for today.' },
      { id: 'm3', role: 'user', content: 'recommend a snack' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ role: 'assistant', content: 'You have ~600 calories left for today.' });
  });

  it('keeps assistant structured-data fields on the wrapped history entry', () => {
    const out = buildHistory([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Logged a sandwich.',
        parsedFoods: [{ description: 'sandwich', meal_type: 'lunch', calories: 400, protein_g: 20, carbs_g: 40, fat_g: 12 }],
      },
    ]);
    expect(out[0]).toMatchObject({
      role: 'assistant',
      content: 'Logged a sandwich.',
      parsedFoods: [{ description: 'sandwich', meal_type: 'lunch', calories: 400, protein_g: 20, carbs_g: 40, fat_g: 12 }],
    });
  });

  it('caps to last `limit` messages', () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `msg ${i}`,
    }));
    const out = buildHistory(msgs, 20);
    expect(out).toHaveLength(20);
    expect(out[0].content).toBe('msg 10');
    expect(out[19].content).toBe('msg 29');
  });

  it('does not include parsed* fields on user-role entries', () => {
    const out = buildHistory([
      { id: 'm1', role: 'user', content: 'hi' },
    ]);
    expect(out[0]).toEqual({ role: 'user', content: 'hi' });
  });
});
