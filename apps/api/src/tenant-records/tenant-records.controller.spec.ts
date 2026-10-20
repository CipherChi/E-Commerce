import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantRecordsController } from './tenant-records.controller';
import { TenantRecordsService } from './tenant-records.service';

class RequestRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { businessId: 'business-a', sub: 'user-a', role: req.headers['x-role'] ?? 'STAFF' };
    return true;
  }
}

describe('TenantRecordsController policy', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantRecordsController],
      providers: [
        { provide: TenantRecordsService, useValue: { get: jest.fn().mockResolvedValue({ id: 'payment-a' }), update: jest.fn(), remove: jest.fn() } },
        BusinessContextGuard,
        RolesGuard,
      ],
    }).overrideGuard(JwtAuthGuard).useClass(RequestRoleGuard).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('requires OWNER to view a payment by ID', async () => {
    await request(app.getHttpServer()).get('/payments/payment-a').set('x-role', 'STAFF').expect(403);
    await request(app.getHttpServer()).get('/payments/payment-a').set('x-role', 'OWNER').expect(200);
  });
});
