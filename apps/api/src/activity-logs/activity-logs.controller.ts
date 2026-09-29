import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type TenantRequest = Request & { user: { businessId: string } };

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('activity')
export class ActivityLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() req: TenantRequest) {
    return this.prisma.activityLog.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
