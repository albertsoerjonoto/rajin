'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SignupMode = 'username' | 'email';

export default function SignupPage() {
  const [mode, setMode] = useState<SignupMode>('username');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUsernameSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters (letters, numbers, underscores)');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/signup-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Auto sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push('/onboarding');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Check your email</h1>
          <p className="text-text-secondary mb-6">
            We sent a confirmation link to <span className="font-medium text-text-label">{email}</span>. Click it to activate your account.
          </p>
          <p className="text-sm text-text-tertiary">
            Didn&apos;t get it? Check your spam folder.
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring focus:border-transparent transition-all duration-200';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Rajin</h1>
          <p className="text-text-secondary mt-2">Start tracking your daily progress</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          {(['username', 'email'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-sm transition-all capitalize ${
                mode === m
                  ? 'bg-surface-hover text-text-primary font-semibold'
                  : 'bg-surface-secondary text-text-muted hover:bg-surface-hover'
              }`}
            >
              {m === 'username' ? 'Username' : 'Email'}
            </button>
          ))}
        </div>

        {mode === 'username' ? (
          <form onSubmit={handleUsernameSignup} className="space-y-4">
            {error && (
              <div className="bg-danger-surface text-danger-text text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-text-label mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                maxLength={20}
                className={inputClass}
                placeholder="your_username"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <p className="text-xs text-text-tertiary mt-1">3-20 characters, letters, numbers, underscores</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-label mb-1">
                Password
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-label mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSignup} className="space-y-4">
            {error && (
              <div className="bg-danger-surface text-danger-text text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-label mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="emailPassword" className="block text-sm font-medium text-text-label mb-1">
                Password
              </label>
              <input
                id="emailPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="emailConfirmPassword" className="block text-sm font-medium text-text-label mb-1">
                Confirm Password
              </label>
              <input
                id="emailConfirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-text font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
