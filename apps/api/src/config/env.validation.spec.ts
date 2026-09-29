import { validateEnvironment } from './env.validation';
import { ConfigModule } from '@nestjs/config';

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

  it.each(['DATABASE_URL', 'JWT_ACCESS_SECRET'])('fails ConfigModule boot clearly when %s is missing', async (missing) => {
    const keys = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.DATABASE_URL = 'postgresql://localhost/app';
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    delete process.env[missing];

    try {
      await expect(
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      ).rejects.toThrow(`Missing required API environment variables: ${missing}`);
    } finally {
      for (const key of keys) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key]!;
      }
    }
  });
});
