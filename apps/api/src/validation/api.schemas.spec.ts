import { BusinessType } from '@prisma/client';
import express = require('express');
import * as request from 'supertest';
import { ZodError } from 'zod';
import { errorHandler } from '../middleware/error-handler';
import { validateBody } from '../middleware/validate';
import { registerSchema } from './auth.schemas';
import { apiValidation, applyApiValidation } from './api.schemas';

describe('API validation compatibility', () => {
  it('accepts an HTTPS logo and bounded business name', () => {
    const request = {
      body: { name: 'n'.repeat(200), primaryType: BusinessType.HOTEL, logo: 'https://cdn.example.test/logo.png' },
      query: undefined,
    };
    expect(() => applyApiValidation('POST', '/businesses', request)).not.toThrow();
  });

  it.each(['http://example.test/logo.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA'])('rejects non-HTTPS logo %s', (logo) => {
    expect(() => apiValidation['POST /businesses'].body?.parse({ name: 'Hotel', primaryType: BusinessType.HOTEL, logo })).toThrow(ZodError);
  });

  it('rejects logos over 2048 characters', () => {
    const logo = `https://example.test/${'a'.repeat(2048)}`;
    expect(() => apiValidation['POST /businesses'].body?.parse({ name: 'Hotel', primaryType: BusinessType.HOTEL, logo })).toThrow(ZodError);
  });

  it('keeps the 400 response envelope for over-length name and notes', async () => {
    const app = express();
    app.use(express.json());
    app.post('/businesses', (req, res, next) => {
      try { applyApiValidation('POST', '/businesses', { body: req.body, query: req.query }); res.sendStatus(201); }
      catch (error) { next(error); }
    });
    app.post('/customers', (req, res, next) => {
      try { applyApiValidation('POST', '/customers', { body: req.body, query: req.query }); res.sendStatus(201); }
      catch (error) { next(error); }
    });
    app.use(errorHandler({ error: jest.fn() }));

    const nameResponse = await request(app).post('/businesses').send({ name: 'n'.repeat(201), primaryType: BusinessType.HOTEL }).expect(400);
    const notesResponse = await request(app).post('/customers').send({ name: 'Guest', phone: '123', notes: 'n'.repeat(2001) }).expect(400);
    for (const response of [nameResponse, notesResponse]) {
      expect(response.body).toMatchObject({ statusCode: 400, message: { statusCode: 400, error: 'Bad Request' }, requestId: null });
      expect(response.body.message.message).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('timestamp');
    }
  });

  it.each([
    ['email', { email: `${'a'.repeat(243)}@example.test`, password: 'long-enough-password', name: 'Guest', primaryType: BusinessType.HOTEL }],
    ['password', { email: 'guest@example.test', password: 'p'.repeat(129), name: 'Guest', primaryType: BusinessType.HOTEL }],
    ['name', { email: 'guest@example.test', password: 'long-enough-password', name: 'n'.repeat(201), primaryType: BusinessType.HOTEL }],
  ])('returns the existing 400 shape for an over-length registration %s', async (_field, body) => {
    const app = express();
    app.use(express.json());
    app.post('/auth/register', validateBody(registerSchema), (_req, res) => res.sendStatus(201));
    app.use(errorHandler({ error: jest.fn() }));
    const response = await request(app).post('/auth/register').send(body).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, message: { statusCode: 400, error: 'Bad Request' }, requestId: null });
    expect(response.body.message.message).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('accepts null for IsOptional and PartialType properties, as class-validator does', () => {
    expect(() => apiValidation['PATCH /customers/:id'].body?.parse({ name: null, email: null })).not.toThrow();
    expect(() => apiValidation['POST /customers'].body?.parse({ name: 'Guest', phone: '123', notes: null })).not.toThrow();
  });

  it('continues to reject unknown properties on decorated DTOs', () => {
    expect(() => apiValidation['POST /customers'].body?.parse({ name: 'Guest', phone: '123', extra: true })).toThrow(ZodError);
  });

  it('validates the staff-active body as a strict boolean object', () => {
    const schema = apiValidation['PATCH /businesses/staff/:userId'].body;
    expect(() => schema?.parse({ isActive: true })).not.toThrow();
    expect(() => schema?.parse({ isActive: 'true' })).toThrow(ZodError);
    expect(() => schema?.parse({ isActive: true, extra: true })).toThrow(ZodError);
  });

  it('keeps PATCH staff activation at 200 and rejects invalid bodies with the API 400 envelope', async () => {
    const app = express();
    app.use(express.json());
    app.patch('/businesses/staff/:userId', (req, res, next) => {
      try { applyApiValidation('PATCH', '/businesses/staff/:userId', { body: req.body, query: req.query }); res.sendStatus(200); }
      catch (error) { next(error); }
    });
    app.use(errorHandler({ error: jest.fn() }));
    const unknown = await request(app).patch('/businesses/staff/u1').send({ isActive: true, extra: true }).expect(400);
    const invalid = await request(app).patch('/businesses/staff/u1').send({ isActive: 'true' }).expect(400);
    expect(unknown.body).toMatchObject({ statusCode: 400, message: { statusCode: 400, error: 'Bad Request' } });
    expect(invalid.body).toMatchObject({ statusCode: 400, message: { statusCode: 400, error: 'Bad Request' } });
    await request(app).patch('/businesses/staff/u1').send({ isActive: true }).expect(200);
  });

  it('rejects impossible ISO calendar dates', () => {
    expect(() => apiValidation['POST /bookings'].body?.parse({
      roomId: 'room', customerId: 'customer', checkIn: '2025-02-30', checkOut: '2025-03-01',
    })).toThrow(ZodError);
  });
});
