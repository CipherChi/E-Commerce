'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { formatMoney, multiplyMoney, subtractMoney, sumMoney } from '@/lib/money';
type Item = { id: string; name: string; module: string; sellingPrice: string; normalRate: string; partyRate: string; monthlyPrice: string; isStockable: boolean; currentQuantity?: number | null };
type Customer = { id: string; name: string; phone: string };
type StaffMember = { id: string; name: string };
type Sale = {
  id: string;
  guestName?: string | null;
  customer?: Customer | null;
  createdAt: string;
  createdBy?: { id: string; name: string };
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  total: string;
  amountPaid: string;
  _count?: { items: number };
  items?: {
    id: string;
    quantity: number;
    unitPrice: string;
    lineSubtotal: string;
    product: { name: string; module: string };
  }[];
  movements?: { id: string; quantity: number; product: { name: string } }[];
};
const field = 'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3';
const money = (n: string | number) => formatMoney(String(n));
export default function SalesPage() {
  const idempotencyKey = useRef<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [guest, setGuest] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [amountPaid, setAmountPaid] = useState('');
  const [lines, setLines] = useState<{ productId: string; quantity: number; pricingOption: 'NORMAL' | 'PARTY' }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [recordedBy, setRecordedBy] = useState('');
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('paymentMethod', filter);
      if (customerFilter) params.set('customerId', customerFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (recordedBy) params.set('recordedById', recordedBy);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      const [catalog, guests, history] = await Promise.all([
        apiRequest<Item[]>('/catalog'),
        apiRequest<Customer[]>('/customers'),
        apiRequest<Sale[]>(`/sales${params.size ? `?${params}` : ''}`),
      ]);
      setItems(catalog);
      setCustomers(guests);
      setSales(history);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load sales');
    }
  }, [filter, customerFilter, statusFilter, from, to, recordedBy]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => { void apiRequest<{role:string}>('/auth/me').then(me => { if(me.role==='ADMIN'||me.role==='OWNER') return apiRequest<Array<{user:StaffMember}>>('/businesses/staff').then(rows=>setStaff(rows.map(row=>row.user))); }).catch(()=>{}); }, []);
  const priceFor = (line: { productId: string; pricingOption: 'NORMAL' | 'PARTY' }) => { const item = items.find(i => i.id === line.productId); return item?.module === 'LODGING' ? (line.pricingOption === 'PARTY' ? item.partyRate : item.normalRate) : item?.module === 'GYM' ? item.monthlyPrice : item?.sellingPrice ?? '0'; };
  const total = useMemo(() => sumMoney(lines.map(line => multiplyMoney(priceFor(line), line.quantity))), [lines, items]);
  function addLine() {
    const available = items.find((i) => !lines.some((l) => l.productId === i.id));
    if (available) setLines([...lines, { productId: available.id, quantity: 1, pricingOption: 'NORMAL' }]);
    else setLines([...lines, { productId: items[0]?.id ?? '', quantity: 1, pricingOption: 'NORMAL' }]);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const sale = await apiRequest<Sale>('/sales', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          customerId: customerId || undefined,
          guestName: customerId ? undefined : guest,
          paymentMethod: method,
          paymentStatus,
          amountPaid: paymentStatus === 'PARTIAL' ? amountPaid : undefined,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, pricingOption: l.pricingOption })),
        }),
      });
      idempotencyKey.current = null;
      setCustomerId('');
      setGuest('');
      setLines([]);
      setSelected(sale);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete sale');
    } finally {
      setBusy(false);
    }
  }
  async function openSale(id: string) {
    try {
      setSelected(await apiRequest<Sale>(`/sales/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load sale');
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="font-bold tracking-[.18em] text-accent" href="/">
          STAYWISE
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/products">Catalog</Link>
          <Link href="/inventory">Inventory</Link>
          <Link href="/customers">Customers</Link>
        </nav>
      </header>
      <div className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Revenue</p>
        <h1 className="mt-2 text-4xl font-semibold">Sales</h1>
        <p className="mt-2 text-ink/60">
          Sell room nights, services and products together; stock deductions are recorded on
          completion.
        </p>
      </div>
      <section className="mt-8 grid gap-8 lg:grid-cols-[430px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-3xl border border-ink/10 bg-white p-6">
          <h2 className="text-xl font-semibold">New sale</h2>
          <label className="mt-5 block text-sm font-medium">
            Customer
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={field}
            >
              <option value="">Walk-in / guest</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </label>
          {!customerId && (
            <label className="mt-4 block text-sm font-medium">
              Guest name
              <input
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                className={field}
                placeholder="Name for walk-in sale"
              />
            </label>
          )}
          <div className="mt-6 flex items-center justify-between">
            <h3 className="font-semibold">Items</h3>
            <button
              type="button"
              onClick={addLine}
              disabled={!items.length}
              className="text-sm font-semibold text-accent"
            >
              + Add item
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_82px_34px] items-end gap-2">
                <label className="text-xs font-medium text-ink/60">
                  Product or service
                  <select
                    value={line.productId}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, i) =>
                          i === index ? { ...x, productId: e.target.value, pricingOption: 'NORMAL' } : x,
                        ),
                      )
                    }
                    className={field}
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {money(i.sellingPrice)}{i.isStockable ? ` · ${i.currentQuantity ?? 0} in stock` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {items.find(i => i.id === line.productId)?.module === 'LODGING' && <label className="col-span-full text-xs font-medium text-ink/60">Rate<select value={line.pricingOption} onChange={e => setLines(lines.map((x,i) => i === index ? { ...x, pricingOption: e.target.value as 'NORMAL' | 'PARTY' } : x))} className={field}><option value="NORMAL">Normal rate: {money(items.find(i=>i.id===line.productId)?.normalRate ?? '0')}</option><option value="PARTY">Party rate: {money(items.find(i=>i.id===line.productId)?.partyRate ?? '0')}</option></select></label>}
                <label className="text-xs font-medium text-ink/60">
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, i) =>
                          i === index ? { ...x, quantity: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    className={field}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  className="mb-3 text-lg text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {lines.length === 0 && (
            <p className="mt-3 text-sm text-ink/50">Add at least one catalog item.</p>
          )}
          <div className="mt-5 flex justify-between border-t border-ink/10 pt-4 font-semibold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Payment method
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer</option>
                <option value="POS">POS</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Payment status
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className={field}
              >
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </label>
          </div>
          {paymentStatus === 'PARTIAL' && (
            <label className="mt-4 block text-sm font-medium">
              Amount received
              <input
                required
                min="0.01"
                max={subtractMoney(total)}
                step="0.01"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className={field}
              />
            </label>
          )}
          <button
            disabled={busy || !items.length || !lines.length}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Completing…' : 'Complete sale'}
          </button>
        </form>
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Sales history</h2>
              <p className="mt-1 text-sm text-ink/55">{sales.length} recent sales</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="text-xs font-medium">
                Search
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={field}
                  placeholder="Guest name"
                />
              </label>
              <label className="text-xs font-medium">
                Customer
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className={field}
                >
                  <option value="">All customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium">
                Payment
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className={field}
                >
                  <option value="">All methods</option>
                  <option value="CASH">Cash</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="POS">POS</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={field}
                >
                  <option value="">All statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              {staff.length>0 && <label className="text-xs font-medium">Recorded by<select value={recordedBy} onChange={e=>setRecordedBy(e.target.value)} className={field}><option value="">All staff</option>{staff.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
              <label className="text-xs font-medium">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={field}
                />
              </label>
              <label className="text-xs font-medium">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={field}
                />
              </label>
            </div>
          </div>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="space-y-3">
            {sales
              .filter((s) =>
                (s.customer?.name ?? s.guestName ?? 'Walk-in')
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => void openSale(s.id)}
                  className="w-full rounded-2xl border border-ink/10 bg-white p-5 text-left hover:border-accent/40"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {s.customer?.name ?? s.guestName ?? 'Walk-in'}{' '}
                        <span className="ml-2 text-xs font-normal text-ink/45">
                          {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-ink/55">
                        {s.paymentMethod} · {s.paymentStatus} · {s._count?.items ?? '—'} lines · Recorded by {s.createdBy?.name ?? '—'}
                      </p>
                    </div>
                    <p className="font-semibold">{money(s.total)}</p>
                  </div>
                </button>
              ))}
            {!sales.length && (
              <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-sm text-ink/55">
                No sales recorded yet.
              </div>
            )}
          </div>
          {selected && (
            <article className="mt-6 rounded-3xl border border-accent/20 bg-white p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Sale detail
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    {selected.customer?.name ?? selected.guestName}
                  </h3>
                </div>
                <button className="text-sm text-accent" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
              <div className="mt-4 divide-y divide-ink/5">
                {selected.items?.map((i) => (
                  <div className="flex justify-between py-3 text-sm" key={i.id}>
                    <span>
                      {i.product.name} ({i.quantity} × {money(i.unitPrice)})
                    </span>
                    <span>{money(i.lineSubtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-ink/10 pt-4 text-sm">
                <span>
                  {selected.paymentMethod} · {selected.paymentStatus} · Paid{' '}
                  {money(selected.amountPaid)}
                </span>
                <strong>Total {money(selected.total)}</strong>
              </div>
              <p className="mt-3 text-sm text-ink/60">Recorded by {selected.createdBy?.name ?? '—'}</p>
              <Link className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white" href={`/receipts/${selected.id}`}>View receipt</Link>
              {!!selected.movements?.length && (
                <div className="mt-4 rounded-xl bg-paper p-4">
                  <p className="text-sm font-semibold">Linked stock deductions</p>
                  {selected.movements.map((m) => (
                    <p key={m.id} className="mt-1 text-sm text-ink/65">
                      {m.product.name}: {m.quantity}
                    </p>
                  ))}
                </div>
              )}
            </article>
          )}
        </section>
      </section>
    </main>
  );
}
