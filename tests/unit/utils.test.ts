import { describe, expect, it } from 'vitest';
import { cn, getDateRange, getDatesInRange, getToday } from '@/lib/utils';

describe('cn (classnames helper)', () => {
  it('joins truthy classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('skips falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, '', 'c')).toBe('a c');
  });

  it('dedupes conflicting tailwind classes if tailwind-merge is wired', () => {
    // cn may use tailwind-merge under the hood; either behavior is acceptable —
    // we just want it to never crash on conflicts.
    expect(() => cn('p-1 p-2', 'text-red-500 text-blue-500')).not.toThrow();
  });
});

describe('getToday', () => {
  it('returns an ISO date string (YYYY-MM-DD)', () => {
    const today = getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getDateRange / getDatesInRange', () => {
  it('returns a single-day range for period=day', () => {
    const range = getDateRange('2025-01-15', 'day');
    expect(range.start).toBe('2025-01-15');
    expect(range.end).toBe('2025-01-15');
  });

  it('returns 7 dates for a week range', () => {
    const range = getDateRange('2025-01-15', 'week');
    const dates = getDatesInRange(range.start, range.end);
    expect(dates.length).toBe(7);
  });

  it('produces strictly increasing dates', () => {
    const dates = getDatesInRange('2025-01-01', '2025-01-05');
    expect(dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05']);
  });
});
