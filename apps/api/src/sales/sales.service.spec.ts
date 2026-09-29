import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService Decimal rules', () => {
  const setup = () => {
    const product = { id: 'p1', name: 'Room item', sellingPrice: new Prisma.Decimal('10.25'), costPrice: new Prisma.Decimal('4.20'), module: 'FOOD', isStockable: false };
    const tx: any = {
      customer: { findFirst: jest.fn() }, businessModule: { findMany: jest.fn().mockResolvedValue([{ module: 'FOOD' }]) },
      product: { findMany: jest.fn().mockResolvedValue([product]) }, stockMovement: { aggregate: jest.fn(), createMany: jest.fn() },
      sale: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 's1' }), findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)), sale: tx.sale } as unknown as PrismaService;
    return { service: new SalesService(prisma), tx };
  };
  const dto: any = { guestName: 'Walk in', paymentMethod: 'CASH', paymentStatus: 'PARTIAL', amountPaid: '5.10', items: [{ productId: 'p1', quantity: 3 }] };
  it('uses exact Decimal multiplication and allows a valid partial tender', async () => {
    const { service, tx } = setup();
    await service.create('b1', 'u1', dto);
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: new Prisma.Decimal('30.75'), amountPaid: new Prisma.Decimal('5.10'), items: { create: [expect.objectContaining({ unitPrice: new Prisma.Decimal('10.25'), lineSubtotal: new Prisma.Decimal('30.75') })] } }) }));
  });
  it('rejects zero or full amount as a partial tender before writing a sale', async () => {
    const { service, tx } = setup();
    await expect(service.create('b1', 'u1', { ...dto, amountPaid: '0' })).rejects.toThrow('Partial payment');
    expect(tx.sale.create).not.toHaveBeenCalled();
  });
  it('rejects an amount on an unpaid sale and a non-total paid tender', async () => {
    const first = setup();
    await expect(first.service.create('b1', 'u1', { ...dto, paymentStatus: 'UNPAID', amountPaid: '1.00' })).rejects.toThrow('Unpaid sales');
    const second = setup();
    await expect(second.service.create('b1', 'u1', { ...dto, paymentStatus: 'PAID', amountPaid: '29.00' })).rejects.toThrow('Paid sales');
    expect(second.tx.sale.create).not.toHaveBeenCalled();
  });
});
