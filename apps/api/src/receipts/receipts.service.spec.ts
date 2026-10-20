import { Prisma } from '@prisma/client';
import { formatReceiptMoney } from '@hotel/shared-types/src/money.js';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptsService } from './receipts.service';
import { NotFoundException } from '@nestjs/common';

describe('ReceiptsService', () => {
  const record = {
    id: 'sale-1', businessId: 'business-1', status: 'COMPLETED', receiptToken: 'unguessable-token',
    receiptNumber: 'RCT-2026-000001', createdAt: new Date('2026-10-05T10:00:00Z'),
    subtotal: new Prisma.Decimal('1234.5'), total: new Prisma.Decimal('1234.5'), amountPaid: new Prisma.Decimal('1000'),
    paymentMethod: 'CASH', paymentStatus: 'PARTIAL', guestName: 'Guest',
    business: { name: 'Staywise', address: 'Lagos', phone: '0800', logo: null },
    createdBy: { name: 'Cashier' }, customer: null,
    items: [{ product: { name: 'Room' }, quantity: 1, unitPrice: new Prisma.Decimal('1234.5'), lineSubtotal: new Prisma.Decimal('1234.5') }],
  };
  const setup = () => {
    const prisma = { sale: { findFirst: jest.fn().mockResolvedValue(record) } } as unknown as PrismaService;
    return { service: new ReceiptsService(prisma), prisma };
  };

  it('uses one consistent NGN decimal formatter', () => {
    expect(formatReceiptMoney('1234567.5')).toBe('NGN 1,234,567.50');
    expect(formatReceiptMoney('0')).toBe('NGN 0.00');
    expect(() => formatReceiptMoney('1.234')).toThrow('Invalid receipt amount');
  });

  it('scopes staff receipt reads to the business', async () => {
    const { service, prisma } = setup();
    const receipt = await service.tenantReceipt('business-1', 'sale-1');
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sale-1', businessId: 'business-1', status: 'COMPLETED' } }));
    expect(receipt.recordedBy).toBe('Cashier');
    expect(receipt.balance.toString()).toBe('234.5');
  });

  it('loads public receipts by unguessable token and generates a PDF', async () => {
    const { service, prisma } = setup();
    const receipt = await service.publicReceipt('unguessable-token');
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { receiptToken: 'unguessable-token', status: 'COMPLETED' } }));
    expect(receipt.publicUrl).toContain('/public/receipt/unguessable-token');
    const pdf = await service.pdf('unguessable-token');
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('returns 404 for unknown public receipt tokens', async () => {
    const { service, prisma } = setup();
    (prisma.sale.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.publicReceipt('unknown')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { receiptToken: 'unknown', status: 'COMPLETED' } }));
  });
});
