'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function BusinessSetupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          primaryType: sessionStorage.getItem('staywise.primaryType') ?? 'HOTEL',
          phone: form.get('phone') || undefined,
          address: form.get('address') || undefined,
          logo: form.get('logo') || undefined,
        }),
      });
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your business');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
        E Commerce Site
      </Link>
      <section className="mt-8 rounded-3xl border border-ink/10 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold">Set up your business</h1>
        <p className="mt-2 text-sm text-ink/65">
          Your primary business type is set during signup. You can enable more modules later in
          Settings.
        </p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Business name
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="name"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="phone"
              type="tel"
            />
          </label>
          <label className="block text-sm font-medium">
            Address
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="address"
            />
          </label>
          <label className="block text-sm font-medium">
            Logo URL
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="logo"
              type="url"
            />
          </label>
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Create business'}
          </button>
        </form>
      </section>
    </main>
  );
}
