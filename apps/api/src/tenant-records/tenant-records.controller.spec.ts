import * as request from 'supertest';
import { createApp } from '../app';

describe('TenantRecordsController policy', () => {
  let membershipRole = 'STAFF';
  const prisma = {
    businessMember: { findFirst: jest.fn(({ where }: any) => where.isActive ? { businessId: 'business-a', role: membershipRole } : { id: 'membership-a' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, tokenVersion: 0 }) },
  };
  const methods = new Proxy({}, { get: () => jest.fn().mockResolvedValue({ id: 'payment-a' }) });
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

  it('requires OWNER to view a payment by ID', async () => {
    const get = () => request(app).get('/payments/payment-a').set('Authorization', 'Bearer test-token');
    await get().expect(403);
    membershipRole = 'OWNER';
    await get().expect(200);
  });
});
