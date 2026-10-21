import { BadRequestException, NotFoundException } from '../lib/http-errors';
import { PrismaService } from '../prisma/prisma.service';
import { TenantRecordsService } from './tenant-records.service';

describe('TenantRecordsService generic writes', () => {
  const makeService = () => {
    const record = { id: 'record-1', businessId: 'business-1' };
    const delegate = {
      findFirst: jest.fn().mockResolvedValue(record),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    };
    const prisma = {
      booking: delegate,
      payment: delegate,
      invoice: delegate,
    } as unknown as PrismaService;
    return { service: new TenantRecordsService(prisma), delegate };
  };

  it.each(['booking', 'payment', 'invoice'] as const)(
    'rejects generic updates and deletes for %s',
    async (resource) => {
      const { service, delegate } = makeService();
      await expect(
        service.update(resource, 'business-1', 'record-1', { amount: '1.00', totalAmount: '1.00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remove(resource, 'business-1', 'record-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(delegate.updateMany).not.toHaveBeenCalled();
      expect(delegate.deleteMany).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for a payment identifier outside the current business', async () => {
    const { service, delegate } = makeService();
    delegate.findFirst.mockResolvedValueOnce(null);
    await expect(service.get('payment', 'business-2', 'record-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(delegate.findFirst).toHaveBeenCalledWith({ where: { id: 'record-1', businessId: 'business-2' } });
  });
});
