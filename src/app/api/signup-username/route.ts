import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(request: Request) {
  const { username, password } = await request.json();

  // Validate username format
  if (!username || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-20 characters (letters, numbers, underscores)' },
      { status: 400 },
    );
  }

  // Validate password
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 },
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  // Check username uniqueness (case-insensitive)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
  }

  // Create auth user with auto-confirmed placeholder email
  const email = `${username.toLowerCase()}@rajin.app`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create profile
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      username: username.toLowerCase(),
      display_name: username,
      daily_calorie_offset: 0,
    });

  if (profileError) {
    // Cleanup: delete the auth user if profile creation fails
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  return NextResponse.json({ email });
}
