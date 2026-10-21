import * as request from 'supertest';
import { createApp } from '../app';

describe('PaymentsController role policy', () => {
  let membershipRole = 'STAFF';
  const prisma = {
    businessMember: { findFirst: jest.fn(({ where }: any) => where.isActive ? { businessId: 'business-a', role: membershipRole } : { id: 'membership-a' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, tokenVersion: 0 }) },
  };
  const methods = new Proxy({}, { get: () => jest.fn().mockResolvedValue({ ok: true }) });
  const app = createApp({
    environment: { DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret', JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:3000' },
    logger: { log: jest.fn(), error: jest.fn() },
    dependencies: {
      prisma: prisma as never,
      jwt: { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-a', email: 'a@example.com', role: 'ADMIN', tokenVersion: 0 }) } as never,
      auth: {} as never,
      controllers: new Proxy({}, { get: () => methods }) as never,
    } as never,
  });

  beforeEach(() => { membershipRole = 'STAFF'; jest.clearAllMocks(); });

  it.each([
    ['/bookings/booking-a/invoice', {}],
    ['/bookings/booking-a/payments', { amount: '1.00', method: 'CASH' }],
    ['/invoices/invoice-a/void', {}],
    ['/invoices/invoice-a/payments', { amount: '1.00', method: 'CASH' }],
  ])('requires an OWNER membership for POST %s', async (path, body) => {
    await request(app).post(path).set('Authorization', 'Bearer test-token').send(body).expect(403);
    membershipRole = 'OWNER';
    const response = await request(app).post(path).set('Authorization', 'Bearer test-token').send(body).expect(201);
    expect(response.body).toEqual({ ok: true });
  });
});
