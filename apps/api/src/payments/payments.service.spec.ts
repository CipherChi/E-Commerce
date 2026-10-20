import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const setup = () => {
    const paymentRows: Array<{ id: string; amount: Prisma.Decimal; method: string; reference: string | null }> = [];
    const invoice = { id: 'invoice-a', businessId: 'business-a', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), amountPaid: new Prisma.Decimal(0), balance: new Prisma.Decimal('30'), status: 'UNPAID', booking: { payments: paymentRows } };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: invoice.id }]),
      invoice: { findFirst: jest.fn().mockImplementation(async () => ({ ...invoice, booking: { payments: [...paymentRows] } })), update: jest.fn().mockImplementation(async ({ data }) => { Object.assign(invoice, data); }) },
      payment: {
        create: jest.fn().mockImplementation(async ({ data }) => { const row = { id: 'payment-a', ...data }; paymentRows.push(row); return row; }),
        findMany: jest.fn().mockImplementation(async () => paymentRows.map(({ amount }) => ({ amount }))),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)) } as unknown as PrismaService;
    return { service: new PaymentsService(prisma), prisma, tx };
  };
  it('records a positive Decimal payment inside a transaction and recalculates the invoice', async () => {
    const { service, tx } = setup();
    const invoice = await service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '10.25', method: 'CASH' });
    expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: new Prisma.Decimal('10.25'), businessId: 'business-a', bookingId: 'booking-a' }) });
    expect(invoice.amountPaid.toString()).toBe('10.25');
    expect(invoice.balance.toString()).toBe('19.75');
    expect(invoice.status).toBe('PARTIAL');
  });
  it('rejects zero before starting a transaction', async () => {
    const { service, prisma } = setup();
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '0', method: 'CASH' })).rejects.toThrow('greater than zero');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('voids an unpaid invoice while holding the invoice row lock', async () => {
    const { service, tx } = setup();
    const result = await service.voidInvoice('business-a', 'invoice-a');
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.invoice.update).toHaveBeenCalledWith({ where: { id: 'invoice-a' }, data: expect.objectContaining({ status: 'VOID' }) });
    expect(result.status).toBe('VOID');
    expect(result.balance.toString()).toBe('0');
  });

  it('rejects voiding when an invoice already has a payment', async () => {
    const { service, tx } = setup();
    tx.invoice.findFirst.mockResolvedValueOnce({
      id: 'invoice-a', businessId: 'business-a', bookingId: 'booking-a',
      totalAmount: new Prisma.Decimal('30'), status: 'UNPAID',
      booking: { payments: [{ id: 'payment-a', amount: new Prisma.Decimal('5') }] },
    });
    await expect(service.voidInvoice('business-a', 'invoice-a')).rejects.toThrow('with payments cannot be voided');
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a cross-tenant invoice before attempting to void it', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.voidInvoice('business-a', 'invoice-b')).rejects.toMatchObject({ status: 404 });
    expect(tx.invoice.findFirst).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});
