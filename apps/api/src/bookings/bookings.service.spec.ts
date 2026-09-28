import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  const businessId = 'business-a';
  const room = {
    id: 'room-a',
    businessId,
    basePrice: new Prisma.Decimal('125.25'),
    status: RoomStatus.AVAILABLE,
  };
  const customer = { id: 'customer-a' };
  const transitions: Record<BookingStatus, BookingStatus[]> = {
    PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    CONFIRMED: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
    CHECKED_IN: [BookingStatus.CHECKED_OUT],
    CHECKED_OUT: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  const invalidTransitions = Object.values(BookingStatus).flatMap((current) =>
    Object.values(BookingStatus)
      .filter((target) => !transitions[current].includes(target))
      .map((target) => [current, target] as [BookingStatus, BookingStatus]),
  );

  function fixture() {
    const tx = {
      room: { findFirst: jest.fn(), updateMany: jest.fn() },
      customer: { findFirst: jest.fn() },
      booking: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn(async (operation: any) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(tx),
      ),
    } as unknown as PrismaService;
    return { tx, service: new BookingsService(prisma) };
  }

  it('creates a booking with a Decimal room-rate total based on calendar nights', async () => {
    const { tx, service } = fixture();
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.booking.create.mockImplementation(({ data }) => data);

    const result = await service.create(businessId, {
      roomId: room.id,
      customerId: customer.id,
      checkIn: '2032-02-01',
      checkOut: '2032-02-04',
    });

    expect(result.totalAmount.toString()).toBe('375.75');
    expect(result.checkIn).toEqual(new Date('2032-02-01T00:00:00.000Z'));
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId }) }),
    );
  });

  it('rejects a room or customer from another business without querying by request businessId', async () => {
    const { tx, service } = fixture();
    tx.room.findFirst.mockResolvedValue(null);
    await expect(
      service.create(businessId, {
        roomId: 'foreign-room',
        customerId: customer.id,
        checkIn: '2032-02-01',
        checkOut: '2032-02-02',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.room.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-room', businessId } });

    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: 'foreign-customer',
        checkIn: '2032-02-01',
        checkOut: '2032-02-02',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-customer', businessId, archivedAt: null },
      select: { id: true },
    });
  });

  it('rejects invalid or reversed calendar stays', async () => {
    const { service } = fixture();
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: customer.id,
        checkIn: '2032-02-03',
        checkOut: '2032-02-03',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: customer.id,
        checkIn: '2032-02-30',
        checkOut: '2032-03-01',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('turns a database exclusion violation into a 409 conflict', async () => {
    const { tx, service } = fixture();
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.booking.create.mockRejectedValue({
      code: 'P2004',
      meta: { constraint: 'Booking_room_stay_no_overlap' },
    });
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: customer.id,
        checkIn: '2032-02-01',
        checkOut: '2032-02-02',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses overlap date filters and tenant scoping for a paginated list', async () => {
    const { tx, service } = fixture();
    tx.booking.findMany.mockResolvedValue([]);
    tx.booking.count.mockResolvedValue(0);
    const result = await service.list(businessId, {
      from: '2032-03-01',
      to: '2032-03-10',
      status: BookingStatus.CONFIRMED,
      roomId: room.id,
      customerId: customer.id,
      page: 2,
      pageSize: 5,
    });
    expect(result).toMatchObject({ data: [], total: 0, page: 2, pageSize: 5 });
    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId,
          checkOut: { gt: new Date('2032-03-01T00:00:00.000Z') },
          checkIn: { lt: new Date('2032-03-10T00:00:00.000Z') },
          status: BookingStatus.CONFIRMED,
        }),
        skip: 5,
        take: 5,
      }),
    );
  });

  it('applies the state machine and changes room status atomically at check-in and check-out', async () => {
    const { tx, service } = fixture();
    const booking = {
      id: 'booking-a',
      businessId,
      roomId: room.id,
      status: BookingStatus.CONFIRMED,
    };
    tx.booking.findFirst.mockResolvedValue(booking);
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.room.updateMany.mockResolvedValue({ count: 1 });
    tx.booking.findFirstOrThrow.mockResolvedValue({ ...booking, status: BookingStatus.CHECKED_IN });
    await service.transition(businessId, booking.id, BookingStatus.CHECKED_IN);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: booking.id, businessId, status: BookingStatus.CONFIRMED },
      data: { status: BookingStatus.CHECKED_IN },
    });
    expect(tx.room.updateMany).toHaveBeenCalledWith({
      where: { id: room.id, businessId, status: { not: RoomStatus.MAINTENANCE } },
      data: { status: RoomStatus.OCCUPIED },
    });

    tx.booking.findFirst.mockResolvedValue({ ...booking, status: BookingStatus.CHECKED_IN });
    tx.booking.findFirstOrThrow.mockResolvedValue({
      ...booking,
      status: BookingStatus.CHECKED_OUT,
    });
    await service.transition(businessId, booking.id, BookingStatus.CHECKED_OUT);
    expect(tx.room.updateMany).toHaveBeenLastCalledWith({
      where: { id: room.id, businessId },
      data: { status: RoomStatus.CLEANING },
    });
  });

  it.each(invalidTransitions)(
    'rejects invalid state transition %s -> %s',
    async (current, next) => {
      const { tx, service } = fixture();
      tx.booking.findFirst.mockResolvedValue({ id: 'booking-a', businessId, status: current });
      await expect(service.transition(businessId, 'booking-a', next)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.booking.updateMany).not.toHaveBeenCalled();
    },
  );

  it('returns 404 when the requested booking belongs to another tenant', async () => {
    const { tx, service } = fixture();
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(service.get(businessId, 'foreign-booking')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-booking', businessId },
      include: expect.any(Object),
    });
  });
});
