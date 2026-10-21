

import { Request } from 'express';




import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';





export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

   list( req: Request & { user: { businessId: string } }) {
    return this.properties.list(req.user.businessId);
  }
   get( req: Request & { user: { businessId: string } },  id: string) {
    return this.properties.get(req.user.businessId, id);
  }



  create(
     req: Request & { user: { sub: string; businessId: string } },
     dto: CreatePropertyDto,
  ) {
    return this.properties.create(req.user.sub, req.user.businessId, dto);
  }



  update(
     req: Request & { user: { businessId: string } },
     id: string,
     dto: UpdatePropertyDto,
  ) {
    return this.properties.update(req.user.businessId, id, dto);
  }



  remove( req: Request & { user: { businessId: string } },  id: string) {
    return this.properties.remove(req.user.businessId, id);
  }
}
