import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy tenant role', () => {
  const validate = async (payloadRole: string, memberRole: string) => {
    const prisma = {
      businessMember: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ businessId: 'business-current', role: memberRole, isActive: true })
          .mockResolvedValueOnce({ id: 'membership-current' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0, isActive: true }) },
    } as unknown as PrismaService;
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    (strategy as any).prisma = prisma;

    return strategy.validate({ sub: 'user-1', email: 'user@example.test', role: payloadRole });
  };

  it.each(['OWNER', 'MANAGER', 'STAFF'])(
    'uses %s from the membership even when the JWT account role is ADMIN',
    async (memberRole) => {
      await expect(validate('ADMIN', memberRole)).resolves.toMatchObject({
        role: memberRole,
        businessId: 'business-current',
      });
    },
  );

  it('does not grant a global ADMIN access to another business where they are STAFF', async () => {
    await expect(validate('ADMIN', 'STAFF')).resolves.toMatchObject({ role: 'STAFF' });
  });

  it('selects only an active business membership for the account', async () => {
    const prisma = {
      businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0, isActive: true }) },
    } as unknown as PrismaService;
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    (strategy as any).prisma = prisma;
    await expect(strategy.validate({ sub: 'user-1', email: 'user@example.test', role: 'STAFF' }))
      .resolves.toMatchObject({ role: null, businessId: undefined });
    expect(prisma.businessMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', isActive: true },
    }));
  });

  it('rejects an account that has memberships but none active', async () => {
    const prisma = {
      businessMember: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'inactive-membership' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0, isActive: true }) },
    } as unknown as PrismaService;
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    (strategy as any).prisma = prisma;
    await expect(strategy.validate({ sub: 'user-1', email: 'user@example.test', role: 'STAFF' }))
      .rejects.toMatchObject({ status: 401 });
  });

  it('rejects an account disabled globally even if it has an active membership', async () => {
    const prisma = {
      businessMember: { findFirst: jest.fn().mockResolvedValue({ businessId: 'business-a', role: 'STAFF' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0, isActive: false }) },
    } as unknown as PrismaService;
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    (strategy as any).prisma = prisma;
    await expect(strategy.validate({ sub: 'user-1', email: 'user@example.test', role: 'STAFF' }))
      .rejects.toMatchObject({ status: 401 });
  });
});
