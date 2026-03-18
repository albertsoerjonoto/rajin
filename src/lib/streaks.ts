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
