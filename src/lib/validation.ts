/**
 * Shared input validators for forms and API routes.
 * Each returns the parsed number (or true) on success, or null/false on failure.
 */

export function validateCalories(val: string): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0 || n > 20000) return null;
  return Math.round(n);
}

export function validateDuration(val: string): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0 || n > 1440) return null;
  return Math.round(n);
}

export function validateMacro(val: string): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0 || n > 5000) return null;
  return Math.round(n * 10) / 10; // one decimal
}

export function validateCalorieGoal(val: string): number | null {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 500 || n > 10000) return null;
  return n;
}

export function validateDOB(val: string): boolean {
  if (!val) return false;
  const dob = new Date(val + 'T00:00:00');
  if (isNaN(dob.getTime())) return false;

  const now = new Date();
  if (dob >= now) return false; // no future dates

  const ageMs = now.getTime() - dob.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears >= 1 && ageYears <= 120;
}

export function validateBodyStat(
  val: string,
  min: number,
  max: number
): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
