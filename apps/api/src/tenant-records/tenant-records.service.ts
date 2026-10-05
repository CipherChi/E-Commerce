import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Resource = 'booking' | 'payment' | 'invoice';

@Injectable()
export class TenantRecordsService {
  constructor(private prisma: PrismaService) {}

  private delegate(resource: Resource): any {
    return {
      booking: this.prisma.booking,
      payment: this.prisma.payment,
      invoice: this.prisma.invoice,
    }[resource];
  }

  async get(resource: Resource, businessId: string, id: string) {
    const record = await this.delegate(resource).findFirst({ where: { id, businessId } });
    // Deliberately hide cross-business records as 404 instead of confirming them with 403.
    if (!record) throw new NotFoundException(`${resource} not found`);
    return record;
  }

  async update(resource: Resource, businessId: string, id: string, input: Record<string, unknown>) {
    await this.get(resource, businessId, id);
    throw new BadRequestException(
      `${resource} records can only be changed through their dedicated service`,
    );
  }

  async remove(resource: Resource, businessId: string, id: string) {
    await this.get(resource, businessId, id);
    throw new BadRequestException(
      `${resource} records can only be changed through their dedicated service`,
    );
  }
}
