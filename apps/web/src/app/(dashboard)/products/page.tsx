'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/money';

type Item = {
  id: string;
  name: string;
  module: 'LODGING' | 'FOOD' | 'BEVERAGE' | 'GYM';
  category: string | null;
  costPrice: string;
  sellingPrice: string;
  normalRate: string;
  partyRate: string;
  monthlyPrice: string;
  isStockable: boolean;
  currentQuantity?: number | null;
  lowStockThreshold: number | null;
  isArchived: boolean;
};
type CatalogPage = { data: Item[]; total: number; page: number; pageSize: number };
const field = 'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3';
const catalogPageSize = 25;

export default function ProductsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [category, setCategory] = useState('');
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [formModule, setFormModule] = useState<Item['module']>('LODGING');
  const [enabledModules, setEnabledModules] = useState<Item['module'][]>([]);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    const q = new URLSearchParams();
    if (module) q.set('module', module);
    if (category) q.set('category', category);
    if (archived) q.set('is_archived', 'true');
    if (searchTerm) q.set('q', searchTerm);
    q.set('page', String(page));
    q.set('pageSize', String(catalogPageSize));
    setLoading(true);
    try {
      const result = await apiRequest<CatalogPage>(`/catalog?${q}`);
      if (version !== requestVersion.current) return;
      setItems(result.data);
      setTotal(result.total);
      setError('');
    } catch (e) {
      if (version === requestVersion.current) {
        setError(e instanceof Error ? e.message : 'Unable to load catalog');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [module, category, archived, searchTerm, page]);
  useEffect(() => {
    const primaryModule: Record<string, Item['module']> = {
      HOTEL: 'LODGING',
      APARTMENT: 'LODGING',
      RESTAURANT: 'FOOD',
      GYM: 'GYM',
      SUPERMARKET: 'FOOD',
    };
    const initialModule =
      primaryModule[sessionStorage.getItem('staywise.primaryType') ?? ''] ?? 'LODGING';
    setModule(initialModule);
    setFormModule(initialModule);
    void apiRequest<Array<{ module: Item['module']; isEnabled: boolean }>>('/businesses/modules')
      .then((rows) => setEnabledModules(rows.filter((r) => r.isEnabled).map((r) => r.module)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const kind = String(form.get('module'));
    const stockable = kind !== 'LODGING' && form.get('isStockable') === 'on';
    const body = {
      name: form.get('name'),
      module: kind,
      category: form.get('category') || undefined,
      ...(kind === 'LODGING'
        ? { normalRate: String(form.get('normalRate')), partyRate: String(form.get('partyRate')) }
        : {}),
      ...(kind === 'GYM' ? { monthlyPrice: String(form.get('monthlyPrice')) } : {}),
      ...(['FOOD', 'BEVERAGE'].includes(kind)
        ? {
            sellingPrice: String(form.get('sellingPrice')),
            ...(stockable && form.get('costPrice')
              ? { costPrice: String(form.get('costPrice')) }
              : {}),
          }
        : {}),
      isStockable: stockable,
      lowStockThreshold:
        stockable && form.get('lowStockThreshold') !== ''
          ? Number(form.get('lowStockThreshold'))
          : undefined,
    };
    setBusy(true);
    setError('');
    try {
      const duplicateParams = new URLSearchParams({
        module: kind,
        q: String(body.name),
        page: '1',
        pageSize: '100',
      });
      if (body.category) duplicateParams.set('category', String(body.category));
      const currentCatalog = await apiRequest<CatalogPage>(`/catalog?${duplicateParams}`);
      const duplicate = currentCatalog.data.some(
        (item) =>
          item.id !== editing?.id &&
          item.module === kind &&
          item.name.trim().toLowerCase() === String(body.name).trim().toLowerCase() &&
          (item.category?.toLowerCase() ?? '') ===
            String(body.category ?? '')
              .trim()
              .toLowerCase(),
      );
      if (
        duplicate &&
        !window.confirm(
          'An item with this name, type and category already exists. Save another anyway?',
        )
      )
        return;
      await apiRequest(editing ? `/catalog/${editing.id}` : '/catalog', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setEditing(null);
      setFormModule(enabledModules[0] ?? 'LODGING');
      setStockEnabled(false);
      formEl.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save item');
    } finally {
      setBusy(false);
    }
  }
  async function archive(item: Item) {
    if (
      !window.confirm(
        `Archive ${item.name}? It will stay on past sales but disappear from selection.`,
      )
    )
      return;
    try {
      await apiRequest(`/catalog/${item.id}/archive`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to archive item');
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="font-bold tracking-[.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/inventory">Inventory</Link>
          <Link href="/sales">Sales</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>
      <div className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Catalog</p>
        <h1 className="mt-2 text-4xl font-semibold">Products &amp; services</h1>
        <p className="mt-2 text-ink/60">
          Manage catalog items across your enabled service modules.{' '}
          <Link className="text-accent" href="/settings">
            Add another service from Settings anytime: Food, Beverage, or Gym.
          </Link>
        </p>
      </div>
      <section className="mt-8 grid gap-8 lg:grid-cols-[350px_1fr]">
        <form
          key={editing?.id ?? 'new'}
          onSubmit={save}
          className="h-fit rounded-3xl border border-ink/10 bg-white p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{editing ? 'Edit item' : 'Add item'}</h2>
            {editing && (
              <button
                className="text-sm text-accent"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormModule(enabledModules[0] ?? 'LODGING');
                  setStockEnabled(false);
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <label className="mt-5 block text-sm font-medium">
            Name
            <input required name="name" defaultValue={editing?.name} className={field} />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Type
            <select
              name="module"
              value={formModule}
              onChange={(e) => {
                setFormModule(e.target.value as Item['module']);
                if (e.target.value === 'LODGING') setStockEnabled(false);
              }}
              className={field}
            >
              {enabledModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">
            Category
            <input
              name="category"
              defaultValue={editing?.category ?? ''}
              placeholder={
                formModule === 'LODGING'
                  ? 'e.g. Apartment Rate'
                  : formModule === 'GYM'
                    ? 'e.g. Membership'
                    : formModule === 'FOOD'
                      ? 'e.g. Meals'
                      : 'e.g. Beverages'
              }
              className={field}
            />
          </label>
          <div key={formModule} className="mt-4 grid grid-cols-2 gap-3">
            {formModule === 'LODGING' && (
              <>
                <label className="text-sm font-medium">
                  Normal rate
                  <input
                    name="normalRate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0"
                    defaultValue={editing?.normalRate ?? ''}
                    className={field}
                  />
                </label>
                <label className="text-sm font-medium">
                  Party rate
                  <input
                    name="partyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0"
                    defaultValue={editing?.partyRate ?? ''}
                    className={field}
                  />
                </label>
              </>
            )}
            {formModule === 'GYM' && (
              <label className="text-sm font-medium">
                Monthly price
                <input
                  name="monthlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0"
                  defaultValue={editing?.monthlyPrice ?? ''}
                  className={field}
                />
              </label>
            )}
            {['FOOD', 'BEVERAGE'].includes(formModule) && (
              <label className="text-sm font-medium">
                Selling price
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0"
                  defaultValue={editing?.sellingPrice ?? ''}
                  className={field}
                />
              </label>
            )}
            {stockEnabled && ['FOOD', 'BEVERAGE'].includes(formModule) && (
              <label className="text-sm font-medium">
                Cost price (optional)
                <input
                  name="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  defaultValue={editing?.costPrice ?? ''}
                  className={field}
                />
              </label>
            )}
          </div>
          {['FOOD', 'BEVERAGE'].includes(formModule) && (
            <label className="mt-4 flex items-center gap-3 text-sm font-medium">
              <input
                name="isStockable"
                type="checkbox"
                checked={stockEnabled}
                onChange={(e) => setStockEnabled(e.target.checked)}
              />
              <span>Track this item in inventory</span>
            </label>
          )}
          {stockEnabled && ['FOOD', 'BEVERAGE'].includes(formModule) && (
            <label className="mt-4 block text-sm font-medium">
              Low stock threshold
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                step="1"
                defaultValue={editing?.lowStockThreshold ?? ''}
                className={field}
              />
            </label>
          )}
          <button
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create item'}
          </button>
        </form>
        <section>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              Type
              <select
                className={field}
                value={module}
                onChange={(e) => {
                  setPage(1);
                  setModule(e.target.value);
                }}
              >
                <option value="">All types</option>
                {enabledModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Category
              <input
                className={field}
                value={category}
                onChange={(e) => {
                  setPage(1);
                  setCategory(e.target.value);
                }}
                placeholder="Filter category"
              />
            </label>
            <label className="text-sm font-medium">
              Search
              <input
                className={field}
                type="search"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Item name"
              />
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  setPage(1);
                  setArchived(e.target.checked);
                }}
              />
              Archived items
            </label>
            <span className="mb-3 ml-auto text-sm text-ink/55">
              {total} items · Page {page} of {Math.max(1, Math.ceil(total / catalogPageSize))}
            </span>
          </div>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <div className="hidden grid-cols-[1.5fr_0.8fr_1fr_0.8fr_1fr] gap-3 bg-paper px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55 sm:grid">
              <span>Name</span>
              <span>Type</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock / action</span>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-ink/55" role="status">
                Loading catalog…
              </p>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-2 border-t border-ink/5 px-5 py-4 sm:grid-cols-[1.5fr_0.8fr_1fr_0.8fr_1fr] sm:items-center sm:gap-3"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    {item.isArchived && <span className="text-xs text-ink/45">Archived</span>}
                  </div>
                  <span className="text-sm text-ink/65">{item.module}</span>
                  <span className="text-sm text-ink/65">{item.category ?? '—'}</span>
                  <span className="text-sm">
                    {item.module === 'LODGING'
                      ? `Normal: ${formatMoney(item.normalRate)} / Party: ${formatMoney(item.partyRate)}`
                      : item.module === 'GYM'
                        ? `${formatMoney(item.monthlyPrice)} / month`
                        : formatMoney(item.sellingPrice)}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <span className="text-ink/55">
                      {item.isStockable ? `${item.currentQuantity ?? 0} on hand` : 'Non-stockable'}
                    </span>
                    {!archived && (
                      <>
                        <button
                          className="text-accent"
                          onClick={() => {
                            setEditing(item);
                            setFormModule(item.module);
                            setStockEnabled(item.isStockable);
                          }}
                        >
                          Edit
                        </button>
                        <button className="text-red-700" onClick={() => void archive(item)}>
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
            {!loading && !items.length && (
              <p className="p-8 text-center text-sm text-ink/55">
                No catalog items match these filters.
              </p>
            )}
          </div>
          {!loading && total > catalogPageSize && (
            <nav
              aria-label="Catalog pages"
              className="mt-4 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                className="min-h-11 rounded-xl border border-ink/15 px-4 py-2 text-sm disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span className="text-sm text-ink/60">
                Page {page} of {Math.ceil(total / catalogPageSize)}
              </span>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-ink/15 px-4 py-2 text-sm disabled:opacity-50"
                disabled={page >= Math.ceil(total / catalogPageSize)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </section>
    </main>
  );
}
