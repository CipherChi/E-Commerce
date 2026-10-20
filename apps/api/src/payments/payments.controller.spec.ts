import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

class RequestRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { businessId: 'business-a', sub: 'user-a', role: req.headers['x-role'] ?? 'STAFF' };
    return true;
  }
}

describe('PaymentsController role policy', () => {
  let app: INestApplication;
  const service = {
    createInvoice: jest.fn().mockResolvedValue({ id: 'invoice-a' }),
    recordBookingPayment: jest.fn().mockResolvedValue({ id: 'invoice-a' }),
    invoice: jest.fn().mockResolvedValue({ id: 'invoice-a' }),
    listForInvoice: jest.fn().mockResolvedValue([]),
    voidInvoice: jest.fn().mockResolvedValue({ id: 'invoice-a', status: 'VOID' }),
    recordPayment: jest.fn().mockResolvedValue({ id: 'invoice-a' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: service },
        BusinessContextGuard,
        RolesGuard,
      ],
    }).overrideGuard(JwtAuthGuard).useClass(RequestRoleGuard).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it.each([
    ['POST', '/bookings/booking-a/invoice'],
    ['POST', '/bookings/booking-a/payments'],
    ['GET', '/invoices/invoice-a'],
    ['GET', '/invoices/invoice-a/payments'],
    ['POST', '/invoices/invoice-a/void'],
    ['POST', '/invoices/invoice-a/payments'],
  ])('%s %s denies STAFF and allows OWNER', async (method, path) => {
    const send = (role: string) => {
      const req = (request(app.getHttpServer()) as any)[method.toLowerCase()](path).set('x-role', role);
      return method === 'POST' && path === '/bookings/booking-a/payments'
        ? req.send({ amount: '1.00', method: 'CASH' })
        : req;
    };
    await send('STAFF').expect(403);
    await send('OWNER').expect(method === 'GET' ? 200 : 201);
  });
});
