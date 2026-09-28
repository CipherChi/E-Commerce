import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalePaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { deriveInvoiceFinancials } from '../finance/invoice-financials';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, userId: string, dto: CreateSaleDto) {
    return this.prisma.$transaction(
      async (tx) => {
        if (dto.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: dto.customerId, businessId, archivedAt: null },
          });
          if (!customer) throw new NotFoundException('Customer not found');
        }
        if (!dto.customerId && !dto.guestName?.trim())
          throw new BadRequestException('Select a customer or enter a guest name');
        const requested = new Map<string, number>();
        for (const line of dto.items)
          requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.quantity);
        const enabledModules = await tx.businessModule.findMany({ where: { businessId, isEnabled: true }, select: { module: true } });
        const products = await tx.product.findMany({
          where: { id: { in: [...requested.keys()] }, businessId, isArchived: false, module: { in: enabledModules.map(m => m.module) } },
        });
        if (products.length !== requested.size)
          throw new BadRequestException('One or more catalog items are unavailable');
        const productMap = new Map(products.map((item) => [item.id, item]));
        const normalized = dto.items.map((line) => {
          const product = productMap.get(line.productId)!;
          const unitPrice = product.sellingPrice;
          return {
            ...line,
            unitPrice,
            lineSubtotal: unitPrice.mul(line.quantity),
          };
        });
        const subtotal = normalized.reduce((sum, line) => sum.plus(line.lineSubtotal), new Prisma.Decimal(0));
        const amountPaid = new Prisma.Decimal(
          dto.amountPaid !== undefined
            ? dto.amountPaid.toString()
            : dto.paymentStatus === SalePaymentStatus.PAID
              ? subtotal.toString()
              : '0',
        );
        const tender = deriveInvoiceFinancials(subtotal, [amountPaid]);
        if (
          dto.paymentStatus === SalePaymentStatus.PARTIAL &&
          tender.status !== 'PARTIAL'
        )
          throw new BadRequestException(
            'Partial payment must be greater than zero and less than the total',
          );
        if (
          dto.paymentStatus === SalePaymentStatus.PAID &&
          tender.status !== 'PAID'
        )
          throw new BadRequestException('Paid sales must have amountPaid equal to the total');
        if (dto.paymentStatus === SalePaymentStatus.UNPAID && !amountPaid.isZero())
          throw new BadRequestException('Unpaid sales cannot have an amount paid');

        for (const [productId, quantity] of requested) {
          const product = productMap.get(productId)!;
          if (!product.isStockable) continue;
          const aggregate = await tx.stockMovement.aggregate({
            where: { businessId, productId },
            _sum: { quantity: true },
          });
          const available = aggregate._sum.quantity ?? 0;
          if (quantity > available)
            throw new BadRequestException(
              `Insufficient stock for ${product.name}. Available: ${available}`,
            );
        }
        const year = new Date().getFullYear();
        const receiptCount = await tx.sale.count({ where: { businessId, receiptNumber: { startsWith: `RCPT-${year}-` } } });
        const receiptNumber = `RCPT-${year}-${String(receiptCount + 1).padStart(6, '0')}`;
        const sale = await tx.sale.create({
          data: {
            businessId,
            customerId: dto.customerId ?? null,
            guestName: dto.customerId ? null : dto.guestName!.trim(),
            paymentMethod: dto.paymentMethod,
            paymentStatus: dto.paymentStatus,
            subtotal,
            total: subtotal,
            amountPaid,
            createdById: userId,
            receiptNumber,
            items: {
              create: normalized.map((line) => ({
                businessId,
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineSubtotal: line.lineSubtotal,
                costPrice: productMap.get(line.productId)!.costPrice,
              })),
            },
          },
        });
        const movements = normalized
          .filter((line) => productMap.get(line.productId)!.isStockable)
          .map((line) => ({
            businessId,
            productId: line.productId,
            saleId: sale.id,
            type: 'STOCK_OUT' as const,
            quantity: -line.quantity,
            createdById: userId,
            reason: `Sale ${sale.id}`,
          }));
        if (movements.length) await tx.stockMovement.createMany({ data: movements });
        return tx.sale.findFirst({
          where: { id: sale.id, businessId },
          include: this.detailInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async list(
    businessId: string,
    query: {
      from?: string;
      to?: string;
      customerId?: string;
      paymentMethod?: string;
      status?: string;
      paymentStatus?: string;
    },
  ) {
    return this.prisma.sale.findMany({
      where: {
        businessId,
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.paymentMethod ? { paymentMethod: query.paymentMethod as never } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(businessId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: this.detailInclude,
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  private detailInclude = {
    customer: { select: { id: true, name: true, phone: true } },
    items: { include: { product: { select: { id: true, name: true, module: true } } } },
    movements: {
      include: {
        product: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    },
    createdBy: { select: { id: true, name: true } },
  } satisfies Prisma.SaleInclude;
}
