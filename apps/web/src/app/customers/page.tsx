'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  notes?: string | null;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async (search: string) => {
    try {
      setCustomers(
        await apiRequest<Customer[]>(
          `/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
        ),
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [load, query]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          email: form.get('email') || undefined,
          idType: form.get('idType') || undefined,
          idNumber: form.get('idNumber') || undefined,
          notes: form.get('notes') || undefined,
        }),
      });
      formElement.reset();
      setQuery('');
      await load('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create customer');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          STAYWISE
        </Link>
        <Link className="text-sm text-accent" href="/properties">
          Properties →
        </Link>
      </header>
      <div className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Customer directory
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Customers</h1>
        <p className="mt-3 text-ink/65">
          Register customers and quickly find them by name, phone, or email.
        </p>
      </div>
      <section className="mt-9 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="h-fit rounded-3xl border border-ink/10 bg-white p-6" onSubmit={create}>
          <h2 className="text-xl font-semibold">Add a customer</h2>
          <label className="mt-5 block text-sm font-medium">
            Full name
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="name"
              autoComplete="name"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Phone
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Email <span className="font-normal text-ink/50">(optional)</span>
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="email"
              type="email"
              autoComplete="email"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              ID type
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
                name="idType"
              />
            </label>
            <label className="text-sm font-medium">
              ID number
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
                name="idNumber"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium">
            Notes
            <textarea
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="notes"
              rows={3}
            />
          </label>
          <button
            className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving…' : 'Save guest'}
          </button>
        </form>
        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold">Customer list</h2>
              <p className="mt-1 text-sm text-ink/60">
                {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
              </p>
            </div>
            <label className="text-sm font-medium">
              Search
              <input
                className="mt-2 w-full min-w-64 rounded-xl border border-ink/15 px-4 py-3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or phone number"
                type="search"
              />
            </label>
          </div>
          {loading ? (
            <p className="text-sm text-ink/60">Loading customers…</p>
          ) : customers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/20 p-8 text-sm text-ink/60">
              {query ? 'No customers match this search.' : 'No customers registered yet.'}
            </div>
          ) : (
            <div className="grid gap-3">
              {customers.map((customer) => (
                <article
                  className="rounded-2xl border border-ink/10 bg-white p-5"
                  key={customer.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        className="font-semibold text-accent"
                        href={`/customers/${customer.id}`}
                      >
                        {customer.name}
                      </Link>
                      <p className="mt-1 text-sm text-ink/65">{customer.phone}</p>
                      {customer.email && (
                        <p className="mt-1 text-sm text-ink/55">{customer.email}</p>
                      )}
                    </div>
                    {customer.idType && (
                      <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/65">
                        {customer.idType}
                        {customer.idNumber ? ` · ${customer.idNumber}` : ''}
                      </span>
                    )}
                  </div>
                  {customer.notes && (
                    <p className="mt-3 border-t border-ink/5 pt-3 text-sm text-ink/60">
                      {customer.notes}
                    </p>
                  )}
                </article>
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
