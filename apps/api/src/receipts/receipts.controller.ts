import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessContextGuard } from '../auth/business-context.guard';
type TenantRequest = Request & { user: { businessId: string } };
@ApiTags('receipts') @ApiBearerAuth() @UseGuards(JwtAuthGuard, BusinessContextGuard) @Controller('receipts')
export class ReceiptsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':saleId')
  async get(@Req() req: TenantRequest, @Param('saleId') id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, businessId: req.user.businessId, status: 'COMPLETED' }, include: { business: true, createdBy: { select: { name: true } }, customer: { select: { name: true, phone: true } }, items: { include: { product: { select: { name: true } } } } } });
    if (!sale) throw new NotFoundException('Receipt not found');
    return { saleId: sale.id, recordedBy: sale.createdBy.name, business: { name: sale.business.name, address: sale.business.address, phone: sale.business.phone, logoUrl: sale.business.logo }, receiptNumber: sale.receiptNumber, createdAt: sale.createdAt, customer: sale.customer ?? { name: sale.guestName ?? 'Guest', phone: null }, items: sale.items.map(item => ({ name: item.product.name, quantity: item.quantity, unitPrice: item.unitPrice, lineSubtotal: item.lineSubtotal })), subtotal: sale.subtotal, total: sale.total, paymentMethod: sale.paymentMethod, paymentStatus: sale.paymentStatus, amountPaid: sale.amountPaid, balance: Prisma.Decimal.max(new Prisma.Decimal(0), sale.total.minus(sale.amountPaid)) };
  }
}
