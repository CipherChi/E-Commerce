import { ConflictException, NotFoundException, UnprocessableEntityException } from '../lib/http-errors';
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
      invoice: { findFirst: jest.fn(), update: jest.fn() },
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

  it('reprices an unpaid invoice atomically when stay dates change', async () => {
    const { tx, service } = fixture();
    const booking = { id: 'booking-a', businessId, roomId: room.id, customerId: customer.id, status: BookingStatus.PENDING, checkIn: new Date('2032-02-01T00:00:00Z'), checkOut: new Date('2032-02-02T00:00:00Z'), totalAmount: new Prisma.Decimal('125.25') };
    tx.booking.findFirst.mockResolvedValue(booking);
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.invoice.findFirst.mockResolvedValue({ id: 'invoice-a', totalAmount: booking.totalAmount, booking: { payments: [] } });
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.booking.findFirstOrThrow.mockResolvedValue({ ...booking, checkOut: new Date('2032-02-03T00:00:00Z'), totalAmount: new Prisma.Decimal('250.50') });
    await service.update(businessId, booking.id, { checkOut: '2032-02-03' });
    expect(tx.invoice.update).toHaveBeenCalledWith({ where: { id: 'invoice-a' }, data: expect.objectContaining({ totalAmount: new Prisma.Decimal('250.50'), amountPaid: new Prisma.Decimal(0), balance: new Prisma.Decimal('250.50'), status: 'UNPAID' }) });
  });

  it('rejects a total-changing stay edit after a payment exists', async () => {
    const { tx, service } = fixture();
    const booking = { id: 'booking-a', businessId, roomId: room.id, customerId: customer.id, status: BookingStatus.PENDING, checkIn: new Date('2032-02-01T00:00:00Z'), checkOut: new Date('2032-02-02T00:00:00Z'), totalAmount: new Prisma.Decimal('125.25') };
    tx.booking.findFirst.mockResolvedValue(booking);
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.invoice.findFirst.mockResolvedValue({ id: 'invoice-a', totalAmount: booking.totalAmount, booking: { payments: [{ amount: new Prisma.Decimal('10') }] } });
    await expect(service.update(businessId, booking.id, { checkOut: '2032-02-03' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
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

  it('validates list date windows and supports open-ended filters', async () => {
    const { tx, service } = fixture();
    tx.booking.findMany.mockResolvedValue([]);
    tx.booking.count.mockResolvedValue(0);
    await expect(service.list(businessId, { from: 'bad-date', page: 1, pageSize: 20 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(
      service.list(businessId, { from: '2032-03-10', to: '2032-03-01', page: 1, pageSize: 20 }),
    ).rejects.toThrow('to date must be after');
    await service.list(businessId, { from: '2032-03-01', page: 1, pageSize: 20 });
    await service.list(businessId, { to: '2032-03-10', page: 1, pageSize: 20 });
    await service.list(businessId, { page: 1, pageSize: 20 });
    expect(tx.booking.findMany).toHaveBeenCalledTimes(3);
  });

  it('reports availability for missing, maintained, occupied, and free rooms', async () => {
    const { tx, service } = fixture();
    await expect(
      service.availability(businessId, room.id, '2032-02-01', '2032-02-01'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    tx.room.findFirst.mockResolvedValue(null);
    await expect(
      service.availability(businessId, room.id, '2032-02-01', '2032-02-02'),
    ).rejects.toBeInstanceOf(NotFoundException);
    tx.room.findFirst.mockResolvedValue({ ...room, status: RoomStatus.MAINTENANCE });
    await expect(
      service.availability(businessId, room.id, '2032-02-01', '2032-02-02'),
    ).resolves.toMatchObject({ available: false });
    tx.room.findFirst.mockResolvedValue(room);
    tx.booking.findFirst.mockResolvedValue({ id: 'overlap' });
    await expect(
      service.availability(businessId, room.id, '2032-02-01', '2032-02-02'),
    ).resolves.toMatchObject({ available: false });
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(
      service.availability(businessId, room.id, '2032-02-01', '2032-02-02'),
    ).resolves.toEqual({ available: true });
  });

  it('rejects maintenance rooms and translates exclusion errors by constraint or SQLSTATE', async () => {
    const { tx, service } = fixture();
    tx.room.findFirst.mockResolvedValue({ ...room, status: RoomStatus.MAINTENANCE });
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: customer.id,
        checkIn: '2032-02-01',
        checkOut: '2032-02-02',
      }),
    ).rejects.toThrow('out of service');
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.booking.create.mockRejectedValue(new Error('23P01 exclusion violation'));
    await expect(
      service.create(businessId, {
        roomId: room.id,
        customerId: customer.id,
        checkIn: '2032-02-01',
        checkOut: '2032-02-02',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid update operations and detects stale booking writes', async () => {
    const { tx, service } = fixture();
    const booking = {
      id: 'booking-a', businessId, roomId: room.id, customerId: customer.id,
      status: BookingStatus.PENDING, checkIn: new Date('2032-02-01T00:00:00Z'),
      checkOut: new Date('2032-02-02T00:00:00Z'), totalAmount: new Prisma.Decimal('125.25'),
    };
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(service.update(businessId, booking.id, {})).rejects.toBeInstanceOf(NotFoundException);
    tx.booking.findFirst.mockResolvedValue(booking);
    await expect(service.update(businessId, booking.id, { status: BookingStatus.CANCELLED })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update(businessId, booking.id, { checkIn: 'nope' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    tx.room.findFirst.mockResolvedValue(null);
    await expect(service.update(businessId, booking.id, { checkOut: '2032-02-03' })).rejects.toBeInstanceOf(NotFoundException);
    tx.room.findFirst.mockResolvedValue(room);
    tx.customer.findFirst.mockResolvedValue(customer);
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(businessId, booking.id, { source: 'WALK_IN' })).rejects.toThrow('changed during update');
  });

  it('blocks active deletion and reports a stale delete', async () => {
    const { tx, service } = fixture();
    tx.booking.findFirst.mockResolvedValue({ id: 'booking-a', status: BookingStatus.CONFIRMED });
    await expect(service.remove(businessId, 'booking-a')).rejects.toBeInstanceOf(ConflictException);
    tx.booking.findFirst.mockResolvedValue({ id: 'booking-a', status: BookingStatus.CANCELLED });
    tx.booking.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(businessId, 'booking-a')).rejects.toThrow('changed during deletion');
    tx.booking.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove(businessId, 'booking-a')).resolves.toEqual({ success: true });
  });

  it('rejects missing and stale transitions and prevents check-in to a maintained room', async () => {
    const { tx, service } = fixture();
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(service.transition(businessId, 'booking-a', BookingStatus.CONFIRMED)).rejects.toBeInstanceOf(NotFoundException);
    tx.booking.findFirst.mockResolvedValue({ id: 'booking-a', roomId: room.id, status: BookingStatus.CONFIRMED });
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.transition(businessId, 'booking-a', BookingStatus.CHECKED_IN)).rejects.toThrow('changed during transition');
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.room.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.transition(businessId, 'booking-a', BookingStatus.CHECKED_IN)).rejects.toThrow('out of service');
    tx.booking.findFirst.mockResolvedValue({ id: 'booking-a', roomId: room.id, status: BookingStatus.CHECKED_IN });
    await expect(service.transition(businessId, 'booking-a', BookingStatus.CHECKED_OUT)).rejects.toBeInstanceOf(NotFoundException);
  });
});
