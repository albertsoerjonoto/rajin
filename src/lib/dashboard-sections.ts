import type { DashboardSection, DashboardSectionId } from './types';

export const ALL_SECTION_IDS: DashboardSectionId[] = [
  'habits',
  'supplements',
  'skincare',
  'superfoods',
  'diet',
  'exercise',
];

export const DEFAULT_SECTIONS: DashboardSection[] = ALL_SECTION_IDS.map((id) => ({
  id,
  visible: true,
}));

const VALID_IDS = new Set<DashboardSectionId>(ALL_SECTION_IDS);

function isValidSection(s: unknown): s is DashboardSection {
  return (
    typeof s === 'object' &&
    s !== null &&
    'id' in s &&
    'visible' in s &&
    typeof (s as DashboardSection).visible === 'boolean' &&
    VALID_IDS.has((s as DashboardSection).id)
  );
}

// Returns the effective ordered list of sections for the dashboard.
// - If `stored` is null/empty, returns the defaults (all visible, canonical order).
// - Filters out unknown IDs and de-duplicates by id (first occurrence wins).
// - Appends any missing default sections to the tail (so a future SectionId added
//   in code automatically appears for users who saved an older list).
export function resolveSections(
  stored: DashboardSection[] | null | undefined
): DashboardSection[] {
  if (!stored || stored.length === 0) return DEFAULT_SECTIONS;

  const seen = new Set<DashboardSectionId>();
  const cleaned: DashboardSection[] = [];
  for (const s of stored) {
    if (!isValidSection(s)) continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    cleaned.push({ id: s.id, visible: s.visible });
  }

  for (const id of ALL_SECTION_IDS) {
    if (!seen.has(id)) {
      cleaned.push({ id, visible: true });
    }
  }

  return cleaned;
}

export const SECTION_TITLE_KEYS: Record<DashboardSectionId, string> = {
  habits: 'dashboard.section.habits',
  supplements: 'dashboard.section.supplements',
  skincare: 'dashboard.section.skincare',
  superfoods: 'dashboard.section.superfoods',
  diet: 'dashboard.diet',
  exercise: 'dashboard.exercise',
};
