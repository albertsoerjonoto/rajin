'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/i18n';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLocale();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth') {
      setError(t('auth.emailConfirmFailed'));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let email = identifier.trim();

    // If no @, treat as username and look up the email
    if (!email.includes('@')) {
      try {
        const res = await fetch('/api/login-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email }),
        });

        if (!res.ok) {
          setError(t('auth.userNotFound'));
          setLoading(false);
          return;
        }

        const data = await res.json();
        email = data.email;
      } catch {
        setError(t('auth.somethingWrong'));
        setLoading(false);
        return;
      }
    }

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

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">{t('auth.appName')}</h1>
          <p className="text-text-secondary mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-danger-surface text-danger-text text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-text-label mb-1">
              {t('auth.usernameOrEmail')}
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className={inputClass}
              placeholder="username or email"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-label mb-1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          {t('auth.dontHaveAccount')}{' '}
          <Link href="/signup" className="text-accent-text font-medium hover:underline">
            {t('auth.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
