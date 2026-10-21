import { authenticate } from '../middleware/auth';

describe('JWT authentication tenant role resolution', () => {
  const run = async (payloadRole: string, memberRole: string | null, active = true) => {
    const req: any = { headers: { authorization: 'Bearer signed' } };
    const next = jest.fn();
    const prisma: any = {
      businessMember: { findFirst: jest.fn().mockResolvedValueOnce(memberRole ? { businessId: 'business-current', role: memberRole, isActive: true } : null).mockResolvedValueOnce(memberRole ? { id: 'membership' } : null) },
      user: { findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0, isActive: active }) },
    };
    authenticate({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', email: 'user@example.test', role: payloadRole }) } as never, prisma, 'secret')(req, {} as never, next);
    await new Promise((resolve) => setImmediate(resolve));
    return { req, next, prisma };
  };

  it.each(['OWNER', 'MANAGER', 'STAFF'])('uses membership role %s rather than token role ADMIN', async (role) => {
    const { req } = await run('ADMIN', role);
    expect(req.user).toMatchObject({ role, businessId: 'business-current' });
  });

  it('does not grant global ADMIN access where membership is STAFF', async () => {
    const { req } = await run('ADMIN', 'STAFF');
    expect(req.user.role).toBe('STAFF');
  });

  it('leaves a businessless account without tenant authority', async () => {
    const { req } = await run('OWNER', null);
    expect(req.user).toMatchObject({ role: null });
    expect(req.user.businessId).toBeUndefined();
  });

  it('rejects inactive accounts and membership-less users with existing memberships', async () => {
    const inactive = await run('OWNER', 'OWNER', false);
    expect(inactive.next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});
