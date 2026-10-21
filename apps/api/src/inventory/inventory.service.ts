import { BadRequestException, NotFoundException } from '../lib/http-errors';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { MovementQueryDto, StockAdjustmentDto, StockMovementDto } from './dto/movement.dto';


export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private catalog: CatalogService,
  ) {}

  async current(businessId: string, productId: string) {
    await this.stockable(businessId, productId);
    return { productId, quantity: await this.catalog.quantity(businessId, productId) };
  }

  async history(businessId: string, productId: string, query: MovementQueryDto) {
    await this.stockable(businessId, productId);
    const where: Prisma.StockMovementWhereInput = {
      businessId,
      productId,
      ...(query.type ? { type: query.type as StockMovementType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          sale: { select: { id: true } },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * Math.min(query.limit, 100),
        take: Math.min(query.limit, 100),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { data, total, page: query.page, limit: Math.min(query.limit, 100) };
  }

  async lowStock(businessId: string) {
    const enabled = await this.prisma.businessModule.findMany({ where: { businessId, isEnabled: true }, select: { module: true } });
    const products = await this.prisma.product.findMany({
      where: { businessId, module: { in: enabled.map(m => m.module) }, isStockable: true, isArchived: false, lowStockThreshold: { not: null } },

    });
    const result: Array<(typeof products)[number] & { currentQuantity: number }> = [];
    for (const product of products) {
      const quantity = await this.catalog.quantity(businessId, product.id);
      if (quantity <= product.lowStockThreshold!)
        result.push({ ...product, currentQuantity: quantity });
    }
    return result;
  }

  async stockableProducts(businessId: string) {
    const enabled = await this.prisma.businessModule.findMany({ where: { businessId, isEnabled: true }, select: { module: true } });
    return this.prisma.product.findMany({
      where: { businessId, module: { in: enabled.map(m => m.module) }, isStockable: true, isArchived: false },

      orderBy: { name: 'asc' },
    });
  }

  async summary(businessId: string) {
    const products = await this.stockableProducts(businessId);
    const productIds = products.map((product) => product.id);
    const totals = productIds.length
      ? await this.prisma.stockMovement.groupBy({
          by: ['productId'],
          where: { businessId, productId: { in: productIds } },
          _sum: { quantity: true },
        })
      : [];

    return {
      stockableProductCount: productIds.length,
      productsWithStock: totals.filter((row) => (row._sum.quantity ?? 0) > 0).length,
    };
  }

  stockIn(businessId: string, userId: string, dto: StockMovementDto) {
    return this.record(
      businessId,
      userId,
      dto.productId,
      StockMovementType.STOCK_IN,
      dto.quantity,
      dto.reason,
    );
  }
  stockOut(businessId: string, userId: string, dto: StockMovementDto) {
    return this.record(
      businessId,
      userId,
      dto.productId,
      StockMovementType.STOCK_OUT,
      -dto.quantity,
      dto.reason,
    );
  }
  adjust(businessId: string, userId: string, dto: StockAdjustmentDto) {
    if (!dto.reason.trim())
      throw new BadRequestException('A reason is required for stock adjustments');
    if (!dto.quantity) throw new BadRequestException('Adjustment quantity cannot be zero');
    return this.record(
      businessId,
      userId,
      dto.productId,
      StockMovementType.ADJUSTMENT,
      dto.quantity,
      dto.reason.trim(),
    );
  }

  private async stockable(
    businessId: string,
    productId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const item = await tx.product.findFirst({
      where: { id: productId, businessId, isStockable: true },
    });
    if (!item) throw new NotFoundException('Stockable product not found');
    return item;
  }

  private async record(
    businessId: string,
    userId: string,
    productId: string,
    type: StockMovementType,
    quantity: number,
    reason?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.stockable(businessId, productId, tx);
        const current = await this.catalog.quantity(businessId, productId, tx);
        if (current + quantity < 0)
          throw new BadRequestException(`Insufficient stock. Available: ${current}`);
        return tx.stockMovement.create({
          data: {
            businessId,
            productId,
            createdById: userId,
            type,
            quantity,
            reason: reason?.trim() || null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
