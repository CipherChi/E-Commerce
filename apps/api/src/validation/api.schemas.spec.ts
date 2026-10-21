import { BusinessType } from '@prisma/client';
import { ZodError } from 'zod';
import { apiValidation, applyApiValidation } from './api.schemas';

describe('API validation compatibility', () => {
  it('keeps the original DTO rule set without invented maximums or URL restrictions', () => {
    const request = {
      body: { name: 'n'.repeat(201), primaryType: BusinessType.HOTEL, logo: 'legacy-logo-value' },
      query: undefined,
    };
    expect(() => applyApiValidation('POST', '/businesses', request)).not.toThrow();
  });

  it('accepts null for IsOptional and PartialType properties, as class-validator does', () => {
    expect(() => apiValidation['PATCH /customers/:id'].body?.parse({ name: null, email: null })).not.toThrow();
    expect(() => apiValidation['POST /customers'].body?.parse({ name: 'Guest', phone: '123', notes: null })).not.toThrow();
  });

  it('continues to reject unknown properties on decorated DTOs', () => {
    expect(() => apiValidation['POST /customers'].body?.parse({ name: 'Guest', phone: '123', extra: true })).toThrow(ZodError);
  });

  it('does not add validation to the original inline staff-active object parameter', () => {
    const body = { isActive: 'legacy value', extra: true };
    const request = { body, query: undefined };
    expect(() => applyApiValidation('PATCH', '/businesses/staff/:userId', request)).not.toThrow();
    expect(request.body).toBe(body);
  });

  it('rejects impossible ISO calendar dates', () => {
    expect(() => apiValidation['POST /bookings'].body?.parse({
      roomId: 'room', customerId: 'customer', checkIn: '2025-02-30', checkOut: '2025-03-01',
    })).toThrow(ZodError);
  });
});
