'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Property = {
  id: string;
  name: string;
  address: string;
  type: string;
  _count?: { rooms: number };
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      setProperties(await apiRequest<Property[]>('/properties'));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load properties');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCreating(true);
    setError('');
    try {
      await apiRequest('/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          address: form.get('address'),
          type: form.get('type'),
        }),
      });
      formElement.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create property');
    } finally {
      setCreating(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          STAYWISE
        </Link>
        <Link className="text-sm text-ink/65 hover:text-accent" href="/login">
          Sign in
        </Link>
      </header>
      <div className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Your portfolio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Properties</h1>
        <p className="mt-3 text-ink/65">Keep each property and its rooms organized in one place.</p>
      </div>
      <section className="mt-9 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="h-fit rounded-3xl border border-ink/10 bg-white p-6" onSubmit={create}>
          <h2 className="text-xl font-semibold">Add a property</h2>
          <p className="mt-1 text-sm text-ink/60">
            Property creation requires an administrator account.
          </p>
          <label className="mt-5 block text-sm font-medium">
            Name
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="name"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Address
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="address"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Property type
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
              name="type"
            >
              <option value="HOTEL">Hotel</option>
              <option value="SHORTLET">Short-let</option>
            </select>
          </label>
          <button
            className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={creating}
            type="submit"
          >
            {creating ? 'Saving…' : 'Create property'}
          </button>
        </form>
        <section>
          <h2 className="mb-4 text-xl font-semibold">Your properties</h2>
          {loading ? (
            <p className="text-sm text-ink/60">Loading properties…</p>
          ) : properties.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/20 p-8 text-sm text-ink/60">
              No properties yet. Create one to add and manage its rooms.
            </div>
          ) : (
            <div className="grid gap-4">
              {properties.map((property) => (
                <Link
                  className="rounded-3xl border border-ink/10 bg-white p-6 transition hover:border-accent/40"
                  href={`/properties/${property.id}/rooms`}
                  key={property.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{property.name}</h3>
                      <p className="mt-1 text-sm text-ink/60">{property.address}</p>
                    </div>
                    <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-accent">
                      {property.type === 'SHORTLET' ? 'Short-let' : 'Hotel'}
                    </span>
                  </div>
                  <p className="mt-5 text-sm text-ink/60">
                    {property._count?.rooms ?? 0} rooms <span aria-hidden="true">·</span> View rooms
                    →
                  </p>
                </Link>
              ))}
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
