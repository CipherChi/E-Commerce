import * as request from 'supertest';
import { createApp } from '../app';

describe('Express auth routes', () => {
  const environment = {
    DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:3000', NODE_ENV: 'test',
  };
  const auth = {
    register: jest.fn().mockResolvedValue({ accessToken: 'access-register', refreshToken: 'refresh-register' }),
    login: jest.fn().mockResolvedValue({ accessToken: 'access-login', refreshToken: 'refresh-login' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'access-new', refreshToken: 'refresh-new' }),
    logout: jest.fn().mockResolvedValue(undefined), me: jest.fn().mockResolvedValue({ id: 'u1' }),
  };
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', tokenVersion: 0 }) };
  const prisma = {
    businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, tokenVersion: 0 }) },
  };
  const app = () => createApp({ environment, logger: { log: jest.fn(), error: jest.fn() }, dependencies: { auth: auth as never, jwt: jwt as never, prisma: prisma as never, controllers: {} as never } as never });

  beforeEach(() => jest.clearAllMocks());

  it('keeps refresh tokens in HttpOnly SameSite strict /auth cookies only', async () => {
    const response = await request(app()).post('/auth/login').send({ email: 'a@example.com', password: 'password123' }).expect(201);
    expect(response.body).toEqual({ accessToken: 'access-login' });
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(response.headers['set-cookie'][0]).toContain('Path=/auth');
    expect(response.headers['set-cookie'][0]).toContain('refresh-login');
  });

  it('rejects missing/mismatched origins, rotates refresh cookie, and logs out with 204', async () => {
    await request(app()).post('/auth/refresh').expect(403);
    const refreshed = await request(app()).post('/auth/refresh').set('Origin', 'https://bad.test').expect(403);
    expect(refreshed.body.statusCode).toBe(403);
    const rotated = await request(app()).post('/auth/refresh').set('Origin', environment.WEB_ORIGIN).set('Cookie', 'staywise_rt=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1MSJ9.signature').expect(201);
    expect(rotated.body).toEqual({ accessToken: 'access-new' });
    expect(rotated.headers['set-cookie'][0]).toContain('refresh-new');
    const logout = await request(app()).post('/auth/logout').set('Origin', environment.WEB_ORIGIN).set('Authorization', 'Bearer access').expect(204);
    expect(logout.text).toBe('');
    expect(auth.logout).toHaveBeenCalledWith('u1');
  });

  it('rejects unknown input properties with the shared validation envelope', async () => {
    const response = await request(app()).post('/auth/login').send({ email: 'a@example.com', password: 'password123', extra: true }).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, path: '/auth/login', requestId: expect.any(String) });
    expect(auth.login).not.toHaveBeenCalled();
  });
});
