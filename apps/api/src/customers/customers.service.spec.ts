import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const prisma: any = {
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new CustomersService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('searches customer name, phone, and email inside the current business', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    await service.list('business-a', 'Ada');
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
});
