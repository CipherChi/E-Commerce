'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type DashboardData = {
  sales: string; expenses: string; estimatedProfit: string; revenue: string; costOfGoods: string;
  collectedPayments: string; outstandingPayments: string; arrivalsToday: number; departuresToday: number;
  occupancy: { date: string; occupiedRooms: number; reservedRooms: number; totalBookableRooms: number; occupiedRate: number; reservedRate: number };
  moduleCards: Array<{ module: string; label: string; value: number }>; lowStock: number;
};
const cash = (value: string) => { const [whole, fraction = '00'] = value.split('.'); return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`; };
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [range, setRange] = useState('today');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { try { const query = new URLSearchParams({ range }); if (range === 'custom') { if (from) query.set('from', from); if (to) query.set('to', to); } setData(await apiRequest<DashboardData>(`/dashboard/summary?${query}`)); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load dashboard'); } }, [range, from, to]);
  useEffect(() => { void load(); }, [load]);
  const cards: Array<[string, string, string]> = data ? [
    ['Sales', cash(data.sales), '/sales'], ['Collected', cash(data.collectedPayments), '/invoices'],
    ['Expenses', cash(data.expenses), '/expenses'], ['Estimated Profit', cash(data.estimatedProfit), '#profit'],
    ['Outstanding Payments', cash(data.outstandingPayments), '/invoices'],
    ...data.moduleCards.map(card => [card.label, String(card.value), '/sales'] as [string, string, string]),
    ['Low Stock', String(data.lowStock), '/inventory?lowStock=true'],
  ] : [];
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 pb-24 sm:px-10">
    <header className="flex justify-between"><Link className="font-bold tracking-[.18em] text-accent" href="/">STAYWISE</Link><nav className="hidden gap-4 text-sm sm:flex"><Link href="/bookings">Bookings</Link><Link href="/properties">Properties</Link><Link href="/customers">Customers</Link><Link href="/sales">Sales</Link><Link href="/inventory">Inventory</Link><Link href="/expenses">Expenses</Link><Link href="/settings">Settings</Link></nav></header>
    <p className="mt-10 text-sm font-semibold uppercase tracking-[.18em] text-accent">Overview</p><h1 className="mt-2 text-4xl font-semibold">Dashboard</h1>
    <div className="mt-6 flex flex-wrap items-end gap-3"><label className="text-sm">Date range<select value={range} onChange={event => setRange(event.target.value)} className="mt-1 block rounded-xl border bg-white px-3 py-2"><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom</option></select></label>{range === 'custom' && <><input aria-label="From" type="date" value={from} onChange={event => setFrom(event.target.value)} className="rounded-xl border bg-white px-3 py-2"/><input aria-label="To" type="date" value={to} onChange={event => setTo(event.target.value)} className="rounded-xl border bg-white px-3 py-2"/></>}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3">{error}</p>}
    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-3xl border border-ink/10 bg-white p-6"><p className="text-sm text-ink/60">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></Link>)}</section>
    {data && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Occupancy · {data.occupancy.date}</h2><p className="mt-3">Occupied: {data.occupancy.occupiedRooms}/{data.occupancy.totalBookableRooms} · Reserved: {data.occupancy.reservedRooms}/{data.occupancy.totalBookableRooms}</p></article><article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Front desk today</h2><p className="mt-3">Arrivals: {data.arrivalsToday} · Departures: {data.departuresToday}</p></article></section>}
    {data && <details id="profit" className="mt-5 rounded-2xl border border-ink/10 bg-white p-5"><summary className="cursor-pointer font-semibold">Estimated Profit calculation</summary><div className="mt-4 max-w-md space-y-2 text-sm"><p className="flex justify-between"><span>Revenue</span><span>{cash(data.revenue)}</span></p><p className="flex justify-between"><span>Cost of Goods</span><span>− {cash(data.costOfGoods)}</span></p><p className="flex justify-between"><span>Expenses</span><span>− {cash(data.expenses)}</span></p><p className="flex justify-between border-t pt-2 font-semibold"><span>Estimated Profit</span><span>{cash(data.estimatedProfit)}</span></p></div></details>}
  </main>;
}
