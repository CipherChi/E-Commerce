'use client';

import { useState } from 'react';
import { formatReceiptMoney } from '@hotel/shared-types/src/money.js';

export type ReceiptData = {
  saleId: string;
  business: { name: string; address?: string | null; phone?: string | null; logoUrl?: string | null };
  receiptNumber: string;
  publicUrl: string;
  pdfUrl: string;
  createdAt: string;
  recordedBy: string;
  customer: { name: string; phone?: string | null };
  items: { name: string; quantity: number; unitPrice: string; lineSubtotal: string }[];
  subtotal: string;
  total: string;
  paymentMethod: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  amountPaid: string;
  balance: string;
};

export function ReceiptView({ receipt }: { receipt: ReceiptData }) {
  const [paper, setPaper] = useState<'standard' | '58mm' | '80mm'>('standard');
  const publicUrl = receipt.publicUrl || (typeof window !== 'undefined' ? window.location.href : '');
  async function share() {
    if (navigator.share) await navigator.share({ title: `Receipt ${receipt.receiptNumber}`, url: publicUrl });
    else await navigator.clipboard.writeText(publicUrl);
  }
  return <main className="receipt-page mx-auto max-w-2xl p-6 print:p-0">
    <article className="receipt-print rounded-2xl border bg-white p-8 print:border-0 print:p-0" data-paper={paper}>
      <header className="flex justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {receipt.business.logoUrl && <img className="max-h-16 max-w-24 object-contain" src={receipt.business.logoUrl} alt={`${receipt.business.name} logo`} />}
          <div><h1 className="text-xl font-bold">{receipt.business.name}</h1><p>{receipt.business.address}<br/>{receipt.business.phone}</p></div>
        </div>
        <div className="text-right"><h2 className="text-2xl font-semibold">Receipt</h2><p>{receipt.receiptNumber}</p><p>{new Date(receipt.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p></div>
      </header>
      <p className="mt-8">Customer: {receipt.customer.name} {receipt.customer.phone}</p>
      <p className="mt-1 text-sm text-ink/60">Cashier: {receipt.recordedBy}</p>
      <div className="my-4 border-y py-3">
        {receipt.items.map((item, index) => <p key={`${item.name}-${index}`} className="flex justify-between gap-3 py-2"><span>{item.name} ({item.quantity} × {formatReceiptMoney(item.unitPrice)})</span><span>{formatReceiptMoney(item.lineSubtotal)}</span></p>)}
      </div>
      <p className="text-right">Subtotal {formatReceiptMoney(receipt.subtotal)}</p>
      <p className="text-right text-lg font-bold">Total {formatReceiptMoney(receipt.total)}</p>
      <p className="mt-3 text-right">{receipt.paymentMethod} · {receipt.paymentStatus}</p>
      <p className="text-right">Paid {formatReceiptMoney(receipt.amountPaid)} · Balance {formatReceiptMoney(receipt.balance)}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
        <a href={receipt.pdfUrl} className="rounded-xl bg-accent px-4 py-2 text-white" download>Download PDF</a>
        <button onClick={() => window.print()} className="rounded-xl border px-4 py-2">Print</button>
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Receipt ${receipt.receiptNumber}: ${publicUrl}`)}`, '_blank', 'noopener,noreferrer')} className="rounded-xl border px-4 py-2">WhatsApp</button>
        <button onClick={() => void share()} className="rounded-xl border px-4 py-2">Share / Copy link</button>
        <label className="flex items-center gap-2 text-sm">Print width<select value={paper} onChange={event => setPaper(event.target.value as typeof paper)} className="rounded-lg border p-2"><option value="standard">Standard</option><option value="58mm">58mm thermal</option><option value="80mm">80mm thermal</option></select></label>
      </div>
    </article>
  </main>;
}
