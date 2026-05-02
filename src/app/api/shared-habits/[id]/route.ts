import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // 'accept' or 'reject'

  if (!['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Fetch the shared habit
  const { data: sharedHabit } = await supabase
    .from('shared_habits')
    .select('*, habits!shared_habits_habit_id_fkey(name, emoji, category)')
    .eq('id', id)
    .eq('friend_id', user.id)
    .single();

  if (!sharedHabit) {
    return NextResponse.json({ error: 'Shared habit not found' }, { status: 404 });
  }

  if (action === 'reject') {
    await supabase.from('shared_habits').update({ status: 'rejected' }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  // Accept: create or link habit for the friend
  const habitInfo = sharedHabit.habits as { name: string; emoji: string; category: 'habit' | 'supplement' | 'skincare' | null } | null;
  const habitName = habitInfo?.name ?? 'Shared Habit';
  const habitEmoji = habitInfo?.emoji ?? '⭐';
  const habitCategory = habitInfo?.category ?? 'habit';

  // Check if friend already has a habit with same name
  const { data: existing } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', habitName)
    .eq('is_active', true)
    .limit(1);

  let friendHabitId: string;

  if (existing && existing.length > 0) {
    friendHabitId = existing[0].id;
  } else {
    const { data: newHabit, error: insertErr } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        name: habitName,
        emoji: habitEmoji,
        sort_order: 999,
        category: habitCategory,
      })
      .select('id')
      .single();

    if (insertErr || !newHabit) {
      return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
    }
    friendHabitId = newHabit.id;
  }

  // Update shared_habits with accepted status and friend_habit_id
  await supabase
    .from('shared_habits')
    .update({ status: 'accepted', friend_habit_id: friendHabitId })
    .eq('id', id);

  // Create shared_streaks row
  const { error: streakErr } = await supabase.from('shared_streaks').insert({
    shared_habit_id: id,
  });
  if (streakErr) {
    return NextResponse.json({ error: 'Failed to initialize shared streak' }, { status: 500 });
  }

  return NextResponse.json({ success: true, friend_habit_id: friendHabitId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('shared_habits')
    .delete()
    .eq('id', id)
    .or(`owner_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete shared habit' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
