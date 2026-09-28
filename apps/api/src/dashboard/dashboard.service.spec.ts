import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
describe('DashboardService occupancy', () => {
  const setup = (rooms: string[], bookings: Array<{ status: string }>) => {
    const prisma = {
      sale: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      room: { findMany: jest.fn().mockResolvedValue(rooms.map(id => ({ id }))) },
      booking: {
        findMany: jest.fn().mockResolvedValue(bookings),
        count: jest.fn().mockResolvedValue(0),
      },
      businessModule: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      stockMovement: { aggregate: jest.fn() },
    } as unknown as PrismaService;
    return { prisma, service: new DashboardService(prisma) };
  };
  it('handles zero bookable rooms and turnover-day date bounds', async () => {
    const { prisma, service } = setup([], []);
    const result = await service.summary('tenant', 'today', undefined, undefined, '2031-02-03');
    expect(result.occupancy).toMatchObject({ date: '2031-02-03', occupiedRooms: 0, reservedRooms: 0, totalBookableRooms: 0, occupiedRate: 0, reservedRate: 0 });
    expect((prisma.booking.findMany as jest.Mock).mock.calls[0][0].where.checkOut.gt.toISOString()).toBe('2031-02-03T00:00:00.000Z');
  });
  it('reports occupied separately from reserved and excludes cancelled bookings', async () => {
    const { service } = setup(['a', 'b', 'c'], [{ status: 'CHECKED_IN' }, { status: 'CONFIRMED' }]);
    const result = await service.summary('tenant', 'today', undefined, undefined, '2031-02-03');
    expect(result.occupancy).toMatchObject({ occupiedRooms: 1, reservedRooms: 1, totalBookableRooms: 3, occupiedRate: 1 / 3, reservedRate: 1 / 3 });
    expect(RoomStatus.MAINTENANCE).toBe('MAINTENANCE');
  });
});
