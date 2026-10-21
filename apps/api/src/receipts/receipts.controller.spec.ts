import * as request from 'supertest';
import { createApp } from '../app';

describe('ReceiptsController public throttling', () => {
  it('rate limits public receipt lookups', async () => {
    const methods = new Proxy({}, { get: () => jest.fn().mockResolvedValue({ saleId: 'sale-1' }) });
    const app = createApp({
      environment: { DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret', JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:3000' },
      logger: { log: jest.fn(), error: jest.fn() },
      dependencies: { prisma: {} as never, jwt: {} as never, auth: {} as never, controllers: new Proxy({}, { get: () => methods }) as never } as never,
    });
    for (let i = 0; i < 20; i++) await request(app).get('/receipts/public/token-a').expect(200);
    const limited = await request(app).get('/receipts/public/token-a').expect(429);
    expect(limited.body).toMatchObject({ statusCode: 429, message: { statusCode: 429, message: 'Too Many Requests' } });
  });
});
