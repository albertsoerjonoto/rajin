// Hardcoded to Jakarta for now — will switch to user's local timezone later
const TIMEZONE = 'Asia/Jakarta';

/**
 * Get today's date string (YYYY-MM-DD) in Jakarta timezone.
 */
export function getToday(): string {
  // en-CA locale gives YYYY-MM-DD format natively
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Format a YYYY-MM-DD string into a display string, with special labels
 * for Today / Yesterday / Tomorrow.
 */
export function formatDisplayDate(dateStr: string): string {
  const today = getToday();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  if (dateStr === tomorrow) return 'Tomorrow';

  // Parse at UTC noon to avoid any timezone-shift artifacts in display
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Add (or subtract) days from a YYYY-MM-DD string. All arithmetic is
 * done in UTC so timezone offsets never cause a day to be skipped.
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
