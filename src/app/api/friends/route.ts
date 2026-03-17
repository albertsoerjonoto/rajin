import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: 'Failed to load friends' }, { status: 500 });
  }

  const friendships = data ?? [];
  const otherIds = friendships.map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  let profiles: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[] = [];
  if (otherIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', otherIds);
    profiles = profileData ?? [];
  }

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const result = friendships.map(f => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    return {
      ...f,
      profile: profileMap.get(otherId) ?? { id: otherId, username: null, display_name: null, avatar_url: null },
    };
  });

  return NextResponse.json({ friendships: result, userId: user.id });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { addressee_id } = body;

  if (!addressee_id || addressee_id === user.id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { error } = await supabase.from('friendships').insert({
    requester_id: user.id,
    addressee_id,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { friendship_id, action } = body;

  if (!friendship_id || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const status = action === 'accept' ? 'accepted' : 'declined';
  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', friendship_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { friendship_id } = await request.json();
  if (!friendship_id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendship_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
