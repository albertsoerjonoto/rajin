import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Uses SECURITY DEFINER function that searches by:
  // 1. Exact username match
  // 2. Exact email match
  // 3. Display name prefix autocomplete (4+ chars)
  // 4. Partial username match
  const { data, error } = await supabase.rpc('search_users', {
    search_term: query,
  });

  if (error) {
    // Fallback: try the old function name if new migration hasn't been applied
    const { data: fallbackData, error: fallbackError } = await supabase.rpc('search_users_by_username', {
      search_term: query,
    });

    if (fallbackError) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ results: fallbackData ?? [] });
  }

  return NextResponse.json({ results: data ?? [] });
}
