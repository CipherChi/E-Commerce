

import { Request } from 'express';




import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';
import { ListCatalogDto } from './dto/list-catalog.dto';





export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
   list(
     req: Request & { user: { businessId: string; role?: string } },
     query: ListCatalogDto,
  ) {
    return this.catalog.list(req.user.businessId, query).then(result => req.user.role === 'OWNER'
      ? result
      : { ...result, data: result.data.map(({ costPrice, ...item }) => item) });
  }
   categories( req: Request & { user: { businessId: string } }) {
    return this.catalog.categories(req.user.businessId);
  }
   get( req: Request & { user: { businessId: string; role?: string } },  id: string) {
    return this.catalog.get(req.user.businessId, id).then(({ costPrice, ...item }) => req.user.role === 'OWNER' ? { costPrice, ...item } : item);
  }
     create(
     req: Request & { user: { businessId: string } },
     dto: CreateCatalogItemDto,
  ) {
    return this.catalog.create(req.user.businessId, dto);
  }
     update(
     req: Request & { user: { businessId: string } },
     id: string,
     dto: UpdateCatalogItemDto,
  ) {
    return this.catalog.update(req.user.businessId, id, dto);
  }
     archive(
     req: Request & { user: { businessId: string } },
     id: string,
  ) {
    return this.catalog.archive(req.user.businessId, id);
  }
}
