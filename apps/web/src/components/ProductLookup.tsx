'use client';

import { useEffect, useId, useState } from 'react';
import { apiRequest } from '@/lib/api';

export type CatalogOption = {
  id: string;
  name: string;
  module: string;
  sellingPrice: string;
  normalRate: string;
  partyRate: string;
  monthlyPrice: string;
  isStockable: boolean;
  currentQuantity?: number | null;
};

type CatalogPage = { data: CatalogOption[]; total: number; page: number; pageSize: number };

export function ProductLookup({
  selected,
  onSelect,
}: {
  selected: CatalogOption | null;
  onSelect: (item: CatalogOption) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!selected);
  const [results, setResults] = useState<CatalogOption[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultPage, setResultPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
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
      void apiRequest<CatalogPage>(`/catalog?${params}`)
        .then((page) => {
          if (current) {
            setResults(page.data);
            setResultTotal(page.total);
            setError('');
          }
        })
        .catch((cause: unknown) => {
          if (current) {
            setError(cause instanceof Error ? cause.message : 'Unable to search catalog');
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
  }, [query, resultPage]);

  function select(item: CatalogOption) {
    setQuery('');
    setResults([]);
    setResultTotal(0);
    setResultPage(1);
    setOpen(false);
    onSelect(item);
  }

  return (
    <div className="text-xs font-medium text-ink/60">
      <label className="block" htmlFor={inputId}>Product or service</label>
      {selected && !open && (
        <div className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2">
          <span className="min-w-0 truncate">{selected.name}</span>
          <button type="button" className="shrink-0 text-accent underline" onClick={() => setOpen(true)}>
            Change
          </button>
        </div>
      )}
      {open && (
        <>
          <input
            id={inputId}
            className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
            type="search"
            value={query}
            onChange={(event) => { setResultPage(1); setQuery(event.target.value); }}
            placeholder="Search catalog"
            autoComplete="off"
            aria-autocomplete="list"
          />
          {loading && <p className="mt-2 text-xs" role="status">Searching catalog…</p>}
          {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 text-xs" role="status">No matching products or services.</p>
          )}
          {results.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-auto rounded-xl border border-ink/15 bg-white shadow-lg">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="min-h-11 w-full px-3 py-2 text-left hover:bg-paper"
                    onClick={() => select(item)}
                  >
                    <span className="block font-semibold">{item.name}</span>
                    <span className="block text-xs">{item.module}{item.isStockable ? ` · ${item.currentQuantity ?? 0} in stock` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {resultTotal > 20 && results.length > 0 && (
            <nav aria-label="Catalog search pages" className="mt-2 flex items-center justify-between gap-2">
              <button type="button" className="min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50" disabled={resultPage <= 1 || loading} onClick={() => setResultPage((current) => current - 1)}>Previous</button>
              <span>Page {resultPage} of {Math.ceil(resultTotal / 20)}</span>
              <button type="button" className="min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50" disabled={resultPage >= Math.ceil(resultTotal / 20) || loading} onClick={() => setResultPage((current) => current + 1)}>Next</button>
            </nav>
          )}
          {selected && <button type="button" className="mt-2 text-xs text-accent underline" onClick={() => setOpen(false)}>Keep current item</button>}
        </>
      )}
    </div>
  );
}
