import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
  const prisma: any = {
    property: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new PropertiesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('scopes non-admin lists to the owner', async () => {
    prisma.property.findMany.mockResolvedValue([]);
    await service.list({ sub: 'owner-1', role: 'STAFF' });
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'owner-1' } }),
    );
  });
  it('creates properties for the authenticated owner', async () => {
    prisma.property.create.mockResolvedValue({ id: 'property-1', ownerId: 'owner-1' });
    await service.create('owner-1', { name: 'Lodge', address: 'Road' });
    expect(prisma.property.create).toHaveBeenCalledWith({
      data: { name: 'Lodge', address: 'Road', ownerId: 'owner-1' },
    });
  });
  it('rejects reads outside the owner scope', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.get('owner-1', 'property-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('blocks deleting another owner’s property', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'property-1', ownerId: 'owner-2' });
    await expect(service.remove('owner-1', 'property-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.property.delete).not.toHaveBeenCalled();
  });
});
