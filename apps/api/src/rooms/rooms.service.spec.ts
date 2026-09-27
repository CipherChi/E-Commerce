import { NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  const prisma: any = {
    property: { findFirst: jest.fn() },
    room: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new RoomsService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('lists rooms only after confirming property ownership', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: 'property-1', ownerId: 'owner-1' });
    prisma.room.findMany.mockResolvedValue([{ id: 'room-1', status: 'AVAILABLE' }]);
    const result = await service.list('owner-1', 'property-1');
    expect(result[0].status).toBe('AVAILABLE');
    expect(prisma.room.findMany).toHaveBeenCalledWith({
      where: { propertyId: 'property-1' },
      orderBy: { label: 'asc' },
    });
  });
  it('creates rooms with the owning property and status payload', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: 'property-1', ownerId: 'owner-1' });
    prisma.room.create.mockResolvedValue({ id: 'room-1', status: 'CLEANING' });
    await service.create('owner-1', 'property-1', {
      label: '201',
      type: 'Suite',
      capacity: 3,
      basePrice: 80,
      status: 'CLEANING' as any,
    });
    expect(prisma.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ propertyId: 'property-1', status: 'CLEANING' }),
    });
  });
  it('gets a room only after checking its property owner', async () => {
    prisma.room.findFirst.mockResolvedValue({ id: 'room-1', property: { ownerId: 'owner-1' } });
    prisma.room.findUnique.mockResolvedValue({ id: 'room-1', status: 'AVAILABLE' });
    await expect(service.get('owner-1', 'property-1', 'room-1')).resolves.toMatchObject({
      status: 'AVAILABLE',
    });
  });
  it('does not expose rooms for an unowned property', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.list('owner-1', 'property-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.room.findMany).not.toHaveBeenCalled();
  });
});
