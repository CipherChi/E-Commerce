import { NotFoundException } from '../lib/http-errors';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  const prisma: any = {
    property: { findFirst: jest.fn() },
    room: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new RoomsService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('lists rooms after confirming the property belongs to the business', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: 'property-1' });
    prisma.room.findMany.mockResolvedValue([{ id: 'room-1', status: 'AVAILABLE' }]);
    const result = await service.list('business-a', 'property-1');
    expect(result[0].status).toBe('AVAILABLE');
    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: 'property-1', businessId: 'business-a' },
    });
    expect(prisma.room.findMany).toHaveBeenCalledWith({
      where: { propertyId: 'property-1', businessId: 'business-a' },
      orderBy: { label: 'asc' },
    });
  });
  it('creates rooms using the active business and property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: 'property-1' });
    prisma.room.create.mockResolvedValue({ id: 'room-1', status: 'CLEANING' });
    await service.create('business-a', 'property-1', {
      label: '201',
      type: 'Suite',
      capacity: 3,
      basePrice: '80.00',
      status: 'CLEANING' as any,
    });
    expect(prisma.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 'property-1',
        businessId: 'business-a',
        status: 'CLEANING',
      }),
    });
  });
  it('gets only a room in the current business and property', async () => {
    prisma.room.findFirst.mockResolvedValue({ id: 'room-1', status: 'AVAILABLE' });
    await expect(service.get('business-a', 'property-1', 'room-1')).resolves.toMatchObject({
      status: 'AVAILABLE',
    });
    expect(prisma.room.findFirst).toHaveBeenCalledWith({
      where: { id: 'room-1', propertyId: 'property-1', businessId: 'business-a' },
    });
  });
  it('does not expose rooms through another business property', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.list('business-a', 'property-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.room.findMany).not.toHaveBeenCalled();
  });
});
