

import { Request } from 'express';


import { PrismaService } from '../prisma/prisma.service';

type TenantRequest = Request & { user: { businessId: string } };





export class ActivityLogsController {
  constructor(private readonly prisma: PrismaService) {}


  list( req: TenantRequest) {
    return this.prisma.activityLog.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
