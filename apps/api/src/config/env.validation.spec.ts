import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('returns a complete environment unchanged', () => {
    const env = {
      DATABASE_URL: 'postgresql://localhost/app',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };
    expect(validateEnvironment(env)).toBe(env);
  });

  it.each([
    ['DATABASE_URL', { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b' }],
    ['JWT_ACCESS_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_REFRESH_SECRET: 'b' }],
    ['JWT_REFRESH_SECRET', { DATABASE_URL: 'postgresql://localhost/app', JWT_ACCESS_SECRET: 'a' }],
  ])('fails API boot validation when %s is absent', (key, env) => {
    expect(() => validateEnvironment(env as Record<string, string>)).toThrow(
      `Missing required API environment variables: ${key}`,
    );
  });

  it('rejects reused JWT secrets with a clear message', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost/app',
        JWT_ACCESS_SECRET: 'same',
        JWT_REFRESH_SECRET: 'same',
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  });
});
