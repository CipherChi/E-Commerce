import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import { HealthController } from '../src/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health routes (e2e)', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    app = module.createNestApplication();
    app.use(requestIdMiddleware);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => prisma.$queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]));

  it('returns liveness and a generated request ID without querying the database', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness only when the database is available', async () => {
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ok', database: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    await request(app.getHttpServer()).get('/health/ready').expect(500);
  });
});
