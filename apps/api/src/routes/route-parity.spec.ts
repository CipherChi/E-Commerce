import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as request from 'supertest';
import { createApp } from '../app';

const planPath = resolve(__dirname, '../../../../docs/api-routes.md');
const routes = [...readFileSync(planPath, 'utf8').matchAll(/^\| (GET|POST|PATCH|DELETE) \| (\/[^|]+) \| ([^|]+) \|/gm)]
  .map((match) => ({
    method: match[1].toLowerCase() as 'get' | 'post' | 'patch' | 'delete',
    path: match[2].trim(),
    guards: match[3],
    protected: /JWT/.test(match[3]),
    business: /BC/.test(match[3]),
    admin: /R\(ADMIN\)/.test(match[3]),
  }));

const responseFixtures: Record<string, Record<string, unknown>> = {
  businesses: { create: { id: 'business-1', name: 'Contract Business', primaryType: 'HOTEL' } },
  properties: { create: { id: 'property-1', name: 'Contract Property', address: '1 Main Street' } },
  bookings: { create: { id: 'booking-1', status: 'PENDING', totalAmount: '100.00' } },
  payments: { record: { id: 'payment-1', amount: '100.00', method: 'CASH' } },
  inventory: { stockIn: { id: 'movement-1', quantity: 5, type: 'IN' } },
  sales: { create: { id: 'sale-1', total: '100.00', items: [] } },
  expenses: { create: { id: 'expense-1', amount: '10.00', description: 'Test expense' } },
};

describe('documented route parity', () => {
  const environment = { DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret-32-characters-long-000', JWT_REFRESH_SECRET: 'refresh-secret-32-characters-long-000', WEB_ORIGIN: 'http://localhost:3000', NODE_ENV: 'test' };
  const controllers = new Proxy({}, {
    get: (_target, controller: string) => new Proxy({}, {
      get: (_methods, method: string) => method === 'publicPdf'
        ? (_token: string, res: { status: (code: number) => { send: (data: string) => void } }) => res.status(200).send('pdf')
        : jest.fn().mockResolvedValue(responseFixtures[controller]?.[method] ?? { ok: true }),
    }),
  });
  const auth = {
    register: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } }),
    login: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } }),
    refresh: jest.fn(), logout: jest.fn(), me: jest.fn(),
  };
  const logger = { log: jest.fn(), error: jest.fn() };
  const memberships = new Map([
    ['owner', { businessId: 'business-1', role: 'OWNER' }],
    ['staff', { businessId: 'business-1', role: 'STAFF' }],
  ]);
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    businessMember: {
      findFirst: jest.fn(({ where }: any) => {
        const membership = memberships.get(where.userId);
        return 'isActive' in where ? membership ?? null : membership ? { id: 'membership-1' } : null;
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, tokenVersion: 0 }) },
  };
  const jwt = {
    verifyAsync: jest.fn((token: string) => ({ sub: token === 'owner-token' ? 'owner' : token === 'staff-token' ? 'staff' : 'no-business', tokenVersion: 0 })),
  };
  const app = createApp({ environment, logger, dependencies: {
    prisma: prisma as never,
    jwt: jwt as never,
    auth: auth as never,
    controllers: controllers as never,
  } as never });

  it('covers every route in the migration plan and protects JWT routes', async () => {
    expect(routes).toHaveLength(83);
    for (const route of routes) {
      const path = route.path.replace(/:([A-Za-z]+)/g, 'fixture');
      let call = request(app)[route.method](path);
      if (route.protected) {
        const response = await call;
        expect(response.status).toBe(401);
      } else {
        if (path === '/auth/refresh') call = call.set('Origin', environment.WEB_ORIGIN);
        if (path === '/auth/register') call = call.send({ email: 'a@example.com', password: 'long-password-123', name: 'A', primaryType: 'HOTEL' });
        if (path === '/auth/login') call = call.send({ email: 'a@example.com', password: 'long-password' });
        const response = await call;
        expect(response.status).not.toBe(404);
      }
    }
  });

  it('rejects missing business context wherever the Nest inventory required it', async () => {
    const businessRoutes = routes.filter((route) => route.business);
    expect(businessRoutes.length).toBeGreaterThan(0);
    for (const route of businessRoutes) {
      const response = await request(app)[route.method](route.path.replace(/:([A-Za-z]+)/g, 'fixture'))
        .set('Authorization', 'Bearer no-business-token');
      expect(response.status).toBe(403);
      expect(response.body.message).toMatchObject({ statusCode: 403, message: 'Create or join a business first' });
    }
  });

  it('rejects non-owner roles wherever the Nest inventory required ADMIN/OWNER access', async () => {
    const adminRoutes = routes.filter((route) => route.admin);
    expect(adminRoutes.length).toBeGreaterThan(0);
    for (const route of adminRoutes) {
      const response = await request(app)[route.method](route.path.replace(/:([A-Za-z]+)/g, 'fixture'))
        .set('Authorization', 'Bearer staff-token');
      expect(response.status).toBe(403);
    }
  });

  it('preserves representative success statuses and response keys across route groups', async () => {
    const login = await request(app).post('/auth/login').send({ email: 'a@example.com', password: 'password123' }).expect(201);
    expect(login.body).toEqual({ accessToken: 'a' });
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');

    const cases = [
      { path: '/businesses', body: { name: 'Contract Business', primaryType: 'HOTEL' }, expected: { id: 'business-1', name: 'Contract Business', primaryType: 'HOTEL' } },
      { path: '/properties', body: { name: 'Contract Property', address: '1 Main Street' }, expected: { id: 'property-1', name: 'Contract Property', address: '1 Main Street' } },
      { path: '/bookings', body: { roomId: 'room-1', customerId: 'customer-1', checkIn: '2026-11-01', checkOut: '2026-11-02' }, expected: { id: 'booking-1', status: 'PENDING', totalAmount: '100.00' } },
      { path: '/invoices/invoice-1/payments', body: { amount: '100.00', method: 'CASH' }, expected: { id: 'payment-1', amount: '100.00', method: 'CASH' } },
      { path: '/inventory/stock-in', body: { productId: 'product-1', quantity: 5 }, expected: { id: 'movement-1', quantity: 5, type: 'IN' } },
      { path: '/sales', body: { paymentMethod: 'CASH', paymentStatus: 'PAID', amountPaid: '100.00', items: [{ productId: 'product-1', quantity: 1 }] }, expected: { id: 'sale-1', total: '100.00', items: [] }, idempotency: true },
      { path: '/expenses', body: { categoryId: 'category-1', amount: '10.00', description: 'Test expense', expenseDate: '2026-10-31' }, expected: { id: 'expense-1', amount: '10.00', description: 'Test expense' } },
    ];
    for (const testCase of cases) {
      const response = await request(app).post(testCase.path)
        .set('Authorization', 'Bearer owner-token')
        .set(testCase.idempotency ? 'Idempotency-Key' : 'X-Contract-Test', testCase.idempotency ? 'contract-test-1' : 'true')
        .send(testCase.body)
        .expect(201);
      expect(response.body).toEqual(testCase.expected);
    }
  });

  it('returns the shared 400 envelope for invalid and unknown representative request fields', async () => {
    const cases = [
      { path: '/businesses', valid: { name: 'Business', primaryType: 'HOTEL' }, invalid: { name: '', primaryType: 'HOTEL' } },
      { path: '/properties', valid: { name: 'Property', address: '1 Main Street' }, invalid: { name: 'Property', address: '' } },
      { path: '/bookings', valid: { roomId: 'room-1', customerId: 'customer-1', checkIn: '2026-11-01', checkOut: '2026-11-02' }, invalid: { roomId: 'room-1', customerId: 'customer-1', checkIn: 'bad-date', checkOut: '2026-11-02' } },
      { path: '/invoices/invoice-1/payments', valid: { amount: '1.00', method: 'CASH' }, invalid: { amount: 'bad-amount', method: 'CASH' } },
      { path: '/inventory/stock-in', valid: { productId: 'product-1', quantity: 1 }, invalid: { productId: 'product-1', quantity: 0 } },
      { path: '/sales', valid: { paymentMethod: 'CASH', paymentStatus: 'PAID', items: [{ productId: 'product-1', quantity: 1 }] }, invalid: { paymentMethod: 'CASH', paymentStatus: 'PAID', items: [] }, idempotency: true },
      { path: '/expenses', valid: { categoryId: 'category-1', amount: '1.00', expenseDate: '2026-10-31' }, invalid: { categoryId: 'category-1', amount: 'bad-amount', expenseDate: '2026-10-31' } },
    ];
    for (const testCase of cases) {
      for (const body of [testCase.invalid, { ...testCase.valid, unexpectedField: true }]) {
        const response = await request(app).post(testCase.path)
          .set('Authorization', 'Bearer owner-token')
          .set(testCase.idempotency ? 'Idempotency-Key' : 'X-Contract-Test', testCase.idempotency ? 'contract-test-2' : 'true')
          .send(body)
          .expect(400);
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: { statusCode: 400, error: 'Bad Request', message: expect.any(Array) },
          requestId: expect.any(String),
        });
      }
    }
  });

  it('logs matched route templates without query strings', async () => {
    await request(app).get('/properties?search=private').expect(401);
    const entry = JSON.parse(logger.log.mock.calls.at(-1)?.[0] as string);
    expect(entry.path).toBe('/properties/');
    expect(entry.path).not.toContain('private');
  });
});
