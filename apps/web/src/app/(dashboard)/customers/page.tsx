'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
type CustomerPage = { data: Customer[]; total: number; page: number; pageSize: number };
const customerPageSize = 25;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const requestVersion = useRef(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async (search: string, pageNumber: number) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ page: String(pageNumber), pageSize: String(customerPageSize) });
      if (search.trim()) params.set('q', search.trim());
      const result = await apiRequest<CustomerPage>(`/customers?${params}`);
      if (version !== requestVersion.current) return;
      setCustomers(result.data);
      setTotal(result.total);
      setError('');
    } catch (cause) {
      if (version === requestVersion.current) {
        setLoadError(cause instanceof Error ? cause.message : 'Unable to load customers');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(query, page), 250);
    return () => window.clearTimeout(timer);
  }, [load, query, page]);
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
      setPage(1);
      await load('', 1);
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
                {total} {total === 1 ? 'customer' : 'customers'} · Page {page} of {Math.max(1, Math.ceil(total / customerPageSize))}
              </p>
            </div>
            <label className="text-sm font-medium">
              Search
              <input
                className="mt-2 w-full min-w-64 rounded-xl border border-ink/15 px-4 py-3"
                value={query}
                onChange={(event) => { setPage(1); setQuery(event.target.value); }}
                placeholder="Name or phone number"
                type="search"
              />
            </label>
          </div>
          {loading ? (
            <p className="text-sm text-ink/60">Loading customers…</p>
          ) : loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-6 text-sm" role="alert">
              <span>Unable to load customers: {loadError}</span>
              <button type="button" className="font-semibold text-accent underline" onClick={() => void load(query, page)}>
                Retry
              </button>
            </div>
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
          {!loading && !loadError && total > customerPageSize && (
            <nav aria-label="Customer pages" className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-ink/15 px-4 py-2 text-sm disabled:opacity-50"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span className="text-sm text-ink/60">Page {page} of {Math.max(1, Math.ceil(total / customerPageSize))}</span>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-ink/15 px-4 py-2 text-sm disabled:opacity-50"
                disabled={loading || page >= Math.ceil(total / customerPageSize)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </nav>
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
