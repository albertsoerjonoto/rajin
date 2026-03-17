import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if profile exists, create one if not (for OAuth users)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, onboarding_completed')
          .eq('id', user.id)
          .single();

        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email ?? '',
            display_name: user.user_metadata?.full_name
              || user.user_metadata?.name
              || user.email?.split('@')[0]
              || '',
          });
        }

        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/dashboard`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
