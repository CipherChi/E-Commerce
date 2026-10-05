'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { ReceiptData, ReceiptView } from '@/components/ReceiptView';

export default function PublicReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { apiRequest<ReceiptData>(`/receipts/public/${encodeURIComponent(token)}`).then(setReceipt).catch(() => setError('Receipt not found')); }, [token]);
  if (error) return <main className="mx-auto max-w-xl p-10" role="alert">{error}</main>;
  if (!receipt) return <main className="mx-auto max-w-xl p-10">Loading receipt…</main>;
  return <ReceiptView receipt={receipt} />;
}
