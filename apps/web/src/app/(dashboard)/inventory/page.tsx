'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Item = { id: string; name: string; lowStockThreshold: number | null };
type Low = Item & { currentQuantity: number };
type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason?: string | null;
  createdAt: string;
  createdBy: { name: string };
};
const field = 'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3';
export default function InventoryPage() {
  const [products, setProducts] = useState<Item[]>([]);
  const [low, setLow] = useState<Low[]>([]);
  const [productId, setProductId] = useState('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [mode, setMode] = useState('STOCK_IN');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([
        apiRequest<Item[]>('/inventory/products'),
        apiRequest<Low[]>('/inventory/low-stock'),
      ]);
      setProducts(p);
      setLow(l);
      if (!productId && p[0]) setProductId(p[0].id);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load stock');
    }
  }, [productId]);
  const history = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await apiRequest<{ data: Movement[] }>(
        `/inventory/${id}/movements?page=1&limit=50`,
      );
      setMovements(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load history');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void history(productId);
  }, [history, productId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const quantity = Number(f.get('quantity'));
    setBusy(true);
    setError('');
    const endpoint =
      mode === 'STOCK_IN'
        ? '/inventory/stock-in'
        : mode === 'STOCK_OUT'
          ? '/inventory/stock-out'
          : '/inventory/adjustments';
    const payload = {
      productId,
      quantity: mode === 'ADJUSTMENT' && f.get('direction') === 'out' ? -quantity : quantity,
      ...(mode === 'ADJUSTMENT'
        ? { reason: f.get('reason') }
        : { reason: f.get('reason') || undefined }),
    };
    try {
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await load();
      await history(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record movement');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="font-bold tracking-[.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/products">Catalog</Link>
          <Link href="/sales">Sales</Link>
          <Link href="/customers">Customers</Link>
        </nav>
      </header>
      <div className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">
          Stock control
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Inventory</h1>
        <p className="mt-2 text-ink/60">
          Every quantity change is recorded in the movement ledger.
        </p>
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[350px_1fr]">
        <div className="space-y-6">
          <article className="rounded-3xl bg-accent p-6 text-white">
            <p className="text-sm text-white/70">Low stock items</p>
            <p className="mt-2 text-4xl font-semibold">{low.length}</p>
            <p className="mt-2 text-sm text-white/70">At or below their configured threshold</p>
          </article>
          <form onSubmit={submit} className="rounded-3xl border border-ink/10 bg-white p-6">
            <h2 className="text-xl font-semibold">Record movement</h2>
            <label className="mt-5 block text-sm font-medium">
              Movement
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={field}>
                <option value="STOCK_IN">Stock in</option>
                <option value="STOCK_OUT">Stock out</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Product
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                className={field}
              >
                {products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              {mode === 'ADJUSTMENT' ? 'Adjustment size' : 'Quantity'}
              <input name="quantity" type="number" min="1" step="1" required className={field} />
            </label>
            {mode === 'ADJUSTMENT' && (
              <label className="mt-4 block text-sm font-medium">
                Correction direction
                <select name="direction" className={field}>
                  <option value="in">Add stock</option>
                  <option value="out">Remove stock</option>
                </select>
              </label>
            )}
            <label className="mt-4 block text-sm font-medium">
              {mode === 'ADJUSTMENT' ? 'Reason (required)' : 'Note (optional)'}
              <input name="reason" required={mode === 'ADJUSTMENT'} className={field} />
            </label>
            <button
              disabled={busy || !products.length}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Recording…' : 'Record movement'}
            </button>
          </form>
        </div>
        <div className="space-y-6">
          <section className="rounded-3xl border border-ink/10 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Low stock</h2>
                <p className="mt-1 text-sm text-ink/55">
                  Restock items at or below their threshold.
                </p>
              </div>
              <Link className="text-sm text-accent" href="/products">
                Manage catalog →
              </Link>
            </div>
            {low.length ? (
              <div className="mt-5 divide-y divide-ink/5">
                {low.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className="flex w-full justify-between py-3 text-left"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-red-700">
                      {p.currentQuantity} on hand · threshold {p.lowStockThreshold}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink/55">No stockable items are currently low.</p>
            )}
          </section>
          <section className="rounded-3xl border border-ink/10 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Movement history</h2>
                <p className="mt-1 text-sm text-ink/55">
                  {products.find((p) => p.id === productId)?.name ?? 'Select a product'}
                </p>
              </div>
              <select
                aria-label="Product history"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="rounded-xl border border-ink/15 px-3 py-2"
              >
                {products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 divide-y divide-ink/5">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[1fr_auto] gap-2 py-3 sm:grid-cols-[1fr_100px_100px_1fr]"
                >
                  <span className="text-sm font-medium">{m.type.replace('_', ' ')}</span>
                  <span
                    className={m.quantity < 0 ? 'text-sm text-red-700' : 'text-sm text-emerald-700'}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                  <span className="text-sm text-ink/55">{m.createdBy?.name}</span>
                  <span className="text-right text-xs text-ink/50 sm:text-left">
                    {new Date(m.createdAt).toLocaleString()}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </span>
                </div>
              ))}
              {!movements.length && (
                <p className="py-5 text-sm text-ink/55">No movements recorded for this item yet.</p>
              )}
            </div>
          </section>
        </div>
      </section>
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </main>
  );
}
