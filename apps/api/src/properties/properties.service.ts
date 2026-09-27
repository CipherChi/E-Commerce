import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  list(user: { sub: string; role: string }) {
    return this.prisma.property.findMany({
      where: { ownerId: user.sub },
      include: { _count: { select: { rooms: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  create(ownerId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({ data: { ...dto, ownerId } });
  }

  async update(userId: string, propertyId: string, dto: UpdatePropertyDto) {
    await this.get(userId, propertyId);
    return this.prisma.property.update({ where: { id: propertyId }, data: dto });
  }

  async remove(userId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.ownerId !== userId)
      throw new ForbiddenException('You cannot delete another owner’s property');
    return this.prisma.property.delete({ where: { id: propertyId } });
  }
}
