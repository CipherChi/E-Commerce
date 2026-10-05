'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { ReceiptData, ReceiptView } from '@/components/ReceiptView';

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { apiRequest<ReceiptData>(`/receipts/${saleId}`).then(setReceipt).catch(() => setError('Unable to load receipt')); }, [saleId]);
  if (error) return <main className="p-10" role="alert">{error}</main>;
  if (!receipt) return <main className="p-10">Loading receipt…</main>;
  return <ReceiptView receipt={receipt} />;
}
