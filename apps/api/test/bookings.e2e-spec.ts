import { PrismaClient, Role } from '@prisma/client';
import { Express } from 'express';
import * as request from 'supertest';
import { createApp } from '../src/app';
import { createContainer } from '../src/lib/container';

const databaseUrl = process.env.TENANT_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('Set TENANT_TEST_DATABASE_URL to a dedicated migrated Postgres test database.');
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = 'booking-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'booking-test-refresh-secret';
process.env.TZ = 'Africa/Lagos';

describe('Booking engine (real Postgres)', () => {
  let app: Express;
  let prisma: PrismaClient;
  let businessId: string;
  let userId: string;
  let token: string;
  let propertyId: string;
  let roomId: string;
  let customerId: string;
  let container: ReturnType<typeof createContainer>;

  function createBooking(checkIn: string, checkOut: string, room = roomId) {
    return request(app)
      .post('/bookings')
      .set('Authorization', token)
      .send({ roomId: room, customerId, checkIn, checkOut });
  }

  beforeAll(async () => {
    container = createContainer(process.env);
    prisma = container.prisma;
    await prisma.$connect();
    app = createApp({ dependencies: container });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `booking-${suffix}@example.test`;
    const password = 'booking-test-password-123';
    await request(app)
      .post('/auth/register')
      .send({ email, password, name: 'Booking tester', primaryType: 'HOTEL' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
    await prisma.user.update({ where: { id: userId }, data: { role: Role.ADMIN } });
    const login = await request(app)
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    token = `Bearer ${login.body.accessToken}`;
    const business = await request(app)
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
    const property = await request(app)
      .post('/properties')
      .set('Authorization', token)
      .send({ name: 'Booking property', address: 'Booking test address', type: 'HOTEL' })
      .expect(201);
    propertyId = property.body.id;
    const room = await request(app)
      .post(`/properties/${propertyId}/rooms`)
      .set('Authorization', token)
      .send({ label: '101', type: 'Standard', capacity: 2, basePrice: '100.25' })
      .expect(201);
    roomId = room.body.id;
    const customer = await request(app)
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
    await prisma?.$disconnect();
  });

  it('supports the property and room list/create flows and creates a Decimal stay total', async () => {
    const propertyList = await request(app)
      .get('/properties')
      .set('Authorization', token)
      .expect(200);
    expect(propertyList.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: propertyId })]),
    );
    const roomList = await request(app)
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
    await request(app)
      .post(`/bookings/${cancellable.body.id}/cancel`)
      .set('Authorization', token)
      .expect(201);
    await createBooking('2031-02-10', '2031-02-12').expect(201);

    const noShow = await createBooking('2031-02-20', '2031-02-22').expect(201);
    await request(app)
      .post(`/bookings/${noShow.body.id}/confirm`)
      .set('Authorization', token)
      .expect(201);
    await request(app)
      .post(`/bookings/${noShow.body.id}/no-show`)
      .set('Authorization', token)
      .expect(201);
    await createBooking('2031-02-20', '2031-02-22').expect(201);
  });

  it('round-trips DATE values as Lagos calendar dates and protects booking totals and active bookings', async () => {
    const booking = await createBooking('2031-02-24', '2031-02-25').expect(201);
    expect(booking.body.checkIn).toBe('2031-02-24T00:00:00.000Z');
    expect(booking.body.checkOut).toBe('2031-02-25T00:00:00.000Z');
    await request(app).patch(`/bookings/${booking.body.id}`).set('Authorization', token)
      .send({ totalAmount: '0.01', status: 'CANCELLED' }).expect(400);
    await request(app).delete(`/bookings/${booking.body.id}`).set('Authorization', token).expect(409);

    await prisma.room.update({ where: { id: roomId }, data: { basePrice: '150.00' } });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).totalAmount.toString()).toBe('100.25');
    const changedStay = await request(app).patch(`/bookings/${booking.body.id}`).set('Authorization', token)
      .send({ checkIn: '2031-02-23', checkOut: '2031-02-25' }).expect(200);
    expect(changedStay.body.totalAmount).toBe('300');
    expect(changedStay.body.checkIn).toBe('2031-02-23T00:00:00.000Z');
    await prisma.room.update({ where: { id: roomId }, data: { basePrice: '500.00' } });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).totalAmount.toString()).toBe('300');
    const repricedRoom = await prisma.room.create({ data: { businessId, propertyId, label: '998', type: 'Standard', capacity: 2, basePrice: '250.00' } });
    const moved = await request(app).patch(`/bookings/${booking.body.id}`).set('Authorization', token).send({ roomId: repricedRoom.id }).expect(200);
    expect(moved.body.totalAmount).toBe('500');
  });

  it('rejects booking a room that is out of service', async () => {
    const room = await prisma.room.create({ data: { businessId, propertyId, label: '999', type: 'Standard', capacity: 2, basePrice: '100', status: 'MAINTENANCE' } });
    await createBooking('2031-02-26', '2031-02-27', room.id).expect(422);
  });

  it('serializes concurrent check-in and check-in versus cancellation', async () => {
    const confirmed = await createBooking('2031-06-10', '2031-06-11').expect(201);
    await request(app).post(`/bookings/${confirmed.body.id}/confirm`).set('Authorization', token).expect(201);
    const checkIns = await Promise.all(Array.from({ length: 2 }, () => request(app).post(`/bookings/${confirmed.body.id}/check-in`).set('Authorization', token)));
    expect(checkIns.map(x => x.status).sort()).toEqual([201, 409]);

    const race = await createBooking('2031-06-12', '2031-06-13').expect(201);
    await request(app).post(`/bookings/${race.body.id}/confirm`).set('Authorization', token).expect(201);
    const results = await Promise.all([
      request(app).post(`/bookings/${race.body.id}/check-in`).set('Authorization', token),
      request(app).post(`/bookings/${race.body.id}/cancel`).set('Authorization', token),
    ]);
    expect(results.filter(x => x.status === 201)).toHaveLength(1);
    expect(results.filter(x => x.status === 409)).toHaveLength(1);
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
    const secondRoom = await request(app)
      .post(`/properties/${propertyId}/rooms`)
      .set('Authorization', token)
      .send({ label: '102', type: 'Standard', capacity: 2, basePrice: '200' })
      .expect(201);
    const candidate = await createBooking('2031-05-10', '2031-05-12', secondRoom.body.id).expect(
      201,
    );
    await request(app)
      .patch(`/bookings/${candidate.body.id}`)
      .set('Authorization', token)
      .send({ roomId, checkIn: '2031-05-03', checkOut: '2031-05-05' })
      .expect(409);
    const availability = await request(app)
      .get(`/bookings/availability?roomId=${roomId}&checkIn=2031-05-03&checkOut=2031-05-05`)
      .set('Authorization', token)
      .expect(200);
    expect(availability.body).toMatchObject({ available: false });
  });

  it('enforces transitions and updates room status atomically on check-in and check-out', async () => {
    const booking = await createBooking('2031-06-01', '2031-06-02').expect(201);
    await request(app)
      .post(`/bookings/${booking.body.id}/check-in`)
      .set('Authorization', token)
      .expect(409);
    await request(app)
      .post(`/bookings/${booking.body.id}/confirm`)
      .set('Authorization', token)
      .expect(201);
    const checkedIn = await request(app)
      .post(`/bookings/${booking.body.id}/check-in`)
      .set('Authorization', token)
      .expect(201);
    expect(checkedIn.body.status).toBe('CHECKED_IN');
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe(
      'OCCUPIED',
    );
    const checkedOut = await request(app)
      .post(`/bookings/${booking.body.id}/check-out`)
      .set('Authorization', token)
      .expect(201);
    expect(checkedOut.body.status).toBe('CHECKED_OUT');
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe(
      'CLEANING',
    );
    await request(app)
      .post(`/bookings/${booking.body.id}/cancel`)
      .set('Authorization', token)
      .expect(409);
  });

  it('filters and paginates list results by tenant, dates, status, room, and customer', async () => {
    const booking = await createBooking('2031-07-01', '2031-07-02').expect(201);
    const result = await request(app)
      .get(
        `/bookings?from=2031-07-01&to=2031-07-03&status=PENDING&roomId=${roomId}&customerId=${customerId}&page=1&pageSize=1`,
      )
      .set('Authorization', token)
      .expect(200);
    expect(result.body).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(result.body.data[0].id).toBe(booking.body.id);
  });

  it('creates invoices, derives payment balances, serializes concurrent overpayments, and is idempotent by reference', async () => {
    const paymentRoom = await prisma.room.create({ data: { businessId, propertyId, label: 'payment-test', type: 'Standard', capacity: 2, basePrice: '100.25' } });
    const booking = await createBooking('2031-08-01', '2031-08-02', paymentRoom.id).expect(201);
    const invoice = await request(app).post(`/bookings/${booking.body.id}/invoice`).set('Authorization', token).expect(201);
    expect(invoice.body).toMatchObject({ status: 'UNPAID', balance: '100.25', amountPaid: '0' });
    await request(app).patch(`/invoices/${invoice.body.id}`).set('Authorization', token).send({ status: 'PAID' }).expect(400);
    const concurrent = await Promise.all([
      request(app).post(`/invoices/${invoice.body.id}/payments`).set('Authorization', token).send({ amount: '60.00', method: 'CASH' }),
      request(app).post(`/invoices/${invoice.body.id}/payments`).set('Authorization', token).send({ amount: '60.00', method: 'CASH' }),
    ]);
    expect(concurrent.map(result => result.status).sort()).toEqual([201, 409]);
    const partial = await request(app).get(`/invoices/${invoice.body.id}`).set('Authorization', token).expect(200);
    expect(partial.body.status).toBe('PARTIAL');
    expect(partial.body.balance).toBe('40.25');
    const dashboardPartial = await request(app).get('/dashboard/summary').set('Authorization', token).expect(200);
    expect(dashboardPartial.body).toMatchObject({ collectedPayments: '60.00', outstandingPayments: '40.25' });
    const recorded = await request(app).get(`/invoices/${invoice.body.id}/payments`).set('Authorization', token).expect(200);
    await request(app).patch(`/payments/${recorded.body[0].id}`).set('Authorization', token).send({ amount: '0.01' }).expect(400);
    await request(app).delete(`/payments/${recorded.body[0].id}`).set('Authorization', token).expect(400);
    const repeated = await Promise.all([1, 2].map(() => request(app).post(`/invoices/${invoice.body.id}/payments`).set('Authorization', token).send({ amount: '40.25', method: 'TRANSFER', reference: 'same-reference' })));
    expect(repeated.map(result => result.status)).toEqual([201, 201]);
    expect((await prisma.payment.count({ where: { bookingId: booking.body.id, reference: 'same-reference' } })).toString()).toBe('1');
    const paid = await request(app).get(`/invoices/${invoice.body.id}`).set('Authorization', token).expect(200);
    expect(paid.body).toMatchObject({ status: 'PAID', balance: '0' });
    const dashboardPaid = await request(app).get('/dashboard/summary').set('Authorization', token).expect(200);
    expect(dashboardPaid.body).toMatchObject({ collectedPayments: '100.25', outstandingPayments: '0.00' });
    await request(app).delete(`/invoices/${invoice.body.id}`).set('Authorization', token).expect(400);
  });

  it('keeps an unpaid invoice in sync with booking repricing and blocks repricing after a payment', async () => {
    const repricedRoom = await prisma.room.create({ data: { businessId, propertyId, label: 'invoice-reprice', type: 'Standard', capacity: 2, basePrice: '75.00' } });
    const booking = await createBooking('2031-09-01', '2031-09-02', repricedRoom.id).expect(201);
    const invoice = await request(app).post(`/bookings/${booking.body.id}/invoice`).set('Authorization', token).expect(201);
    await request(app).patch(`/bookings/${booking.body.id}`).set('Authorization', token).send({ checkOut: '2031-09-03' }).expect(200);
    const updatedInvoice = await request(app).get(`/invoices/${invoice.body.id}`).set('Authorization', token).expect(200);
    expect(updatedInvoice.body).toMatchObject({ totalAmount: '150', balance: '150', status: 'UNPAID' });
    await request(app).post(`/invoices/${invoice.body.id}/payments`).set('Authorization', token).send({ amount: '10.00', method: 'CASH' }).expect(201);
    await request(app).patch(`/bookings/${booking.body.id}`).set('Authorization', token).send({ checkOut: '2031-09-04' }).expect(409);
  });
});

