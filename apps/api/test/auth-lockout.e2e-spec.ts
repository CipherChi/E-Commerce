import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthService } from '../src/auth/auth.service';
import { UnauthorizedException } from '../src/lib/http-errors';
import { createContainer } from '../src/lib/container';

const databaseUrl = process.env.TENANT_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set TENANT_TEST_DATABASE_URL to a dedicated migrated Postgres test database.');
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = 'tenant-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'tenant-test-refresh-secret';

describe('Login lockout (real Postgres)', () => {
  let auth: AuthService;
  let prisma: PrismaClient;
  let container: ReturnType<typeof createContainer>;
  let userId: string;
  let email: string;
  let unknownEmail: string;
  const password = 'tenant-test-password-123';
  const ip = '198.51.100.73';
  let key: string;
  let accountKey: string;
  const attemptKeys: string[] = [];

  beforeAll(async () => {
    container = createContainer(process.env);
    auth = container.auth;
    prisma = container.prisma;
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    email = `lockout-${suffix}@example.test`;
    const session = await auth.register({ email, name: 'Lockout test', password, primaryType: 'HOTEL' });
    userId = session.user.id;
    key = createHash('sha256').update(`login-ip\0${userId}\0${ip}`).digest('hex');
    accountKey = createHash('sha256').update(`login-account\0${email.toLowerCase()}`).digest('hex');
    attemptKeys.push(key, accountKey);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.loginAttempt.deleteMany({ where: { key: { in: attemptKeys } } });
      if (unknownEmail) {
        const unknownKeys = [
          createHash('sha256').update(`login-ip\0${unknownEmail.toLowerCase()}\0${ip}`).digest('hex'),
          createHash('sha256').update(`login-account\0${unknownEmail.toLowerCase()}`).digest('hex'),
        ];
        await prisma.loginAttempt.deleteMany({ where: { key: { in: unknownKeys } } });
      }
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma?.$disconnect();
  });

  it('returns one generic error for unknown, wrong-password, and locked attempts', async () => {
    const errorOf = async (promise: Promise<unknown>): Promise<InstanceType<typeof UnauthorizedException>> => {
      try {
        await promise;
      } catch (error) {
        if (error instanceof UnauthorizedException) return error;
        throw error;
      }
      throw new Error('Expected login to fail');
    };
    unknownEmail = `missing-${Date.now()}@example.test`;
    const unknown = await errorOf(auth.login({ email: unknownEmail, password }, ip));
    const wrong = await errorOf(auth.login({ email, password: 'wrong-password-123' }, ip));
    for (let failure = 1; failure < 5; failure += 1) {
      await auth.login({ email, password: 'wrong-password-123' }, ip).catch(() => undefined);
    }
    const attempt = await prisma.loginAttempt.findUniqueOrThrow({ where: { key } });
    expect(attempt.failedAttempts).toBe(5);
    expect(attempt.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(attempt.lockedUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    const locked = await errorOf(auth.login({ email, password }, ip));

    for (const error of [unknown, wrong, locked]) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.message).toBe('Invalid email or password');
    }
  });

  it('isolates counters by client IP and clears them on successful login', async () => {
    const otherKey = createHash('sha256').update(`login-ip\0${userId}\0${ip}-other`).digest('hex');
    attemptKeys.push(otherKey);
    await auth.login({ email, password: 'wrong-password-123' }, `${ip}-other`).catch(() => undefined);
    expect(await prisma.loginAttempt.findUnique({ where: { key: otherKey } })).toMatchObject({ failedAttempts: 1 });
    await auth.login({ email, password }, `${ip}-other`);
    expect(await prisma.loginAttempt.findUnique({ where: { key: otherKey } })).toBeNull();

    await prisma.loginAttempt.update({
      where: { key },
      data: { failedAttempts: 4, firstFailureAt: new Date(Date.now() - 16 * 60_000), lockedUntil: null },
    });
    await auth.login({ email, password: 'wrong-password-123' }, ip).catch(() => undefined);
    const decayed = await prisma.loginAttempt.findUniqueOrThrow({ where: { key } });
    expect(decayed.failedAttempts).toBe(1);
    expect(decayed.firstFailureAt.getTime()).toBeGreaterThan(Date.now() - 60_000);

    await prisma.loginAttempt.update({
      where: { key },
      data: { failedAttempts: 5, firstFailureAt: new Date(), lockedUntil: null },
    });
    await auth.login({ email, password: 'wrong-password-123' }, ip).catch(() => undefined);
    const progressive = await prisma.loginAttempt.findUniqueOrThrow({ where: { key } });
    const progressiveDelay = progressive.lockedUntil!.getTime() - Date.now();
    expect(progressive.failedAttempts).toBe(6);
    expect(progressiveDelay).toBeGreaterThan(1_500);
    expect(progressiveDelay).toBeLessThanOrEqual(2_000);

    await prisma.loginAttempt.update({
      where: { key },
      data: { failedAttempts: 100, firstFailureAt: new Date(), lockedUntil: null },
    });
    await auth.login({ email, password: 'wrong-password-123' }, ip).catch(() => undefined);
    const capped = await prisma.loginAttempt.findUniqueOrThrow({ where: { key } });
    expect(capped.lockedUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);

    await prisma.loginAttempt.update({ where: { key }, data: { lockedUntil: new Date(Date.now() - 1) } });
    await auth.login({ email, password }, ip);
    expect(await prisma.loginAttempt.findUnique({ where: { key } })).toBeNull();
  });

  it('applies a capped progressive account-wide delay across different IPs', async () => {
    for (let failure = 0; failure < 10; failure += 1) {
      const clientIp = `198.51.100.${100 + failure}`;
      attemptKeys.push(createHash('sha256').update(`login-ip\0${userId}\0${clientIp}`).digest('hex'));
      await auth.login({ email, password: 'wrong-password-123' }, clientIp)
        .catch(() => undefined);
    }
    const firstGlobalLock = await prisma.loginAttempt.findUniqueOrThrow({ where: { key: accountKey } });
    expect(firstGlobalLock.failedAttempts).toBe(10);
    expect(firstGlobalLock.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await prisma.loginAttempt.update({
      where: { key: accountKey },
      data: { failedAttempts: 100, firstFailureAt: new Date(), lockedUntil: null },
    });
    const cappedIp = '198.51.100.250';
    attemptKeys.push(createHash('sha256').update(`login-ip\0${userId}\0${cappedIp}`).digest('hex'));
    await auth.login({ email, password: 'wrong-password-123' }, cappedIp).catch(() => undefined);
    const cappedGlobalLock = await prisma.loginAttempt.findUniqueOrThrow({ where: { key: accountKey } });
    expect(cappedGlobalLock.lockedUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});
