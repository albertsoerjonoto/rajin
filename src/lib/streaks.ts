import { createClient } from '@/lib/supabase/client';

interface HabitLogEntry {
  date: string;
  completed: boolean;
}

export function calculateStreak(
  logs: HabitLogEntry[],
  today: string,
  intervalDays: number = 1
): { current: number; longest: number; lastCompleted: string | null } {
  const interval = Math.max(1, Math.floor(intervalDays));
  const completedDates = [...new Set(
    logs.filter(l => l.completed).map(l => l.date)
  )].sort(); // ascending

  if (completedDates.length === 0) {
    return { current: 0, longest: 0, lastCompleted: null };
  }

  const lastCompleted = completedDates[completedDates.length - 1];

  // Current streak: alive if the last completion is within `interval` days
  // of today. Walk backwards through completions, counting each as part of
  // the chain while each gap between successive completions is ≤ interval.
  let current = 0;
  if (daysBetween(lastCompleted, today) <= interval) {
    current = 1;
    for (let i = completedDates.length - 2; i >= 0; i--) {
      if (daysBetween(completedDates[i], completedDates[i + 1]) <= interval) {
        current++;
      } else {
        break;
      }
    }
  }

  // Longest streak: scan ascending, counting completions chained by ≤ interval gaps.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < completedDates.length; i++) {
    if (daysBetween(completedDates[i - 1], completedDates[i]) <= interval) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  return { current, longest, lastCompleted };
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T12:00:00Z').getTime();
  const b = new Date(later + 'T12:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

export async function updateHabitStreak(userId: string, habitId: string, today: string) {
  const sb = createClient();

  // Fetch the habit's streak interval setting along with its completed logs.
  const [habitRes, logsRes] = await Promise.all([
    sb.from('habits').select('streak_interval_days').eq('id', habitId).single(),
    sb.from('habit_logs')
      .select('date, completed')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false })
      .limit(400),
  ]);

  const logs = logsRes.data;
  if (!logs) return null;

  const intervalDays = habitRes.data?.streak_interval_days ?? 1;
  const { current, longest, lastCompleted } = calculateStreak(logs, today, intervalDays);

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

/**
 * After a user toggles a habit, check if it's shared and update shared_streaks.
 * Also emit shared_streak_milestone feed events when milestones are hit.
 */
export async function updateSharedStreaks(
  userId: string,
  habitId: string,
  today: string,
  isCompleting: boolean
): Promise<void> {
  const sb = createClient();

  // Find all accepted shared_habits where this habit is involved
  const { data: sharedHabits } = await sb
    .from('shared_habits')
    .select('id, habit_id, owner_id, friend_id, friend_habit_id')
    .eq('status', 'accepted')
    .or(`and(owner_id.eq.${userId},habit_id.eq.${habitId}),and(friend_id.eq.${userId},friend_habit_id.eq.${habitId})`);

  if (!sharedHabits || sharedHabits.length === 0) return;

  for (const sh of sharedHabits) {
    const isOwner = sh.owner_id === userId;
    const otherUserId = isOwner ? sh.friend_id : sh.owner_id;
    const otherHabitId = isOwner ? sh.friend_habit_id : sh.habit_id;

    if (!otherHabitId) continue;

    // Check if the other user completed their habit today
    const { data: otherLog } = await sb
      .from('habit_logs')
      .select('id')
      .eq('habit_id', otherHabitId)
      .eq('user_id', otherUserId)
      .eq('date', today)
      .eq('completed', true)
      .limit(1);

    const bothCompletedToday = isCompleting && otherLog && otherLog.length > 0;

    // Get current shared streak
    const { data: sharedStreak } = await sb
      .from('shared_streaks')
      .select('*')
      .eq('shared_habit_id', sh.id)
      .single();

    if (!sharedStreak) continue;

    let newStreak = sharedStreak.current_streak;

    if (bothCompletedToday) {
      const lastDate = sharedStreak.last_both_completed_date;
      const yesterday = addDaysStr(today, -1);

      if (lastDate === today) {
        // Already counted today
        continue;
      } else if (lastDate === yesterday) {
        newStreak = sharedStreak.current_streak + 1;
      } else {
        newStreak = 1;
      }

      const newLongest = Math.max(sharedStreak.longest_streak, newStreak);

      await sb
        .from('shared_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
          last_both_completed_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sharedStreak.id);

      // Emit shared_streak_milestone if applicable
      if (isStreakMilestone(newStreak)) {
        // Get habit info and profiles for the event
        const [habitRes, ownerRes, friendRes] = await Promise.all([
          sb.from('habits').select('name, emoji').eq('id', sh.habit_id).single(),
          sb.from('profiles').select('display_name, avatar_url').eq('id', sh.owner_id).single(),
          sb.from('profiles').select('display_name, avatar_url').eq('id', sh.friend_id).single(),
        ]);

        const eventData = {
          shared_habit_id: sh.id,
          habit_name: habitRes.data?.name ?? '',
          habit_emoji: habitRes.data?.emoji ?? '',
          streak: newStreak,
          user1_name: ownerRes.data?.display_name ?? 'User',
          user1_avatar: ownerRes.data?.avatar_url ?? null,
          user2_name: friendRes.data?.display_name ?? 'User',
          user2_avatar: friendRes.data?.avatar_url ?? null,
          friend_name: isOwner ? friendRes.data?.display_name : ownerRes.data?.display_name,
          friend_avatar_url: isOwner ? friendRes.data?.avatar_url : ownerRes.data?.avatar_url,
        };

        // Emit for both users
        await Promise.all([
          sb.from('feed_events').insert({
            user_id: sh.owner_id,
            event_type: 'shared_streak_milestone',
            data: eventData,
            is_private: false,
          }),
          sb.from('feed_events').insert({
            user_id: sh.friend_id,
            event_type: 'shared_streak_milestone',
            data: eventData,
            is_private: false,
          }),
        ]);
      }
    } else if (!isCompleting) {
      // User uncompleted — recalculate shared streak
      const myHabitId = isOwner ? sh.habit_id : sh.friend_habit_id;
      if (!myHabitId) continue;

      const [myLogsRes, otherLogsRes] = await Promise.all([
        sb.from('habit_logs').select('date, completed').eq('habit_id', myHabitId).eq('user_id', userId).eq('completed', true).order('date', { ascending: false }).limit(100),
        sb.from('habit_logs').select('date, completed').eq('habit_id', otherHabitId).eq('user_id', otherUserId).eq('completed', true).order('date', { ascending: false }).limit(100),
      ]);

      const recalculated = calculateSharedStreak(
        myLogsRes.data ?? [],
        otherLogsRes.data ?? [],
        today
      );

      await sb
        .from('shared_streaks')
        .update({
          current_streak: recalculated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sharedStreak.id);
    }
  }
}
