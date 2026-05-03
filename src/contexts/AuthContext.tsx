'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe: (() => void) | undefined;

    // Dynamic import keeps `@supabase/ssr` out of the auth-page initial
    // bundle. The login/signup pages never need the SDK before the user
    // submits a form, and authed pages get it asynchronously here without
    // blocking first paint. Saves ~47 KB of unused JS on /login + /signup.
    (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      if (!mountedRef.current) return;
      const supabase = createClient();

      // getSession() is cookie-only — no network call. The JWT is verified
      // by RLS on each database query, so we don't need to round-trip to
      // the auth server here. getUser() was costing 150-400ms on mount.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      setState({ user: session?.user ?? null, session, loading: false });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mountedRef.current) return;
        setState({ user: session?.user ?? null, session, loading: false });
      });
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
