import { BadRequestException, ConflictException, NotFoundException } from '../lib/http-errors';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deriveInvoiceFinancials } from '../finance/invoice-financials';
import { RecordPaymentDto } from './dto/record-payment.dto';


export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(businessId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, businessId }, include: { invoice: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.invoice) return this.getInvoiceWithTx(tx, businessId, booking.invoice.id);
      const count = await tx.invoice.count({ where: { businessId } });
      const invoice = await tx.invoice.create({ data: {
        businessId, bookingId, invoiceNumber: `INV-${Date.now()}-${count + 1}`,
        items: [{ description: 'Room stay', amount: booking.totalAmount.toString() }],
        totalAmount: booking.totalAmount, amountPaid: new Prisma.Decimal(0), balance: booking.totalAmount, status: InvoiceStatus.UNPAID,
      } });
      return this.getInvoiceWithTx(tx, businessId, invoice.id);
    });
  }

  async invoice(businessId: string, id: string) {
    return this.getInvoiceWithTx(this.prisma, businessId, id);
  }

  private async getInvoiceWithTx(tx: PrismaService | Prisma.TransactionClient, businessId: string, id: string) {
    const invoice = await tx.invoice.findFirst({ where: { id, businessId }, include: { booking: { include: { payments: { orderBy: { paidAt: 'asc' } } } } } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const derived = deriveInvoiceFinancials(invoice.totalAmount, invoice.booking.payments.map(p => p.amount), invoice.status === InvoiceStatus.VOID);
    return { ...invoice, amountPaid: derived.amountPaid, balance: derived.balance, status: derived.status, payments: invoice.booking.payments };
  }

  async recordPayment(businessId: string, userId: string, invoiceId: string, dto: RecordPaymentDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.greaterThan(0)) throw new BadRequestException('Payment amount must be greater than zero');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "businessId" = ${businessId} FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Invoice not found');
        const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { booking: { include: { payments: true } } } });
        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.status === InvoiceStatus.VOID) throw new ConflictException('Void invoices cannot receive payments');
        const reference = dto.reference?.trim() || null;
        const prior = reference ? invoice.booking.payments.find(p => p.reference === reference) : undefined;
        if (prior) {
          if (!prior.amount.equals(amount) || prior.method !== dto.method) throw new ConflictException('Payment reference was already used with different payment details');
          return this.getInvoiceWithTx(tx, businessId, invoiceId);
        }
        const current = deriveInvoiceFinancials(invoice.totalAmount, invoice.booking.payments.map(p => p.amount));
        if (amount.greaterThan(current.balance)) throw new ConflictException('Payment exceeds the outstanding invoice balance');
        await tx.payment.create({ data: { businessId, bookingId: invoice.bookingId, amount, method: dto.method, reference, recordedById: userId } });
        const rows = await tx.payment.findMany({ where: { businessId, bookingId: invoice.bookingId }, select: { amount: true } });
        const next = deriveInvoiceFinancials(invoice.totalAmount, rows.map(p => p.amount));
        await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid: next.amountPaid, balance: next.balance, status: next.status } });
        return this.getInvoiceWithTx(tx, businessId, invoiceId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      throw error;
    }
  }

  async recordBookingPayment(businessId: string, userId: string, bookingId: string, dto: RecordPaymentDto) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, businessId }, include: { invoice: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const invoice = booking.invoice ?? await this.createInvoice(businessId, bookingId);
    return this.recordPayment(businessId, userId, invoice.id, dto);
  }

  async voidInvoice(businessId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "businessId" = ${businessId} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Invoice not found');
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { booking: { include: { payments: true } } } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.booking.payments.length) throw new ConflictException('An invoice with payments cannot be voided');
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: InvoiceStatus.VOID, amountPaid: new Prisma.Decimal(0), balance: new Prisma.Decimal(0) } });
      return this.getInvoiceWithTx(tx, businessId, invoiceId);
    });
  }

  async listForInvoice(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, select: { bookingId: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.prisma.payment.findMany({ where: { businessId, bookingId: invoice.bookingId }, orderBy: { paidAt: 'asc' } });
  }
}
