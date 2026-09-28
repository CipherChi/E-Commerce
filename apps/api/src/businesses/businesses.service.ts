import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessModuleType, BusinessType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

const primaryModule: Record<BusinessType, BusinessModuleType> = {
  HOTEL: BusinessModuleType.LODGING, APARTMENT: BusinessModuleType.LODGING,
  RESTAURANT: BusinessModuleType.FOOD_BEVERAGE, GYM: BusinessModuleType.GYM,
  SUPERMARKET: BusinessModuleType.RETAIL,
};

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateBusinessDto) {
    const { primaryType, ...details } = dto;
    return this.prisma.business.create({
      data: { ...details, primaryType, members: { create: { userId, role: 'OWNER' } },
        modules: { create: [{ module: primaryModule[primaryType], isEnabled: true }] } },
      include: { members: { select: { userId: true, role: true } }, modules: true },
    });
  }

  profile(businessId: string) {
    return this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, primaryType: true, createdAt: true } });
  }

  modules(businessId: string) {
    return this.prisma.businessModule.findMany({ where: { businessId }, orderBy: { module: 'asc' } });
  }

  async setModule(businessId: string, module: BusinessModuleType, isEnabled: boolean) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { primaryType: true } });
    if (!business) throw new NotFoundException('Business not found');
    if (!isEnabled && primaryModule[business.primaryType] === module)
      throw new BadRequestException('Your primary business module cannot be disabled');
    return this.prisma.businessModule.upsert({
      where: { businessId_module: { businessId, module } },
      update: { isEnabled, ...(isEnabled ? { enabledAt: new Date() } : {}) },
      create: { businessId, module, isEnabled },
    });
  }
}
