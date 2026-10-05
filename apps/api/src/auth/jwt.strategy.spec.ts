import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy tenant role', () => {
  const validate = async (payloadRole: string, memberRole: string) => {
    const prisma = {
      businessMember: {
        findFirst: jest.fn().mockResolvedValue({ businessId: 'business-current', role: memberRole }),
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
});
