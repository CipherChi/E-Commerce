import { ConflictException, NotFoundException, UnprocessableEntityException } from '../lib/http-errors';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const nonBlocking = [BookingStatus.CANCELLED, BookingStatus.NO_SHOW];
const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  CHECKED_IN: [BookingStatus.CHECKED_OUT],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};
const bookingRelations = {
  customer: { select: { id: true, name: true, phone: true } },
  room: { include: { property: { select: { id: true, name: true } } } },
} as const;

function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new UnprocessableEntityException('Booking dates must use YYYY-MM-DD calendar dates');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new UnprocessableEntityException(`Invalid booking date: ${value}`);
  }
  return date;
}

function assertStay(checkIn: Date, checkOut: Date) {
  if (checkOut <= checkIn) {
    throw new UnprocessableEntityException('Check-out date must be after check-in date');
  }
}

function nightsBetween(checkIn: Date, checkOut: Date) {
  return (checkOut.getTime() - checkIn.getTime()) / 86_400_000;
}

function isRoomDateConflict(error: unknown) {
  const message = `${error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)} ${JSON.stringify(error)}`;
  return (
    message.includes('Booking_room_stay_no_overlap') ||
    message.includes('23P01') ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2004')
  );
}


export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, query: ListBookingsDto) {
    const from = query.from ? dateOnly(query.from) : undefined;
    const to = query.to ? dateOnly(query.to) : undefined;
    if (from && to && to <= from) {
      throw new UnprocessableEntityException('The to date must be after the from date');
    }
    const where: Prisma.BookingWhereInput = {
      businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(from || to
        ? {
            ...(from ? { checkOut: { gt: from } } : {}),
            ...(to ? { checkIn: { lt: to } } : {}),
          }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingRelations,
        orderBy: [{ checkIn: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async get(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: bookingRelations,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async availability(
    businessId: string,
    roomId: string,
    checkInValue: string,
    checkOutValue: string,
  ) {
    const checkIn = dateOnly(checkInValue);
    const checkOut = dateOnly(checkOutValue);
    assertStay(checkIn, checkOut);
    const room = await this.prisma.room.findFirst({ where: { id: roomId, businessId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === RoomStatus.MAINTENANCE) {
      return { available: false, reason: 'Room is out of service' };
    }
    const overlap = await this.prisma.booking.findFirst({
      where: {
        businessId,
        roomId,
        status: { notIn: nonBlocking },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    });
    return overlap
      ? { available: false, reason: 'Room is already booked for those dates' }
      : { available: true };
  }

  async create(businessId: string, input: CreateBookingDto) {
    const checkIn = dateOnly(input.checkIn);
    const checkOut = dateOnly(input.checkOut);
    assertStay(checkIn, checkOut);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.findFirst({ where: { id: input.roomId, businessId } });
        if (!room) throw new NotFoundException('Room not found');
        if (room.status === RoomStatus.MAINTENANCE) {
          throw new UnprocessableEntityException('Room is out of service and cannot be booked');
        }
        const customer = await tx.customer.findFirst({
          where: { id: input.customerId, businessId, archivedAt: null },
          select: { id: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        const totalAmount = room.basePrice.mul(
          new Prisma.Decimal(nightsBetween(checkIn, checkOut)),
        );
        return tx.booking.create({
          data: {
            businessId,
            roomId: room.id,
            customerId: customer.id,
            checkIn,
            checkOut,
            totalAmount,
            source: input.source,
          },
          include: bookingRelations,
        });
      });
    } catch (error) {
      if (isRoomDateConflict(error)) {
        throw new ConflictException('Room is already booked for some or all of those dates');
      }
      throw error;
    }
  }

  async update(businessId: string, id: string, input: UpdateBookingDto) {
    const existing = await this.get(businessId, id);
    if (input.status !== undefined) {
      throw new ConflictException(
        'Use the check-in, check-out, cancel, or no-show action to change booking status',
      );
    }
    const checkIn = input.checkIn ? dateOnly(input.checkIn) : existing.checkIn;
    const checkOut = input.checkOut ? dateOnly(input.checkOut) : existing.checkOut;
    assertStay(checkIn, checkOut);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const roomId = input.roomId ?? existing.roomId;
        const customerId = input.customerId ?? existing.customerId;
        const room = await tx.room.findFirst({ where: { id: roomId, businessId } });
        if (!room) throw new NotFoundException('Room not found');
        if (room.status === RoomStatus.MAINTENANCE) {
          throw new UnprocessableEntityException('Room is out of service and cannot be booked');
        }
        const customer = await tx.customer.findFirst({
          where: { id: customerId, businessId, archivedAt: null },
          select: { id: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        const stayChanged =
          input.roomId !== undefined || input.checkIn !== undefined || input.checkOut !== undefined;
        const totalAmount = stayChanged
          ? room.basePrice.mul(new Prisma.Decimal(nightsBetween(checkIn, checkOut)))
          : existing.totalAmount;
        if (stayChanged) {
          const invoice = await tx.invoice.findFirst({
            where: { bookingId: id, businessId },
            include: { booking: { include: { payments: true } } },
          });
          if (invoice && invoice.booking.payments.length && !invoice.totalAmount.equals(totalAmount)) {
            throw new ConflictException('A booking with recorded payments cannot be repriced');
          }
          if (invoice && !invoice.booking.payments.length) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                totalAmount,
                amountPaid: new Prisma.Decimal(0),
                balance: totalAmount,
                status: 'UNPAID',
                items: [{ description: 'Room stay', amount: totalAmount.toString() }],
              },
            });
          }
        }
        const updated = await tx.booking.updateMany({
          where: { id, businessId, status: existing.status },
          data: {
            roomId,
            customerId,
            checkIn,
            checkOut,
            source: input.source,
            totalAmount,
          },
        });
        if (!updated.count) throw new ConflictException('Booking changed during update; retry');
        return tx.booking.findFirstOrThrow({
          where: { id, businessId },
          include: bookingRelations,
        });
      });
    } catch (error) {
      if (isRoomDateConflict(error)) {
        throw new ConflictException('Room is already booked for some or all of those dates');
      }
      throw error;
    }
  }

  async remove(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, businessId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.CHECKED_IN) {
      throw new ConflictException('Active bookings cannot be deleted; cancel or check out the booking first');
    }
    const result = await this.prisma.booking.deleteMany({
      where: { id, businessId, status: booking.status },
    });
    if (!result.count) throw new ConflictException('Booking changed during deletion; retry');
    return { success: true };
  }

  async transition(businessId: string, id: string, target: BookingStatus) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, businessId } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (!transitions[booking.status].includes(target)) {
        throw new ConflictException(
          `Cannot transition booking from ${booking.status} to ${target}`,
        );
      }
      const updated = await tx.booking.updateMany({
        where: { id, businessId, status: booking.status },
        data: { status: target },
      });
      if (!updated.count) throw new ConflictException('Booking changed during transition; retry');
      if (target === BookingStatus.CHECKED_IN || target === BookingStatus.CHECKED_OUT) {
        const roomStatus =
          target === BookingStatus.CHECKED_IN ? RoomStatus.OCCUPIED : RoomStatus.CLEANING;
        const room = await tx.room.updateMany({
          where: {
            id: booking.roomId,
            businessId,
            ...(target === BookingStatus.CHECKED_IN
              ? { status: { not: RoomStatus.MAINTENANCE } }
              : {}),
          },
          data: { status: roomStatus },
        });
        if (!room.count) {
          if (target === BookingStatus.CHECKED_IN) {
            throw new UnprocessableEntityException(
              'Room is out of service and cannot be checked in',
            );
          }
          throw new NotFoundException('Room not found');
        }
      }
      return tx.booking.findFirstOrThrow({ where: { id, businessId }, include: bookingRelations });
    });
  }
}
