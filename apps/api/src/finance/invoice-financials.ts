import { InvoiceStatus, Prisma } from '@prisma/client';

export function deriveInvoiceFinancials(total: Prisma.Decimal, payments: Prisma.Decimal[], voided = false) {
  const paid = payments.reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0));
  const calculatedBalance = total.minus(paid).lessThan(0) ? new Prisma.Decimal(0) : total.minus(paid);
  const balance = voided ? new Prisma.Decimal(0) : calculatedBalance;
  const status = voided ? InvoiceStatus.VOID : balance.isZero() ? InvoiceStatus.PAID : paid.isZero() ? InvoiceStatus.UNPAID : InvoiceStatus.PARTIAL;
  return { amountPaid: paid, balance, status };
}
