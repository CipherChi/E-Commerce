import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';
type AuthReq = Request & { user: { businessId: string; sub: string } };
@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Get() list(
    @Req() req: AuthReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerId') customerId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.sales.list(req.user.businessId, { from, to, customerId, paymentMethod, status, paymentStatus });
  }
  @Get(':id') get(@Req() req: AuthReq, @Param('id') id: string) {
    return this.sales.get(req.user.businessId, id);
  }
  @Post() create(@Req() req: AuthReq, @Body() dto: CreateSaleDto) {
    return this.sales.create(req.user.businessId, req.user.sub, dto);
  }
}
