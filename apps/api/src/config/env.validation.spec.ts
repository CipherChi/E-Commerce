import { loadExpressEnvironment } from './express-env';

describe('loadExpressEnvironment', () => {
  const complete = {
    DATABASE_URL: 'postgresql://localhost/app', JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32), WEB_ORIGIN: 'http://localhost:3000',
  };
  it('returns validated configuration', () => {
    expect(loadExpressEnvironment(complete)).toMatchObject(complete);
  });

  it.each([
    ['DATABASE_URL', { JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) }],
    ['JWT_ACCESS_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_REFRESH_SECRET: 'b'.repeat(32) }],
    ['JWT_REFRESH_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_ACCESS_SECRET: 'a'.repeat(32) }],
    [
      'WEB_ORIGIN',
      {
        DATABASE_URL: 'postgresql://localhost/app',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      },
    ],
  ])('fails API boot validation when %s is absent', (key, env) => {
    expect(() => loadExpressEnvironment(env as Record<string, string>)).toThrow(
      `Missing required API environment variables: ${key}`,
    );
  });

  it('rejects reused JWT secrets with a clear message', () => {
    expect(() =>
      loadExpressEnvironment({
        DATABASE_URL: 'postgresql://localhost/app',
        JWT_ACCESS_SECRET: 's'.repeat(32),
        JWT_REFRESH_SECRET: 's'.repeat(32),
        WEB_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  });

  it('rejects short JWT secrets without echoing their values', () => {
    const secret = 'too-short-secret';
    expect(() => loadExpressEnvironment({ ...complete, JWT_ACCESS_SECRET: secret })).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters/);
    try { loadExpressEnvironment({ ...complete, JWT_ACCESS_SECRET: secret }); }
    catch (error) { expect((error as Error).message).not.toContain(secret); }
  });

});
