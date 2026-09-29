import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessModuleType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';
const labels: Record<BusinessModuleType, string> = { LODGING: 'Lodging', FOOD: 'Food', BEVERAGE: 'Beverage', GYM: 'Gym' };
@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}
  async list(businessId: string, filters: { module?: BusinessModuleType; category?: string; is_stockable?: string; is_archived?: string }) {
    const enabled = await this.prisma.businessModule.findMany({ where: { businessId, isEnabled: true }, select: { module: true } });
    const where: Prisma.ProductWhereInput = { businessId, module: { in: enabled.map(m => m.module) } };
    if (filters.module) where.module = filters.module;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters.is_stockable !== undefined) where.isStockable = filters.is_stockable === 'true';
    where.isArchived = filters.is_archived === 'true';
    const items = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    const ids = items.filter(i => i.isStockable).map(i => i.id);
    const totals = ids.length ? await this.prisma.stockMovement.groupBy({ by: ['productId'], where: { businessId, productId: { in: ids } }, _sum: { quantity: true } }) : [];
    const quantities = new Map(totals.map(x => [x.productId, x._sum.quantity ?? 0]));
    return items.map(item => ({ ...item, currentQuantity: item.isStockable ? quantities.get(item.id) ?? 0 : null }));
  }
  async categories(businessId: string) {
    const rows = await this.prisma.product.findMany({ where: { businessId, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
    return rows.map(r => ({ name: r.category }));
  }
  async get(businessId: string, id: string) {
    const item = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!item) throw new NotFoundException('Catalog item not found');
    return { ...item, currentQuantity: item.isStockable ? await this.quantity(businessId, id) : null };
  }
  async create(businessId: string, dto: CreateCatalogItemDto) {
    await this.assertEnabled(businessId, dto.module);
    const stockable = dto.module === BusinessModuleType.FOOD || dto.module === BusinessModuleType.BEVERAGE ? (dto.isStockable ?? false) : false;
    this.validatePricing(dto);
    return this.prisma.product.create({ data: { businessId, module: dto.module, category: dto.category?.trim() || null, name: dto.name.trim(), costPrice: dto.costPrice ?? '0', sellingPrice: dto.sellingPrice ?? '0', normalRate: dto.normalRate ?? '0', partyRate: dto.partyRate ?? '0', monthlyPrice: dto.monthlyPrice ?? '0', isStockable: stockable, lowStockThreshold: stockable ? dto.lowStockThreshold ?? null : null } });
  }
  async update(businessId: string, id: string, dto: UpdateCatalogItemDto) {
    const current = await this.get(businessId, id); const module = dto.module ?? current.module;
    await this.assertEnabled(businessId, module);
    const stockable = module === BusinessModuleType.FOOD || module === BusinessModuleType.BEVERAGE ? (dto.isStockable ?? current.isStockable) : false;
    const changedType = dto.module !== undefined && dto.module !== current.module;
    this.validatePricing(changedType ? { ...dto, module } : { ...current, ...dto, module });
    if (!stockable && current.isStockable && await this.quantity(businessId, id) !== 0) throw new BadRequestException('Stockable items must have zero stock before disabling stock tracking');
    return this.prisma.product.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), module, ...(dto.category !== undefined ? { category: dto.category.trim() || null } : {}), ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}), ...((dto.sellingPrice !== undefined || changedType) ? { sellingPrice: module === BusinessModuleType.FOOD || module === BusinessModuleType.BEVERAGE ? dto.sellingPrice ?? '0' : '0' } : {}), ...((dto.normalRate !== undefined || changedType) ? { normalRate: module === BusinessModuleType.LODGING ? dto.normalRate ?? '0' : '0' } : {}), ...((dto.partyRate !== undefined || changedType) ? { partyRate: module === BusinessModuleType.LODGING ? dto.partyRate ?? '0' : '0' } : {}), ...((dto.monthlyPrice !== undefined || changedType) ? { monthlyPrice: module === BusinessModuleType.GYM ? dto.monthlyPrice ?? '0' : '0' } : {}), isStockable: stockable, lowStockThreshold: stockable ? dto.lowStockThreshold ?? current.lowStockThreshold : null } });
  }
  async archive(businessId: string, id: string) { await this.get(businessId, id); await this.prisma.product.updateMany({ where: { id, businessId }, data: { isArchived: true } }); return { success: true }; }
  async quantity(businessId: string, productId: string, db: Prisma.TransactionClient | PrismaService = this.prisma) { const result = await db.stockMovement.aggregate({ where: { businessId, productId }, _sum: { quantity: true } }); return result._sum.quantity ?? 0; }
  private async assertEnabled(businessId: string, module: BusinessModuleType) {
    const row = await this.prisma.businessModule.findUnique({ where: { businessId_module: { businessId, module } } });
    if (!row?.isEnabled) throw new BadRequestException(`Enable ${labels[module]} in Settings first`);
  }
  private validatePricing(item: { module: BusinessModuleType; normalRate?: unknown; partyRate?: unknown; sellingPrice?: unknown; monthlyPrice?: unknown }) {
    const required = item.module === BusinessModuleType.LODGING ? [item.normalRate, item.partyRate] : item.module === BusinessModuleType.GYM ? [item.monthlyPrice] : [item.sellingPrice];
    if (required.some(value => value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) throw new BadRequestException('Enter valid non-negative prices for the selected type');
  }
}
