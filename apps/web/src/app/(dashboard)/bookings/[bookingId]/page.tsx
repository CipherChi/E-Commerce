'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Booking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: string;
  source: string;
  customer: { id: string; name: string; phone: string };
  room: {
    id: string;
    label: string;
    type: string;
    status: string;
    property: { id: string; name: string };
  };
};
const cash = (value: string) => {
  const [whole, fraction = '00'] = value.split('.');
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
};

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setBooking(await apiRequest<Booking>(`/bookings/${bookingId}`));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load booking');
    }
  }, [bookingId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string) {
    setWorking(true);
    setError('');
    try {
      await apiRequest(`/bookings/${bookingId}/${action}`, { method: 'POST' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Booking action failed');
    } finally {
      setWorking(false);
    }
  }

  async function createInvoice() {
    setWorking(true);
    setError('');
    try {
      const invoice = await apiRequest<{ id: string }>(`/bookings/${bookingId}/invoice`, {
        method: 'POST',
      });
      setInvoiceId(invoice.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create invoice');
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <Link className="text-sm text-accent" href="/bookings">
          ← Bookings
        </Link>
      </header>
      {booking ? (
        <>
          <section className="mt-12">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Booking details
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-4xl font-semibold">{booking.customer.name}</h1>
              <span className="rounded-full bg-paper px-4 py-2 text-sm font-semibold">
                {booking.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-3 text-ink/65">
              {booking.room.property.name} · {booking.room.label} · {booking.room.type}
            </p>
          </section>
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <h2 className="font-semibold">Stay</h2>
              <p className="mt-3">
                {booking.checkIn.slice(0, 10)} → {booking.checkOut.slice(0, 10)}
              </p>
              <p className="mt-2 text-sm text-ink/60">
                Source: {booking.source.toLowerCase().replace('_', ' ')}
              </p>
            </article>
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <h2 className="font-semibold">Guest and total</h2>
              <p className="mt-3">{booking.customer.phone}</p>
              <p className="mt-2 text-lg font-semibold">{cash(booking.totalAmount)}</p>
            </article>
          </section>
          <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="text-lg font-semibold">Front desk actions</h2>
            <p className="mt-1 text-sm text-ink/60">
              Room status: {booking.room.status.toLowerCase().replace('_', ' ')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {invoiceId ? (
                <Link
                  className="rounded-xl border border-ink/15 px-5 py-3 font-semibold"
                  href={`/invoices/${invoiceId}`}
                >
                  Open invoice and payments
                </Link>
              ) : (
                <button
                  className="rounded-xl border border-ink/15 px-5 py-3 font-semibold disabled:opacity-50"
                  disabled={working}
                  onClick={() => void createInvoice()}
                >
                  Create / open invoice
                </button>
              )}
              {booking.status === 'PENDING' && (
                <>
                  <button
                    className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50"
                    disabled={working}
                    onClick={() => void act('confirm')}
                  >
                    Confirm booking
                  </button>
                  <button
                    className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                    disabled={working}
                    onClick={() => void act('cancel')}
                  >
                    Cancel booking
                  </button>
                </>
              )}
              {booking.status === 'CONFIRMED' && (
                <>
                  <button
                    className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50"
                    disabled={working}
                    onClick={() => void act('check-in')}
                  >
                    Check in
                  </button>
                  <button
                    className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                    disabled={working}
                    onClick={() => void act('cancel')}
                  >
                    Cancel booking
                  </button>
                  <button
                    className="rounded-xl border border-ink/15 px-5 py-3 font-semibold disabled:opacity-50"
                    disabled={working}
                    onClick={() => void act('no-show')}
                  >
                    Mark no-show
                  </button>
                </>
              )}
              {booking.status === 'CHECKED_IN' && (
                <button
                  className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={working}
                  onClick={() => void act('check-out')}
                >
                  Check out
                </button>
              )}
            </div>
          </section>
        </>
      ) : error ? (
        <p className="mt-12 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-12 text-sm text-ink/60">Loading booking…</p>
      )}
      {booking && error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
