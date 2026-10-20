import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
type TenantRequest = Request & { user: { businessId: string; sub: string } };
@ApiTags('payments and invoices') @ApiBearerAuth() @UseGuards(JwtAuthGuard, BusinessContextGuard) @Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('bookings/:bookingId/invoice') @UseGuards(RolesGuard) @Roles('ADMIN') createInvoice(@Req() req: TenantRequest, @Param('bookingId') id: string) { return this.payments.createInvoice(req.user.businessId, id); }
  @Post('bookings/:bookingId/payments') @UseGuards(RolesGuard) @Roles('ADMIN') recordForBooking(@Req() req: TenantRequest, @Param('bookingId') id: string, @Body() dto: RecordPaymentDto) { return this.payments.recordBookingPayment(req.user.businessId, req.user.sub, id, dto); }
  @Get('invoices/:id') @UseGuards(RolesGuard) @Roles('ADMIN') invoice(@Req() req: TenantRequest, @Param('id') id: string) { return this.payments.invoice(req.user.businessId, id); }
  @Get('invoices/:id/payments') @UseGuards(RolesGuard) @Roles('ADMIN') list(@Req() req: TenantRequest, @Param('id') id: string) { return this.payments.listForInvoice(req.user.businessId, id); }
  @Post('invoices/:id/void') @UseGuards(RolesGuard) @Roles('ADMIN') void(@Req() req: TenantRequest, @Param('id') id: string) { return this.payments.voidInvoice(req.user.businessId, id); }
  @Post('invoices/:id/payments') @UseGuards(RolesGuard) @Roles('ADMIN') record(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: RecordPaymentDto) { return this.payments.recordPayment(req.user.businessId, req.user.sub, id, dto); }
}
