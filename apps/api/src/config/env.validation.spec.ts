import { loadExpressEnvironment } from './express-env';

describe('loadExpressEnvironment', () => {
  const complete = {
    DATABASE_URL: 'postgresql://localhost/app', JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:3000',
  };
  it('returns validated configuration', () => {
    expect(loadExpressEnvironment(complete)).toMatchObject(complete);
  });

  it.each([
    ['DATABASE_URL', { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b' }],
    ['JWT_ACCESS_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_REFRESH_SECRET: 'b' }],
    ['JWT_REFRESH_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_ACCESS_SECRET: 'a' }],
    [
      'WEB_ORIGIN',
      {
        DATABASE_URL: 'postgresql://localhost/app',
        JWT_ACCESS_SECRET: 'a',
        JWT_REFRESH_SECRET: 'b',
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
        JWT_ACCESS_SECRET: 'same',
        JWT_REFRESH_SECRET: 'same',
        WEB_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  });

});
