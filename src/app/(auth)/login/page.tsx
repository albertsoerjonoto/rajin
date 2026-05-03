'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();

  const [initialError] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('error') === 'auth' ? 'auth' : '';
  });

  useEffect(() => {
    if (initialError === 'auth') {
      queueMicrotask(() => setError(t('auth.emailConfirmFailed')));
    }
  }, [initialError, t]);

  // Lazy-load the Supabase client so the auth-page initial bundle stays small.
  // The user only needs the SDK when they actually submit the form.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setError('');
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';

  return (
    <div className="h-dvh flex items-center justify-center bg-bg px-4 relative overflow-hidden">
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center bg-surface rounded-full border border-border-strong overflow-hidden">
          {(['id', 'en'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-all uppercase',
                locale === code
                  ? 'bg-text-primary text-bg'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">{t('auth.appName')}</h1>
          <p className="text-text-secondary mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        {error && (
          <div className="bg-danger-surface text-danger-text text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-surface border border-border-strong rounded-xl font-medium text-text-primary hover:bg-surface-hover transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t('auth.loginWithEmail')}
            </button>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t('auth.email')}
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t('auth.password')}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmailForm(false); setError(''); }}
                className="w-full text-sm text-text-tertiary font-medium hover:text-text-secondary transition-colors"
              >
                {t('auth.back')}
              </button>
            </form>
          )}

          {!showEmailForm && (
            <>
              {/* Apple OAuth hidden until Apple Developer account is active
              <button
                onClick={() => handleOAuthLogin('apple')}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-surface border border-border-strong rounded-xl font-medium text-text-primary hover:bg-surface-hover transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                {t('auth.loginWithApple')}
              </button>
              */}

              <button
                onClick={() => handleOAuthLogin('google')}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-surface border border-border-strong rounded-xl font-medium text-text-primary hover:bg-surface-hover transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {t('auth.loginWithGoogle')}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          {t('auth.dontHaveAccount')}{' '}
          <Link href="/signup" className="text-accent-text font-medium hover:underline">
            {t('auth.signUp')}
          </Link>
        </p>

        <p className="text-center text-xs text-text-tertiary/60 mt-6">{t('auth.loginSubtagline')}</p>
      </div>
    </div>
  );
}
