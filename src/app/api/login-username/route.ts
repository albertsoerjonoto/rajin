import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { username } = await request.json();

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  // Case-insensitive username lookup
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .ilike('username', username)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Username not found' }, { status: 404 });
  }

  return NextResponse.json({ email: profile.email });
}
