import { BusinessModuleType, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const name = process.env.ADMIN_NAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 12) {
    throw new Error(
      'Set ADMIN_EMAIL, ADMIN_NAME, and an ADMIN_PASSWORD with at least 12 characters before seeding.',
    );
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: await argon2.hash(password), role: Role.ADMIN },
  });
  await prisma.business.upsert({
    where: { id: 'default-business-migration' },
    update: {},
    create: { id: 'default-business-migration', name: 'Default Business' },
  });
  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: 'default-business-migration', userId: user.id } },
    update: {},
    create: { businessId: 'default-business-migration', userId: user.id, role: 'OWNER' },
  });
  const businessId = 'default-business-migration';
  for (const name of ['Electricity', 'Staff', 'Maintenance', 'Other']) {
    await prisma.expenseCategory.upsert({
      where: { businessId_name: { businessId, name } },
      update: {},
      create: { businessId, name },
    });
  }
  await prisma.businessModule.upsert({ where: { businessId_module: { businessId: 'default-business-migration', module: BusinessModuleType.LODGING } }, update: {}, create: { businessId: 'default-business-migration', module: BusinessModuleType.LODGING, isEnabled: true } });
  await prisma.businessModule.upsert({ where: { businessId_module: { businessId: 'default-business-migration', module: BusinessModuleType.FOOD_BEVERAGE } }, update: {}, create: { businessId: 'default-business-migration', module: BusinessModuleType.FOOD_BEVERAGE, isEnabled: true } });
  const roomCategory = await prisma.catalogCategory.upsert({
    where: { businessId_name: { businessId, name: 'Rooms' } },
    update: {},
    create: { businessId, name: 'Rooms' },
  });
  const serviceCategory = await prisma.catalogCategory.upsert({
    where: { businessId_name: { businessId, name: 'Services' } },
    update: {},
    create: { businessId, name: 'Services' },
  });
  const beverageCategory = await prisma.catalogCategory.upsert({
    where: { businessId_name: { businessId, name: 'Beverages' } },
    update: {},
    create: { businessId, name: 'Beverages' },
  });
  const catalogSeed = [
    {
      name: 'Deluxe Room',
      module: 'LODGING' as const,
      category: 'Room type',
      costPrice: 0,
      sellingPrice: 75000,
      isStockable: false,
    },
    {
      name: 'Executive Room',
      module: 'LODGING' as const,
      category: 'Room type',
      costPrice: 0,
      sellingPrice: 120000,
      isStockable: false,
    },
    {
      name: 'Laundry',
      module: 'FOOD_BEVERAGE' as const,
      category: 'Service',
      costPrice: 0,
      sellingPrice: 5000,
      isStockable: false,
    },
    {
      name: 'Breakfast',
      module: 'FOOD_BEVERAGE' as const,
      category: 'Service',
      costPrice: 0,
      sellingPrice: 8000,
      isStockable: false,
    },
    {
      name: 'Airport Pickup',
      module: 'FOOD_BEVERAGE' as const,
      category: 'Service',
      costPrice: 0,
      sellingPrice: 25000,
      isStockable: false,
    },
    {
      name: 'Drinks',
      module: 'FOOD_BEVERAGE' as const,
      category: 'Beverages',
      costPrice: 800,
      sellingPrice: 1500,
      isStockable: true,
      lowStockThreshold: 10,
    },
    {
      name: 'Water',
      module: 'FOOD_BEVERAGE' as const,
      category: 'Beverages',
      costPrice: 200,
      sellingPrice: 500,
      isStockable: true,
      lowStockThreshold: 20,
    },
  ];
  for (const item of catalogSeed) {
    const exists = await prisma.product.findFirst({
      where: { businessId, name: item.name, module: item.module, category: item.category },
    });
    if (!exists) await prisma.product.create({ data: { ...item, businessId } });
  }
  console.log(`Administrator account ready for ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
