import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { BusinessModuleType, BusinessType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

const primaryModule: Record<BusinessType, BusinessModuleType> = {
  HOTEL: BusinessModuleType.LODGING, APARTMENT: BusinessModuleType.LODGING,
  RESTAURANT: BusinessModuleType.FOOD, GYM: BusinessModuleType.GYM,
  SUPERMARKET: BusinessModuleType.FOOD,
};

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  async staff(businessId: string) {
    // Staff access is determined by the tenant-scoped BusinessMember.role.
    return this.prisma.businessMember.findMany({ where: { businessId, role: 'STAFF' }, include: { user: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createStaff(businessId: string, dto: { name: string; email: string; password: string }) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    // User.role remains account metadata; authorization reads the BusinessMember role above.
    return this.prisma.user.create({ data: { name: dto.name.trim(), email, passwordHash: await argon2.hash(dto.password), role: 'STAFF', memberships: { create: { businessId, role: 'STAFF' } } }, select: { id: true, name: true, email: true, isActive: true, createdAt: true } });
  }

  async setStaffActive(businessId: string, userId: string, isActive: boolean) {
    const membership = await this.prisma.businessMember.findFirst({ where: { businessId, userId, role: 'STAFF' } });
    if (!membership) throw new NotFoundException('Staff member not found');
    return this.prisma.user.update({ where: { id: userId }, data: { isActive, tokenVersion: { increment: 1 } }, select: { id: true, name: true, email: true, isActive: true } });
  }

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
