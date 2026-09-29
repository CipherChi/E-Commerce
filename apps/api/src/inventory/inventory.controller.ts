import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InventoryService } from './inventory.service';
import { MovementQueryDto, StockAdjustmentDto, StockMovementDto } from './dto/movement.dto';
type AuthReq = Request & { user: { businessId: string; sub: string } };
@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard, RolesGuard)
@Roles('ADMIN')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('products') products(@Req() req: AuthReq) {
    return this.inventory.stockableProducts(req.user.businessId);
  }
  @Get('low-stock') low(@Req() req: AuthReq) {
    return this.inventory.lowStock(req.user.businessId);
  }
  @Get(':productId/current') current(@Req() req: AuthReq, @Param('productId') id: string) {
    return this.inventory.current(req.user.businessId, id);
  }
  @Get(':productId/movements') history(
    @Req() req: AuthReq,
    @Param('productId') id: string,
    @Query() query: MovementQueryDto,
  ) {
    return this.inventory.history(req.user.businessId, id, query);
  }
  @Post('stock-in') @UseGuards(RolesGuard) @Roles('ADMIN') stockIn(@Req() req: AuthReq, @Body() dto: StockMovementDto) {
    return this.inventory.stockIn(req.user.businessId, req.user.sub, dto);
  }
  @Post('stock-out') @UseGuards(RolesGuard) @Roles('ADMIN') stockOut(@Req() req: AuthReq, @Body() dto: StockMovementDto) {
    return this.inventory.stockOut(req.user.businessId, req.user.sub, dto);
  }
  @Post('adjustments') @UseGuards(RolesGuard) @Roles('ADMIN') adjust(@Req() req: AuthReq, @Body() dto: StockAdjustmentDto) {
    return this.inventory.adjust(req.user.businessId, req.user.sub, dto);
  }
}
