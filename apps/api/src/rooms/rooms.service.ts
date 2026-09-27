import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, propertyId: string) {
    await this.assertPropertyOwner(userId, propertyId);
    return this.prisma.room.findMany({ where: { propertyId }, orderBy: { label: 'asc' } });
  }

  async get(userId: string, propertyId: string, roomId: string) {
    await this.assertRoomOwner(userId, propertyId, roomId);
    return this.prisma.room.findUnique({ where: { id: roomId } });
  }

  async create(userId: string, propertyId: string, dto: CreateRoomDto) {
    await this.assertPropertyOwner(userId, propertyId);
    return this.prisma.room.create({ data: { ...dto, propertyId } });
  }

  async update(userId: string, propertyId: string, roomId: string, dto: UpdateRoomDto) {
    await this.assertRoomOwner(userId, propertyId, roomId);
    return this.prisma.room.update({ where: { id: roomId }, data: dto });
  }

  async remove(userId: string, propertyId: string, roomId: string) {
    await this.assertRoomOwner(userId, propertyId, roomId);
    return this.prisma.room.delete({ where: { id: roomId } });
  }

  private async assertPropertyOwner(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
    });
    if (!property) throw new NotFoundException('Property not found');
  }

  private async assertRoomOwner(userId: string, propertyId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId },
      include: { property: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.property.ownerId !== userId)
      throw new ForbiddenException('You cannot change another owner’s room');
  }
}
