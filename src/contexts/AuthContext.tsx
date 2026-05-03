'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
});

// Routes that don't need the Supabase SDK on initial mount. These pages
// either run pre-auth (login/signup) or do their own SDK load on submit
// (the login/signup page handlers `await import('@/lib/supabase/client')`
// directly). Skipping the AuthProvider load drops the 47 KB chunk fetch
// off the auth-page critical path entirely — not just defers it.
const AUTH_ROUTES = ['/login', '/signup'];

function isPreAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_ROUTES.includes(pathname);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipLoad = isPreAuthRoute(pathname);

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: !skipLoad,
  });

  useEffect(() => {
    if (skipLoad) {
      // Pre-auth route: no session work needed. Synchronous resolve so
      // consumers (none on /login or /signup, but the contract holds)
      // don't hang on `loading: true`.
      setState({ user: null, session: null, loading: false });
      return;
    }

    // Closure-local flag so each effect invocation has its own —
    // prevents StrictMode mount/unmount/mount from leaking a subscription.
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      if (!mounted) return;
      const supabase = createClient();

      // getSession() is cookie-only — no network call. The JWT is verified
      // by RLS on each database query, so we don't need to round-trip to
      // the auth server here. getUser() was costing 150-400ms on mount.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setState({ user: session?.user ?? null, session, loading: false });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setState({ user: session?.user ?? null, session, loading: false });
      });
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [skipLoad]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
