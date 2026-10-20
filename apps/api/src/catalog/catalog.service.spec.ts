import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService tenant-scoped updates', () => {
  it('includes businessId in the catalog update write', async () => {
    const item = { id: 'product-1', businessId: 'business-a', module: 'FOOD', name: 'Meal', category: null,
      costPrice: '2', sellingPrice: '4', normalRate: '0', partyRate: '0', monthlyPrice: '0',
      isStockable: false, lowStockThreshold: null, isArchived: false };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(item), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      businessModule: { findUnique: jest.fn().mockResolvedValue({ isEnabled: true }) },
      stockMovement: { aggregate: jest.fn() },
    } as unknown as PrismaService;
    await new CatalogService(prisma).update('business-a', 'product-1', { name: 'Meal 2' });
    expect(prisma.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1', businessId: 'business-a' },
    }));
  });
});
