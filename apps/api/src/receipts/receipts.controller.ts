import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceiptsService } from './receipts.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

type TenantRequest = Request & { user: { businessId: string } };

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get('public/:token/pdf')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async publicPdf(@Param('token') token: string, @Res() response: Response) {
    const result = await this.receipts.pdf(token);
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${result.receiptNumber}.pdf"` });
    response.send(result.buffer);
  }

  @Get('public/:token')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  publicGet(@Param('token') token: string) { return this.receipts.publicReceipt(token); }

  @Get(':saleId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, BusinessContextGuard)
  get(@Req() req: TenantRequest, @Param('saleId') id: string) {
    return this.receipts.tenantReceipt(req.user.businessId, id);
  }
}
