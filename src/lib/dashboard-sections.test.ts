import { describe, it, expect } from 'vitest';
import {
  ALL_SECTION_IDS,
  DEFAULT_SECTIONS,
  resolveSections,
} from './dashboard-sections';
import type { DashboardSection } from './types';

describe('resolveSections', () => {
  it('returns defaults when stored is null', () => {
    expect(resolveSections(null)).toEqual(DEFAULT_SECTIONS);
  });

  it('returns defaults when stored is undefined', () => {
    expect(resolveSections(undefined)).toEqual(DEFAULT_SECTIONS);
  });

  it('returns defaults when stored is an empty array', () => {
    expect(resolveSections([])).toEqual(DEFAULT_SECTIONS);
  });

  it('preserves user order and visibility', () => {
    const stored: DashboardSection[] = [
      { id: 'exercise', visible: true },
      { id: 'diet', visible: false },
      { id: 'habits', visible: true },
      { id: 'supplements', visible: true },
      { id: 'skincare', visible: false },
      { id: 'superfoods', visible: true },
    ];
    expect(resolveSections(stored)).toEqual(stored);
  });

  it('appends missing default sections to the tail', () => {
    const stored: DashboardSection[] = [
      { id: 'diet', visible: false },
      { id: 'exercise', visible: true },
    ];
    const out = resolveSections(stored);
    expect(out[0]).toEqual({ id: 'diet', visible: false });
    expect(out[1]).toEqual({ id: 'exercise', visible: true });
    // Remaining 4 sections appended with visible: true
    expect(out.length).toBe(ALL_SECTION_IDS.length);
    expect(out.slice(2).every((s) => s.visible)).toBe(true);
  });

  it('filters out unknown ids', () => {
    const stored = [
      { id: 'habits', visible: true },
      { id: 'unknown_section', visible: true },
      { id: 'diet', visible: true },
    ] as unknown as DashboardSection[];
    const out = resolveSections(stored);
    expect(out.map((s) => s.id)).not.toContain('unknown_section');
    expect(out.length).toBe(ALL_SECTION_IDS.length);
  });

  it('de-duplicates by id (first occurrence wins)', () => {
    const stored: DashboardSection[] = [
      { id: 'habits', visible: false },
      { id: 'habits', visible: true },
    ];
    const out = resolveSections(stored);
    const habits = out.filter((s) => s.id === 'habits');
    expect(habits.length).toBe(1);
    expect(habits[0].visible).toBe(false);
  });
});
