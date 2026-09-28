import { deriveInvoiceFinancials } from './invoice-financials';
import { Prisma } from '@prisma/client';
describe('deriveInvoiceFinancials', () => {
  it('derives partial and paid balances with Decimal arithmetic', () => {
    expect(deriveInvoiceFinancials(new Prisma.Decimal('10.10'), [new Prisma.Decimal('2.35')])).toMatchObject({ amountPaid: new Prisma.Decimal('2.35'), balance: new Prisma.Decimal('7.75'), status: 'PARTIAL' });
    expect(deriveInvoiceFinancials(new Prisma.Decimal('10.10'), [new Prisma.Decimal('10.10')]).status).toBe('PAID');
  });
  it('marks void invoices without including their balance', () => {
    expect(deriveInvoiceFinancials(new Prisma.Decimal('10'), [], true).status).toBe('VOID');
  });
});
