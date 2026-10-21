

import { Request } from 'express';




import { InventoryService } from './inventory.service';
import { MovementQueryDto, StockAdjustmentDto, StockMovementDto } from './dto/movement.dto';
type AuthReq = Request & { user: { businessId: string; sub: string } };





export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
   products( req: AuthReq) {
    return this.inventory.stockableProducts(req.user.businessId);
  }
   summary( req: AuthReq) {
    return this.inventory.summary(req.user.businessId);
  }
   low( req: AuthReq) {
    return this.inventory.lowStock(req.user.businessId);
  }
   current( req: AuthReq,  id: string) {
    return this.inventory.current(req.user.businessId, id);
  }
   history(
     req: AuthReq,
     id: string,
     query: MovementQueryDto,
  ) {
    return this.inventory.history(req.user.businessId, id, query);
  }
     stockIn( req: AuthReq,  dto: StockMovementDto) {
    return this.inventory.stockIn(req.user.businessId, req.user.sub, dto);
  }
     stockOut( req: AuthReq,  dto: StockMovementDto) {
    return this.inventory.stockOut(req.user.businessId, req.user.sub, dto);
  }
     adjust( req: AuthReq,  dto: StockAdjustmentDto) {
    return this.inventory.adjust(req.user.businessId, req.user.sub, dto);
  }
}
