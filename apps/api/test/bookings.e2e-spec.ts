import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const databaseUrl = process.env.TENANT_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('Set TENANT_TEST_DATABASE_URL to a dedicated migrated Postgres test database.');
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = 'booking-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'booking-test-refresh-secret';

describe('Booking engine (real Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let businessId: string;
  let userId: string;
  let token: string;
  let propertyId: string;
  let roomId: string;
  let customerId: string;

  function createBooking(checkIn: string, checkOut: string, room = roomId) {
    return request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', token)
      .send({ roomId: room, customerId, checkIn, checkOut });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `booking-${suffix}@example.test`;
    const password = 'booking-test-password-123';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Booking tester', primaryType: 'HOTEL' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
    await prisma.user.update({ where: { id: userId }, data: { role: Role.ADMIN } });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    token = `Bearer ${login.body.accessToken}`;
    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', token)
      .send({
        name: `Booking test ${suffix}`,
        primaryType: 'HOTEL',
        phone: '+2348099999999',
        address: 'Booking test address',
      })
      .expect(201);
    businessId = business.body.id;
    const property = await request(app.getHttpServer())
      .post('/properties')
      .set('Authorization', token)
      .send({ name: 'Booking property', address: 'Booking test address', type: 'HOTEL' })
      .expect(201);
    propertyId = property.body.id;
    const room = await request(app.getHttpServer())
      .post(`/properties/${propertyId}/rooms`)
      .set('Authorization', token)
      .send({ label: '101', type: 'Standard', capacity: 2, basePrice: 100.25 })
      .expect(201);
    roomId = room.body.id;
    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', token)
      .send({ name: 'Booking customer', phone: '+2348012345678' })
      .expect(201);
    customerId = customer.body.id;
  }, 30000);

  afterAll(async () => {
    if (prisma && businessId) {
      await prisma.invoice.deleteMany({ where: { businessId } });
      await prisma.payment.deleteMany({ where: { businessId } });
      await prisma.booking.deleteMany({ where: { businessId } });
      await prisma.customer.deleteMany({ where: { businessId } });
      await prisma.room.deleteMany({ where: { businessId } });
      await prisma.property.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app?.close();
  });

  it('supports the property and room list/create flows and creates a Decimal stay total', async () => {
    const propertyList = await request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', token)
      .expect(200);
    expect(propertyList.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: propertyId })]),
    );
    const roomList = await request(app.getHttpServer())
      .get(`/properties/${propertyId}/rooms`)
      .set('Authorization', token)
      .expect(200);
    expect(roomList.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: roomId, status: 'AVAILABLE' })]),
    );

    const booking = await createBooking('2031-01-01', '2031-01-04').expect(201);
    expect(booking.body.totalAmount).toBe('300.75');
    expect(booking.body.businessId).toBe(businessId);
    expect(booking.body.roomId).toBe(roomId);
  });

  it('allows turnover on checkout day, rejects one-night overlap, and lets cancellation free dates', async () => {
    await createBooking('2031-02-01', '2031-02-03').expect(201);
    await createBooking('2031-02-03', '2031-02-05').expect(201);
    await createBooking('2031-02-02', '2031-02-04').expect(409);

    const cancellable = await createBooking('2031-02-10', '2031-02-12').expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${cancellable.body.id}/cancel`)
      .set('Authorization', token)
      .expect(201);
    await createBooking('2031-02-10', '2031-02-12').expect(201);

    const noShow = await createBooking('2031-02-20', '2031-02-22').expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${noShow.body.id}/confirm`)
      .set('Authorization', token)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${noShow.body.id}/no-show`)
      .set('Authorization', token)
      .expect(201);
    await createBooking('2031-02-20', '2031-02-22').expect(201);
  });

  it('allows exactly one of concurrent overlapping creates and returns 409 for all others', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createBooking('2031-03-01', '2031-03-04')),
    );
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(7);
  });

  it('rejects overlapping direct SQL inserts with the exclusion constraint', async () => {
    await createBooking('2031-04-01', '2031-04-03').expect(201);
    const rawId = `raw-overlap-${Date.now()}`;
    await expect(
      prisma.$executeRaw`INSERT INTO "Booking" ("id", "businessId", "roomId", "customerId", "checkIn", "checkOut", "status", "totalAmount", "source", "createdAt") VALUES (${rawId}, ${businessId}, ${roomId}, ${customerId}, ${new Date('2031-04-02T00:00:00Z')}::date, ${new Date('2031-04-04T00:00:00Z')}::date, 'PENDING', 200, 'WALK_IN', NOW())`,
    ).rejects.toThrow();
  });

  it('rejects overlapping date updates and reports date-based availability', async () => {
    await createBooking('2031-05-01', '2031-05-04').expect(201);
    const secondRoom = await request(app.getHttpServer())
      .post(`/properties/${propertyId}/rooms`)
      .set('Authorization', token)
      .send({ label: '102', type: 'Standard', capacity: 2, basePrice: 200 })
      .expect(201);
    const candidate = await createBooking('2031-05-10', '2031-05-12', secondRoom.body.id).expect(
      201,
    );
    await request(app.getHttpServer())
      .patch(`/bookings/${candidate.body.id}`)
      .set('Authorization', token)
      .send({ roomId, checkIn: '2031-05-03', checkOut: '2031-05-05' })
      .expect(409);
    const availability = await request(app.getHttpServer())
      .get(`/bookings/availability?roomId=${roomId}&checkIn=2031-05-03&checkOut=2031-05-05`)
      .set('Authorization', token)
      .expect(200);
    expect(availability.body).toMatchObject({ available: false });
  });

  it('enforces transitions and updates room status atomically on check-in and check-out', async () => {
    const booking = await createBooking('2031-06-01', '2031-06-02').expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${booking.body.id}/check-in`)
      .set('Authorization', token)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/bookings/${booking.body.id}/confirm`)
      .set('Authorization', token)
      .expect(201);
    const checkedIn = await request(app.getHttpServer())
      .post(`/bookings/${booking.body.id}/check-in`)
      .set('Authorization', token)
      .expect(201);
    expect(checkedIn.body.status).toBe('CHECKED_IN');
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe(
      'OCCUPIED',
    );
    const checkedOut = await request(app.getHttpServer())
      .post(`/bookings/${booking.body.id}/check-out`)
      .set('Authorization', token)
      .expect(201);
    expect(checkedOut.body.status).toBe('CHECKED_OUT');
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe(
      'CLEANING',
    );
    await request(app.getHttpServer())
      .post(`/bookings/${booking.body.id}/cancel`)
      .set('Authorization', token)
      .expect(409);
  });

  it('filters and paginates list results by tenant, dates, status, room, and customer', async () => {
    const booking = await createBooking('2031-07-01', '2031-07-02').expect(201);
    const result = await request(app.getHttpServer())
      .get(
        `/bookings?from=2031-07-01&to=2031-07-03&status=PENDING&roomId=${roomId}&customerId=${customerId}&page=1&pageSize=1`,
      )
      .set('Authorization', token)
      .expect(200);
    expect(result.body).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(result.body.data[0].id).toBe(booking.body.id);
  });
});
