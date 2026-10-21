

import { BusinessModuleType } from '@prisma/client';

import { Request } from 'express';




import { CreateBusinessDto } from './dto/create-business.dto';

import { BusinessesService } from './businesses.service';

class ModuleUpdateDto {
   module!: BusinessModuleType;
   isEnabled!: boolean;
}
class CreateStaffDto {
    name!: string;
    email!: string;
    password!: string;
}
type AuthReq = Request & { user: { sub: string; businessId: string } };




export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}
   create( req: AuthReq,  dto: CreateBusinessDto) {
    return this.businesses.create(req.user.sub, dto);
  }
    profile( req: AuthReq) {
    return this.businesses.profile(req.user.businessId);
  }
    modules( req: AuthReq) {
    return this.businesses.modules(req.user.businessId);
  }
     setModule(
     req: AuthReq,
     dto: ModuleUpdateDto,
  ) {
    return this.businesses.setModule(req.user.businessId, dto.module, dto.isEnabled);
  }
     staff(
     req: AuthReq,
  ) {
    return this.businesses.staff(req.user.businessId);
  }
     createStaff(
     req: AuthReq,
     dto: CreateStaffDto,
  ) {
    return this.businesses.createStaff(req.user.businessId, dto);
  }



  setStaffActive(
     req: AuthReq,
     userId: string,
     dto: { isActive: boolean },
  ) {
    return this.businesses.setStaffActive(req.user.businessId, userId, dto.isActive);
  }
}
