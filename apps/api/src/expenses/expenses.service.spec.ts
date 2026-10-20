import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService tenant-scoped updates', () => {
  it('includes businessId in the expense update write', async () => {
    const expense = { id: 'expense-1', businessId: 'business-a', isArchived: false };
    const prisma = {
      expense: { findFirst: jest.fn().mockResolvedValue(expense), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      expenseCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'category-1' }) },
    } as unknown as PrismaService;
    await new ExpensesService(prisma).update('business-a', 'expense-1', {
      categoryId: 'category-1', amount: '12.00', expenseDate: '2020-01-01',
    });
    expect(prisma.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'expense-1', businessId: 'business-a', isArchived: false },
    }));
  });
});
