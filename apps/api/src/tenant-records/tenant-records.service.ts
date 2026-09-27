import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Resource = 'booking' | 'payment' | 'invoice';
const editable: Record<Resource, string[]> = {
  booking: ['checkIn', 'checkOut', 'status', 'totalAmount', 'source'],
  payment: ['amount', 'method', 'reference', 'paidAt'],
  invoice: ['invoiceNumber', 'items', 'totalAmount', 'amountPaid', 'balance', 'status'],
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
    if (!record) throw new NotFoundException(`${resource} not found`);
    return record;
  }

  async update(resource: Resource, businessId: string, id: string, input: Record<string, unknown>) {
    await this.get(resource, businessId, id);
    const data = Object.fromEntries(
      Object.entries(input).filter(([key]) => editable[resource].includes(key)),
    );
    const result = await this.delegate(resource).updateMany({ where: { id, businessId }, data });
    if (!result.count) throw new NotFoundException(`${resource} not found`);
    return this.get(resource, businessId, id);
  }

  async remove(resource: Resource, businessId: string, id: string) {
    const result = await this.delegate(resource).deleteMany({ where: { id, businessId } });
    if (!result.count) throw new NotFoundException(`${resource} not found`);
    return { success: true };
  }
}
