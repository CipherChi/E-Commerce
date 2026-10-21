import { ConflictException, UnauthorizedException } from '../lib/http-errors';
import { AuthService } from './auth.service';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'guest@example.com',
    name: 'Guest',
    role: 'STAFF',
    isActive: true,
    tokenVersion: 0,
    passwordHash: 'hashed',
    refreshTokenHash: null,
  };
  const prisma: any = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    loginAttempt: { findUnique: jest.fn().mockResolvedValue(null), deleteMany: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const jwt: any = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: user.id }),
  };
  const config: any = { getOrThrow: jest.fn((key) => key) };
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(argon2, 'hash').mockResolvedValue('test-argon-hash');
    service = new AuthService(prisma, jwt, config);
  });

  it('registers with a hashed password and returns session tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    const result = await service.register({
      email: user.email,
      name: user.name,
      password: 'password123',
      primaryType: 'HOTEL' as never,
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    );
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.register({
        email: user.email,
        name: user.name,
        password: 'password123',
        primaryType: 'HOTEL' as never,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records failures, applies progressive lockout, and returns the same login error', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    await expect(
      service.login({ email: user.email, password: 'incorrect' }, '192.0.2.1'),
    ).rejects.toThrow('Invalid email or password');
    const [sqlParts, , threshold, maxLockMs] = prisma.$executeRaw.mock.calls[0];
    expect(sqlParts).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ON CONFLICT ("key") DO UPDATE'),
        expect.stringContaining("INTERVAL '15 minutes'"),
        expect.stringContaining('LEAST('),
      ]),
    );
    expect(threshold).toBe(5);
    expect(maxLockMs).toBe(900_000);
    expect(prisma.loginAttempt.findUnique.mock.calls[0][0].where.key).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.$executeRaw.mock.calls[1][2]).toBe(10);
    expect(prisma.$executeRaw.mock.calls[1][3]).toBe(60_000);
  });

  it('returns identical generic errors for unknown, wrong-password, and locked attempts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const verify = jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    const unknownError = await service
      .login({ email: 'missing@example.test', password: 'incorrect' })
      .catch((error) => error);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.loginAttempt.findUnique.mockResolvedValue(null);
    const wrongPasswordError = await service
      .login({ email: user.email, password: 'incorrect' })
      .catch((error) => error);
    prisma.loginAttempt.findUnique.mockResolvedValue({
      key: 'locked',
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const lockedError = await service
      .login({ email: user.email, password: 'incorrect' })
      .catch((error) => error);
    for (const error of [wrongPasswordError, lockedError]) {
      expect(error.getStatus()).toBe(unknownError.getStatus());
      expect(error.message).toBe(unknownError.message);
    }
    expect(unknownError.message).toBe('Invalid email or password');
    expect(verify).toHaveBeenCalledTimes(3);
    const dummyHash = await (service as any).dummyPasswordHash;
    expect(verify.mock.calls[0][0]).toBe(dummyHash);
    expect(verify.mock.calls[1][0]).toBe(user.passwordHash);
    expect(verify.mock.calls[2][0]).toBe(dummyHash);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(4);
  });

  it('resets failed-login state after a successful login', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.loginAttempt.findUnique.mockResolvedValue({ key: 'some-key', lockedUntil: null });
    prisma.loginAttempt.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
    await service.login({ email: user.email, password: 'correct' });
    expect(prisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: [expect.any(String), expect.any(String)] } },
    });
  });

  it('uses separate lockout counters for different client IPs', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.loginAttempt.findUnique.mockResolvedValue(null);
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    await expect(
      service.login({ email: user.email, password: 'bad' }, '192.0.2.1'),
    ).rejects.toThrow();
    await expect(
      service.login({ email: user.email, password: 'bad' }, '192.0.2.2'),
    ).rejects.toThrow();
    const keys = prisma.loginAttempt.findUnique.mock.calls.map((call: any[]) => call[0].where.key);
    expect(keys[0]).not.toBe(keys[2]);
    expect(keys[1]).toBe(keys[3]);
  });

  it('returns the business-member role rather than the account role from /auth/me', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: user.id,
      isActive: true,
      email: user.email,
      name: user.name,
      propertyId: null,
      memberships: [
        { businessId: 'business-1', role: 'MANAGER', business: { name: 'Business 1' } },
      ],
    });

    await expect(service.me(user.id)).resolves.toMatchObject({
      role: 'MANAGER',
      businessId: 'business-1',
      business: { name: 'Business 1' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ memberships: expect.any(Object) }),
      }),
    );
  });

  it('rotates a valid refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, refreshTokenHash: 'stored-hash' });
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, tokenVersion: 0 });
    prisma.user.update.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
    jest.spyOn(argon2, 'hash').mockResolvedValue('new-hash');
    const result = await service.refresh(user.id, 'refresh-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refreshTokenHash: 'new-hash' } }),
    );
  });

  it('invalidates the session when a validly signed rotated refresh token is replayed', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, refreshTokenHash: 'newer-hash' });
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, tokenVersion: 0 });
    prisma.user.update.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);

    await expect(service.refresh(user.id, 'replayed-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  });

  it('rejects refresh tokens revoked by staff deactivation', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      tokenVersion: 1,
      refreshTokenHash: null,
    });
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, tokenVersion: 0 });
    await expect(service.refresh(user.id, 'old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('stores only a hash of the issued refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    jest.spyOn(argon2, 'hash').mockResolvedValue('argon2-refresh-hash');
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('plain-refresh-token');

    const session = await service.register({
      email: user.email,
      name: user.name,
      password: 'a-strong-password',
      primaryType: 'HOTEL' as never,
    });

    expect(session.refreshToken).toBe('plain-refresh-token');
    const tokenStorage = prisma.user.update.mock.calls.find(
      (call: any[]) => call[0].data.refreshTokenHash,
    );
    expect(tokenStorage[0]).toEqual({
      where: { id: user.id },
      data: { refreshTokenHash: 'argon2-refresh-hash' },
    });
    expect(tokenStorage[0].data.refreshTokenHash).not.toBe(session.refreshToken);
  });
});
