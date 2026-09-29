import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Resource = 'booking' | 'payment' | 'invoice';
const editable: Record<Resource, string[]> = {
  booking: ['checkIn', 'checkOut', 'status', 'totalAmount', 'source'],
  payment: ['amount', 'method', 'reference', 'paidAt'],
  invoice: [],
};

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
    if (resource === 'payment') throw new BadRequestException('Recorded payments are immutable; record a correcting payment instead');
    if (resource === 'invoice' && Object.keys(input).some((key) => ['balance', 'amountPaid', 'status', 'totalAmount'].includes(key))) {
      throw new BadRequestException('Invoice totals and status are derived from its booking and payments');
    }
    const data = Object.fromEntries(
      Object.entries(input).filter(([key]) => editable[resource].includes(key)),
    );
    const result = await this.delegate(resource).updateMany({ where: { id, businessId }, data });
    if (!result.count) throw new NotFoundException(`${resource} not found`);
    return this.get(resource, businessId, id);
  }

  async remove(resource: Resource, businessId: string, id: string) {
    await this.get(resource, businessId, id);
    if (resource === 'payment' || resource === 'invoice') {
      throw new BadRequestException(`${resource} records cannot be deleted`);
    }
    const result = await this.delegate(resource).deleteMany({ where: { id, businessId } });
    if (!result.count) throw new NotFoundException(`${resource} not found`);
    return { success: true };
  }
}
