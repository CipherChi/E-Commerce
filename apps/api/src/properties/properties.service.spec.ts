import { NotFoundException } from '@nestjs/common';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
  const prisma: any = {
    property: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new PropertiesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('scopes property lists to the active business', async () => {
    prisma.property.findMany.mockResolvedValue([]);
    await service.list('business-a');
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'business-a' } }),
    );
  });
  it('creates properties with the owner and business from authentication', async () => {
    prisma.property.create.mockResolvedValue({ id: 'property-1', ownerId: 'owner-1' });
    await service.create('owner-1', 'business-a', { name: 'Lodge', address: 'Road' });
    expect(prisma.property.create).toHaveBeenCalledWith({
      data: { name: 'Lodge', address: 'Road', ownerId: 'owner-1', businessId: 'business-a' },
    });
  });
  it('rejects reads outside the business scope', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.get('business-a', 'property-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'property-b', businessId: 'business-a' } }),
    );
  });
  it('scopes property deletion and reports an invisible row as not found', async () => {
    prisma.property.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('business-a', 'property-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.property.deleteMany).toHaveBeenCalledWith({
      where: { id: 'property-b', businessId: 'business-a' },
    });
  });
});
