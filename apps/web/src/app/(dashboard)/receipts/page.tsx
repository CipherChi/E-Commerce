'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ReceiptData, ReceiptView } from '@/components/ReceiptView';
import { formatReceiptMoney } from '@hotel/shared-types/src/money.js';

type SaleRow = {
  id: string;
  receiptNumber: string | null;
  createdAt: string;
  total: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  guestName?: string | null;
};
type SalesPage = { data: SaleRow[]; total: number; page: number; pageSize: number };
const pageSize = 25;

export default function ReceiptsPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      status: 'COMPLETED',
      page: String(page),
      pageSize: String(pageSize),
    });
    void apiRequest<SalesPage>(`/sales?${params}`)
      .then((result) => {
        setSales(result.data);
        setTotal(result.total);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load receipts'),
      )
      .finally(() => setLoading(false));
  }, [page]);
  async function view(id: string) {
    try {
      setSelected(await apiRequest<ReceiptData>(`/receipts/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load receipt');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 pb-24 sm:px-10">
      <header className="flex justify-between">
        <Link className="font-bold tracking-[.18em] text-accent" href="/">
          E Commerce Site
        </Link>
        <Link href="/sales">Sales</Link>
      </header>
      <h1 className="mt-9 text-4xl font-semibold">Receipts</h1>
      <p className="mt-2 text-ink/60">
        Receipts are created automatically when a sale is completed.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 divide-y rounded-2xl border bg-white">
        {loading && (
          <p className="p-6 text-sm text-ink/60" role="status">
            Loading receipts…
          </p>
        )}
        {!loading &&
          sales.map((sale) => (
            <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <b>{sale.receiptNumber ?? 'Receipt'}</b>
                <p className="text-sm text-ink/60">
                  {sale.customer?.name ?? sale.guestName ?? 'Guest'} ·{' '}
                  {new Date(sale.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} ·{' '}
                  {sale.paymentStatus} · {formatReceiptMoney(sale.total)}
                </p>
              </div>
              <button
                onClick={() => void view(sale.id)}
                className="rounded-xl bg-accent px-4 py-2 text-white"
              >
                View receipt
              </button>
            </div>
          ))}
        {!loading && !error && sales.length === 0 && (
          <p className="p-6 text-sm text-ink/60">No completed sales yet.</p>
        )}
      </div>
      {total > pageSize && (
        <nav aria-label="Receipt pages" className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-ink/60">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            type="button"
            className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
            disabled={loading || page >= Math.ceil(total / pageSize)}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-3 py-6">
          <div className="mx-auto max-w-3xl rounded-2xl bg-paper p-4">
            <button
              onClick={() => setSelected(null)}
              className="mb-2 rounded-lg border bg-white px-3 py-2 print:hidden"
            >
              Close
            </button>
            <ReceiptView receipt={selected} />
          </div>
        </div>
      )}
    </main>
  );
}
