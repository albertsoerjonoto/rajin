import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, let requests through (build time)
  if (!url || !key) {
    return supabaseResponse;
  }

  // If a confirmation code lands on root, redirect to the callback route
  // (cheap string check — no Supabase client needed)
  const code = request.nextUrl.searchParams.get('code');
  if (code && request.nextUrl.pathname === '/') {
    const next = request.nextUrl.clone();
    next.pathname = '/auth/callback';
    return NextResponse.redirect(next);
  }

  // Allow auth callback route through without checks
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Cookie-only session check: this does NOT make a network call to the
  // Supabase auth server. It reads and parses the auth cookie. The JWT is
  // still verified by RLS on every database query, so this is safe for
  // redirect gating. getUser() (which calls the auth server) was costing
  // 150-400ms per navigation — we use getSession() instead.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;
  const onPublic = isPublicPath(pathname);

  // Redirect unauthenticated users to login (except auth pages)
  if (!user && !onPublic) {
    const next = request.nextUrl.clone();
    next.pathname = '/login';
    return NextResponse.redirect(next);
  }

  // Redirect authenticated users away from auth pages
  if (user && onPublic) {
    const next = request.nextUrl.clone();
    next.pathname = '/dashboard';
    return NextResponse.redirect(next);
  }

  // Redirect root to dashboard
  if (user && pathname === '/') {
    const next = request.nextUrl.clone();
    next.pathname = '/dashboard';
    return NextResponse.redirect(next);
  }

  return supabaseResponse;
}
