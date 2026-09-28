'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type Payment = { id: string; amount: string; method: string; reference?: string | null; paidAt: string };
type Invoice = { id: string; invoiceNumber: string; totalAmount: string; amountPaid: string; balance: string; status: string; payments: Payment[] };
const cash = (value: string) => { const [whole, fraction = '00'] = value.split('.'); return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`; };

export default function InvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => setInvoice(await apiRequest<Invoice>(`/invoices/${invoiceId}`)), [invoiceId]);
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load invoice')); }, [load]);
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); setError('');
    try { await apiRequest(`/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify({ amount: form.get('amount'), method: form.get('method'), reference: form.get('reference') || undefined }) }); event.currentTarget.reset(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment'); } finally { setSaving(false); }
  }
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-10 sm:px-10">
    <Link href="/bookings" className="text-sm text-accent">← Bookings</Link>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {invoice ? <><p className="mt-8 text-sm font-semibold uppercase tracking-[.18em] text-accent">Invoice</p><h1 className="mt-2 text-4xl font-semibold">{invoice.invoiceNumber}</h1>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">{[['Total', invoice.totalAmount], ['Collected', invoice.amountPaid], [`Outstanding · ${invoice.status}`, invoice.balance]].map(([label, value]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-ink/60">{label}</p><p className="mt-2 text-xl font-semibold">{cash(value)}</p></article>)}</section>
      <section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="text-lg font-semibold">Payment history</h2>{invoice.payments.length ? <ul className="mt-4 divide-y">{invoice.payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{payment.method} · {new Date(payment.paidAt).toLocaleString()}</span><span className="font-semibold">{cash(payment.amount)}{payment.reference ? ` · ${payment.reference}` : ''}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink/60">No payments recorded.</p>}</section>
      {invoice.status !== 'PAID' && invoice.status !== 'VOID' && <form className="mt-8 rounded-2xl border bg-white p-6" onSubmit={pay}><h2 className="text-lg font-semibold">Record payment</h2><label className="mt-4 block text-sm">Amount<input className="mt-1 block w-full rounded-xl border px-4 py-3" name="amount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required /></label><label className="mt-4 block text-sm">Method<select name="method" className="mt-1 block w-full rounded-xl border px-4 py-3"><option value="CASH">Cash</option><option value="TRANSFER">Transfer</option><option value="POS">POS</option></select></label><label className="mt-4 block text-sm">Reference (optional)<input className="mt-1 block w-full rounded-xl border px-4 py-3" name="reference" /></label><button disabled={saving} className="mt-5 rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Record payment'}</button></form>}
    </> : !error && <p className="mt-10 text-sm text-ink/60">Loading invoice…</p>}
  </main>;
}
