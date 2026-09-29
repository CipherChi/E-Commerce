'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(typeof result.message === 'string' ? result.message : 'Unable to sign in');
      sessionStorage.setItem('staywise.accessToken', result.accessToken);
      sessionStorage.setItem('staywise.refreshToken', result.refreshToken);
      sessionStorage.setItem('staywise.user', JSON.stringify(result.user));
      const profileResponse = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${result.accessToken}` },
      });
      const profile = profileResponse.ok ? await profileResponse.json() : null;
      const requested = new URLSearchParams(window.location.search).get('returnTo');
      router.replace(profile?.businessId ? (requested?.startsWith('/') ? requested : '/dashboard') : '/business');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to sign in. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
        STAYWISE
      </Link>
      <section className="auth-card mt-8 rounded-3xl border border-ink/10 p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-ink/65">
          Sign in to manage your hotel or short-let operations.
        </p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-sm text-ink/60">
          New to Staywise?{' '}
          <Link className="font-medium text-accent" href="/register">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
