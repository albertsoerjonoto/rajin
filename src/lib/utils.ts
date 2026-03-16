import type { Locale } from './types';

// Hardcoded to Jakarta for now — will switch to user's local timezone later
const TIMEZONE = 'Asia/Jakarta';

/**
 * Get today's date string (YYYY-MM-DD) in Jakarta timezone.
 */
export function getToday(): string {
  // en-CA locale gives YYYY-MM-DD format natively
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

const DATE_LOCALE_MAP: Record<Locale, string> = { id: 'id-ID', en: 'en-US' };

/**
 * Format a YYYY-MM-DD string into a display string, with special labels
 * for Today / Yesterday / Tomorrow.
 */
export function formatDisplayDate(dateStr: string, locale: Locale = 'id'): string {
  const today = getToday();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  if (dateStr === today) return locale === 'id' ? 'Hari Ini' : 'Today';
  if (dateStr === yesterday) return locale === 'id' ? 'Kemarin' : 'Yesterday';
  if (dateStr === tomorrow) return locale === 'id' ? 'Besok' : 'Tomorrow';

  // Parse at UTC noon to avoid any timezone-shift artifacts in display
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString(DATE_LOCALE_MAP[locale], {
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

export type Period = 'day' | 'week' | 'month' | 'year';

export function formatWeekLabel(dateStr: string, locale: Locale = 'id'): string {
  const today = getToday();
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(dateStr, monOffset);
  const sunday = addDays(monday, 6);

  const todayD = new Date(today + 'T12:00:00Z');
  const todayDow = todayD.getUTCDay();
  const todayMonOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = addDays(today, todayMonOffset);

  if (monday === thisMonday) return locale === 'id' ? 'Minggu Ini' : 'This Week';
  if (monday === addDays(thisMonday, -7)) return locale === 'id' ? 'Minggu Lalu' : 'Last Week';
  if (monday === addDays(thisMonday, 7)) return locale === 'id' ? 'Minggu Depan' : 'Next Week';

  const dl = DATE_LOCALE_MAP[locale];
  const m = new Date(monday + 'T12:00:00Z');
  const s = new Date(sunday + 'T12:00:00Z');
  const mLabel = m.toLocaleDateString(dl, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const sLabel = s.toLocaleDateString(dl, { day: 'numeric', timeZone: 'UTC' });
  return `${mLabel}–${sLabel}`;
}

export function formatMonthLabel(dateStr: string, locale: Locale = 'id'): string {
  const today = getToday();
  const d = new Date(dateStr + 'T12:00:00Z');
  const t = new Date(today + 'T12:00:00Z');

  if (d.getUTCFullYear() === t.getUTCFullYear() && d.getUTCMonth() === t.getUTCMonth()) {
    return locale === 'id' ? 'Bulan Ini' : 'This Month';
  }

  const prevMonth = new Date(t);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  if (d.getUTCFullYear() === prevMonth.getUTCFullYear() && d.getUTCMonth() === prevMonth.getUTCMonth()) {
    return locale === 'id' ? 'Bulan Lalu' : 'Last Month';
  }

  return d.toLocaleDateString(DATE_LOCALE_MAP[locale], {
    month: 'long',
    year: d.getUTCFullYear() === t.getUTCFullYear() ? undefined : 'numeric',
    timeZone: 'UTC',
  });
}

export function formatYearLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return String(d.getUTCFullYear());
}

export function navigateByPeriod(dateStr: string, period: Period, direction: 1 | -1): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  switch (period) {
    case 'day':
      return addDays(dateStr, direction);
    case 'week':
      return addDays(dateStr, direction * 7);
    case 'month': {
      d.setUTCMonth(d.getUTCMonth() + direction);
      return d.toISOString().split('T')[0];
    }
    case 'year': {
      d.setUTCFullYear(d.getUTCFullYear() + direction);
      return d.toISOString().split('T')[0];
    }
  }
}
