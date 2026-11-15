import { Prisma } from '@prisma/client';
import { ConflictException, NotFoundException } from '../lib/http-errors';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const setup = () => {
    const paymentRows: Array<{ id: string; amount: Prisma.Decimal; method: string; reference: string | null }> = [];
    const invoice = { id: 'invoice-a', businessId: 'business-a', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), amountPaid: new Prisma.Decimal(0), balance: new Prisma.Decimal('30'), status: 'UNPAID', booking: { payments: paymentRows } };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: invoice.id }]),
      booking: { findFirst: jest.fn().mockResolvedValue({ id: invoice.bookingId, businessId: invoice.businessId, totalAmount: invoice.totalAmount, invoice: null }) },
      invoice: {
        findFirst: jest.fn().mockImplementation(async () => ({ ...invoice, booking: { payments: [...paymentRows] } })),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }) => ({ ...invoice, ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => { Object.assign(invoice, data); }),
      },
      payment: {
        create: jest.fn().mockImplementation(async ({ data }) => { const row = { id: 'payment-a', ...data }; paymentRows.push(row); return row; }),
        findMany: jest.fn().mockImplementation(async () => paymentRows.map(({ amount }) => ({ amount }))),
      },
    };
    const prisma = { ...tx, $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)) } as unknown as PrismaService;
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

  it('creates an invoice once and returns an existing invoice on retry', async () => {
    const { service, tx } = setup();
    await service.createInvoice('business-a', 'booking-a');
    expect(tx.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ bookingId: 'booking-a', status: 'UNPAID' }) });
    tx.booking.findFirst.mockResolvedValueOnce({ id: 'booking-a', businessId: 'business-a', invoice: { id: 'invoice-a' } });
    await service.createInvoice('business-a', 'booking-a');
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    tx.booking.findFirst.mockResolvedValueOnce(null);
    await expect(service.createInvoice('business-a', 'foreign-booking')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reads an invoice and reports a missing invoice', async () => {
    const { service, tx } = setup();
    const result = await service.invoice('business-a', 'invoice-a');
    expect(result.balance.toString()).toBe('30');
    tx.invoice.findFirst.mockResolvedValueOnce(null);
    await expect(service.invoice('business-a', 'foreign-invoice')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing, void, overpaid, and reused payment references', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.recordPayment('business-a', 'user-a', 'missing', { amount: '1', method: 'CASH' })).rejects.toBeInstanceOf(NotFoundException);
    tx.invoice.findFirst.mockResolvedValueOnce(null);
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '1', method: 'CASH' })).rejects.toBeInstanceOf(NotFoundException);
    tx.invoice.findFirst.mockResolvedValueOnce({ id: 'invoice-a', status: 'VOID', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), booking: { payments: [] } });
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '1', method: 'CASH' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '31', method: 'CASH' })).rejects.toThrow('exceeds the outstanding');
    tx.invoice.findFirst.mockResolvedValueOnce({ id: 'invoice-a', status: 'UNPAID', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), booking: { payments: [{ reference: 'ref-1', amount: new Prisma.Decimal('10'), method: 'CASH' }] } });
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '10', method: 'CASH', reference: 'ref-1' })).resolves.toMatchObject({ id: 'invoice-a' });
    tx.invoice.findFirst.mockResolvedValueOnce({ id: 'invoice-a', status: 'UNPAID', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), booking: { payments: [{ reference: 'ref-1', amount: new Prisma.Decimal('10'), method: 'CASH' }] } });
    await expect(service.recordPayment('business-a', 'user-a', 'invoice-a', { amount: '11', method: 'CASH', reference: 'ref-1' })).rejects.toThrow('already used');
  });

  it('records payment against a booking and lists invoice payments with tenant scope', async () => {
    const { service, tx } = setup();
    const record = jest.spyOn(service, 'recordPayment').mockResolvedValue({ id: 'invoice-a' } as never);
    await service.recordBookingPayment('business-a', 'user-a', 'booking-a', { amount: '5', method: 'CASH' });
    expect(record).toHaveBeenCalledWith('business-a', 'user-a', 'invoice-a', { amount: '5', method: 'CASH' });
    tx.booking.findFirst.mockResolvedValueOnce(null);
    await expect(service.recordBookingPayment('business-a', 'user-a', 'missing', { amount: '5', method: 'CASH' })).rejects.toBeInstanceOf(NotFoundException);
    const payments = await service.listForInvoice('business-a', 'invoice-a');
    expect(payments).toEqual([]);
    tx.invoice.findFirst.mockResolvedValueOnce(null);
    await expect(service.listForInvoice('business-a', 'foreign-invoice')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing invoice locks and voids when no prior payments exist', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.voidInvoice('business-a', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    tx.invoice.findFirst.mockResolvedValueOnce(null);
    await expect(service.voidInvoice('business-a', 'invoice-a')).rejects.toBeInstanceOf(NotFoundException);
    tx.invoice.findFirst.mockResolvedValueOnce({ id: 'invoice-a', businessId: 'business-a', bookingId: 'booking-a', totalAmount: new Prisma.Decimal('30'), status: 'UNPAID', booking: { payments: [] } });
    await service.voidInvoice('business-a', 'invoice-a');
    expect(tx.invoice.update).toHaveBeenCalledWith({ where: { id: 'invoice-a' }, data: expect.objectContaining({ status: 'VOID' }) });
  });
});
