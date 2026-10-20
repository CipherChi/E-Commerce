import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication endpoints', () => {
  let app: INestApplication;
  const users: any[] = [];
  const loginAttempts = new Map<string, { failedAttempts: number; firstFailureAt: number; lockedUntil: Date | null }>();
  const prisma = {
    user: {
      findUnique: jest.fn(
        ({ where }: any) =>
          users.find((user) => user.id === where.id || user.email === where.email) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const user = {
          id: `user-${users.length + 1}`,
          role: 'STAFF',
          isActive: true,
          propertyId: null,
          tokenVersion: 0,
          failedLoginAttempts: 0,
          loginLockedUntil: null,
          refreshTokenHash: null,
          ...data,
        };
        users.push(user);
        return user;
      }),
      update: jest.fn(({ where, data }: any) => {
        const user = users.find((entry) => entry.id === where.id);
        const { tokenVersion, ...fields } = data;
        Object.assign(user, fields);
        if (tokenVersion?.increment) user.tokenVersion += tokenVersion.increment;
        else if (typeof tokenVersion === 'number') user.tokenVersion = tokenVersion;
        return user;
      }),
    },
    loginAttempt: {
      findUnique: jest.fn(({ where }: any) => loginAttempts.get(where.key) ?? null),
      deleteMany: jest.fn(({ where }: any) => {
        const keys = Array.isArray(where.key?.in) ? where.key.in : [where.key];
        return { count: keys.reduce((count: number, key: string) => count + Number(loginAttempts.delete(key)), 0) };
      }),
    },
    $executeRaw: jest.fn((_strings: TemplateStringsArray, key: string, threshold: number, maxLockMs: number) => {
      const now = Date.now();
      const prior = loginAttempts.get(key);
      const withinWindow = prior && now - prior.firstFailureAt < 15 * 60_000;
      const failedAttempts = withinWindow ? prior.failedAttempts + 1 : 1;
      const firstFailureAt = withinWindow ? prior.firstFailureAt : now;
      const lockMs = failedAttempts < threshold
        ? 0
        : Math.min(maxLockMs, 1_000 * 2 ** Math.min(failedAttempts - threshold, 12));
      loginAttempts.set(key, { failedAttempts, firstFailureAt, lockedUntil: lockMs ? new Date(now + lockMs) : null });
      return 1;
    }),
    businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  afterAll(async () => app.close());

  it('rejects invalid registration and unauthenticated profile requests', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bad', password: 'short', name: '', primaryType: 'HOTEL' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'short-password@example.com',
        password: 'too-short',
        name: 'Short Password',
        primaryType: 'HOTEL',
      })
      .expect(400);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('registers, logs in, refreshes, returns a sanitized profile, and revokes refresh on logout', async () => {
    const credentials = {
      email: 'auth-flow@example.com',
      name: 'Auth Flow',
      password: 'password12345',
      primaryType: 'HOTEL',
    };
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body.user).not.toHaveProperty('passwordHash');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    const auth = { Authorization: `Bearer ${refreshed.body.accessToken}` };
    const me = await request(app.getHttpServer()).get('/auth/me').set(auth).expect(200);
    expect(me.body).toMatchObject({
      email: credentials.email,
      name: credentials.name,
      role: null,
      businessId: null,
    });
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(auth)
      .expect(201)
      .expect({ success: true });
    await request(app.getHttpServer()).get('/auth/me').set(auth).expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
  }, 30000);

  it('rejects invalid passwords without revealing account existence', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'password12345' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'auth-flow@example.com', password: 'wrong-password-123' })
      .expect(401);
  });

  it('rejects an expired access token', async () => {
    const token = await app.get(JwtService).signAsync(
      { sub: 'user-1', email: 'auth-flow@example.com', role: 'STAFF', tokenVersion: 0 },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('returns 429 after repeated invalid login attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'rate-limit@example.com', password: 'invalid-password-123' });
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  }, 30000);
});
