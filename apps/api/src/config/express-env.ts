import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  WEB_ORIGIN: z.string().url(),
  API_PORT: z.string().optional(),
  API_ORIGIN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  NODE_ENV: z.string().optional(),
}).passthrough().refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
  message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values',
});

export type ExpressEnvironment = z.infer<typeof envSchema>;

export function loadExpressEnvironment(source: NodeJS.ProcessEnv = process.env): ExpressEnvironment {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'WEB_ORIGIN']
      .filter((key) => !source[key]?.trim());
    if (missing.length) {
      throw new Error(`Missing required API environment variables: ${missing.join(', ')}`);
    }
    throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}
