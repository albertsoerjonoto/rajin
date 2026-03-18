import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('shared_habits')
    .select('*')
    .or(`owner_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: 'Failed to load shared habits' }, { status: 500 });
  }

  return NextResponse.json({ shared_habits: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { habit_id, friend_id } = body;

  if (!habit_id || !friend_id) {
    return NextResponse.json({ error: 'habit_id and friend_id are required' }, { status: 400 });
  }

  // Validate friendship exists and is accepted
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friend_id}),and(requester_id.eq.${friend_id},addressee_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .limit(1);

  if (!friendship || friendship.length === 0) {
    return NextResponse.json({ error: 'Must be friends to share habits' }, { status: 400 });
  }

  // Validate habit belongs to user
  const { data: habit } = await supabase
    .from('habits')
    .select('id')
    .eq('id', habit_id)
    .eq('user_id', user.id)
    .single();

  if (!habit) {
    return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('shared_habits')
    .insert({
      habit_id,
      owner_id: user.id,
      friend_id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already shared with this friend' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to share habit' }, { status: 500 });
  }

  return NextResponse.json({ shared_habit: data });
}
