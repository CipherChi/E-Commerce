import { NotFoundException } from '../lib/http-errors';
import { CustomersService } from './customers.service';
import { Prisma } from '@prisma/client';

describe('CustomersService', () => {
  const prisma: any = {
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new CustomersService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('searches customer name, phone, and email inside the current business', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    await service.list('business-a', { q: 'Ada' });
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 'business-a',
          archivedAt: null,
          OR: [
            { name: { contains: 'Ada', mode: 'insensitive' } },
            { phone: { contains: 'Ada' } },
            { email: { contains: 'Ada', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('creates customer rows with the active business id', async () => {
    prisma.customer.create.mockResolvedValue({ id: 'customer-a', name: 'Ada Guest' });
    await service.create('business-a', { name: 'Ada Guest', phone: '+2348000000000' });
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { businessId: 'business-a', name: 'Ada Guest', phone: '+2348000000000' },
    });
  });

  it('rejects a cross-business update and does not write', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.update('business-a', 'customer-b', { notes: 'new note' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
  });

  it('archives customers within the current business', async () => {
    prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    await service.remove('business-a', 'customer-a');
    expect(prisma.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-a', businessId: 'business-a', archivedAt: null },
        data: { archivedAt: expect.any(Date) },
      }),
    );
  });

  it('derives balance across partial and voided invoices using Decimal', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'customer-a', bookings: [
      { totalAmount: new Prisma.Decimal('100'), payments: [{ amount: new Prisma.Decimal('25') }], invoice: { totalAmount: new Prisma.Decimal('100'), status: 'ISSUED' } },
      { totalAmount: new Prisma.Decimal('80'), payments: [], invoice: { totalAmount: new Prisma.Decimal('80'), status: 'VOID' } },
      { totalAmount: new Prisma.Decimal('40'), payments: [{ amount: new Prisma.Decimal('10') }], invoice: { totalAmount: new Prisma.Decimal('40'), status: 'ISSUED' } },
    ] });
    const result = await service.get('business-a', 'customer-a');
    expect(result.outstandingBalance).toBe('105.00');
    expect(result.bookings.map((booking) => booking.invoice?.balance.toString())).toEqual(['75', '0', '30']);
  });
});
