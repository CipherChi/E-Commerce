import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService Decimal rules', () => {
  const setup = () => {
    const product = { id: 'p1', name: 'Room item', sellingPrice: new Prisma.Decimal('10.25'), costPrice: new Prisma.Decimal('4.20'), module: 'FOOD', isStockable: false };
    const tx: any = {
      customer: { findFirst: jest.fn() }, businessModule: { findMany: jest.fn().mockResolvedValue([{ module: 'FOOD' }]) },
      product: { findMany: jest.fn().mockResolvedValue([product]) }, stockMovement: { aggregate: jest.fn(), createMany: jest.fn() },
      receiptSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
      sale: { create: jest.fn().mockResolvedValue({ id: 's1' }), findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 's1' }) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)), sale: tx.sale } as unknown as PrismaService;
    return { service: new SalesService(prisma), tx };
  };
  const dto: any = { guestName: 'Walk in', paymentMethod: 'CASH', paymentStatus: 'PARTIAL', amountPaid: '5.10', items: [{ productId: 'p1', quantity: 3 }] };
  it('uses exact Decimal multiplication and allows a valid partial tender', async () => {
    const { service, tx } = setup();
    await service.create('b1', 'u1', dto, 'key-1');
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: new Prisma.Decimal('30.75'), amountPaid: new Prisma.Decimal('5.10'), items: { create: [expect.objectContaining({ unitPrice: new Prisma.Decimal('10.25'), lineSubtotal: new Prisma.Decimal('30.75') })] } }) }));
    expect(tx.sale.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ receiptNumber: expect.stringMatching(/^RCT-\d{4}-000001$/), receiptToken: expect.any(String), idempotencyKey: 'key-1' }));
    expect(Buffer.from(tx.sale.create.mock.calls[0][0].data.receiptToken, 'base64url')).toHaveLength(32);
    expect(tx.receiptSequence.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId_year: { businessId: 'b1', year: expect.any(Number) } } }));
  });
  it('rejects zero or full amount as a partial tender before writing a sale', async () => {
    const { service, tx } = setup();
    await expect(service.create('b1', 'u1', { ...dto, amountPaid: '0' }, 'key-1')).rejects.toThrow('Partial payment');
    expect(tx.sale.create).not.toHaveBeenCalled();
  });
  it('rejects an amount on an unpaid sale and a non-total paid tender', async () => {
    const first = setup();
    await expect(first.service.create('b1', 'u1', { ...dto, paymentStatus: 'UNPAID', amountPaid: '1.00' }, 'key-1')).rejects.toThrow('Unpaid sales');
    const second = setup();
    await expect(second.service.create('b1', 'u1', { ...dto, paymentStatus: 'PAID', amountPaid: '29.00' }, 'key-1')).rejects.toThrow('Paid sales');
    expect(second.tx.sale.create).not.toHaveBeenCalled();
  });

  it('returns the original sale when the tenant reuses an idempotency key', async () => {
    const { service, tx } = setup();
    tx.sale.findFirst.mockReset().mockResolvedValue({ id: 'existing-sale' });
    await expect(service.create('b1', 'u1', dto, 'key-1')).resolves.toEqual({ id: 'existing-sale' });
    expect(tx.sale.create).not.toHaveBeenCalled();
    expect(tx.receiptSequence.upsert).not.toHaveBeenCalled();
  });

  it('returns a retryable 503 after exhausting serialization retries', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(conflict),
      sale: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SalesService(prisma);
    const waitBeforeRetry = jest
      .spyOn(service as any, 'waitBeforeRetry')
      .mockResolvedValue(undefined);
    await expect(service.create('b1', 'u1', dto, 'key-1')).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
      response: expect.objectContaining({
        statusCode: 503,
        message: expect.stringContaining('Retry with the same Idempotency-Key'),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(11);
    expect(waitBeforeRetry).toHaveBeenCalledTimes(10);
  }, 30000);

  it('does not retry errors other than serialization conflicts', async () => {
    const failure = new Error('database unavailable');
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(failure),
      sale: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SalesService(prisma);

    await expect(service.create('b1', 'u1', dto, 'key-1')).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
