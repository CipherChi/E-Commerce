import { BadRequestException } from '../lib/http-errors';


import { Request } from 'express';


import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { SalesService } from './sales.service';
type AuthReq = Request & { user: { businessId: string; sub: string } };




export class SalesController {
  constructor(private readonly sales: SalesService) {}
   list( req: AuthReq,  query: ListSalesDto) {
    return this.sales.list(req.user.businessId, query);
  }
   get( req: AuthReq,  id: string) {
    return this.sales.get(req.user.businessId, id);
  }
   create( req: AuthReq,  dto: CreateSaleDto,  idempotencyKey?: string) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 128) throw new BadRequestException('A valid Idempotency-Key header is required');
    return this.sales.create(req.user.businessId, req.user.sub, dto, key);
  }
}
