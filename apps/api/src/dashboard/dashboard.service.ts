import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus, SalePaymentStatus, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deriveInvoiceFinancials } from '../finance/invoice-financials';

const money = (value: Prisma.Decimal) => value.toFixed(2);
const decimal = (value: Prisma.Decimal | null | undefined) => value ?? new Prisma.Decimal(0);
const lagosDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dateOnly = (key: string) => new Date(`${key}T00:00:00.000Z`);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(businessId: string, preset = 'today', from?: string, to?: string, asOf?: string) {
    if (asOf && (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(dateOnly(asOf).getTime()) || dateOnly(asOf).toISOString().slice(0, 10) !== asOf)) throw new BadRequestException('Invalid dashboard date');
    const todayKey = asOf ?? lagosDate(new Date());
    const todayStart = dateOnly(todayKey);
    let startKey = todayKey;
    let endKey = todayKey;
    if (preset === 'custom') {
      if (!from || !to) throw new BadRequestException('Custom range requires from and to');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new BadRequestException('Invalid date range');
      startKey = from; endKey = to;
    } else if (preset === 'week' || preset === 'month') {
      const local = new Date(`${todayKey}T12:00:00.000Z`);
      if (preset === 'month') startKey = `${todayKey.slice(0, 7)}-01`;
      else {
        const weekday = (local.getUTCDay() + 6) % 7;
        local.setUTCDate(local.getUTCDate() - weekday);
        startKey = local.toISOString().slice(0, 10);
      }
    } else if (preset !== 'today') throw new BadRequestException('Range must be today, week, month, or custom');
    const start = dateOnly(startKey);
    const end = new Date(dateOnly(endKey).getTime() + 86_400_000 - 1);
    const [sales, expensesAgg, paymentAgg, invoices, rooms, activeBookings, arrivals, departures, modules] = await Promise.all([
      this.prisma.sale.findMany({ where: { businessId, status: SaleStatus.COMPLETED, createdAt: { gte: start, lte: end } }, include: { items: { include: { product: { select: { costPrice: true } } } } } }),
      this.prisma.expense.aggregate({ where: { businessId, isArchived: false, expenseDate: { gte: dateOnly(startKey), lte: dateOnly(endKey) } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { businessId, paidAt: { gte: start, lte: end } }, _sum: { amount: true } }),
      this.prisma.invoice.findMany({ where: { businessId }, include: { booking: { include: { payments: true } } } }),
      this.prisma.room.findMany({ where: { businessId, status: { not: RoomStatus.MAINTENANCE } }, select: { id: true } }),
      this.prisma.booking.findMany({ where: { businessId, checkIn: { lte: todayStart }, checkOut: { gt: todayStart }, status: { in: [BookingStatus.CHECKED_IN, BookingStatus.PENDING, BookingStatus.CONFIRMED] } }, select: { status: true } }),
      this.prisma.booking.count({ where: { businessId, checkIn: todayStart, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] } } }),
      this.prisma.booking.count({ where: { businessId, checkOut: todayStart, status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] } } }),
      this.prisma.businessModule.findMany({ where: { businessId, isEnabled: true }, select: { module: true } }),
    ]);
    const revenue = sales.reduce((sum, sale) => sum.plus(sale.total), new Prisma.Decimal(0));
    const cogs = sales.reduce((sum, sale) => sum.plus(sale.items.reduce((lineSum, item) => lineSum.plus(decimal(item.costPrice).mul(item.quantity)), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    const expenses = decimal(expensesAgg._sum.amount);
    const invoiceOutstanding = invoices.reduce((sum, invoice) => invoice.status === 'VOID' ? sum : sum.plus(deriveInvoiceFinancials(invoice.totalAmount, invoice.booking.payments.map(p => p.amount)).balance), new Prisma.Decimal(0));
    const salesOutstanding = await this.prisma.sale.findMany({ where: { businessId, status: SaleStatus.COMPLETED, paymentStatus: { in: [SalePaymentStatus.PARTIAL, SalePaymentStatus.UNPAID] } }, select: { total: true, amountPaid: true } });
    const outstanding = salesOutstanding.reduce((sum, sale) => sum.plus(deriveInvoiceFinancials(sale.total, [sale.amountPaid]).balance), invoiceOutstanding);
    const salesCollected = sales.reduce((sum, sale) => sum.plus(sale.amountPaid), new Prisma.Decimal(0));
    const occupiedRooms = activeBookings.filter(b => b.status === BookingStatus.CHECKED_IN).length;
    const reservedRooms = activeBookings.filter(b => b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED).length;
    const enabled = new Set(modules.map(m => m.module));
    const moduleCards: Array<{ module: string; label: string; value: number }> = [];
    if (enabled.has('LODGING')) moduleCards.push({ module: 'LODGING', label: 'Bookings', value: activeBookings.length });
    const stockProducts = await this.prisma.product.findMany({ where: { businessId, module: { in: modules.map(m => m.module) }, isStockable: true, isArchived: false, lowStockThreshold: { not: null } }, select: { id: true, lowStockThreshold: true } });
    let lowStock = 0;
    for (const product of stockProducts) {
      const aggregate = await this.prisma.stockMovement.aggregate({ where: { businessId, productId: product.id }, _sum: { quantity: true } });
      if ((aggregate._sum.quantity ?? 0) <= product.lowStockThreshold!) lowStock++;
    }
    return {
      range: { from: start.toISOString(), to: end.toISOString(), preset },
      sales: money(revenue), expenses: money(expenses), estimatedProfit: money(revenue.minus(cogs).minus(expenses)),
      revenue: money(revenue), costOfGoods: money(cogs), collectedPayments: money(decimal(paymentAgg._sum.amount).plus(salesCollected)),
      outstandingPayments: money(outstanding), arrivalsToday: arrivals, departuresToday: departures,
      occupancy: { date: todayKey, occupiedRooms, reservedRooms, totalBookableRooms: rooms.length,
        occupiedRate: rooms.length ? occupiedRooms / rooms.length : 0, reservedRate: rooms.length ? reservedRooms / rooms.length : 0 },
      moduleCards, lowStock,
    };
  }
}
