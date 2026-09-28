'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type Booking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: string;
  payments: { amount: string }[];
  invoice?: { balance: string; amountPaid: string } | null;
};
type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  outstandingBalance: string;
  bookings: Booking[];
};
const cash = (value: string) => { const [whole, fraction = '00'] = value.split('.'); return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`; };

export default function CustomerProfilePage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<Customer>(`/customers/${params.customerId}`)
      .then(setCustomer)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load customer'),
      );
  }, [params.customerId]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const updated = await apiRequest<Customer>(`/customers/${params.customerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          email: form.get('email') || undefined,
          notes: form.get('notes') || undefined,
        }),
      });
      setCustomer((current) => (current ? { ...current, ...updated } : updated));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update customer');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!window.confirm('Archive this customer? Their transaction history will be retained.'))
      return;
    try {
      await apiRequest(`/customers/${params.customerId}`, { method: 'DELETE' });
      router.push('/customers');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive customer');
    }
  }

  if (!customer)
    return <main className="mx-auto max-w-4xl px-6 py-10">{error || 'Loading customer…'}</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <Link className="text-sm text-accent" href="/customers">
        ← Customers
      </Link>
      <h1 className="mt-5 text-4xl font-semibold">{customer.name}</h1>
      <p className="mt-2 text-ink/65">
        Outstanding balance: {cash(customer.outstandingBalance)}
      </p>
      <section className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="h-fit rounded-3xl border border-ink/10 bg-white p-6" onSubmit={update}>
          <h2 className="text-xl font-semibold">Customer details</h2>
          <label className="mt-5 block text-sm font-medium">
            Name
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="name"
              defaultValue={customer.name}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Phone
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="phone"
              defaultValue={customer.phone}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Email
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="email"
              type="email"
              defaultValue={customer.email ?? ''}
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Notes
            <textarea
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="notes"
              defaultValue={customer.notes ?? ''}
              rows={3}
            />
          </label>
          <button
            className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className="mt-3 w-full rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700"
            type="button"
            onClick={archive}
          >
            Archive customer
          </button>
        </form>
        <section className="rounded-3xl border border-ink/10 bg-white p-6">
          <h2 className="text-xl font-semibold">Transaction history</h2>
          {customer.bookings.length ? (
            <div className="mt-5 divide-y divide-ink/10">
              {customer.bookings.map((booking) => (
                <article className="py-4 first:pt-0" key={booking.id}>
                  <div className="flex justify-between gap-4">
                    <span className="font-medium">
                      {new Date(booking.checkIn).toLocaleDateString()} –{' '}
                      {new Date(booking.checkOut).toLocaleDateString()}
                    </span>
                    <span className="text-sm text-ink/60">
                      {booking.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/65">{booking.invoice ? <>Invoice total {cash(booking.totalAmount)} · paid {cash(booking.invoice.amountPaid)} · due {cash(booking.invoice.balance)}</> : <>Booking total {cash(booking.totalAmount)} · not invoiced</>}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/60">No transactions yet.</p>
          )}
        </section>
      </section>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
