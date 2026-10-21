import { NotFoundException } from '../lib/http-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';


export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.property.findMany({
      where: { businessId },
      include: { _count: { select: { rooms: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(businessId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, businessId },
      include: { _count: { select: { rooms: true } } },
    });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  create(ownerId: string, businessId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({ data: { ...dto, ownerId, businessId } });
  }

  async update(businessId: string, propertyId: string, dto: UpdatePropertyDto) {
    await this.get(businessId, propertyId);
    const result = await this.prisma.property.updateMany({
      where: { id: propertyId, businessId },
      data: dto,
    });
    if (!result.count) throw new NotFoundException('Property not found');
    return this.get(businessId, propertyId);
  }

  async remove(businessId: string, propertyId: string) {
    const result = await this.prisma.property.deleteMany({ where: { id: propertyId, businessId } });
    if (!result.count) throw new NotFoundException('Property not found');
    return { success: true };
  }
}
