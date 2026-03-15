import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function DELETE() {
  // Verify the user is authenticated
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role to delete user data and auth account
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  // Delete user data from all tables (RLS won't apply with service role)
  const userId = user.id;
  await admin.from('habit_logs').delete().eq('user_id', userId);
  await admin.from('habits').delete().eq('user_id', userId);
  await admin.from('food_logs').delete().eq('user_id', userId);
  await admin.from('exercise_logs').delete().eq('user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);

  // Delete the auth user
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
