import { NotFoundException } from '../lib/http-errors';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from './businesses.service';

describe('BusinessesService staff membership status', () => {
  it('deactivates only the staff membership in the selected business', async () => {
    const memberships = [
      { businessId: 'business-a', userId: 'staff-1', role: 'STAFF', isActive: true },
      { businessId: 'business-b', userId: 'staff-1', role: 'STAFF', isActive: true },
    ];
    const user = { id: 'staff-1', name: 'Staff', email: 'staff@example.test', createdAt: new Date() };
    const tx = { businessMember: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = memberships.find((entry) => entry.businessId === where.businessId && entry.userId === where.userId && entry.role === where.role);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const row = memberships.find((entry) => entry.businessId === where.businessId && entry.userId === where.userId && entry.role === where.role);
        return row ? { ...row, user } : null;
      }),
    }, user: { update: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: (fn: (db: any) => unknown) => fn(tx) } as unknown as PrismaService;
    const service = new BusinessesService(prisma);
    await expect(service.setStaffActive('business-a', 'staff-1', false)).resolves.toMatchObject({
      businessId: 'business-a', user: { id: 'staff-1', isActive: false },
    });
    expect(tx.businessMember.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'business-a', userId: 'staff-1', role: 'STAFF' }, data: { isActive: false },
    });
    expect(memberships).toEqual([
      expect.objectContaining({ businessId: 'business-a', isActive: false }),
      expect.objectContaining({ businessId: 'business-b', isActive: true }),
    ]);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' }, data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  });

  it('does not update a matching user membership in another business', async () => {
    const tx = { businessMember: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst: jest.fn(),
    }, user: { update: jest.fn() } };
    const prisma = { $transaction: (fn: (db: any) => unknown) => fn(tx) } as unknown as PrismaService;
    await expect(new BusinessesService(prisma).setStaffActive('business-a', 'staff-1', false))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(tx.businessMember.findFirst).not.toHaveBeenCalled();
  });
});
