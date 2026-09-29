export type ApiEnvironment = Record<string, string | undefined>;

export function validateEnvironment(env: ApiEnvironment): ApiEnvironment {
  const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => !env[key]?.trim(),
  );
  if (missing.length) {
    throw new Error(`Missing required API environment variables: ${missing.join(', ')}`);
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }
  return env;
}
