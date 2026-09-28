import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  BusinessModuleType,
  Prisma,
  PrismaClient,
  Role,
  SalePaymentStatus,
  SaleStatus,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const databaseUrl = process.env.TENANT_TEST_DATABASE_URL;
// This inventory is parsed by tenant-schema-coverage.spec.ts and maps schema
// ownership to the real-Postgres fixtures and their available HTTP surfaces.
const schemaTenantCoverageInventory = [
  'BusinessModule',
  'BusinessMember',
  'Property',
  'Room',
  'Customer',
  'CatalogCategory',
  'Product',
  'StockMovement',
  'Sale',
  'SaleItem',
  'ExpenseCategory',
  'Expense',
  'Booking',
  'Payment',
  'Invoice',
  'ActivityLog',
] as const;
if (!databaseUrl)
  throw new Error('Set TENANT_TEST_DATABASE_URL to a dedicated migrated Postgres test database.');
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = 'tenant-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'tenant-test-refresh-secret';

describe('Cross-business isolation (real Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const businessIds: string[] = [];
  const userIds: string[] = [];
  const resources: Record<
    string,
    { path: string; patch: object; id: string; removePath?: string }[]
  > = {};
  let tokenA: string;
  let tokenB: string;
  let businessAId: string;
  let businessBName: string;
  let productBId: string;
  let expenseBId: string;
  let expenseCategoryBId: string;
  let saleBId: string;
  let saleItemBId: string;
  let activityLogBId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const makeMember = async (label: string) => {
      const email = `${label}-${suffix}@example.test`;
      const password = 'tenant-test-password-123';
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: label, primaryType: 'HOTEL' })
        .expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      userIds.push(user.id);
      await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      const auth = { Authorization: `Bearer ${login.body.accessToken}` };
      const business = await request(app.getHttpServer())
        .post('/businesses')
        .set(auth)
        .send({
          name: `Isolation ${label} ${suffix}`,
          primaryType: 'HOTEL',
          phone: '+2348000000000',
          address: 'Test address',
        })
        .expect(201);
      businessIds.push(business.body.id);
      const membership = await prisma.businessMember.findUniqueOrThrow({
        where: { businessId_userId: { businessId: business.body.id, userId: user.id } },
      });
      expect(membership.businessId).toBe(business.body.id);
      return { id: user.id, auth, businessId: business.body.id };
    };

    const memberA = await makeMember('member-a');
    tokenA = memberA.auth.Authorization;
    businessAId = memberA.businessId;
    const memberB = await makeMember('member-b');
    tokenB = memberB.auth.Authorization;
    const businessId = memberB.businessId;
    businessBName = `Isolation member-b ${suffix}`;

    const property = await prisma.property.create({
      data: {
        businessId,
        ownerId: memberB.id,
        name: 'Business B property',
        address: 'B address',
      },
    });
    const room = await prisma.room.create({
      data: {
        businessId,
        propertyId: property.id,
        label: 'B-101',
        type: 'Standard',
        capacity: 2,
        basePrice: new Prisma.Decimal(100),
      },
    });
    const customer = await prisma.customer.create({
      data: {
        businessId,
        name: 'Business B customer',
        phone: '+2348011111111',
      },
    });
    const booking = await prisma.booking.create({
      data: {
        businessId,
        roomId: room.id,
        customerId: customer.id,
        checkIn: new Date('2030-01-01T12:00:00Z'),
        checkOut: new Date('2030-01-02T12:00:00Z'),
        totalAmount: new Prisma.Decimal(100),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        businessId,
        bookingId: booking.id,
        amount: new Prisma.Decimal(50),
        method: 'CASH',
        recordedById: memberB.id,
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        bookingId: booking.id,
        invoiceNumber: `INV-${suffix}`,
        items: [],
        totalAmount: new Prisma.Decimal(100),
        amountPaid: new Prisma.Decimal(50),
        balance: new Prisma.Decimal(50),
      },
    });

    await prisma.businessModule.create({
      data: { businessId, module: BusinessModuleType.RETAIL, isEnabled: true },
    });
    const catalogCategory = await prisma.catalogCategory.create({
      data: { businessId, name: 'B private catalog category' },
    });
    const product = await prisma.product.create({
      data: {
        businessId,
        category: 'B private product category',
        name: 'B private product',
        module: BusinessModuleType.RETAIL,
        costPrice: new Prisma.Decimal(2),
        sellingPrice: new Prisma.Decimal(4),
        isStockable: true,
        lowStockThreshold: 2,
      },
    });
    productBId = product.id;
    await prisma.stockMovement.create({
      data: {
        businessId,
        productId: product.id,
        type: 'STOCK_IN',
        quantity: 8,
        createdById: memberB.id,
      },
    });
    const sale = await prisma.sale.create({
      data: {
        businessId,
        customerId: customer.id,
        status: SaleStatus.COMPLETED,
        paymentMethod: 'CASH',
        paymentStatus: SalePaymentStatus.PAID,
        subtotal: new Prisma.Decimal(4),
        total: new Prisma.Decimal(4),
        amountPaid: new Prisma.Decimal(4),
        createdById: memberB.id,
        receiptNumber: `RCPT-TEST-${suffix}`,
        items: {
          create: [
            { productId: product.id, quantity: 1, unitPrice: 4, lineSubtotal: 4, costPrice: 2 },
          ],
        },
      },
    });
    saleBId = sale.id;
    saleItemBId = (await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } })).id;
    const expenseCategory = await prisma.expenseCategory.create({
      data: { businessId, name: 'B private expense category' },
    });
    expenseCategoryBId = expenseCategory.id;
    const expense = await prisma.expense.create({
      data: {
        businessId,
        categoryId: expenseCategory.id,
        amount: new Prisma.Decimal(777),
        description: 'B private expense',
        expenseDate: new Date('2020-01-01T00:00:00Z'),
        createdById: memberB.id,
      },
    });
    expenseBId = expense.id;
    const activityLog = await prisma.activityLog.create({
      data: {
        businessId,
        userId: memberB.id,
        action: 'private-test-event',
        entityType: 'test',
        entityId: sale.id,
      },
    });
    activityLogBId = activityLog.id;

    resources.customers = [
      { id: customer.id, path: `/customers/${customer.id}`, patch: { name: 'Hijacked customer' } },
    ];
    resources.properties = [
      { id: property.id, path: `/properties/${property.id}`, patch: { name: 'Hijacked property' } },
    ];
    resources.rooms = [
      {
        id: room.id,
        path: `/properties/${property.id}/rooms/${room.id}`,
        patch: { label: 'Hijacked room' },
      },
    ];
    resources.bookings = [
      { id: booking.id, path: `/bookings/${booking.id}`, patch: { status: 'CANCELLED' } },
    ];
    resources.payments = [
      { id: payment.id, path: `/payments/${payment.id}`, patch: { reference: 'Hijacked payment' } },
    ];
    resources.invoices = [
      { id: invoice.id, path: `/invoices/${invoice.id}`, patch: { balance: 0 } },
    ];
    resources.products = [
      {
        id: product.id,
        path: `/catalog/${product.id}`,
        patch: { name: 'Hijacked product' },
        removePath: `/catalog/${product.id}/archive`,
      },
    ];
    resources.movements = [
      {
        id: product.id,
        path: `/inventory/${product.id}/movements`,
        patch: {},
        removePath: `/inventory/${product.id}/movements`,
      },
    ];
    resources.expenses = [
      {
        id: expense.id,
        path: `/expenses/${expense.id}`,
        patch: { categoryId: expenseCategory.id, amount: '1.00', expenseDate: '2020-01-01' },
      },
    ];
    resources.expenseCategories = [
      {
        id: expenseCategory.id,
        path: `/expenses/categories/${expenseCategory.id}`,
        patch: { name: 'Hijacked category' },
      },
    ];
    resources.sales = [
      { id: sale.id, path: `/sales/${sale.id}`, patch: {}, removePath: `/sales/${sale.id}` },
    ];
    resources.receipts = [
      { id: sale.id, path: `/receipts/${sale.id}`, patch: {}, removePath: `/receipts/${sale.id}` },
    ];
    resources.catalogCategories = [
      { id: catalogCategory.id, path: '/catalog/categories', patch: {} },
    ];
    resources.activityLogs = [
      { id: activityLog.id, path: '/activity', patch: {}, removePath: '/activity' },
    ];
    resources.businesses = [
      { id: businessId, path: '/businesses/profile', patch: {}, removePath: '/businesses/profile' },
    ];
    resources.businessModules = [
      {
        id: businessId,
        path: '/businesses/modules',
        patch: { module: 'RETAIL', isEnabled: false },
        removePath: '/businesses/modules',
      },
    ];
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      for (const businessId of businessIds) {
        await prisma.activityLog.deleteMany({ where: { businessId } });
        await prisma.invoice.deleteMany({ where: { businessId } });
        await prisma.payment.deleteMany({ where: { businessId } });
        await prisma.booking.deleteMany({ where: { businessId } });
        await prisma.stockMovement.deleteMany({ where: { businessId } });
        await prisma.saleItem.deleteMany({ where: { businessId } });
        await prisma.sale.deleteMany({ where: { businessId } });
        await prisma.expense.deleteMany({ where: { businessId } });
        await prisma.expenseCategory.deleteMany({ where: { businessId } });
        await prisma.customer.deleteMany({ where: { businessId } });
        await prisma.product.deleteMany({ where: { businessId } });
        await prisma.catalogCategory.deleteMany({ where: { businessId } });
        await prisma.businessModule.deleteMany({ where: { businessId } });
        await prisma.room.deleteMany({ where: { businessId } });
        await prisma.property.deleteMany({ where: { businessId } });
        await prisma.business.deleteMany({ where: { id: businessId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it.each(['customers', 'properties', 'rooms', 'bookings', 'payments', 'invoices'])(
    'rejects Business A GET, PATCH, and DELETE for Business B %s, while preserving the row',
    async (entity) => {
      const record = resources[entity][0];
      const get = await request(app.getHttpServer()).get(record.path).set('Authorization', tokenA);
      expect(get.status).toBe(404);
      console.log(`${entity} GET ${record.path}: HTTP ${get.status}`);
      const patch = await request(app.getHttpServer())
        .patch(record.path)
        .set('Authorization', tokenA)
        .send(record.patch);
      expect(patch.status).toBe(404);
      console.log(`${entity} PATCH ${record.path}: HTTP ${patch.status}`);
      const remove = await request(app.getHttpServer())
        .delete(record.path)
        .set('Authorization', tokenA);
      expect(remove.status).toBe(404);
      console.log(`${entity} DELETE ${record.path}: HTTP ${remove.status}`);

      const where = { id: record.id };
      if (entity === 'customers')
        expect((await prisma.customer.findUniqueOrThrow({ where })).name).toBe(
          'Business B customer',
        );
      if (entity === 'properties')
        expect((await prisma.property.findUniqueOrThrow({ where })).name).toBe(
          'Business B property',
        );
      if (entity === 'rooms')
        expect((await prisma.room.findUniqueOrThrow({ where })).label).toBe('B-101');
      if (entity === 'bookings')
        expect((await prisma.booking.findUniqueOrThrow({ where })).status).toBe('PENDING');
      if (entity === 'payments')
        expect((await prisma.payment.findUniqueOrThrow({ where })).reference).toBeNull();
      if (entity === 'invoices')
        expect((await prisma.invoice.findUniqueOrThrow({ where })).balance.toString()).toBe('50');
    },
  );

  it('does not return another business customer from list or search', async () => {
    const list = await request(app.getHttpServer())
      .get('/customers')
      .set('Authorization', tokenA)
      .expect(200);
    const search = await request(app.getHttpServer())
      .get('/customers?q=Business%20B%20customer')
      .set('Authorization', tokenA)
      .expect(200);
    expect(list.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Business B customer' })]),
    );
    expect(search.body).toEqual([]);
  });

  it('keeps booking lists tenant scoped and rejects foreign rooms, customers, and booking actions', async () => {
    const list = await request(app.getHttpServer())
      .get('/bookings?page=1&pageSize=10')
      .set('Authorization', tokenA)
      .expect(200);
    expect(list.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: resources.bookings[0].id })]),
    );

    const memberA = await prisma.businessMember.findFirstOrThrow({
      where: { businessId: businessAId },
    });
    const propertyA = await prisma.property.create({
      data: {
        businessId: businessAId,
        ownerId: memberA.userId,
        name: 'Business A booking property',
        address: 'A address',
      },
    });
    const roomA = await prisma.room.create({
      data: {
        businessId: businessAId,
        propertyId: propertyA.id,
        label: 'A-101',
        type: 'Standard',
        capacity: 2,
        basePrice: new Prisma.Decimal(80),
      },
    });
    const customerA = await prisma.customer.create({
      data: {
        businessId: businessAId,
        name: 'Business A booking customer',
        phone: '+2348022222222',
      },
    });
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', tokenA)
      .send({
        roomId: resources.rooms[0].id,
        customerId: customerA.id,
        checkIn: '2031-04-01',
        checkOut: '2031-04-02',
      })
      .expect(404);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', tokenA)
      .send({
        roomId: roomA.id,
        customerId: resources.customers[0].id,
        checkIn: '2031-04-01',
        checkOut: '2031-04-02',
      })
      .expect(404);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', tokenA)
      .send({
        businessId: resources.businesses[0].id,
        roomId: roomA.id,
        customerId: customerA.id,
        checkIn: '2031-04-01',
        checkOut: '2031-04-02',
      })
      .expect(400);

    for (const action of ['check-in', 'check-out', 'cancel', 'no-show']) {
      await request(app.getHttpServer())
        .post(`/bookings/${resources.bookings[0].id}/${action}`)
        .set('Authorization', tokenA)
        .expect(404);
    }
  });

  it('keeps catalog, inventory, sales, receipts, expenses and activity tenant scoped', async () => {
    const catalog = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', tokenA)
      .expect(200);
    const categories = await request(app.getHttpServer())
      .get('/catalog/categories')
      .set('Authorization', tokenA)
      .expect(200);
    const stockable = await request(app.getHttpServer())
      .get('/inventory/products')
      .set('Authorization', tokenA)
      .expect(200);
    const lowStock = await request(app.getHttpServer())
      .get('/inventory/low-stock')
      .set('Authorization', tokenA)
      .expect(200);
    const sales = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', tokenA)
      .expect(200);
    const expenses = await request(app.getHttpServer())
      .get('/expenses')
      .set('Authorization', tokenA)
      .expect(200);
    const expenseCategories = await request(app.getHttpServer())
      .get('/expenses/categories')
      .set('Authorization', tokenA)
      .expect(200);
    const summary = await request(app.getHttpServer())
      .get('/expenses/summary')
      .set('Authorization', tokenA)
      .expect(200);
    const activity = await request(app.getHttpServer())
      .get('/activity')
      .set('Authorization', tokenA)
      .expect(200);
    const dashboard = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', tokenA)
      .expect(200);

    expect(catalog.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productBId })]),
    );
    expect(categories.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'B private product category' })]),
    );
    expect(stockable.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productBId })]),
    );
    expect(lowStock.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productBId })]),
    );
    expect(sales.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: saleBId })]),
    );
    expect(expenses.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: expenseBId })]),
    );
    expect(expenseCategories.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'B private expense category' })]),
    );
    expect(summary.body.total).toBe('0');
    expect(activity.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'private-test-event' })]),
    );
    expect(dashboard.body).toMatchObject({
      revenue: '0.00',
      expenses: '0.00',
      outstandingPayments: '0.00',
      lowStock: 0,
    });
    expect(dashboard.body.moduleCards).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ module: 'RETAIL', value: 1 })]),
    );
    const historicDashboard = await request(app.getHttpServer())
      .get('/dashboard/summary?date=2030-01-01')
      .set('Authorization', tokenA)
      .expect(200);
    expect(historicDashboard.body.occupancy).toMatchObject({ occupiedRooms: 0, reservedRooms: 0, totalBookableRooms: 1 });
    expect(historicDashboard.body.arrivalsToday).toBe(0);
    expect(historicDashboard.body.departuresToday).toBe(0);

    await request(app.getHttpServer())
      .get(`/catalog/${productBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/catalog/${productBId}`)
      .set('Authorization', tokenA)
      .send({ name: 'x' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/catalog/${productBId}/archive`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/inventory/${productBId}/current`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/inventory/${productBId}/movements`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/sales/${saleBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/sales/${saleBId}`)
      .set('Authorization', tokenA)
      .send({ guestName: 'Hijacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/sales/${saleBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/sales/${saleBId}/items/${saleItemBId}`)
      .set('Authorization', tokenA)
      .send({ quantity: 99 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/sales/${saleBId}/items/${saleItemBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/receipts/${saleBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/receipts/${saleBId}`)
      .set('Authorization', tokenA)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/receipts/${saleBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/inventory/${productBId}/movements`)
      .set('Authorization', tokenA)
      .send({ quantity: 99 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/inventory/${productBId}/movements`)
      .set('Authorization', tokenA)
      .expect(404);
    const catalogCategoryId = resources.catalogCategories[0].id;
    await request(app.getHttpServer())
      .get(`/catalog/categories/${catalogCategoryId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/catalog/categories/${catalogCategoryId}`)
      .set('Authorization', tokenA)
      .send({ name: 'Hijacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/catalog/categories/${catalogCategoryId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/activity/${activityLogBId}`)
      .set('Authorization', tokenA)
      .send({ action: 'Hijacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/activity/${activityLogBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/expenses/${expenseBId}`)
      .set('Authorization', tokenA)
      .send({ categoryId: expenseCategoryBId, amount: '1.00', expenseDate: '2020-01-01' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/expenses/${expenseBId}`)
      .set('Authorization', tokenA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/expenses/categories/${expenseCategoryBId}`)
      .set('Authorization', tokenA)
      .send({ name: 'Hijacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/expenses/categories/${expenseCategoryBId}`)
      .set('Authorization', tokenA)
      .expect(404);

    const profile = await request(app.getHttpServer())
      .get('/businesses/profile')
      .set('Authorization', tokenA)
      .expect(200);
    expect(profile.body.name).not.toBe(businessBName);
    const modules = await request(app.getHttpServer())
      .get('/businesses/modules')
      .set('Authorization', tokenA)
      .expect(200);
    expect(modules.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ businessId: resources.businesses[0].id })]),
    );
    await request(app.getHttpServer())
      .patch('/businesses/modules')
      .set('Authorization', tokenA)
      .send({ module: 'RETAIL', isEnabled: false })
      .expect(200);
    expect(
      (
        await prisma.businessModule.findUniqueOrThrow({
          where: {
            businessId_module: {
              businessId: resources.businesses[0].id,
              module: BusinessModuleType.RETAIL,
            },
          },
        })
      ).isEnabled,
    ).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productBId } })).name).toBe(
      'B private product',
    );
    expect(
      (await prisma.expense.findUniqueOrThrow({ where: { id: expenseBId } })).amount.toString(),
    ).toBe('777');
    expect(
      (await prisma.expenseCategory.findUniqueOrThrow({ where: { id: expenseCategoryBId } })).name,
    ).toBe('B private expense category');
    expect(
      (
        await prisma.catalogCategory.findUniqueOrThrow({
          where: { id: resources.catalogCategories[0].id },
        })
      ).name,
    ).toBe('B private catalog category');
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleBId } })).status).toBe(
      'COMPLETED',
    );
    expect(
      (
        await prisma.activityLog.findFirstOrThrow({
          where: { businessId: resources.businesses[0].id },
        })
      ).action,
    ).toBe('private-test-event');
  });

  it('returns 200 from /health when the real Postgres database is up', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'ok' });
  });

  it('hides invoice details and rejects payment writes across businesses', async () => {
    const invoice = resources.invoices[0];
    await request(app.getHttpServer()).get(invoice.path).set('Authorization', tokenA).expect(404);
    await request(app.getHttpServer()).get(`${invoice.path}/payments`).set('Authorization', tokenA).expect(404);
    await request(app.getHttpServer()).post(`${invoice.path}/payments`).set('Authorization', tokenA)
      .send({ amount: '1.00', method: 'CASH', reference: 'cross-tenant' }).expect(404);
  });
});
