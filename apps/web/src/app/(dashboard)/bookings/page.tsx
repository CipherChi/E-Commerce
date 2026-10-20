'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/money';

type Property = { id: string; name: string };
type Room = { id: string; label: string; type: string; basePrice: string; status: string };
type Customer = { id: string; name: string; phone: string };
type Booking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: string;
  customer: Customer;
  room: Room & { property: Property };
};
type ListResult = { data: Booking[]; total: number; page: number; pageSize: number };

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState(today());
  const [checkOut, setCheckOut] = useState('');
  const [availability, setAvailability] = useState(
    'Choose a room and stay dates to check availability.',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBookings = useCallback(async () => {
    try {
      const result = await apiRequest<ListResult>('/bookings?page=1&pageSize=100');
      setBookings(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load bookings');
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      apiRequest<Property[]>('/properties').then(setProperties),
      apiRequest<Customer[]>('/customers').then(setCustomers),
      loadBookings(),
    ]).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Unable to load booking data'),
    );
  }, [loadBookings]);

  useEffect(() => {
    setRoomId('');
    setRooms([]);
    if (!propertyId) return;
    void apiRequest<Room[]>(`/properties/${propertyId}/rooms`)
      .then(setRooms)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load rooms'),
      );
  }, [propertyId]);

  useEffect(() => {
    if (!roomId || !checkIn || !checkOut || checkOut <= checkIn) {
      setAvailability('Choose a room and a check-out date after check-in.');
      return;
    }
    let current = true;
    const params = new URLSearchParams({ roomId, checkIn, checkOut });
    void apiRequest<{ available: boolean; reason?: string }>(`/bookings/availability?${params}`)
      .then((result) => {
        if (current)
          setAvailability(
            result.available
              ? 'Room is available for these dates.'
              : (result.reason ?? 'Room is unavailable.'),
          );
      })
      .catch((cause: unknown) => {
        if (current)
          setAvailability(cause instanceof Error ? cause.message : 'Unable to check availability');
      });
    return () => {
      current = false;
    };
  }, [roomId, checkIn, checkOut]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const booking = await apiRequest<Booking>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          roomId: form.get('roomId'),
          customerId: form.get('customerId'),
          checkIn: form.get('checkIn'),
          checkOut: form.get('checkOut'),
          source: form.get('source'),
        }),
      });
      router.push(`/bookings/${booking.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create booking');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          STAYWISE
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/properties">Properties</Link>
          <Link href="/customers">Customers</Link>
        </nav>
      </header>
      <section className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Front desk</p>
        <h1 className="mt-2 text-4xl font-semibold">Bookings</h1>
        <p className="mt-3 text-ink/65">
          Check room availability, quote the nightly rate, and follow each stay through checkout.
        </p>
      </section>
      <section className="mt-9 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="h-fit rounded-3xl border border-ink/10 bg-white p-6" onSubmit={create}>
          <h2 className="text-xl font-semibold">Create a booking</h2>
          <label className="mt-5 block text-sm font-medium">
            Customer
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
              name="customerId"
              required
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">
            Property
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              required
            >
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">
            Room
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
              name="roomId"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              required
            >
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label} · {room.type} · {formatMoney(room.basePrice)}/night ·{' '}
                  {room.status.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Check-in
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-3 py-3"
                name="checkIn"
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Check-out
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-3 py-3"
                name="checkOut"
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(event) => setCheckOut(event.target.value)}
                required
              />
            </label>
          </div>
          <p
            className={`mt-3 text-sm ${availability.startsWith('Room is available') ? 'text-emerald-700' : 'text-ink/60'}`}
            role="status"
          >
            {availability}
          </p>
          <label className="mt-4 block text-sm font-medium">
            Booking source
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
              name="source"
            >
              <option value="WALK_IN">Walk-in</option>
              <option value="PHONE">Phone</option>
              <option value="AGENT">Agent</option>
            </select>
          </label>
          <button
            className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving…' : 'Create booking'}
          </button>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </form>
        <section>
          <h2 className="mb-4 text-xl font-semibold">Upcoming stays</h2>
          {bookings.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/20 p-8 text-sm text-ink/60">
              No bookings yet.
            </p>
          ) : (
            <div className="grid gap-3">
              {bookings.map((booking) => (
                <Link
                  className="rounded-2xl border border-ink/10 bg-white p-5 hover:border-accent/40"
                  href={`/bookings/${booking.id}`}
                  key={booking.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {booking.customer.name} · {booking.room.property.name}, {booking.room.label}
                      </h3>
                      <p className="mt-1 text-sm text-ink/60">
                        {booking.checkIn.slice(0, 10)} → {booking.checkOut.slice(0, 10)}
                      </p>
                    </div>
                    <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold">
                      {booking.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink/70">
                    Stay total {formatMoney(booking.totalAmount)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
