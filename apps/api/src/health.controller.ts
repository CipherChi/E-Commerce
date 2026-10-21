

import { PrismaService } from './prisma/prisma.service';



export class HealthController {
  constructor(private readonly prisma: PrismaService) {}


  async check() {
    return this.ready();
  }



  live() {
    return { status: 'ok' };
  }



  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok' };
  }
}
