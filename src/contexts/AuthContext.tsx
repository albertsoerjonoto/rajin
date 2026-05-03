'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Closure-local flag (not a useRef) so each effect invocation has its own
    // — prevents StrictMode mount/unmount/mount from leaking a subscription
    // when the first invocation's async closure resolves after the second
    // mount has already reset a shared ref.
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    // Dynamic import keeps `@supabase/ssr` off the auth-page critical path.
    // login/signup never need the SDK before the user submits a form; authed
    // pages still get it here, just after first paint instead of blocking it.
    // The chunk still ships (Next.js preloads it) — what shifts is parse/eval
    // off the critical chain, which is what Lighthouse penalizes.
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
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
