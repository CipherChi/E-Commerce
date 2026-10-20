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
type Setup = { profile: boolean; modules: boolean; properties: boolean; products: boolean; stock: boolean; staff: boolean };
const cash = (value: string) => { const [whole, fraction = '00'] = value.split('.'); return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`; };
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [range, setRange] = useState('today');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [owner, setOwner] = useState(true);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { try { const query = new URLSearchParams({ range }); if (range === 'custom') { if (from) query.set('from', from); if (to) query.set('to', to); } setData(await apiRequest<DashboardData>(`/dashboard/summary?${query}`)); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load dashboard'); } }, [range, from, to]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void apiRequest<{role:string|null}>('/auth/me').then(me => { const isOwner=me.role==='OWNER';setOwner(isOwner);if(!isOwner)return;return Promise.all([apiRequest<{name:string}>('/businesses/profile'), apiRequest<Array<{module:string;isEnabled:boolean}>>('/businesses/modules'), apiRequest<unknown[]>('/properties'), apiRequest<Array<{id:string}> >('/catalog'), apiRequest<{stockableProductCount:number;productsWithStock:number}>('/inventory/summary')])
      .then(async ([profile, modules, properties, products, inventory]) => {
        const staff = await apiRequest<Array<{user:{id:string}}>>('/businesses/staff');
        setSetup({ profile: Boolean(profile.name), modules: modules.some(row=>row.isEnabled), properties: properties.length>0, products: products.length>0, stock: inventory.stockableProductCount===0 || inventory.productsWithStock>0, staff: staff.length>0 });
      })}).catch(()=>setSetup(null));
  }, []);
  const cards: Array<[string, string, string]> = data ? [
    ['Sales', cash(data.sales), '/sales'], ['Collected', cash(data.collectedPayments), '/invoices'],
    ['Expenses', cash(data.expenses), '/expenses'], ['Estimated Profit', cash(data.estimatedProfit), '#profit'],
    ['Outstanding Payments', cash(data.outstandingPayments), '/invoices'],
    ...data.moduleCards.map(card => [card.label, String(card.value), '/sales'] as [string, string, string]),
    ['Low Stock', String(data.lowStock), '/inventory?lowStock=true'],
  ] : [];
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 pb-24 sm:px-10">
    <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Overview</p><h1 className="mt-2 text-4xl font-semibold">Dashboard</h1>
    {owner && setup && Object.values(setup).some(done=>!done) && <section className="mt-6 rounded-3xl border border-accent/20 bg-white p-6"><h2 className="text-xl font-semibold">Getting started</h2><p className="mt-1 text-sm text-ink/60">Complete these steps to set up your workspace.</p><ol className="mt-4 grid gap-2 sm:grid-cols-2">{([['Complete business profile','/settings',setup.profile],['Enable modules','/settings',setup.modules],['Add properties and rooms','/properties',setup.properties],['Add products & services','/products',setup.products],['Add opening stock','/inventory',setup.stock],['Invite staff','/staff',setup.staff]] as const).map(([label,href,done])=><li key={label}><Link href={href} className="flex items-center gap-3 rounded-xl bg-paper px-4 py-3 text-sm"><span className={done?'text-emerald-700':'text-ink/35'}>{done?'✓':'○'}</span><span className={done?'text-ink/50 line-through':'font-medium'}>{label}</span></Link></li>)}</ol></section>}
    <section className="mt-6 flex flex-wrap gap-3">{(owner ? [['Add property','/properties'],['Add product/service','/products'],['Record sale','/sales/new'],['Manage stock','/inventory']] : [['Record sale','/sales/new'],['Sales history','/sales'],['Customers','/customers']]).map(([label,href])=><Link key={label} href={href} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white">{label}</Link>)}</section>
    <div className="mt-6 flex flex-wrap items-end gap-3"><label className="text-sm">Date range<select value={range} onChange={event => setRange(event.target.value)} className="mt-1 block rounded-xl border bg-white px-3 py-2"><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom</option></select></label>{range === 'custom' && <><input aria-label="From" type="date" value={from} onChange={event => setFrom(event.target.value)} className="rounded-xl border bg-white px-3 py-2"/><input aria-label="To" type="date" value={to} onChange={event => setTo(event.target.value)} className="rounded-xl border bg-white px-3 py-2"/></>}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3">{error}</p>}
    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-3xl border border-ink/10 bg-white p-6"><p className="text-sm text-ink/60">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></Link>)}</section>
    {data && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Occupancy · {data.occupancy.date}</h2><p className="mt-3">Occupied: {data.occupancy.occupiedRooms}/{data.occupancy.totalBookableRooms} · Reserved: {data.occupancy.reservedRooms}/{data.occupancy.totalBookableRooms}</p></article><article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Front desk today</h2><p className="mt-3">Arrivals: {data.arrivalsToday} · Departures: {data.departuresToday}</p></article></section>}
    {data && <details id="profit" className="mt-5 rounded-2xl border border-ink/10 bg-white p-5"><summary className="cursor-pointer font-semibold">Estimated Profit calculation</summary><div className="mt-4 max-w-md space-y-2 text-sm"><p className="flex justify-between"><span>Revenue</span><span>{cash(data.revenue)}</span></p><p className="flex justify-between"><span>Cost of Goods</span><span>− {cash(data.costOfGoods)}</span></p><p className="flex justify-between"><span>Expenses</span><span>− {cash(data.expenses)}</span></p><p className="flex justify-between border-t pt-2 font-semibold"><span>Estimated Profit</span><span>{cash(data.estimatedProfit)}</span></p></div></details>}
  </main>;
}
