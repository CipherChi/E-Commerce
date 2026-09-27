import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const databaseUrl = process.env.TENANT_TEST_DATABASE_URL;
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
  const resources: Record<string, { path: string; patch: object; id: string }[]> = {};
  let tokenA: string;

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
        .send({ email, password, name: label })
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
          phone: '+2348000000000',
          address: 'Test address',
        })
        .expect(201);
      businessIds.push(business.body.id);
      return { id: user.id, auth, businessId: business.body.id };
    };

    const memberA = await makeMember('member-a');
    tokenA = memberA.auth.Authorization;
    const memberB = await makeMember('member-b');
    const businessId = memberB.businessId;

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
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      for (const businessId of businessIds) {
        await prisma.invoice.deleteMany({ where: { businessId } });
        await prisma.payment.deleteMany({ where: { businessId } });
        await prisma.booking.deleteMany({ where: { businessId } });
        await prisma.customer.deleteMany({ where: { businessId } });
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
      const patch = await request(app.getHttpServer())
        .patch(record.path)
        .set('Authorization', tokenA)
        .send(record.patch);
      expect(patch.status).toBe(404);
      const remove = await request(app.getHttpServer())
        .delete(record.path)
        .set('Authorization', tokenA);
      expect(remove.status).toBe(404);

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
});
