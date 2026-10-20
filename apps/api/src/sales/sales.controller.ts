import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { SalesService } from './sales.service';
type AuthReq = Request & { user: { businessId: string; sub: string } };
@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Get() list(@Req() req: AuthReq, @Query() query: ListSalesDto) {
    return this.sales.list(req.user.businessId, query);
  }
  @Get(':id') get(@Req() req: AuthReq, @Param('id') id: string) {
    return this.sales.get(req.user.businessId, id);
  }
  @Post() create(@Req() req: AuthReq, @Body() dto: CreateSaleDto, @Headers('idempotency-key') idempotencyKey?: string) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 128) throw new BadRequestException('A valid Idempotency-Key header is required');
    return this.sales.create(req.user.businessId, req.user.sub, dto, key);
  }
}
