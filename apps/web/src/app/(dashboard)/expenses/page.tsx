'use client';
import Link from 'next/link';
import { formatMoney, sumMoney } from '@/lib/money';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Cat = { id: string; name: string };
type Exp = {
  id: string;
  categoryId: string;
  amount: string;
  description?: string;
  expenseDate: string;
  category: Cat;
};
const f = 'mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5';
const money = (n: number | string) => formatMoney(String(n));
export default function ExpensesPage() {
  const [cats, C] = useState<Cat[]>([]),
    [rows, R] = useState<Exp[]>([]),
    [cat, S] = useState(''),
    [filter, F] = useState(''),
    [from, A] = useState(''),
    [to, B] = useState(''),
    [amount, M] = useState(''),
    [desc, D] = useState(''),
    [date, T] = useState(new Date().toISOString().slice(0, 10)),
    [edit, E] = useState(''),
    [newCat, N] = useState(''),
    [error, X] = useState('');
  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (filter) q.set('categoryId', filter);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const [c, e] = await Promise.all([
        apiRequest<Cat[]>('/expenses/categories'),
        apiRequest<Exp[]>(`/expenses${q.size ? '?' + q : ''}`),
      ]);
      C(c);
      R(e);
      if (!cat && c[0]) S(c[0].id);
      X('');
    } catch (e) {
      X(e instanceof Error ? e.message : 'Unable to load expenses');
    }
  }, [filter, from, to, cat]);
  useEffect(() => {
    void load();
  }, [load]);
  const total = sumMoney(rows.map((r) => r.amount));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest(`/expenses${edit ? '/' + edit : ''}`, {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify({ categoryId: cat, amount, description: desc, expenseDate: date }),
      });
      E('');
      M('');
      D('');
      await load();
    } catch (e) {
      X(e instanceof Error ? e.message : 'Unable to save');
    }
  }
  async function archive(r: Exp) {
    if (!confirm('Archive this expense?')) return;
    await apiRequest(`/expenses/${r.id}`, { method: 'DELETE' });
    await load();
  }
  async function addCat() {
    if (!newCat.trim()) return;
    await apiRequest('/expenses/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCat }),
    });
    N('');
    await load();
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 pb-24 sm:px-10">
      <header className="flex justify-between">
        <Link className="font-bold tracking-[.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <Link href="/">Dashboard</Link>
      </header>
      <h1 className="mt-9 text-4xl font-semibold">Expenses</h1>
      <p className="mt-2 text-ink/60">Record and review business expenses.</p>
      <div className="mt-7 grid gap-6 lg:grid-cols-[350px_1fr]">
        <form onSubmit={save} className="h-fit rounded-3xl border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-semibold">{edit ? 'Edit expense' : 'Add expense'}</h2>
          <label className="mt-4 block text-sm">
            Category
            <select required className={f} value={cat} onChange={(e) => S(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Amount (₦)
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              className={f}
              value={amount}
              onChange={(e) => M(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Description
            <input className={f} value={desc} onChange={(e) => D(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            Date
            <input
              required
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className={f}
              value={date}
              onChange={(e) => T(e.target.value)}
            />
          </label>
          <button className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white">
            {edit ? 'Save changes' : 'Add expense'}
          </button>
          {edit && (
            <button type="button" onClick={() => E('')} className="mt-2 w-full py-2">
              Cancel
            </button>
          )}
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold">Add category</h3>
            <div className="mt-2 flex gap-2">
              <input
                className={f}
                placeholder="e.g. Fuel"
                value={newCat}
                onChange={(e) => N(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void addCat()}
                className="rounded-xl bg-paper px-4"
              >
                Add
              </button>
            </div>
          </div>
        </form>
        <section>
          <div className="rounded-3xl border border-ink/10 bg-white p-5">
            <h2 className="font-semibold">Summary by category</h2>
            {cats.map((c) => {
              const n = sumMoney(rows.filter((r) => r.categoryId === c.id).map((r) => r.amount));
              return n ? (
                <div key={c.id} className="mt-2 flex justify-between text-sm">
                  <span>{c.name}</span>
                  <b>{money(n)}</b>
                </div>
              ) : null;
            })}
            <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Category
              <select className={f} value={filter} onChange={(e) => F(e.target.value)}>
                <option value="">All</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              From
              <input type="date" className={f} value={from} onChange={(e) => A(e.target.value)} />
            </label>
            <label className="text-xs">
              To
              <input type="date" className={f} value={to} onChange={(e) => B(e.target.value)} />
            </label>
            <b className="ml-auto p-3">Filtered total: {money(total)}</b>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid gap-2 border-t border-ink/5 px-4 py-4 text-sm sm:grid-cols-[1fr_1fr_1.3fr_1fr_auto] sm:items-center"
              >
                <span>{new Date(r.expenseDate).toLocaleDateString()}</span>
                <span>{r.category.name}</span>
                <span>{r.description || '—'}</span>
                <b>{money(r.amount)}</b>
                <span className="flex gap-3">
                  <button
                    onClick={() => {
                      E(r.id);
                      S(r.categoryId);
                      M(r.amount);
                      D(r.description || '');
                      T(r.expenseDate.slice(0, 10));
                    }}
                    className="text-accent"
                  >
                    Edit
                  </button>
                  <button onClick={() => void archive(r)} className="text-red-700">
                    Archive
                  </button>
                </span>
              </div>
            ))}
            {!rows.length && (
              <p className="p-6 text-sm text-ink/55">No expenses match these filters.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
