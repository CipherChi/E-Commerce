import { BadRequestException, NotFoundException } from '../lib/http-errors';
import { Prisma, StockMovementType } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService stock movements', () => {
  const setup = (currentQuantity = 10) => {
    const movement = { id: 'movement-1' };
    const tx = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'product-1', isStockable: true }) },
      stockMovement: { create: jest.fn().mockResolvedValue(movement) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as unknown as PrismaService;
    const catalog = {
      quantity: jest.fn().mockResolvedValue(currentQuantity),
    } as unknown as CatalogService;

    return { service: new InventoryService(prisma, catalog), prisma, catalog, tx, movement };
  };

  it('records stock received with its reason and serializable isolation', async () => {
    const { service, prisma, tx, movement } = setup();

    await expect(
      service.stockIn('business-1', 'user-1', {
        productId: 'product-1',
        quantity: 4,
        reason: '  supplier delivery  ',
      }),
    ).resolves.toBe(movement);

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business-1',
        productId: 'product-1',
        createdById: 'user-1',
        type: StockMovementType.STOCK_IN,
        quantity: 4,
        reason: 'supplier delivery',
      },
    });
    expect((prisma.$transaction as jest.Mock).mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('rejects stock leaving the inventory below zero', async () => {
    const { service, tx } = setup(2);

    await expect(
      service.stockOut('business-1', 'user-1', {
        productId: 'product-1',
        quantity: 3,
      }),
    ).rejects.toThrow(new BadRequestException('Insufficient stock. Available: 2'));
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('requires an adjustment reason and a non-zero quantity', async () => {
    const { service, tx } = setup();

    expect(() =>
      service.adjust('business-1', 'user-1', {
        productId: 'product-1',
        quantity: 1,
        reason: '   ',
      }),
    ).toThrow(new BadRequestException('A reason is required for stock adjustments'));
    expect(() =>
      service.adjust('business-1', 'user-1', {
        productId: 'product-1',
        quantity: 0,
        reason: 'count correction',
      }),
    ).toThrow(new BadRequestException('Adjustment quantity cannot be zero'));
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('stores an authorized adjustment as a signed inventory movement', async () => {
    const { service, tx, movement } = setup(8);

    await expect(
      service.adjust('business-1', 'user-1', {
        productId: 'product-1',
        quantity: -2,
        reason: '  physical count  ',
      }),
    ).resolves.toBe(movement);

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: StockMovementType.ADJUSTMENT,
        quantity: -2,
        reason: 'physical count',
      }),
    });
  });

  it('does not create a movement for a product outside the business or not stockable', async () => {
    const { service, tx } = setup();
    tx.product.findFirst.mockResolvedValue(null);

    await expect(
      service.stockIn('business-1', 'user-1', {
        productId: 'product-1',
        quantity: 1,
      }),
    ).rejects.toThrow(new NotFoundException('Stockable product not found'));
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
