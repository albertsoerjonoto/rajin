import { createClient } from '@/lib/supabase/client';

interface HabitLogEntry {
  date: string;
  completed: boolean;
}

export function calculateStreak(logs: HabitLogEntry[], today: string): { current: number; longest: number; lastCompleted: string | null } {
  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => l.date)
  );

  if (completedDates.size === 0) {
    return { current: 0, longest: 0, lastCompleted: null };
  }

  // Sort dates descending
  const sorted = [...completedDates].sort((a, b) => b.localeCompare(a));
  const lastCompleted = sorted[0];

  // Calculate current streak: consecutive days ending today or yesterday
  let current = 0;
  let checkDate = today;

  // If today isn't completed, start from yesterday
  if (!completedDates.has(today)) {
    checkDate = addDaysStr(today, -1);
    if (!completedDates.has(checkDate)) {
      // No streak (gap of 2+ days)
      current = 0;
    }
  }

  if (current === 0 && completedDates.has(checkDate)) {
    let d = checkDate;
    while (completedDates.has(d)) {
      current++;
      d = addDaysStr(d, -1);
    }
  }

  // Calculate longest streak
  let longest = 0;
  let streak = 0;
  // Sort ascending for longest
  const asc = [...completedDates].sort();
  for (let i = 0; i < asc.length; i++) {
    if (i === 0 || asc[i] === addDaysStr(asc[i - 1], 1)) {
      streak++;
    } else {
      streak = 1;
    }
    longest = Math.max(longest, streak);
  }

  return { current, longest, lastCompleted };
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

export async function updateHabitStreak(userId: string, habitId: string, today: string) {
  const sb = createClient();

  // Fetch all logs for this habit
  const { data: logs } = await sb
    .from('habit_logs')
    .select('date, completed')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .eq('completed', true)
    .order('date', { ascending: false })
    .limit(400);

  if (!logs) return null;

  const { current, longest, lastCompleted } = calculateStreak(logs, today);

  // Upsert streak
  const { data } = await sb
    .from('habit_streaks')
    .upsert({
      user_id: userId,
      habit_id: habitId,
      current_streak: current,
      longest_streak: longest,
      last_completed_date: lastCompleted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,habit_id' })
    .select()
    .single();

  return data;
}

export function calculateSharedStreak(
  userLogs: HabitLogEntry[],
  friendLogs: HabitLogEntry[],
  today: string
): number {
  const userDates = new Set(userLogs.filter(l => l.completed).map(l => l.date));
  const friendDates = new Set(friendLogs.filter(l => l.completed).map(l => l.date));

  // Shared streak: consecutive days where BOTH completed
  let streak = 0;
  let checkDate = today;

  // Start from today or yesterday
  if (!(userDates.has(checkDate) && friendDates.has(checkDate))) {
    checkDate = addDaysStr(today, -1);
  }

  while (userDates.has(checkDate) && friendDates.has(checkDate)) {
    streak++;
    checkDate = addDaysStr(checkDate, -1);
  }

  return streak;
}

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100, 365];

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}
