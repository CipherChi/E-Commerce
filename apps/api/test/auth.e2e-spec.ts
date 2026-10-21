import { Express } from 'express';
import * as request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { createApp } from '../src/app';
import { JwtAdapter } from '../src/lib/jwt';

let app: Express;
let jwt: JwtAdapter;
const webOrigin = 'http://localhost:3000';
let clientSequence = 0;

describe('Authentication endpoints', () => {
  const users: any[] = [];
  const loginAttempts = new Map<
    string,
    { failedAttempts: number; firstFailureAt: number; lockedUntil: Date | null }
  >();
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
        return {
          count: keys.reduce(
            (count: number, key: string) => count + Number(loginAttempts.delete(key)),
            0,
          ),
        };
      }),
    },
    $executeRaw: jest.fn(
      (_strings: TemplateStringsArray, key: string, threshold: number, maxLockMs: number) => {
        const now = Date.now();
        const prior = loginAttempts.get(key);
        const withinWindow = prior && now - prior.firstFailureAt < 15 * 60_000;
        const failedAttempts = withinWindow ? prior.failedAttempts + 1 : 1;
        const firstFailureAt = withinWindow ? prior.firstFailureAt : now;
        const lockMs =
          failedAttempts < threshold
            ? 0
            : Math.min(maxLockMs, 1_000 * 2 ** Math.min(failedAttempts - threshold, 12));
        loginAttempts.set(key, {
          failedAttempts,
          firstFailureAt,
          lockedUntil: lockMs ? new Date(now + lockMs) : null,
        });
        return 1;
      },
    ),
    businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_ORIGIN = webOrigin;
    process.env.TRUST_PROXY = '1';
    jwt = new JwtAdapter();
    const auth = new AuthService(prisma as never, jwt, { getOrThrow: (key) => process.env[key]! });
    const methods = new Proxy({}, { get: () => jest.fn() });
    app = createApp({ environment: process.env, logger: { log: jest.fn(), error: jest.fn() }, dependencies: {
      prisma: prisma as never, jwt, auth, controllers: new Proxy({}, { get: () => methods }) as never,
    } as never });
  });
  afterAll(async () => undefined);

  it('rejects invalid registration and unauthenticated profile requests', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'bad', password: 'short', name: '', primaryType: 'HOTEL' })
      .expect(400);
    await request(app)
      .post('/auth/register')
      .send({
        email: 'short-password@example.com',
        password: 'too-short',
        name: 'Short Password',
        primaryType: 'HOTEL',
      })
      .expect(400);
    await request(app).get('/auth/me').expect(401);
  });

  it('registers, logs in, refreshes, returns a sanitized profile, and revokes refresh on logout', async () => {
    const credentials = {
      email: 'auth-flow@example.com',
      name: 'Auth Flow',
      password: 'password12345',
      primaryType: 'HOTEL',
    };
    const registered = await request(app)
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body).toHaveProperty('accessToken');
    expect(registered.body).toEqual({ accessToken: expect.any(String) });
    const login = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '192.0.2.101')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    const loginCookie = cookiePair(login);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Strict/i);
    expect(login.headers['set-cookie'][0]).toMatch(/Path=\/auth/i);
    expect(login.body).toEqual({ accessToken: expect.any(String) });
    const refreshed = await request(app)
      .post('/auth/refresh')
      .set('Origin', webOrigin)
      .set('Cookie', loginCookie)
      .expect(201);
    expect(refreshed.body).toEqual({ accessToken: expect.any(String) });
    const auth = { Authorization: `Bearer ${refreshed.body.accessToken}` };
    const me = await request(app).get('/auth/me').set(auth).expect(200);
    expect(me.body).toMatchObject({
      email: credentials.email,
      name: credentials.name,
      role: null,
      businessId: null,
    });
    const logout = await request(app)
      .post('/auth/logout')
      .set(auth)
      .set('Origin', webOrigin)
       .expect(201);
    expect(logout.headers['set-cookie'][0]).toMatch(/staywise_rt=;/);
    expect(logout.headers['set-cookie'][0]).toMatch(/Path=\/auth/i);
    await request(app).get('/auth/me').set(auth).expect(401);
    await request(app)
      .post('/auth/refresh')
      .set('Origin', webOrigin)
      .set('Cookie', cookiePair(refreshed))
      .expect(401);
  }, 30000);

  it('rejects refresh with missing or foreign Origin and with no cookie', async () => {
    const { cookie } = await createSession();
    await request(app).post('/auth/refresh').set('Cookie', cookie).expect(403);
    await request(app)
      .post('/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', cookie)
      .expect(403);
    await request(app).post('/auth/refresh').set('Origin', webOrigin).expect(401);
  }, 30000);

  it('rotates the refresh cookie and invalidates a replayed cookie', async () => {
    const { cookie } = await createSession();
    const rotated = await request(app)
      .post('/auth/refresh')
      .set('Origin', webOrigin)
      .set('Cookie', cookie)
      .expect(201);
    const rotatedCookie = cookiePair(rotated);
    expect(rotatedCookie).not.toBe(cookie);
    await request(app)
      .post('/auth/refresh')
      .set('Origin', webOrigin)
      .set('Cookie', cookie)
      .expect(401);
  }, 30000);

  it('rejects foreign-origin CORS preflight without allowing the origin', async () => {
    const response = await request(app)
      .options('/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preserves the original DTO behavior for logo and unbounded business name strings', async () => {
    const { accessToken } = await createSession();
    const auth = { Authorization: `Bearer ${accessToken}` };
    await request(app)
      .post('/businesses')
      .set(auth)
      .send({ name: 'x'.repeat(201), primaryType: 'HOTEL', logo: 'http://example.com/logo.png' })
      .expect(201);
  }, 30000);

  it('rejects invalid passwords without revealing account existence', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'password12345' })
      .expect(401);
    await request(app)
      .post('/auth/login')
      .send({ email: 'auth-flow@example.com', password: 'wrong-password-123' })
      .expect(401);
  });

  it('rejects an expired access token', async () => {
    const token = await jwt.signAsync(
        { sub: 'user-1', email: 'auth-flow@example.com', role: 'STAFF', tokenVersion: 0 },
        { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: '-1s' },
      );
    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('returns 429 after repeated invalid login attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'rate-limit@example.com', password: 'invalid-password-123' });
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  }, 30000);
});

function remoteRequest(path: string) {
  clientSequence += 1;
  return request(app)
    .post(path)
    .set('X-Forwarded-For', `192.0.2.${100 + clientSequence}`);
}

function cookiePair(response: { headers: { 'set-cookie'?: string[] } }): string {
  const cookie = response.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('Expected refresh cookie');
  return cookie.split(';', 1)[0];
}

async function createSession() {
  const credentials = {
    email: `session-${Date.now()}-${clientSequence}@example.com`,
    name: 'Session User',
    password: 'password12345',
    primaryType: 'HOTEL',
  };
  await remoteRequest('/auth/register').send(credentials).expect(201);
  const login = await remoteRequest('/auth/login')
    .send({ email: credentials.email, password: credentials.password })
    .expect(201);
  return { cookie: cookiePair(login), accessToken: login.body.accessToken as string };
}
