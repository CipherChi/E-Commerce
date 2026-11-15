'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/money';

type Property = {
  id: string;
  name: string;
  address: string;
  type: 'HOTEL' | 'SHORTLET' | 'APARTMENT';
};
type Room = {
  id: string;
  label: string;
  type: string;
  capacity: number;
  basePrice: string | number;
  status: string;
};
const statusStyles: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-800',
  OCCUPIED: 'bg-blue-50 text-blue-800',
  CLEANING: 'bg-amber-50 text-amber-800',
  MAINTENANCE: 'bg-red-50 text-red-800',
};

export default function RoomsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isApartment = property?.type === 'APARTMENT';
  const load = useCallback(async () => {
    try {
      const [nextProperty, nextRooms] = await Promise.all([
        apiRequest<Property>(`/properties/${propertyId}`),
        apiRequest<Room[]>(`/properties/${propertyId}/rooms`),
      ]);
      setProperty(nextProperty);
      setRooms(nextRooms);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load rooms');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/properties/${propertyId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          label: form.get('label'),
          type: form.get('type'),
          capacity: Number(form.get('capacity')),
          basePrice: String(form.get('basePrice')),
        }),
      });
      formElement.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add room');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between">
        <Link className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <Link
          className="text-sm text-accent"
          href="/properties"
          onClick={() => sessionStorage.setItem('staywise.propertiesPageFlip', '1')}
        >
          ← Properties
        </Link>
      </header>
      <div className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Room inventory
        </p>
        <h1 className="mt-2 text-4xl font-semibold">{property?.name ?? 'Rooms'}</h1>
        <p className="mt-3 text-ink/65">{property?.address}</p>
      </div>
      <section className="mt-9 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <form className="h-fit rounded-3xl border border-ink/10 bg-white p-6" onSubmit={create}>
          <h2 className="text-xl font-semibold">
            {isApartment ? 'Add an apartment' : 'Add a room'}
          </h2>
          <label className="mt-5 block text-sm font-medium">
            {isApartment ? 'Apartment label' : 'Room label'}
            <input
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="label"
              key={`${isApartment ? 'apartment' : 'hotel'}-${rooms.length}`}
              defaultValue={
                isApartment ? `Apartment ${rooms.length + 1}` : String(101 + rooms.length)
              }
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            {isApartment ? 'Bedroom configuration' : 'Room type'}
            <select
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
              name="type"
              key={isApartment ? 'apartment-types' : 'hotel-types'}
              defaultValue={isApartment ? '1 Bedroom Apartment' : 'Standard'}
              required
            >
              {isApartment ? (
                <>
                  <option>Studio Apartment</option>
                  <option>1 Bedroom Apartment</option>
                  <option>2 Bedroom Apartment</option>
                  <option>3 Bedroom Apartment</option>
                  <option>4 Bedroom Apartment</option>
                  <option>5 Bedroom Apartment</option>
                </>
              ) : (
                <>
                  <option>Standard</option>
                  <option>Deluxe</option>
                  <option>Executive</option>
                  <option>Suite</option>
                  <option>Family Room</option>
                  <option>Presidential Suite</option>
                </>
              )}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Capacity
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
                name="capacity"
                type="number"
                min="1"
                defaultValue="2"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Base price
              <input
                className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3"
                name="basePrice"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
          </div>
          <button
            className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving…' : isApartment ? 'Add apartment' : 'Add room'}
          </button>
        </form>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{isApartment ? 'Apartments' : 'Rooms'}</h2>
            <span className="text-sm text-ink/60">
              {rooms.length} {isApartment ? 'units' : 'total'}
            </span>
          </div>
          {loading ? (
            <p className="text-sm text-ink/60">Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/20 p-8 text-sm text-ink/60">
              {isApartment ? 'No apartments added yet.' : 'No rooms added yet.'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-ink/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
                <span>{isApartment ? 'Apartment' : 'Room'}</span>
                <span>Capacity · Price</span>
                <span>Status</span>
              </div>
              {rooms.map((room) => (
                <article
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-ink/5 px-5 py-4 last:border-0"
                  key={room.id}
                >
                  <div>
                    <h3 className="font-semibold">{room.label}</h3>
                    <p className="text-sm text-ink/60">{room.type}</p>
                  </div>
                  <p className="text-sm text-ink/70">
                    {room.capacity} guests · {formatMoney(String(room.basePrice))}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[room.status] ?? 'bg-paper text-ink/70'}`}
                  >
                    {room.status.toLowerCase().replace('_', ' ')}
                  </span>
                </article>
              ))}
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
