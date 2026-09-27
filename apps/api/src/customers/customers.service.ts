import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string, query?: string) {
    const search = query?.trim();
    return this.prisma.customer.findMany({
      where: {
        businessId,
        archivedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(businessId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: { ...dto, businessId } });
  }

  async get(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId, archivedAt: null },
      include: {
        bookings: { include: { payments: true, invoice: true }, orderBy: { checkIn: 'desc' } },
      },
    });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!customer) throw new NotFoundException('Customer not found');
    const outstandingBalance = customer.bookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.invoice?.balance ??
            Math.max(
              0,
              Number(booking.totalAmount) -
                booking.payments.reduce((paid, payment) => paid + Number(payment.amount), 0),
            ),
        ),
      0,
    );
    return { ...customer, outstandingBalance };
  }

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    await this.getForMutation(businessId, id);
    const result = await this.prisma.customer.updateMany({
      where: { id, businessId, archivedAt: null },
      data: dto,
    });
    if (!result.count) throw new NotFoundException('Customer not found');
    return this.prisma.customer.findFirst({ where: { id, businessId, archivedAt: null } });
  }

  async remove(businessId: string, id: string) {
    const result = await this.prisma.customer.updateMany({
      where: { id, businessId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Customer not found');
    return { success: true };
  }

  private async getForMutation(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId, archivedAt: null },
    });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }
}
