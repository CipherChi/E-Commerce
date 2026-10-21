import { NextFunction, Request, RequestHandler, Response } from 'express';
import { createClient, RedisClientType } from 'redis';

type Bucket = { expiresAt: number; count: number };
const localBuckets = new Map<string, Bucket>();
const clients = new Map<string, RedisClientType>();

export function rateLimit(limit: number, ttlMs: number, redisUrl?: string, prefix = 'route'): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = `${prefix}:${req.ip ?? 'unknown'}`;
      let count: number;
      if (redisUrl) {
        let client = clients.get(redisUrl);
        if (!client) {
          client = createClient({ url: redisUrl });
          client.on('error', () => undefined);
          clients.set(redisUrl, client);
        }
        if (!client.isOpen) await client.connect();
        const redisKey = `throttle:${key}`;
        count = await client.incr(redisKey);
        if (count === 1) await client.pExpire(redisKey, ttlMs);
      } else {
        const now = Date.now();
        const bucket = localBuckets.get(key);
        if (!bucket || bucket.expiresAt <= now) {
          localBuckets.set(key, { expiresAt: now + ttlMs, count: 1 });
          count = 1;
        } else count = ++bucket.count;
      }
      if (count > limit) return next(Object.assign(new Error('Too Many Requests'), { statusCode: 429, response: { statusCode: 429, message: 'Too Many Requests' } }));
      next();
    } catch {
      next(Object.assign(new Error('Rate limiting is unavailable'), { statusCode: 503, response: { statusCode: 503, message: 'Rate limiting is unavailable' } }));
    }
  };
}

export async function closeRateLimitClients() {
  await Promise.all([...clients.values()].filter((client) => client.isOpen).map((client) => client.quit()));
  clients.clear();
}
