import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties/:propertyId/rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get() list(
    @Req() req: Request & { user: { sub: string } },
    @Param('propertyId') propertyId: string,
  ) {
    return this.rooms.list(req.user.sub, propertyId);
  }
  @Get(':roomId') get(
    @Req() req: Request & { user: { sub: string } },
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
  ) {
    return this.rooms.get(req.user.sub, propertyId, roomId);
  }
  @Post()
  @Roles('ADMIN')
  create(
    @Req() req: Request & { user: { sub: string } },
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.rooms.create(req.user.sub, propertyId, dto);
  }
  @Patch(':roomId')
  @Roles('ADMIN')
  update(
    @Req() req: Request & { user: { sub: string } },
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(req.user.sub, propertyId, roomId, dto);
  }
  @Delete(':roomId')
  @Roles('ADMIN')
  remove(
    @Req() req: Request & { user: { sub: string } },
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
  ) {
    return this.rooms.remove(req.user.sub, propertyId, roomId);
  }
}
