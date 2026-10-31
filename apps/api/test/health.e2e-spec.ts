import { Express } from 'express';
import * as request from 'supertest';
import { createApp } from '../src/app';

describe('Health routes (e2e)', () => {
  let app: Express;
  const prisma = { $queryRaw: jest.fn() };

  beforeAll(async () => {
    const methods = new Proxy({}, { get: () => jest.fn() });
    app = createApp({
      environment: { DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret-32-characters-long-000', JWT_REFRESH_SECRET: 'refresh-secret-32-characters-long-000', WEB_ORIGIN: 'http://localhost:3000' },
      logger: { log: jest.fn(), error: jest.fn() },
      dependencies: { prisma: prisma as never, jwt: {} as never, auth: {} as never, controllers: new Proxy({}, { get: () => methods }) as never } as never,
    });
  });

  afterAll(async () => undefined);

  beforeEach(() => prisma.$queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]));

  it('returns liveness and a generated request ID without querying the database', async () => {
    const response = await request(app).get('/health/live').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness only when the database is available', async () => {
    await request(app).get('/health/ready').expect(200, { status: 'ok', database: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    await request(app).get('/health/ready').expect(500);
  });
});
