import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

describe('ReceiptsController public throttling', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [ReceiptsController],
      providers: [{ provide: ReceiptsService, useValue: {
        publicReceipt: jest.fn().mockResolvedValue({ receiptNumber: 'RCT-1' }),
        pdf: jest.fn().mockResolvedValue({ receiptNumber: 'RCT-1', buffer: Buffer.from('%PDF') }),
        tenantReceipt: jest.fn(),
      } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('rate limits public receipt lookups', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app.getHttpServer()).get('/receipts/public/token-a').expect(200);
    }
    await request(app.getHttpServer()).get('/receipts/public/token-a').expect(429);
  });
});
