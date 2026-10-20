import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';
import { deriveInvoiceFinancials } from '../finance/invoice-financials';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(
    businessId: string,
    query: { q?: string; page?: number; pageSize?: number } = {},
  ) {
    const search = query.q?.trim();
    const where: Prisma.CustomerWhereInput = {
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
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, pageSize };
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
    const outstandingBalance = customer.bookings.reduce((sum, booking) => {
      if (!booking.invoice || booking.invoice.status === 'VOID') return sum;
      const financials = deriveInvoiceFinancials(
        booking.invoice.totalAmount,
        booking.payments.map((payment) => payment.amount),
      );
      return sum.plus(financials.balance);
    }, new Prisma.Decimal(0));
    return {
      ...customer,
      outstandingBalance: outstandingBalance.toFixed(2),
      bookings: customer.bookings.map((booking) => {
        if (!booking.invoice) return { ...booking, invoice: null };
        const derived = deriveInvoiceFinancials(
          booking.invoice.totalAmount,
          booking.payments.map((payment) => payment.amount),
          booking.invoice.status === 'VOID',
        );
        return { ...booking, invoice: { ...booking.invoice, amountPaid: derived.amountPaid, balance: derived.balance, status: derived.status } };
      }),
    };
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
