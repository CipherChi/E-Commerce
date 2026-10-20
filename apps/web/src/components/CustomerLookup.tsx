'use client';

import { useEffect, useId, useState } from 'react';
import { apiRequest } from '@/lib/api';

type CustomerOption = { id: string; name: string; phone: string };
type CustomerPage = { data: CustomerOption[]; total: number; page: number; pageSize: number };

type CustomerLookupProps = {
  label: string;
  name?: string;
  value: string;
  onChange: (customerId: string) => void;
  required?: boolean;
  placeholder?: string;
};

export function CustomerLookup({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder = 'Search by name or phone',
}: CustomerLookupProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultPage, setResultPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || value) {
      setResults([]);
      setResultTotal(0);
      setResultPage(1);
      setLoading(false);
      setError('');
      return;
    }

    let current = true;
    setLoading(true);
    setResults([]);
    setResultTotal(0);
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, page: String(resultPage), pageSize: '20' });
      void apiRequest<CustomerPage>(`/customers?${params}`)
        .then((page) => {
          if (current) {
            setResults(page.data);
            setResultTotal(page.total);
            setError('');
          }
        })
        .catch((cause: unknown) => {
          if (current) {
            setError(cause instanceof Error ? cause.message : 'Unable to search customers');
            setResults([]);
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [query, value, resultPage]);

  function select(customer: CustomerOption) {
    setSelected(customer);
    setQuery('');
    setResults([]);
    setResultTotal(0);
    setResultPage(1);
    onChange(customer.id);
  }

  function clear() {
    setSelected(null);
    setQuery('');
    onChange('');
  }

  return (
    <div className="text-sm font-medium">
      <label className="block" htmlFor={inputId}>
        {label}
      </label>
      {name && <input type="hidden" name={name} value={value} />}
      {value && selected ? (
        <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-ink/15 bg-white px-4 py-2">
          <span className="min-w-0 truncate">{selected.name} · {selected.phone}</span>
          <button type="button" className="shrink-0 text-accent underline" onClick={clear}>
            Change
          </button>
        </div>
      ) : (
        <input
          id={inputId}
          className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
          aria-autocomplete="list"
        />
      )}
      {!value && query.trim().length > 0 && query.trim().length < 2 && (
        <p className="mt-2 text-xs text-ink/55">Enter at least two characters to search.</p>
      )}
      {!value && loading && <p className="mt-2 text-xs text-ink/55" role="status">Searching customers…</p>}
      {!value && error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
      {!value && !loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-ink/55" role="status">No matching customers.</p>
      )}
      {!value && results.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-auto rounded-xl border border-ink/15 bg-white shadow-lg">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="min-h-11 w-full px-4 py-2 text-left hover:bg-paper"
                onClick={() => select(customer)}
              >
                <span className="block font-semibold">{customer.name}</span>
                <span className="block text-xs text-ink/55">{customer.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!value && resultTotal > 20 && results.length > 0 && (
        <nav aria-label="Customer search pages" className="mt-2 flex items-center justify-between gap-2">
          <button type="button" className="min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50" disabled={resultPage <= 1 || loading} onClick={() => setResultPage((current) => current - 1)}>Previous</button>
          <span>Page {resultPage} of {Math.ceil(resultTotal / 20)}</span>
          <button type="button" className="min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50" disabled={resultPage >= Math.ceil(resultTotal / 20) || loading} onClick={() => setResultPage((current) => current + 1)}>Next</button>
        </nav>
      )}
    </div>
  );
}
