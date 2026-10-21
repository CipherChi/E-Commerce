import { NotFoundException } from '../lib/http-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';


export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async list(businessId: string, propertyId: string) {
    await this.assertPropertyInBusiness(businessId, propertyId);
    return this.prisma.room.findMany({
      where: { propertyId, businessId },
      orderBy: { label: 'asc' },
    });
  }

  async get(businessId: string, propertyId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, businessId },
    });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async create(businessId: string, propertyId: string, dto: CreateRoomDto) {
    await this.assertPropertyInBusiness(businessId, propertyId);
    return this.prisma.room.create({ data: { ...dto, propertyId, businessId } });
  }

  async update(businessId: string, propertyId: string, roomId: string, dto: UpdateRoomDto) {
    await this.get(businessId, propertyId, roomId);
    const result = await this.prisma.room.updateMany({
      where: { id: roomId, propertyId, businessId },
      data: dto,
    });
    if (!result.count) throw new NotFoundException('Room not found');
    return this.get(businessId, propertyId, roomId);
  }

  async remove(businessId: string, propertyId: string, roomId: string) {
    const result = await this.prisma.room.deleteMany({
      where: { id: roomId, propertyId, businessId },
    });
    if (!result.count) throw new NotFoundException('Room not found');
    return { success: true };
  }

  private async assertPropertyInBusiness(businessId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, businessId },
    });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!property) throw new NotFoundException('Property not found');
  }
}
