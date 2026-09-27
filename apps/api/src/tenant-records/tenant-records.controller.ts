import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRecordsService } from './tenant-records.service';

@ApiTags('tenant records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller()
export class TenantRecordsController {
  constructor(private readonly records: TenantRecordsService) {}

  @Get('bookings/:id')
  getBooking(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.get('booking', req.user.businessId, id);
  }
  @Patch('bookings/:id')
  updateBooking(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.records.update('booking', req.user.businessId, id, body);
  }
  @Delete('bookings/:id')
  removeBooking(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.remove('booking', req.user.businessId, id);
  }
  @Get('payments/:id')
  getPayment(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.get('payment', req.user.businessId, id);
  }
  @Patch('payments/:id')
  updatePayment(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.records.update('payment', req.user.businessId, id, body);
  }
  @Delete('payments/:id')
  removePayment(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.remove('payment', req.user.businessId, id);
  }
  @Get('invoices/:id')
  getInvoice(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.get('invoice', req.user.businessId, id);
  }
  @Patch('invoices/:id')
  updateInvoice(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.records.update('invoice', req.user.businessId, id, body);
  }
  @Delete('invoices/:id')
  removeInvoice(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.records.remove('invoice', req.user.businessId, id);
  }
}
