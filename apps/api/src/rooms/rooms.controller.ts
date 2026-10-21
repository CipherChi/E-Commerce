

import { Request } from 'express';




import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';





export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

   list(
     req: Request & { user: { businessId: string } },
     propertyId: string,
  ) {
    return this.rooms.list(req.user.businessId, propertyId);
  }
   get(
     req: Request & { user: { businessId: string } },
     propertyId: string,
     roomId: string,
  ) {
    return this.rooms.get(req.user.businessId, propertyId, roomId);
  }


  create(
     req: Request & { user: { businessId: string } },
     propertyId: string,
     dto: CreateRoomDto,
  ) {
    return this.rooms.create(req.user.businessId, propertyId, dto);
  }


  update(
     req: Request & { user: { businessId: string } },
     propertyId: string,
     roomId: string,
     dto: UpdateRoomDto,
  ) {
    return this.rooms.update(req.user.businessId, propertyId, roomId, dto);
  }


  remove(
     req: Request & { user: { businessId: string } },
     propertyId: string,
     roomId: string,
  ) {
    return this.rooms.remove(req.user.businessId, propertyId, roomId);
  }
}
