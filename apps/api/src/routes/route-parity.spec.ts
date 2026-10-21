import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as request from 'supertest';
import { createApp } from '../app';

const planPath = resolve(__dirname, '../../../../docs/express-migration-plan.md');
const routes = [...readFileSync(planPath, 'utf8').matchAll(/^\| (GET|POST|PATCH|DELETE) (\/[^|]+)\|[^|]+\|([^|]+)\|/gm)]
  .map((match) => ({ method: match[1].toLowerCase() as 'get' | 'post' | 'patch' | 'delete', path: match[2].trim(), protected: /JWT/.test(match[3]) }));

describe('documented route parity', () => {
  const environment = { DATABASE_URL: 'postgresql://localhost/test', JWT_ACCESS_SECRET: 'access-secret', JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:3000', NODE_ENV: 'test' };
  const controllerMethods = new Proxy({}, { get: (_target, property) => property === 'publicPdf' ? (_token: string, res: { status: (code: number) => { send: (data: string) => void } }) => res.status(200).send('pdf') : jest.fn().mockResolvedValue({ ok: true }) });
  const controllers = new Proxy({}, { get: () => controllerMethods });
  const auth = { register: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }), login: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }), refresh: jest.fn(), logout: jest.fn(), me: jest.fn() };
  const logger = { log: jest.fn(), error: jest.fn() };
  const app = createApp({ environment, logger, dependencies: {
    prisma: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
    jwt: { verifyAsync: jest.fn() } as never,
    auth: auth as never,
    controllers: controllers as never,
  } as never });

  it('covers every route in the migration plan and protects JWT routes', async () => {
    expect(routes).toHaveLength(83);
    for (const route of routes) {
      const path = route.path.replace(/:([A-Za-z]+)/g, 'fixture');
      let call = request(app)[route.method](path);
      if (route.protected) {
        const response = await call;
        expect(response.status).toBe(401);
      } else {
        if (path === '/auth/refresh') call = call.set('Origin', environment.WEB_ORIGIN);
        if (path === '/auth/register') call = call.send({ email: 'a@example.com', password: 'long-password-123', name: 'A', primaryType: 'HOTEL' });
        if (path === '/auth/login') call = call.send({ email: 'a@example.com', password: 'long-password' });
        const response = await call;
        expect(response.status).not.toBe(404);
      }
    }
  });

  it('logs matched route templates without query strings', async () => {
    await request(app).get('/properties?search=private').expect(401);
    const entry = JSON.parse(logger.log.mock.calls.at(-1)?.[0] as string);
    expect(entry.path).toBe('/properties/');
    expect(entry.path).not.toContain('private');
  });
});
